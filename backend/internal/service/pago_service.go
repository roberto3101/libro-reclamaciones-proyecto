package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

// PagoService orquesta el cobro: valida el plan, cobra, deja constancia
// en la tabla pagos y recién entonces activa la suscripción.
//
// El orden importa. Primero se registra el pago y después se activa: si la
// activación falla, la plata cobrada quedó anotada y se puede reconciliar.
// Al revés perderíamos el rastro de un cobro real.
type PagoService struct {
	culqi       *CulqiClient
	mp          *MercadoPagoClient
	pagoRepo    PagoRepositorio
	planSvc     *PlanService
	suscripcion *SuscripcionService
}

// PagoRepositorio es lo que el servicio necesita del repo. Interfaz para
// poder testear el flujo sin base de datos.
type PagoRepositorio interface {
	Crear(ctx context.Context, p *model.Pago) error
	ObtenerPorReferencia(ctx context.Context, proveedor, referencia string) (*model.Pago, error)
	ListarPorTenant(ctx context.Context, tenantID uuid.UUID, limite int) ([]model.Pago, error)
	RegistrarEvento(ctx context.Context, proveedor, eventoID, tipo string, payload []byte) (bool, error)
	MarcarEventoProcesado(ctx context.Context, proveedor, eventoID string) error
}

func NewPagoService(
	culqi *CulqiClient,
	mp *MercadoPagoClient,
	pagoRepo PagoRepositorio,
	planSvc *PlanService,
	suscripcion *SuscripcionService,
) *PagoService {
	return &PagoService{
		culqi:       culqi,
		mp:          mp,
		pagoRepo:    pagoRepo,
		planSvc:     planSvc,
		suscripcion: suscripcion,
	}
}

var (
	ErrCulqiDeshabilitado = apperror.New(http.StatusServiceUnavailable, "CULQI_DESHABILITADO",
		"El cobro con tarjeta no está configurado todavía.")
	ErrMPDeshabilitado = apperror.New(http.StatusServiceUnavailable, "MP_DESHABILITADO",
		"El cobro por suscripción no está configurado todavía.")
	ErrCicloInvalido = apperror.New(http.StatusBadRequest, "CICLO_INVALIDO",
		"El ciclo debe ser MENSUAL o ANUAL.")
	ErrPlanSinPrecioAnual = apperror.New(http.StatusBadRequest, "PLAN_SIN_PRECIO_ANUAL",
		"Ese plan no tiene precio anual configurado.")
	ErrPlanGratuito = apperror.New(http.StatusBadRequest, "PLAN_GRATUITO",
		"Ese plan es gratuito, no requiere pago.")
	ErrPagoDuplicado = apperror.New(http.StatusConflict, "PAGO_DUPLICADO",
		"Ese pago ya fue registrado antes.")
	ErrProveedorInvalido = apperror.New(http.StatusBadRequest, "PROVEEDOR_INVALIDO",
		"Proveedor de pago no reconocido.")
)

// CobrarTarjetaParams son los datos que llegan del checkout.
type CobrarTarjetaParams struct {
	TenantID   uuid.UUID
	UsuarioID  uuid.UUID
	TokenID    string // tkn_xxx que generó Culqi.js en el navegador
	PlanCodigo string
	Ciclo      string
	Email      string
}

