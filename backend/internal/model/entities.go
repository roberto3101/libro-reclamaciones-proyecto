package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// --- RESPUESTA ---

type Respuesta struct {
	TenantModel
	ReclamoID uuid.UUID `json:"reclamo_id" db:"reclamo_id"`

	RespuestaEmpresa    string          `json:"respuesta_empresa" db:"respuesta_empresa"`
	AccionTomada        NullString      `json:"accion_tomada" db:"accion_tomada"`
	CompensacionOfrecida NullString     `json:"compensacion_ofrecida" db:"compensacion_ofrecida"`
	RespondidoPor       NullUUID        `json:"respondido_por" db:"respondido_por"`
	CargoResponsable    NullString      `json:"cargo_responsable" db:"cargo_responsable"`
	ArchivosAdjuntos    *json.RawMessage `json:"archivos_adjuntos" db:"archivos_adjuntos"`

	NotificadoCliente  bool       `json:"notificado_cliente" db:"notificado_cliente"`
	CanalNotificacion  NullString `json:"canal_notificacion" db:"canal_notificacion"`
	FechaNotificacion  NullTime   `json:"fecha_notificacion" db:"fecha_notificacion"`

	Origen    string   `json:"origen" db:"origen"`
	ChatbotID NullUUID `json:"chatbot_id" db:"chatbot_id"`

	FechaRespuesta time.Time `json:"fecha_respuesta" db:"fecha_respuesta"`
}

// Orígenes de respuesta.
const (
	OrigenPanel   = "PANEL"
	OrigenChatbot = "CHATBOT"
	OrigenAPI     = "API"
)

// --- HISTORIAL ---

type Historial struct {
	TenantModel
	ReclamoID uuid.UUID `json:"reclamo_id" db:"reclamo_id"`

	EstadoAnterior NullString `json:"estado_anterior" db:"estado_anterior"`
	EstadoNuevo    string     `json:"estado_nuevo" db:"estado_nuevo"`
	TipoAccion     string     `json:"tipo_accion" db:"tipo_accion"`
	Comentario     NullString `json:"comentario" db:"comentario"`
	UsuarioAccion  NullUUID   `json:"usuario_accion" db:"usuario_accion"`
	ChatbotID      NullUUID   `json:"chatbot_id" db:"chatbot_id"`
	IPAddress      NullString `json:"ip_address" db:"ip_address"`

	FechaAccion time.Time `json:"fecha_accion" db:"fecha_accion"`
}

// Tipos de acción en historial.
const (
	AccionCreacion        = "CREACION"
	AccionCambioEstado    = "CAMBIO_ESTADO"
	AccionRespuesta       = "RESPUESTA"
	AccionAsignacion      = "ASIGNACION"
	AccionNotificacion    = "NOTIFICACION"
	AccionReapertura      = "REAPERTURA"
	AccionChatbotRespuesta = "CHATBOT_RESPUESTA"
)

// --- MENSAJE SEGUIMIENTO ---

type Mensaje struct {
	TenantModel
	ReclamoID uuid.UUID `json:"reclamo_id" db:"reclamo_id"`

	TipoMensaje    string     `json:"tipo_mensaje" db:"tipo_mensaje"`
	MensajeTexto   string     `json:"mensaje" db:"mensaje"`
	ArchivoURL     NullString `json:"archivo_url" db:"archivo_url"`
	ArchivoNombre  NullString `json:"archivo_nombre" db:"archivo_nombre"`
	Leido          bool       `json:"leido" db:"leido"`
	FechaLectura   NullTime   `json:"fecha_lectura" db:"fecha_lectura"`
	ChatbotID      NullUUID   `json:"chatbot_id" db:"chatbot_id"`

	FechaMensaje time.Time `json:"fecha_mensaje" db:"fecha_mensaje"`
}

// Tipos de mensaje.
const (
	MensajeCliente = "CLIENTE"
	MensajeEmpresa = "EMPRESA"
	MensajeChatbot = "CHATBOT"
)

// --- SESION ADMIN ---

type Sesion struct {
	TenantModel
	UsuarioID uuid.UUID `json:"usuario_id" db:"usuario_id"`

	TokenHash       string   `json:"-" db:"token_hash"` // Nunca se serializa
	IPAddress       NullString `json:"ip_address" db:"ip_address"`
	UserAgent       NullString `json:"user_agent" db:"user_agent"`
	Activa          bool       `json:"activa" db:"activa"`
	FechaInicio     time.Time  `json:"fecha_inicio" db:"fecha_inicio"`
	FechaExpiracion time.Time  `json:"fecha_expiracion" db:"fecha_expiracion"`
}

// --- AUDITORIA ADMIN ---

type Auditoria struct {
	TenantModel
	UsuarioID uuid.UUID `json:"usuario_id" db:"usuario_id"`

	Accion    string          `json:"accion" db:"accion"`
	Entidad   string          `json:"entidad" db:"entidad"`
	EntidadID NullString      `json:"entidad_id" db:"entidad_id"`
	Detalles  json.RawMessage `json:"detalles" db:"detalles"`
	IPAddress NullString      `json:"ip_address" db:"ip_address"`

	Fecha time.Time `json:"fecha" db:"fecha"`
}

// Entidades auditables.
const (
	EntidadReclamo     = "RECLAMO"
	EntidadRespuesta   = "RESPUESTA"
	EntidadUsuario     = "USUARIO"
	EntidadConfig      = "CONFIG"
	EntidadSesion      = "SESION"
	EntidadSede        = "SEDE"
	EntidadChatbot     = "CHATBOT"
	EntidadAPIKey      = "API_KEY"
	EntidadSuscripcion = "SUSCRIPCION"
	EntidadPlan        = "PLAN"
)
