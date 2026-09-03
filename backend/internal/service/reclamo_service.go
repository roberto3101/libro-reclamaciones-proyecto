package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"html"
	"strings"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/google/uuid"
)

type ReclamoService struct {
	reclamoRepo     *repo.ReclamoRepo
	historialRepo   *repo.HistorialRepo
	tenantRepo      *repo.TenantRepo
	sedeRepo        *repo.SedeRepo
	dashboardRepo   *repo.DashboardRepo
	notifService    *NotificacionService
	notifTiempoReal *NotificacionTiempoRealService
}

func (s *ReclamoService) SetNotificacionTiempoReal(svc *NotificacionTiempoRealService) {
	s.notifTiempoReal = svc
}

func NewReclamoService(
	reclamoRepo *repo.ReclamoRepo,
	historialRepo *repo.HistorialRepo,
	tenantRepo *repo.TenantRepo,
	sedeRepo *repo.SedeRepo,
	dashboardRepo *repo.DashboardRepo,
	notifService *NotificacionService,
) *ReclamoService {
	return &ReclamoService{
		reclamoRepo:   reclamoRepo,
		historialRepo: historialRepo,
		tenantRepo:    tenantRepo,
		sedeRepo:      sedeRepo,
		dashboardRepo: dashboardRepo,
		notifService:  notifService,
	}
}

func (s *ReclamoService) GetByTenant(ctx context.Context, tenantID uuid.UUID, pag dto.PaginationRequest, f repo.FiltrosListado) ([]model.Reclamo, int, error) {
	return s.reclamoRepo.GetByTenant(ctx, tenantID, pag, f)
}





func (s *ReclamoService) ObtenerParaExportacion(ctx context.Context, filtros repo.FiltrosExportacion) ([]model.Reclamo, error) {
	return s.reclamoRepo.ObtenerParaExportacion(ctx, filtros)
}



func (s *ReclamoService) GetByCodigoPublico(ctx context.Context, tenantID uuid.UUID, codigo string) (*model.Reclamo, error) {
	return s.reclamoRepo.GetByCodigoPublico(ctx, tenantID, codigo)
}

func (s *ReclamoService) GetByID(ctx context.Context, tenantID, reclamoID uuid.UUID) (*model.Reclamo, error) {
	rec, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("reclamo_service.GetByID: %w", err)
	}
	if rec == nil {
		return nil, apperror.ErrNotFound
	}
	return rec, nil
}