// CobrarConTarjeta ejecuta el cobro en Culqi y activa el plan si sale bien.
func (s *PagoService) CobrarConTarjeta(ctx context.Context, p CobrarTarjetaParams) (*model.Pago, error) {
	if !s.culqi.Habilitado() {
		return nil, ErrCulqiDeshabilitado
	}

	plan, monto, err := s.resolverPlanYMonto(ctx, p.PlanCodigo, p.Ciclo)
	if err != nil {
		return nil, err
	}

	descripcion := fmt.Sprintf("%s — %s", plan.Nombre, strings.ToLower(p.Ciclo))

	cargo, errCargo := s.culqi.CrearCargo(ctx, CargoRequest{
		TokenID:     p.TokenID,
		MontoSoles:  monto,
		Email:       p.Email,
		Descripcion: descripcion,
		Metadata: map[string]string{
			"tenant_id":   p.TenantID.String(),
			"plan_codigo": plan.Codigo,
			"ciclo":       p.Ciclo,
		},
	})

	// Rechazo de la pasarela: se registra igual, para saber cuántos intentos fallan.
	if errCargo != nil {
		var ce *CulqiError
		if errors.As(errCargo, &ce) {
			fallido := &model.Pago{
				TenantID:     p.TenantID,
				PlanID:       plan.ID,
				Proveedor:    model.ProveedorCulqi,
				Monto:        monto,
				Moneda:       "PEN",
				Ciclo:        p.Ciclo,
				Estado:       model.PagoFallido,
				Email:        model.NullString{NullString: sql.NullString{String: p.Email, Valid: p.Email != ""}},
				Descripcion:  model.NullString{NullString: sql.NullString{String: descripcion, Valid: true}},
				ErrorCodigo:  model.NullString{NullString: sql.NullString{String: ce.Codigo, Valid: ce.Codigo != ""}},
				ErrorMensaje: model.NullString{NullString: sql.NullString{String: ce.MsgComercio, Valid: ce.MsgComercio != ""}},
			}
			_ = s.pagoRepo.Crear(ctx, fallido)

			return nil, apperror.New(http.StatusPaymentRequired, "PAGO_RECHAZADO", ce.ParaCliente())
		}
		return nil, errCargo
	}

	ahora := time.Now()
	pago := &model.Pago{
		TenantID:          p.TenantID,
		PlanID:            plan.ID,
		Proveedor:         model.ProveedorCulqi,
		ReferenciaExterna: model.NullString{NullString: sql.NullString{String: cargo.ID, Valid: true}},
		Monto:             monto,
		Moneda:            "PEN",
		Ciclo:             p.Ciclo,
		Estado:            model.PagoPagado,
		Email:             model.NullString{NullString: sql.NullString{String: p.Email, Valid: p.Email != ""}},
		Descripcion:       model.NullString{NullString: sql.NullString{String: descripcion, Valid: true}},
		Payload:           cargo.Bruto,
		RegistradoPor:     model.NullUUID{UUID: p.UsuarioID, Valid: p.UsuarioID != uuid.Nil},
		FechaPago:         model.NullTime{NullTime: sql.NullTime{Time: ahora, Valid: true}},
	}

	if err := s.pagoRepo.Crear(ctx, pago); err != nil {
		// El cobro ya salió. No devolvemos error al cliente por un fallo de
		// escritura nuestro: se resuelve conciliando contra el panel de Culqi.
		return nil, fmt.Errorf("pago cobrado en culqi (%s) pero no se pudo registrar: %w", cargo.ID, err)
	}

	notas := fmt.Sprintf("Pago Culqi %s por S/ %.2f", cargo.ID, monto)
	if _, err := s.suscripcion.ActivarManual(ctx, p.TenantID, plan.Codigo, p.Ciclo, notas, p.UsuarioID); err != nil {
		return pago, fmt.Errorf("pago registrado pero la activación falló: %w", err)
	}

	return pago, nil
}

// SuscribirMPParams son los datos para dar de alta el cobro recurrente.
type SuscribirMPParams struct {
	TenantID     uuid.UUID
	UsuarioID    uuid.UUID
	PlanCodigo   string
	Ciclo        string
	Email        string
	TokenTarjeta string // Generado en el navegador por el SDK de Mercado Pago
	URLRetorno   string
}

