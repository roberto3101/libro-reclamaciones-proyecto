package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

/*
Demo de un minuto.

Quien llega desde un anuncio no conoce la marca, así que pedirle RUC y
contraseña antes de enseñarle nada es pedirle una confianza que todavía no
tiene: la mayoría cierra la pestaña. Este servicio le da una empresa
completa y desechable, con datos dentro, sin pedirle un solo dato.

Cada visitante recibe la SUYA, no una compartida. Con una compartida, el
segundo visitante lee lo que escribió el primero, y en un demo abierto a
internet eso acaba en contenido que no quieres enseñarle a un cliente.

Las empresas de demostración cuelgan todas de una misma cuenta. Así se
distinguen del negocio real sin añadir columnas al esquema, y la limpieza
sabe exactamente qué puede borrar.
*/

// CuentaDemo agrupa todas las empresas de demostración. El identificador es
// fijo a propósito: así la limpieza sabe dónde mirar sin depender de un
// nombre que alguien pueda cambiar desde el panel.
var CuentaDemo = uuid.MustParse("d3305a1e-0000-4000-8000-000000000001")

// VigenciaDemo es cuánto sobrevive una empresa de demostración. Dos días da
// margen para que alguien la abra el viernes y la revise el domingo.
const VigenciaDemo = 48 * time.Hour

type DemoService struct {
	db          *sql.DB
	onboarding  *OnboardingService
	jwt         config.JWTConfig
}

func NewDemoService(db *sql.DB, onboarding *OnboardingService, jwt config.JWTConfig) *DemoService {
	return &DemoService{db: db, onboarding: onboarding, jwt: jwt}
}

// ResultadoDemo es lo que necesita el navegador para entrar directamente.
type ResultadoDemo struct {
	Token       string    `json:"token"`
	TenantID    uuid.UUID `json:"tenant_id"`
	// El navegador lo necesita para armar la sesión igual que en un login
	// normal. Sin él, las pantallas que filtran por usuario —"Mis
	// asignaciones", por ejemplo— no llegan ni a pedir datos.
	UsuarioID   uuid.UUID `json:"usuario_id"`
	Slug        string    `json:"slug"`
	RazonSocial string    `json:"razon_social"`
	Email       string    `json:"email"`
	Nombre      string    `json:"nombre"`
	ExpiraEn    time.Time `json:"expira_en"`
}

// Negocios verosímiles. Un demo llamado "Empresa de Prueba SAC" se siente
// como una maqueta; uno llamado "Pollería El Rincón del Norte" se siente
// como el negocio del visitante.
var negociosDemo = []struct {
	Razon    string
	Comercial string
	Direccion string
	Distrito  string
}{
	{"Pollería El Rincón del Norte SAC", "El Rincón del Norte", "Av. Universitaria 2145", "Los Olivos"},
	{"Botica Salud Total EIRL", "Botica Salud Total", "Jr. Puno 388", "Cercado de Lima"},
	{"Minimarket La Esquina SAC", "La Esquina", "Av. Brasil 1720", "Pueblo Libre"},
	{"Restaurante Sazón Criolla SRL", "Sazón Criolla", "Av. La Marina 2380", "San Miguel"},
	{"Veterinaria Patitas Felices EIRL", "Patitas Felices", "Av. Benavides 1455", "Miraflores"},
	{"Gimnasio Fuerza Andina SAC", "Fuerza Andina", "Av. Arequipa 3250", "San Isidro"},
}