// CrearPublico crea un reclamo desde el formulario público (sin auth).
func (s *ReclamoService) CrearPublico(ctx context.Context, tenantSlug string, req dto.CreateReclamoRequest, ip, userAgent string) (*model.Reclamo, error) {
	// 1. Buscar tenant por slug
	tenant, err := s.tenantRepo.GetBySlug(ctx, tenantSlug)
	if err != nil {
		return nil, fmt.Errorf("reclamo_service.CrearPublico tenant: %w", err)
	}
	if tenant == nil || !tenant.Activo {
		return nil, apperror.ErrNotFound
	}

	// 2. Validar límite del plan
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenant.TenantID)
	if err != nil {
		return nil, fmt.Errorf("reclamo_service.CrearPublico uso: %w", err)
	}
	if uso == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	if !uso.CanCreateReclamo() {
		return nil, apperror.ErrPlanLimitReclamos.Withf(uso.LimiteReclamosMes)
	}

	// 3. Resolver sede
	var sede *model.Sede
	if req.SedeSlug != "" {
		sede, err = s.sedeRepo.GetBySlug(ctx, tenant.TenantID, req.SedeSlug)
		if err != nil {
			return nil, fmt.Errorf("reclamo_service.CrearPublico sede: %w", err)
		}
	}

	// 4. Generar código
	sedeSlug := ""
	if sede != nil {
		sedeSlug = sede.Slug
	}
	codigo := helper.GenerateCodigoReclamo(tenant.Slug, sedeSlug)

	// 5. Validar fecha del incidente
	fechaIncidente, err := time.Parse("2006-01-02", req.FechaIncidente)
	if err != nil {
		return nil, apperror.New(400, "FECHA_INVALIDA", "La fecha del incidente no tiene un formato válido (YYYY-MM-DD)")
	}
	if fechaIncidente.After(time.Now()) {
		return nil, apperror.New(400, "FECHA_FUTURA", "La fecha del incidente no puede ser posterior a hoy")
	}
	limiteAnterior := time.Now().AddDate(-2, 0, 0)
	if fechaIncidente.Before(limiteAnterior) {
		return nil, apperror.New(400, "FECHA_MUY_ANTIGUA", "La fecha del incidente no puede tener más de 2 años de antigüedad (Art. 121, Ley 29571)")
	}

	// Calcular fecha límite (sanitizar plazo por seguridad)
	plazo := tenant.PlazoRespuestaDias
	if plazo < 1 || plazo > 90 {
		plazo = 15
	}
	fechaLimite := helper.CalcularFechaLimite(time.Now(), plazo)

	// 6. Sanitizar campos de texto contra XSS/inyección de código
	san := html.EscapeString
	req.NombreCompleto = san(strings.TrimSpace(req.NombreCompleto))
	req.NumeroDocumento = san(strings.TrimSpace(req.NumeroDocumento))
	req.Telefono = san(strings.TrimSpace(req.Telefono))
	req.Email = strings.TrimSpace(req.Email)
	req.Domicilio = san(strings.TrimSpace(req.Domicilio))
	req.Departamento = san(strings.TrimSpace(req.Departamento))
	req.Provincia = san(strings.TrimSpace(req.Provincia))
	req.Distrito = san(strings.TrimSpace(req.Distrito))
	req.NombreApoderado = san(strings.TrimSpace(req.NombreApoderado))
	req.DescripcionBien = san(strings.TrimSpace(req.DescripcionBien))
	req.NumeroPedido = san(strings.TrimSpace(req.NumeroPedido))
	req.AreaQueja = san(strings.TrimSpace(req.AreaQueja))
	req.DescripcionSituacion = san(strings.TrimSpace(req.DescripcionSituacion))
	req.DetalleReclamo = san(strings.TrimSpace(req.DetalleReclamo))
	req.PedidoConsumidor = san(strings.TrimSpace(req.PedidoConsumidor))

	// 7. Construir reclamo con snapshots
	reclamo := &model.Reclamo{
		TenantModel:   model.TenantModel{TenantID: tenant.TenantID},
		CodigoReclamo: codigo,
		TipoSolicitud: req.TipoSolicitud,
		Estado:        model.EstadoPendiente,

		NombreCompleto:  req.NombreCompleto,
		TipoDocumento:   req.TipoDocumento,
		NumeroDocumento: req.NumeroDocumento,
		Telefono:        req.Telefono,
		Email:           req.Email,
		Domicilio:       model.NullString{NullString: sql.NullString{String: req.Domicilio, Valid: req.Domicilio != ""}},
		Departamento:    model.NullString{NullString: sql.NullString{String: req.Departamento, Valid: req.Departamento != ""}},
		Provincia:       model.NullString{NullString: sql.NullString{String: req.Provincia, Valid: req.Provincia != ""}},
		Distrito:        model.NullString{NullString: sql.NullString{String: req.Distrito, Valid: req.Distrito != ""}},
		MenorDeEdad:     req.MenorDeEdad,
		NombreApoderado: model.NullString{NullString: sql.NullString{String: req.NombreApoderado, Valid: req.NombreApoderado != ""}},

		// Snapshot proveedor
		RazonSocialProveedor: model.NullString{NullString: sql.NullString{String: tenant.RazonSocial, Valid: true}},
		RUCProveedor:         model.NullString{NullString: sql.NullString{String: tenant.RUC, Valid: true}},
		DireccionProveedor:   model.NullString{NullString: sql.NullString{String: tenant.DireccionLegal.String, Valid: tenant.DireccionLegal.Valid}},

		TipoBien:        model.NullString{NullString: sql.NullString{String: req.TipoBien, Valid: req.TipoBien != ""}},
		MontoReclamado:  model.NullFloat64{NullFloat64: sql.NullFloat64{Float64: req.MontoReclamado, Valid: req.MontoReclamado > 0}},
		DescripcionBien: req.DescripcionBien,
		NumeroPedido:    model.NullString{NullString: sql.NullString{String: req.NumeroPedido, Valid: req.NumeroPedido != ""}},

		AreaQueja:            model.NullString{NullString: sql.NullString{String: req.AreaQueja, Valid: req.AreaQueja != ""}},
		DescripcionSituacion: model.NullString{NullString: sql.NullString{String: req.DescripcionSituacion, Valid: req.DescripcionSituacion != ""}},

		FechaIncidente:   fechaIncidente,
		DetalleReclamo:   req.DetalleReclamo,
		PedidoConsumidor: req.PedidoConsumidor,

		FirmaDigital: model.NullString{NullString: sql.NullString{String: req.FirmaDigital, Valid: req.FirmaDigital != ""}},
		IPAddress:    model.NullString{NullString: sql.NullString{String: ip, Valid: ip != ""}},
		UserAgent:    model.NullString{NullString: sql.NullString{String: userAgent, Valid: userAgent != ""}},

		FechaLimiteRespuesta: model.NullTime{NullTime: sql.NullTime{Time: fechaLimite, Valid: true}},
		CanalOrigen:          model.CanalWeb,
		EsClienteRegistrado:    req.EsClienteRegistrado,
	}

	// Archivos adjuntos
	if len(req.ArchivosAdjuntos) > 0 {
		adjuntosJSON, err := json.Marshal(req.ArchivosAdjuntos)
		if err == nil {
			raw := json.RawMessage(adjuntosJSON)
			reclamo.ArchivosAdjuntos = &raw
		}
	}

	// Snapshot sede
	if sede != nil {
		reclamo.SedeID = model.NullUUID{UUID: sede.ID, Valid: true}
		reclamo.SedeNombre = model.NullString{NullString: sql.NullString{String: sede.Nombre, Valid: true}}
		reclamo.SedeDireccion = model.NullString{NullString: sql.NullString{String: sede.Direccion, Valid: true}}
	}

	// 7. Insertar reclamo + historial en una sola transacción atómica.
	//    Si falla cualquiera de los dos, se revierte todo.
	if err := repo.EjecutarEnTransaccion(ctx, s.reclamoRepo.BaseDeDatos(), func(tx *sql.Tx) error {
		reclamoTx := s.reclamoRepo.ConTransaccion(tx)
		historialTx := s.historialRepo.ConTransaccion(tx)

		if err := reclamoTx.Create(ctx, reclamo); err != nil {
			return fmt.Errorf("insertar reclamo: %w", err)
		}

		historial := &model.Historial{
			TenantModel: model.TenantModel{TenantID: tenant.TenantID},
			ReclamoID:   reclamo.ID,
			EstadoNuevo: model.EstadoPendiente,
			TipoAccion:  model.AccionCreacion,
			IPAddress:   model.NullString{NullString: sql.NullString{String: ip, Valid: ip != ""}},
		}
		if err := historialTx.Create(ctx, historial); err != nil {
			return fmt.Errorf("registrar historial de creacion: %w", err)
		}

		return nil
	}); err != nil {
		return nil, fmt.Errorf("reclamo_service.CrearPublico transaccion: %w", err)
	}

	// 9. Notificaciones por Email (Asíncrono)
	fechaFormateada := reclamo.FechaRegistro.Format("02/01/2006 15:04")

	// 9a. Confirmación al CLIENTE
	if tenant.NotificarEmail && reclamo.Email != "" {
		go func() {
			bgCtx := context.Background()
			_ = s.notifService.EnviarNotificacionReclamo(
				bgCtx,
				reclamo.Email,
				tenant,
				reclamo.CodigoReclamo,
				reclamo.NombreCompleto,
				fechaFormateada,
			)
		}()
	}

	// 9b. Notificación a la EMPRESA (email_contacto del tenant)
	if tenant.NotificarEmail && tenant.EmailContacto.Valid && tenant.EmailContacto.String != "" {
		go func() {
			bgCtx := context.Background()
			_ = s.notifService.EnviarNotificacionNuevoReclamoEmpresa(
				bgCtx,
				tenant.EmailContacto.String,
				tenant,
				reclamo.CodigoReclamo,
				reclamo.NombreCompleto,
				reclamo.TipoSolicitud,
				fechaFormateada,
			)
		}()
	}

	// 10. Notificación en tiempo real al panel admin
	if s.notifTiempoReal != nil {
		sedeNombre := ""
		if sede != nil {
			sedeNombre = sede.Nombre
		}
		go s.notifTiempoReal.EmitirNotificacion(
			tenant.TenantID, model.NotifReclamoNuevoRegistrado,
			"Nuevo reclamo registrado",
			fmt.Sprintf("Nuevo %s #%s de %s", strings.ToLower(reclamo.TipoSolicitud), reclamo.CodigoReclamo, reclamo.NombreCompleto),
			ws.DatosReclamoNuevoRegistrado{
				ReclamoID:     reclamo.ID.String(),
				CodigoReclamo: reclamo.CodigoReclamo,
				TipoSolicitud: reclamo.TipoSolicitud,
				NombreCliente: reclamo.NombreCompleto,
				SedeNombre:    sedeNombre,
			}, nil,
		)
	}

	return reclamo, nil
}