// SuscribirConMercadoPago crea la suscripción recurrente y activa el plan.
//
// A diferencia de CobrarConTarjeta (Culqi), acá no volvemos a cobrar cada mes:
// Mercado Pago lo hace por su cuenta y reintenta si la tarjeta rebota. El
// webhook nos avisa de cada cobro para dejar constancia en la tabla pagos.
func (s *PagoService) SuscribirConMercadoPago(ctx context.Context, p SuscribirMPParams) (*model.Pago, string, error) {
	if s.mp == nil || !s.mp.Habilitado() {
		return nil, "", ErrMPDeshabilitado
	}

	plan, monto, err := s.resolverPlanYMonto(ctx, p.PlanCodigo, p.Ciclo)
	if err != nil {
		return nil, "", err
	}

	tipoFrec := MPFrecuenciaMensual
	if p.Ciclo == model.CicloAnual {
		tipoFrec = MPFrecuenciaAnual
	}

	motivo := fmt.Sprintf("%s — %s", plan.Nombre, strings.ToLower(p.Ciclo))

	sus, errMP := s.mp.CrearSuscripcion(ctx, CrearSuscripcionRequest{
		Motivo:            motivo,
		EmailPagador:      p.Email,
		MontoSoles:        monto,
		Frecuencia:        1,
		TipoFrecuencia:    tipoFrec,
		TokenTarjeta:      p.TokenTarjeta,
		URLRetorno:        p.URLRetorno,
		ReferenciaExterna: p.TenantID.String(),
	})
	if errMP != nil {
		var me *MPError
		if errors.As(errMP, &me) {
			fallido := &model.Pago{
				TenantID:     p.TenantID,
				PlanID:       plan.ID,
				Proveedor:    model.ProveedorMercadoPago,
				Monto:        monto,
				Moneda:       "PEN",
				Ciclo:        p.Ciclo,
				Estado:       model.PagoFallido,
				Email:        model.NullString{NullString: sql.NullString{String: p.Email, Valid: p.Email != ""}},
				Descripcion:  model.NullString{NullString: sql.NullString{String: motivo, Valid: true}},
				ErrorMensaje: model.NullString{NullString: sql.NullString{String: me.Error(), Valid: true}},
			}
			if errReg := s.pagoRepo.Crear(ctx, fallido); errReg != nil {
				// No tapamos este fallo: sin la fila no queda rastro del
				// intento y depurar se vuelve adivinar.
				log.Printf("[pagos] no se pudo registrar el intento fallido de MP: %v (error original: %v)", errReg, me)
			}

			// Un fallo de integración no es culpa de la tarjeta del cliente.
			// Lo devolvemos como error del servidor para que no quede
			// disfrazado de rechazo bancario en los reportes.
			if me.EsProblemaDeConfiguracion() {
				log.Printf("[pagos] mercadopago rechazo por configuracion: %v", me)
				return nil, "", apperror.New(http.StatusBadGateway, "SUSCRIPCION_NO_DISPONIBLE", me.ParaCliente())
			}
			return nil, "", apperror.New(http.StatusPaymentRequired, "SUSCRIPCION_RECHAZADA", me.ParaCliente())
		}
		return nil, "", errMP
	}

	// status "authorized" significa que el primer cobro ya salió.
	estado := model.PagoPendiente
	var fechaPago model.NullTime
	if strings.EqualFold(sus.Status, "authorized") {
		estado = model.PagoPagado
		fechaPago = model.NullTime{NullTime: sql.NullTime{Time: time.Now(), Valid: true}}
	}

	pago := &model.Pago{
		TenantID:          p.TenantID,
		PlanID:            plan.ID,
		Proveedor:         model.ProveedorMercadoPago,
		ReferenciaExterna: model.NullString{NullString: sql.NullString{String: sus.ID, Valid: sus.ID != ""}},
		Monto:             monto,
		Moneda:            "PEN",
		Ciclo:             p.Ciclo,
		Estado:            estado,
		Email:             model.NullString{NullString: sql.NullString{String: p.Email, Valid: p.Email != ""}},
		Descripcion:       model.NullString{NullString: sql.NullString{String: motivo, Valid: true}},
		Payload:           sus.Bruto,
		RegistradoPor:     model.NullUUID{UUID: p.UsuarioID, Valid: p.UsuarioID != uuid.Nil},
		FechaPago:         fechaPago,
	}

	if err := s.pagoRepo.Crear(ctx, pago); err != nil {
		return nil, "", fmt.Errorf("suscripcion creada en mercadopago (%s) pero no se pudo registrar: %w", sus.ID, err)
	}

	// Solo activamos si el cobro ya se autorizó. Si quedó pendiente, la
	// activación llegará por webhook cuando Mercado Pago confirme.
	if estado == model.PagoPagado {
		notas := fmt.Sprintf("Suscripcion Mercado Pago %s por S/ %.2f", sus.ID, monto)
		if _, err := s.suscripcion.ActivarManual(ctx, p.TenantID, plan.Codigo, p.Ciclo, notas, p.UsuarioID); err != nil {
			return pago, sus.InitPoint, fmt.Errorf("pago registrado pero la activación falló: %w", err)
		}
	}

	return pago, sus.InitPoint, nil
}

// CancelarSuscripcionMP detiene los cobros futuros en Mercado Pago.
func (s *PagoService) CancelarSuscripcionMP(ctx context.Context, suscripcionMPID string) error {
	if s.mp == nil || !s.mp.Habilitado() {
		return ErrMPDeshabilitado
	}
	return s.mp.CancelarSuscripcion(ctx, suscripcionMPID)
}

// MPHabilitado indica si hay credenciales de Mercado Pago cargadas.
func (s *PagoService) MPHabilitado() bool {
	return s.mp != nil && s.mp.Habilitado()
}

// LlavePublicaMP la necesita el navegador para tokenizar la tarjeta.
func (s *PagoService) LlavePublicaMP() string {
	if s.mp == nil {
		return ""
	}
	return s.mp.PublicKey()
}

// RegistrarManualParams cubre Yape, transferencia y activación a dedo.
type RegistrarManualParams struct {
	TenantID   uuid.UUID
	UsuarioID  uuid.UUID
	Proveedor  string // YAPE | TRANSFERENCIA | MANUAL
	Referencia string // Código de operación de Yape o nº de transferencia
	PlanCodigo string
	Ciclo      string
	Email      string
	Notas      string
}