// Reclamos de muestra. Cubren los cuatro estados en los que puede estar un
// caso, para que el visitante vea de un vistazo cómo se ve su bandeja llena
// —incluido uno a punto de vencer, que es el argumento de venta—.
var reclamosDemo = []struct {
	Estado          string
	DiasDesdeIngreso int // hace cuántos días entró
	Tipo            string
	Nombre          string
	Documento       string
	Telefono        string
	Email           string
	Bien            string
	Detalle         string
	Pedido          string
	Monto           float64
}{
	{
		Estado: model.EstadoPendiente, DiasDesdeIngreso: 13, Tipo: "RECLAMO",
		Nombre: "Rosa Meléndez Chávez", Documento: "08745219",
		Telefono: "987654321", Email: "rosa.melendez@correo.pe",
		Bien:    "Menú familiar para llevar",
		Detalle: "Pedí el menú familiar para cuatro personas y al llegar a casa faltaban dos porciones. Llamé al local y no me contestaron en toda la tarde.",
		Pedido:  "Solicito la devolución del monto o que completen el pedido.",
		Monto:   68.00,
	},
	{
		Estado: model.EstadoEnProceso, DiasDesdeIngreso: 5, Tipo: "RECLAMO",
		Nombre: "Julio Ramírez Ponce", Documento: "45120983",
		Telefono: "912345678", Email: "julio.ramirez@correo.pe",
		Bien:    "Servicio de delivery",
		Detalle: "El pedido llegó una hora y media tarde y frío. Pagué recargo por entrega rápida.",
		Pedido:  "Devolución del recargo de entrega.",
		Monto:   12.00,
	},
	{
		Estado: model.EstadoResuelto, DiasDesdeIngreso: 2, Tipo: "QUEJA",
		Nombre: "Milagros Ttito Quispe", Documento: "70998234",
		Telefono: "976543210", Email: "milagros.ttito@correo.pe",
		Bien:    "Atención en caja",
		Detalle: "La persona de caja atendió de mala manera cuando pregunté por el comprobante electrónico.",
		Pedido:  "Solicito que se converse con el personal sobre el trato al cliente.",
		Monto:   0,
	},
	{
		Estado: model.EstadoCerrado, DiasDesdeIngreso: 22, Tipo: "RECLAMO",
		Nombre: "Enrique Salazar Vega", Documento: "10456789",
		Telefono: "998877665", Email: "enrique.salazar@correo.pe",
		Bien:    "Producto en mal estado",
		Detalle: "Compré un paquete de embutidos con fecha vencida. Lo noté al abrirlo en casa.",
		Pedido:  "Cambio del producto y revisión de las fechas en góndola.",
		Monto:   24.50,
	},
}

// Crear levanta una empresa de demostración completa y devuelve la sesión ya
// iniciada. El visitante no escribe nada: entra y ve el sistema funcionando.
func (s *DemoService) Crear(ctx context.Context) (*ResultadoDemo, error) {
	if err := s.asegurarCuenta(ctx); err != nil {
		return nil, err
	}

	negocio := negociosDemo[aleatorio(len(negociosDemo))]
	sufijo := sufijoCorto()

	// El RUC lleva el sufijo para no chocar con otro demo activo. Empieza por
	// 20, que es el prefijo de persona jurídica, para que se vea creíble.
	ruc := "20" + sufijo + fmt.Sprintf("%03d", aleatorio(1000))
	for len(ruc) < 11 {
		ruc += "0"
	}
	ruc = ruc[:11]

	email := fmt.Sprintf("demo.%s@reclamatiendo.pe", strings.ToLower(sufijo))

	res, err := s.onboarding.Registrar(ctx, OnboardingRequest{
		CuentaID:       CuentaDemo,
		RazonSocial:    negocio.Razon,
		RUC:            ruc,
		Email:          email,
		Password:       "demo-" + sufijo,
		NombreAdmin:    "Administrador de la demostración",
		Telefono:       "+51 987 654 321",
		DireccionLegal: negocio.Direccion,
		EsTrial:        true,
	})
	if err != nil {
		return nil, fmt.Errorf("demo: no se pudo crear la empresa: %w", err)
	}

	// Los reclamos de muestra son lo que convierte el demo en algo que se
	// entiende. Un panel vacío no enseña nada; ese fue justo el problema que
	// tenía una empresa recién creada.
	if err := s.sembrarReclamos(ctx, res.TenantID, res.Slug); err != nil {
		// No se aborta: es preferible un demo con el panel vacío a ningún demo.
		log.Printf("[demo] no se pudieron sembrar los reclamos de %s: %v", res.Slug, err)
	}

	token, err := middleware.GenerateToken(res.TenantID, res.Usuario.ID, res.Usuario.Rol, s.jwt)
	if err != nil {
		return nil, fmt.Errorf("demo: no se pudo emitir la sesión: %w", err)
	}

	return &ResultadoDemo{
		Token:       token,
		TenantID:    res.TenantID,
		UsuarioID:   res.Usuario.ID,
		Slug:        res.Slug,
		RazonSocial: negocio.Razon,
		Email:       email,
		Nombre:      negocio.Comercial,
		ExpiraEn:    time.Now().Add(VigenciaDemo),
	}, nil
}

