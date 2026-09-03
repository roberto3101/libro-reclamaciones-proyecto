package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// --- CHATBOT ---

type Chatbot struct {
	TenantModel

	Nombre      string     `json:"nombre" db:"nombre"`
	Descripcion NullString `json:"descripcion" db:"descripcion"`
	Tipo        string     `json:"tipo" db:"tipo"`

	// Config IA
	ModeloIA           NullString  `json:"modelo_ia" db:"modelo_ia"`
	PromptSistema      NullString  `json:"prompt_sistema" db:"prompt_sistema"`
	Temperatura        NullFloat64 `json:"temperatura" db:"temperatura"`
	MaxTokensRespuesta NullInt64   `json:"max_tokens_respuesta" db:"max_tokens_respuesta"`

	// Scopes
	PuedeLeerReclamos  bool `json:"puede_leer_reclamos" db:"puede_leer_reclamos"`
	PuedeResponder     bool `json:"puede_responder" db:"puede_responder"`
	PuedeCambiarEstado bool `json:"puede_cambiar_estado" db:"puede_cambiar_estado"`
	PuedeEnviarMensajes bool `json:"puede_enviar_mensajes" db:"puede_enviar_mensajes"`
	PuedeLeerMetricas  bool `json:"puede_leer_metricas" db:"puede_leer_metricas"`

	// Restricciones
	RequiereAprobacion bool            `json:"requiere_aprobacion" db:"requiere_aprobacion"`
	MaxRespuestasDia   int             `json:"max_respuestas_dia" db:"max_respuestas_dia"`
	HorarioActivo      json.RawMessage `json:"horario_activo" db:"horario_activo"`
	SedesPermitidas    json.RawMessage `json:"sedes_permitidas" db:"sedes_permitidas"`

	Activo          bool     `json:"activo" db:"activo"`
	CreadoPor       NullUUID `json:"creado_por" db:"creado_por"`
	UltimaActividad NullTime `json:"ultima_actividad" db:"ultima_actividad"`

	Timestamps
}

// Tipos de chatbot.
const (
	ChatbotAsistenteIA  = "ASISTENTE_IA"
	ChatbotWhatsapp     = "WHATSAPP_BOT"
	ChatbotTelegram     = "TELEGRAM_BOT"
	ChatbotCustom       = "CUSTOM"
)

// --- API KEY ---

type APIKey struct {
	TenantModel
	ChatbotID uuid.UUID `json:"chatbot_id" db:"chatbot_id"`

	Nombre    string `json:"nombre" db:"nombre"`
	KeyPrefix string `json:"key_prefix" db:"key_prefix"`
	KeyHash   string `json:"-" db:"key_hash"` // Nunca se serializa

	Entorno         string          `json:"entorno" db:"entorno"`
	Activa          bool            `json:"activa" db:"activa"`
	FechaExpiracion NullTime        `json:"fecha_expiracion" db:"fecha_expiracion"`
	IPsPermitidas   json.RawMessage `json:"ips_permitidas" db:"ips_permitidas"`
	UltimoUso       NullTime        `json:"ultimo_uso" db:"ultimo_uso"`

	RequestsPorMinuto int `json:"requests_por_minuto" db:"requests_por_minuto"`
	RequestsPorDia    int `json:"requests_por_dia" db:"requests_por_dia"`

	FechaCreacion time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	CreadoPor     NullUUID  `json:"creado_por" db:"creado_por"`
}

// Entornos de API key.
const (
	EntornoLive = "LIVE"
	EntornoTest = "TEST"
)

// --- CHATBOT LOG ---

type ChatbotLog struct {
	TenantModel
	ChatbotID uuid.UUID `json:"chatbot_id" db:"chatbot_id"`
	APIKeyID  uuid.UUID `json:"api_key_id" db:"api_key_id"`

	Metodo      string          `json:"metodo" db:"metodo"`
	Endpoint    string          `json:"endpoint" db:"endpoint"`
	RequestBody json.RawMessage `json:"request_body" db:"request_body"`

	StatusCode   int             `json:"status_code" db:"status_code"`
	ResponseBody json.RawMessage `json:"response_body" db:"response_body"`

	IPAddress  NullString `json:"ip_address" db:"ip_address"`
	DuracionMS NullInt64  `json:"duracion_ms" db:"duracion_ms"`
	ReclamoID  NullUUID   `json:"reclamo_id" db:"reclamo_id"`
	Accion     NullString `json:"accion" db:"accion"`

	FueRateLimited  bool      `json:"fue_rate_limited" db:"fue_rate_limited"`
	FechaExpiracion time.Time `json:"fecha_expiracion" db:"fecha_expiracion"`
	Fecha           time.Time `json:"fecha" db:"fecha"`
}