// RegistrarPagoManual deja constancia de un cobro fuera de la pasarela.
//
// Esta es la vía que permite cobrar desde hoy: el cliente yapea, se anota la
// operación y se activa. Sin esperar a integrar nada.
func (s *PagoService) RegistrarPagoManual(ctx context.Context, p RegistrarManualParams) (*model.Pago, error) {
	// Culqi y Mercado Pago tienen su propio flujo: acá solo entra lo cobrado
	// fuera de una pasarela.
	if !model.EsProveedorValido(p.Proveedor) ||
		p.Proveedor == model.ProveedorCulqi ||
		p.Proveedor == model.ProveedorMercadoPago {
		return nil, ErrProveedorInvalido
	}

	plan, monto, err := s.resolverPlanYMonto(ctx, p.PlanCodigo, p.Ciclo)
	if err != nil {
		return nil, err
	}

	if p.Referencia != "" {
		existente, err := s.pagoRepo.ObtenerPorReferencia(ctx, p.Proveedor, p.Referencia)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		if existente != nil {
			return nil, ErrPagoDuplicado
		}
	}

	ahora := time.Now()
	descripcion := fmt.Sprintf("%s — %s (%s)", plan.Nombre, strings.ToLower(p.Ciclo), p.Proveedor)

	pago := &model.Pago{
		TenantID:          p.TenantID,
		PlanID:            plan.ID,
		Proveedor:         p.Proveedor,
		ReferenciaExterna: model.NullString{NullString: sql.NullString{String: p.Referencia, Valid: p.Referencia != ""}},
		Monto:             monto,
		Moneda:            "PEN",
		Ciclo:             p.Ciclo,
		Estado:            model.PagoPagado,
		Email:             model.NullString{NullString: sql.NullString{String: p.Email, Valid: p.Email != ""}},
		Descripcion:       model.NullString{NullString: sql.NullString{String: descripcion, Valid: true}},
		RegistradoPor:     model.NullUUID{UUID: p.UsuarioID, Valid: p.UsuarioID != uuid.Nil},
		FechaPago:         model.NullTime{NullTime: sql.NullTime{Time: ahora, Valid: true}},
	}

	if err := s.pagoRepo.Crear(ctx, pago); err != nil {
		return nil, err
	}

	notas := p.Notas
	if notas == "" {
		notas = fmt.Sprintf("Pago %s ref %s por S/ %.2f", p.Proveedor, p.Referencia, monto)
	}
	if _, err := s.suscripcion.ActivarManual(ctx, p.TenantID, plan.Codigo, p.Ciclo, notas, p.UsuarioID); err != nil {
		return pago, fmt.Errorf("pago registrado pero la activación falló: %w", err)
	}

	return pago, nil
}

func (s *PagoService) ListarPorTenant(ctx context.Context, tenantID uuid.UUID, limite int) ([]model.Pago, error) {
	return s.pagoRepo.ListarPorTenant(ctx, tenantID, limite)
}

// ProcesarEventoWebhook guarda el evento y avisa si toca procesarlo.
// Culqi reintenta mientras no reciba un 200, así que la idempotencia
// no es opcional.
func (s *PagoService) ProcesarEventoWebhook(ctx context.Context, eventoID, tipo string, payload []byte) (bool, error) {
	if eventoID == "" {
		return false, apperror.New(http.StatusBadRequest, "EVENTO_SIN_ID", "El evento no trae identificador.")
	}

	nuevo, err := s.pagoRepo.RegistrarEvento(ctx, model.ProveedorCulqi, eventoID, tipo, payload)
	if err != nil {
		return false, err
	}
	if !nuevo {
		return false, nil // Ya lo vimos antes; responder 200 y no hacer nada.
	}

	if err := s.pagoRepo.MarcarEventoProcesado(ctx, model.ProveedorCulqi, eventoID); err != nil {
		return true, err
	}
	return true, nil
}

// LlavePublica la necesita el frontend para montar el checkout.
func (s *PagoService) LlavePublica() string {
	return s.culqi.PublicKey()
}

func (s *PagoService) CulqiHabilitado() bool {
	return s.culqi.Habilitado()
}

// resolverPlanYMonto traduce código de plan + ciclo a un monto en soles.
func (s *PagoService) resolverPlanYMonto(ctx context.Context, codigo, ciclo string) (*model.Plan, float64, error) {
	ciclo = strings.ToUpper(strings.TrimSpace(ciclo))
	if ciclo != model.CicloMensual && ciclo != model.CicloAnual {
		return nil, 0, ErrCicloInvalido
	}

	plan, err := s.planSvc.GetByCodigo(ctx, strings.ToUpper(strings.TrimSpace(codigo)))
	if err != nil {
		return nil, 0, err
	}
	if plan == nil {
		return nil, 0, apperror.New(http.StatusNotFound, "PLAN_NO_ENCONTRADO", "El plan indicado no existe.")
	}

	monto := plan.PrecioMensual
	if ciclo == model.CicloAnual {
		if !plan.PrecioAnual.Valid {
			return nil, 0, ErrPlanSinPrecioAnual
		}
		monto = plan.PrecioAnual.Float64
	}

	if monto <= 0 {
		return nil, 0, ErrPlanGratuito
	}

	return plan, monto, nil
}
