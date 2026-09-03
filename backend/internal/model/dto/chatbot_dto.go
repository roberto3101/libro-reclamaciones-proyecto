package dto

import "github.com/google/uuid"

// --- Admin Panel DTOs ---

type CreateChatbotRequest struct {
	Nombre      string `json:"nombre" binding:"required"`
	Tipo        string `json:"tipo" binding:"required,oneof=ASISTENTE_IA WHATSAPP_BOT TELEGRAM_BOT CUSTOM"`
	Descripcion string `json:"descripcion"`

	// Config IA (opcionales al crear)
	ModeloIA           string  `json:"modelo_ia"`
	PromptSistema      string  `json:"prompt_sistema"`
	Temperatura        float64 `json:"temperatura"`
	MaxTokensRespuesta int     `json:"max_tokens_respuesta"`
}

type UpdateChatbotRequest struct {
	Nombre      string `json:"nombre" binding:"required"`
	Tipo        string `json:"tipo" binding:"required,oneof=ASISTENTE_IA WHATSAPP_BOT TELEGRAM_BOT CUSTOM"`
	Descripcion string `json:"descripcion"`
	Activo      bool   `json:"activo"`

	// Config IA
	ModeloIA           string  `json:"modelo_ia"`
	PromptSistema      string  `json:"prompt_sistema"`
	Temperatura        float64 `json:"temperatura"`
	MaxTokensRespuesta int     `json:"max_tokens_respuesta"`

	// Permisos (scopes)
	PuedeLeerReclamos   bool `json:"puede_leer_reclamos"`
	PuedeResponder      bool `json:"puede_responder"`
	PuedeCambiarEstado  bool `json:"puede_cambiar_estado"`
	PuedeEnviarMensajes bool `json:"puede_enviar_mensajes"`
	PuedeLeerMetricas   bool `json:"puede_leer_metricas"`

	// Restricciones
	RequiereAprobacion bool `json:"requiere_aprobacion"`
}

type CreateAPIKeyRequest struct {
	Nombre  string `json:"nombre" binding:"required"`
	Entorno string `json:"entorno" binding:"required,oneof=LIVE TEST"`
}

type APIKeyResponse struct {
	ID        uuid.UUID `json:"id"`
	Nombre    string    `json:"nombre"`
	KeyPrefix string    `json:"key_prefix"`
	PlainKey  string    `json:"plain_key,omitempty"` // Solo se muestra al crear
	Entorno   string    `json:"entorno"`
	Activa    bool      `json:"activa"`
}

// --- Bot API DTOs ---

type BotRespuestaRequest struct {
	RespuestaEmpresa     string `json:"respuesta_empresa" binding:"required"`
	AccionTomada         string `json:"accion_tomada"`
	CompensacionOfrecida string `json:"compensacion_ofrecida"`
}

type BotMensajeRequest struct {
	TipoMensaje   string `json:"tipo_mensaje" binding:"required,oneof=CLIENTE EMPRESA"`
	Mensaje       string `json:"mensaje" binding:"required"`
	ArchivoURL    string `json:"archivo_url"`
	ArchivoNombre string `json:"archivo_nombre"`
}

type BotCambiarEstadoRequest struct {
	Estado     string `json:"estado" binding:"required,oneof=PENDIENTE EN_PROCESO RESUELTO CERRADO"`
	Comentario string `json:"comentario"`
}