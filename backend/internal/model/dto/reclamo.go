package dto

import (
	"time"

	"github.com/google/uuid"
)

// CreateReclamoRequest formulario público de INDECOPI.
type CreateReclamoRequest struct {
	TipoSolicitud string `json:"tipo_solicitud" validate:"required,oneof=RECLAMO QUEJA"`

	// Sección 1: Consumidor
	NombreCompleto  string `json:"nombre_completo" validate:"required"`
	TipoDocumento   string `json:"tipo_documento" validate:"required,oneof=DNI CE Pasaporte RUC"`
	NumeroDocumento string `json:"numero_documento" validate:"required"`
	Telefono        string `json:"telefono" validate:"required"`
	Email           string `json:"email" validate:"required,email"`
	Domicilio       string `json:"domicilio"`
	Departamento    string `json:"departamento"`
	Provincia       string `json:"provincia"`
	Distrito        string `json:"distrito"`
	MenorDeEdad     bool   `json:"menor_de_edad"`
	NombreApoderado string `json:"nombre_apoderado"`

	// Sección 3: Bien contratado
	TipoBien        string  `json:"tipo_bien" validate:"omitempty,oneof=PRODUCTO SERVICIO"`
	MontoReclamado  float64 `json:"monto_reclamado"`
	DescripcionBien string  `json:"descripcion_bien" validate:"required"`
	NumeroPedido    string  `json:"numero_pedido"`

	// Campos QUEJA
	AreaQueja            string `json:"area_queja"`
	DescripcionSituacion string `json:"descripcion_situacion"`

	// Sección 4: Detalle
	FechaIncidente   string `json:"fecha_incidente" validate:"required"`
	DetalleReclamo   string `json:"detalle_reclamo" validate:"required"`
	PedidoConsumidor string `json:"pedido_consumidor" validate:"required"`

	// Firma
	FirmaDigital string `json:"firma_digital"`

	// Sede (desde la URL pública)
	SedeSlug string `json:"sede_slug"`

	// Validación cliente empresa
	EsClienteRegistrado bool `json:"es_cliente_registrado"`

	// Archivos adjuntos (claves de Cloudflare R2)
	ArchivosAdjuntos []string `json:"archivos_adjuntos"`

	// CAPTCHA Cloudflare Turnstile
	TurnstileToken string `json:"turnstile_token"`
}

// ReclamoListItem resumen para la tabla del dashboard.
type ReclamoListItem struct {
	ID                   uuid.UUID  `json:"id"`
	CodigoReclamo        string     `json:"codigo_reclamo"`
	TipoSolicitud        string     `json:"tipo_solicitud"`
	Estado               string     `json:"estado"`
	NombreCompleto       string     `json:"nombre_completo"`
	Email                string     `json:"email"`
	FechaRegistro        time.Time  `json:"fecha_registro"`
	FechaLimiteRespuesta *time.Time `json:"fecha_limite_respuesta"`
	SedeNombre           *string    `json:"sede_nombre"`
	DiasRestantes        *int       `json:"dias_restantes"`
	Prioridad            string     `json:"prioridad"`
}

// UpdateEstadoRequest cambio de estado.
type UpdateEstadoRequest struct {
	Estado     string `json:"estado" validate:"required,oneof=PENDIENTE EN_PROCESO RESUELTO CERRADO RECHAZADO"`
	Comentario string `json:"comentario"`
}

// AsignarReclamoRequest asignación a un admin.
type AsignarReclamoRequest struct {
	AdminID uuid.UUID `json:"admin_id" validate:"required"`
}

// ReclamoTrackingResponse respuesta para el seguimiento público.
type ReclamoTrackingResponse struct {
	CodigoReclamo        string     `json:"codigo_reclamo"`
	Estado               string     `json:"estado"`
	FechaRegistro        time.Time  `json:"fecha_registro"`
	FechaLimiteRespuesta *time.Time `json:"fecha_limite_respuesta"`
	FechaRespuesta       *time.Time `json:"fecha_respuesta"`
	SedeNombre           *string    `json:"sede_nombre"`
	TipoSolicitud        string     `json:"tipo_solicitud"`
	DescripcionBien      string     `json:"descripcion_bien"`
	RespuestaEmpresa     string     `json:"respuesta_empresa,omitempty"`
}

// PublicMessageRequest mensaje enviado desde el seguimiento.
type PublicMessageRequest struct {
	Mensaje       string `json:"mensaje" binding:"required,max=1500"`
	ArchivoURL    string `json:"archivo_url"`
	ArchivoNombre string `json:"archivo_nombre"`
}