func (s *ReclamoService) CambiarEstado(ctx context.Context, tenantID, reclamoID, userID uuid.UUID, nuevoEstado, comentario, ip string) error {
	reclamo, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return fmt.Errorf("reclamo_service.CambiarEstado: %w", err)
	}
	if reclamo == nil {
		return apperror.ErrNotFound
	}

	estadoAnterior := reclamo.Estado

	// Actualizar estado + registrar historial en una sola transacción atómica.
	if err := repo.EjecutarEnTransaccion(ctx, s.reclamoRepo.BaseDeDatos(), func(tx *sql.Tx) error {
		reclamoTx := s.reclamoRepo.ConTransaccion(tx)
		historialTx := s.historialRepo.ConTransaccion(tx)

		if err := reclamoTx.UpdateEstado(ctx, tenantID, reclamoID, nuevoEstado, &userID); err != nil {
			return fmt.Errorf("actualizar estado del reclamo: %w", err)
		}

		historial := &model.Historial{
			TenantModel:    model.TenantModel{TenantID: tenantID},
			ReclamoID:      reclamoID,
			EstadoAnterior: model.NullString{NullString: sql.NullString{String: estadoAnterior, Valid: true}},
			EstadoNuevo:    nuevoEstado,
			TipoAccion:     model.AccionCambioEstado,
			Comentario:     model.NullString{NullString: sql.NullString{String: comentario, Valid: comentario != ""}},
			UsuarioAccion:  model.NullUUID{UUID: userID, Valid: true},
			IPAddress:      model.NullString{NullString: sql.NullString{String: ip, Valid: ip != ""}},
		}
		if err := historialTx.Create(ctx, historial); err != nil {
			return fmt.Errorf("registrar historial de cambio de estado: %w", err)
		}

		return nil
	}); err != nil {
		return fmt.Errorf("reclamo_service.CambiarEstado transaccion: %w", err)
	}

	// Notificar al cliente por email (respeta toggle notificar_email_estado)
	if reclamo.Email != "" {
		go func() {
			bgCtx := context.Background()

			t, errT := s.tenantRepo.GetByTenantID(bgCtx, tenantID)
			if errT != nil || t == nil {
				return // Sin tenant no podemos verificar el toggle
			}

			if !t.NotificarEmailEstado {
				return
			}

			// Limpiar estado para legibilidad: "EN_PROCESO" -> "EN PROCESO"
			estadoLegible := strings.ReplaceAll(nuevoEstado, "_", " ")

			errEnvio := s.notifService.EnviarNotificacionCambioEstado(
				bgCtx,
				reclamo.Email,
				t,
				reclamo.CodigoReclamo,
				reclamo.NombreCompleto,
				estadoLegible,
			)
			if errEnvio != nil {
				fmt.Printf("[ERROR SMTP CambiarEstado] %v\n", errEnvio)
			}
		}()
	}

	// Notificación en tiempo real
	fmt.Printf("[CAMBIO-ESTADO-DEBUG] notifTiempoReal == nil? %v\n", s.notifTiempoReal == nil)
	if s.notifTiempoReal != nil {
		fmt.Printf("[CAMBIO-ESTADO-DEBUG] Emitiendo notificación: tenant=%s, reclamo=%s, %s→%s, excluir_user=%s\n",
			tenantID, reclamo.CodigoReclamo, estadoAnterior, nuevoEstado, userID)
		go s.notifTiempoReal.EmitirNotificacion(
			tenantID, model.NotifReclamoEstadoCambiado,
			"Estado de reclamo cambiado",
			fmt.Sprintf("Reclamo #%s cambió de %s a %s", reclamo.CodigoReclamo, estadoAnterior, nuevoEstado),
			ws.DatosReclamoEstadoCambiado{
				ReclamoID:      reclamoID.String(),
				CodigoReclamo:  reclamo.CodigoReclamo,
				EstadoAnterior: estadoAnterior,
				EstadoNuevo:    nuevoEstado,
			}, &userID,
		)
		// Notificar al seguimiento público
		s.notifTiempoReal.EmitirEventoSeguimientoPublico(tenantID.String(), reclamo.CodigoReclamo,
			ws.EventoSeguimientoEstadoActualizado,
			ws.DatosSeguimientoPublico{
				CodigoReclamo: reclamo.CodigoReclamo,
				EstadoNuevo:   nuevoEstado,
				TipoEvento:    "ESTADO_CAMBIADO",
			},
		)
	}

	return nil
}

