package model

import "time"

// SolicitudAsesor representa una solicitud de atención humana generada
// desde WhatsApp, web o teléfono. El flujo es:
// PENDIENTE → EN_ATENCION → RESUELTO | CANCELADO
type SolicitudAsesor struct {
	TenantModel

	Nombre   string `json:"nombre" db:"nombre"`
	Telefono string `json:"telefono" db:"telefono"`
	Motivo   string `json:"motivo" db:"motivo"`

	CanalOrigen     string   `json:"canal_origen" db:"canal_origen"`
	CanalWhatsAppID NullUUID `json:"canal_whatsapp_id" db:"canal_whatsapp_id"`

	Estado   string `json:"estado" db:"estado"`
	Prioridad string `json:"prioridad" db:"prioridad"`

	AsignadoA        NullUUID `json:"asignado_a" db:"asignado_a"`
	
	FechaAsignacion  NullTime `json:"fecha_asignacion" db:"fecha_asignacion"`
	FechaResolucion  NullTime `json:"fecha_resolucion" db:"fecha_resolucion"`

	NotaInterna          NullString `json:"nota_interna" db:"nota_interna"`
	ResumenConversacion  NullString `json:"resumen_conversacion" db:"resumen_conversacion"`

	FechaCreacion      time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion" db:"fecha_actualizacion"`

	// Campo calculado (LEFT JOIN con usuarios_admin)
	NombreAsesor NullString `json:"nombre_asesor" db:"nombre_asesor"`
}

// Estados de solicitud de asesor.
const (
	SolicitudPendiente  = "PENDIENTE"
	SolicitudEnAtencion = "EN_ATENCION"
	SolicitudResuelta   = "RESUELTO"
	SolicitudCancelada  = "CANCELADO"
)

// Canales de origen de solicitud.
const (
	CanalOrigenWhatsApp = "WHATSAPP"
	CanalOrigenWeb      = "WEB"
	CanalOrigenTelefono = "TELEFONO"
)

// Prioridades de solicitud.
const (
	PrioridadBaja    = "BAJA"
	PrioridadNormal  = "NORMAL"
	PrioridadAlta    = "ALTA"
	PrioridadUrgente = "URGENTE"
)

// EstaAbierta indica si la solicitud aún requiere atención.
func (s *SolicitudAsesor) EstaAbierta() bool {
	return s.Estado == SolicitudPendiente || s.Estado == SolicitudEnAtencion
}