// asegurarCuenta crea la cuenta paraguas la primera vez que alguien pide un
// demo. Es idempotente: si ya está, no hace nada.
func (s *DemoService) asegurarCuenta(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO cuentas (id, nombre, email_contacto, notas, activo)
		VALUES ($1, 'Demostraciones', 'demo@reclamatiendo.pe',
		        'Cuenta paraguas de los demos publicos. Las empresas que cuelgan de aqui se borran solas a las 48 horas.', true)
		ON CONFLICT (id) DO NOTHING`, CuentaDemo)
	if err != nil {
		return fmt.Errorf("demo: no se pudo preparar la cuenta: %w", err)
	}
	return nil
}

func (s *DemoService) sembrarReclamos(ctx context.Context, tenantID uuid.UUID, slug string) error {
	var sedeID uuid.UUID
	var sedeSlug string
	err := s.db.QueryRowContext(ctx,
		`SELECT id, slug FROM sedes WHERE tenant_id = $1 ORDER BY fecha_creacion LIMIT 1`,
		tenantID).Scan(&sedeID, &sedeSlug)
	if err != nil {
		return fmt.Errorf("sede principal no encontrada: %w", err)
	}

	ahora := time.Now()
	for _, r := range reclamosDemo {
		ingreso := ahora.AddDate(0, 0, -r.DiasDesdeIngreso)
		limite := helper.CalcularFechaLimite(ingreso, 15)

		reclamoID := uuid.New()
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO reclamos (
				tenant_id, id, sede_id, codigo_reclamo, tipo_solicitud, estado,
				nombre_completo, tipo_documento, numero_documento, telefono, email,
				descripcion_bien, monto_reclamado, fecha_incidente,
				detalle_reclamo, pedido_consumidor,
				acepta_terminos, acepta_copia, es_cliente_registrado,
				fecha_registro, fecha_limite_respuesta
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				$7, 'DNI', $8, $9, $10,
				$11, $12, $13,
				$14, $15,
				true, true, false,
				$16, $17
			)`,
			tenantID, reclamoID, sedeID,
			helper.GenerateCodigoReclamo(slug, sedeSlug),
			r.Tipo, r.Estado,
			r.Nombre, r.Documento, r.Telefono, r.Email,
			r.Bien, r.Monto, ingreso.AddDate(0, 0, -1),
			r.Detalle, r.Pedido,
			ingreso, limite,
		)
		if err != nil {
			return fmt.Errorf("insertando reclamo de muestra: %w", err)
		}

		// La respuesta vive en su propia tabla. Solo los casos cerrados la
		// llevan; así el visitante ve cómo queda un caso resuelto de verdad.
		if r.Estado == model.EstadoCerrado {
			_, err := s.db.ExecContext(ctx, `
				INSERT INTO respuestas (
					tenant_id, reclamo_id, respuesta_empresa, accion_tomada,
					cargo_responsable, notificado_cliente, origen, fecha_respuesta
				) VALUES ($1, $2, $3, $4, $5, true, 'MANUAL', $6)`,
				tenantID, reclamoID,
				"Verificamos el lote con el proveedor y retiramos el producto de la góndola el mismo día. Le devolvimos el importe y le entregamos un vale por las molestias.",
				"Retiro del lote y devolución del importe",
				"Jefe de tienda",
				ingreso.AddDate(0, 0, 3),
			)
			if err != nil {
				return fmt.Errorf("insertando respuesta de muestra: %w", err)
			}
		}
	}
	return nil
}