func (s *ReclamoService) Asignar(ctx context.Context, tenantID, reclamoID, adminID, userID uuid.UUID, ip string) error {
	reclamo, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return fmt.Errorf("reclamo_service.Asignar: %w", err)
	}
	if reclamo == nil {
		return apperror.ErrNotFound
	}

	// Asignar asesor + registrar historial en una sola transacción atómica.
	if err := repo.EjecutarEnTransaccion(ctx, s.reclamoRepo.BaseDeDatos(), func(tx *sql.Tx) error {
		reclamoTx := s.reclamoRepo.ConTransaccion(tx)
		historialTx := s.historialRepo.ConTransaccion(tx)

		if err := reclamoTx.Asignar(ctx, tenantID, reclamoID, adminID); err != nil {
			return fmt.Errorf("asignar asesor al reclamo: %w", err)
		}

		historial := &model.Historial{
			TenantModel:    model.TenantModel{TenantID: tenantID},
			ReclamoID:      reclamoID,
			EstadoAnterior: model.NullString{NullString: sql.NullString{String: reclamo.Estado, Valid: true}},
			EstadoNuevo:    reclamo.Estado,
			TipoAccion:     model.AccionAsignacion,
			Comentario:     model.NullString{NullString: sql.NullString{String: fmt.Sprintf("Asignado a %s", adminID), Valid: true}},
			UsuarioAccion:  model.NullUUID{UUID: userID, Valid: true},
			IPAddress:      model.NullString{NullString: sql.NullString{String: ip, Valid: ip != ""}},
		}
		if err := historialTx.Create(ctx, historial); err != nil {
			return fmt.Errorf("registrar historial de asignacion: %w", err)
		}

		return nil
	}); err != nil {
		return fmt.Errorf("reclamo_service.Asignar transaccion: %w", err)
	}

	// Notificar al asesor asignado en tiempo real (solo si no se auto-asigna)
	if s.notifTiempoReal != nil && adminID != userID {
		go s.notifTiempoReal.EmitirNotificacionAUsuario(
			tenantID, adminID,
			model.NotifReclamoAsignado,
			"Reclamo asignado a tu cargo",
			fmt.Sprintf("El reclamo #%s ha sido asignado a tu cargo.", reclamo.CodigoReclamo),
			map[string]interface{}{
				"reclamo_id":     reclamoID.String(),
				"codigo_reclamo": reclamo.CodigoReclamo,
			},
		)
	}

	return nil
}

// nullStr helper inline para construir sql.NullString.
func nullStr(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}