/*
LimpiarAntiguos borra las empresas de demostración caducadas.

Sin esto, cada visita deja una empresa para siempre y en unos meses la base
se llena de negocios que no existen.

Dos decisiones que parecen detalles y no lo son:

  · Las tablas se descubren consultando cuáles llevan tenant_id, en vez de
    ir escritas a mano. Una lista fija se queda corta en cuanto alguien
    añade una tabla, y entonces la limpieza deja restos en silencio.

  · Cada borrado va por su cuenta, sin envolverlo todo en una transacción.
    En Postgres, una sola sentencia que falla envenena la transacción
    entera y a partir de ahí no se borra nada más. Con borrados sueltos,
    una tabla que falle por clave foránea simplemente se reintenta en la
    vuelta siguiente.

Devuelve cuántas empresas quitó.
*/
func (s *DemoService) LimpiarAntiguos(ctx context.Context) (int64, error) {
	corte := time.Now().Add(-VigenciaDemo)

	filas, err := s.db.QueryContext(ctx,
		`SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $1 AND fecha_creacion < $2`,
		CuentaDemo, corte)
	if err != nil {
		return 0, err
	}
	var caducados []uuid.UUID
	for filas.Next() {
		var id uuid.UUID
		if err := filas.Scan(&id); err != nil {
			filas.Close()
			return 0, err
		}
		caducados = append(caducados, id)
	}
	filas.Close()
	if len(caducados) == 0 {
		return 0, nil
	}

	tablas, err := s.tablasConTenant(ctx)
	if err != nil {
		return 0, err
	}

	var borradas int64
	for _, id := range caducados {
		if s.borrarTenant(ctx, id, tablas) {
			borradas++
		}
	}
	return borradas, nil
}

// tablasConTenant lista las tablas que guardan datos por empresa. Se excluyen
// las vistas: no se borra de una vista, se borra de sus tablas.
func (s *DemoService) tablasConTenant(ctx context.Context) ([]string, error) {
	filas, err := s.db.QueryContext(ctx, `
		SELECT c.table_name
		FROM information_schema.columns c
		JOIN information_schema.tables t
		  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
		WHERE c.table_schema = 'public'
		  AND c.column_name = 'tenant_id'
		  AND t.table_type = 'BASE TABLE'`)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	var tablas []string
	for filas.Next() {
		var n string
		if err := filas.Scan(&n); err != nil {
			return nil, err
		}
		// configuracion_tenant va la última: es la fila que define la empresa.
		if n != "configuracion_tenant" {
			tablas = append(tablas, n)
		}
	}
	return append(tablas, "configuracion_tenant"), nil
}

// borrarTenant vacía una empresa tabla por tabla. Las que fallan por clave
// foránea se reintentan mientras se siga avanzando; cuando una vuelta
// completa no borra nada nuevo, se para.
func (s *DemoService) borrarTenant(ctx context.Context, id uuid.UUID, tablas []string) bool {
	pendientes := append([]string(nil), tablas...)

	for vuelta := 0; vuelta < 5 && len(pendientes) > 0; vuelta++ {
		var fallaron []string
		for _, tabla := range pendientes {
			_, err := s.db.ExecContext(ctx,
				fmt.Sprintf("DELETE FROM %s WHERE tenant_id = $1", pq.QuoteIdentifier(tabla)), id)
			if err != nil {
				fallaron = append(fallaron, tabla)
			}
		}
		if len(fallaron) == len(pendientes) {
			// Vuelta sin avance: insistir no va a cambiar nada.
			log.Printf("[demo] no se pudo vaciar %s en %v", id, fallaron)
			return false
		}
		pendientes = fallaron
	}

	if len(pendientes) > 0 {
		log.Printf("[demo] quedaron restos de %s en %v", id, pendientes)
		return false
	}
	return true
}

// IniciarLimpiezaPeriodica deja la limpieza corriendo en segundo plano.
// Se ejecuta una vez al arrancar —por si el servicio estuvo caído— y luego
// cada seis horas.
func (s *DemoService) IniciarLimpiezaPeriodica(ctx context.Context) {
	go func() {
		limpiar := func() {
			n, err := s.LimpiarAntiguos(ctx)
			if err != nil {
				log.Printf("[demo] error en la limpieza: %v", err)
				return
			}
			if n > 0 {
				log.Printf("[demo] %d empresas de demostración caducadas eliminadas", n)
			}
		}
		limpiar()
		t := time.NewTicker(6 * time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				limpiar()
			}
		}
	}()
}

// ── Utilidades ────────────────────────────────────────────────────────

func aleatorio(n int) int {
	if n <= 0 {
		return 0
	}
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(v.Int64())
}

// sufijoCorto da seis dígitos para distinguir un demo de otro.
func sufijoCorto() string {
	const digitos = "0123456789"
	b := make([]byte, 6)
	for i := range b {
		b[i] = digitos[aleatorio(len(digitos))]
	}
	return string(b)
}
