package model

import "fmt"

// ─── Recursos del sistema (constantes tipadas) ─────────────────────────────

// Recurso identifica un tipo de recurso limitable del sistema.
type Recurso string

const (
	RecursoSede          Recurso = "SEDE"
	RecursoUsuario       Recurso = "USUARIO"
	RecursoReclamo       Recurso = "RECLAMO"
	RecursoChatbot       Recurso = "CHATBOT"
	RecursoCanalWhatsApp Recurso = "CANAL_WHATSAPP"
)

// Funcionalidad identifica un feature del plan.
type Funcionalidad string

const (
	FuncChatbot       Funcionalidad = "CHATBOT"
	FuncWhatsApp      Funcionalidad = "WHATSAPP"
	FuncEmail         Funcionalidad = "EMAIL"
	FuncReportesPDF   Funcionalidad = "REPORTES_PDF"
	FuncExportExcel   Funcionalidad = "EXPORTAR_EXCEL"
	FuncAPI           Funcionalidad = "API"
	FuncMarcaBlanca   Funcionalidad = "MARCA_BLANCA"
	FuncAsistenteIA   Funcionalidad = "ASISTENTE_IA"
	FuncAtencionVivo  Funcionalidad = "ATENCION_VIVO"
)

// ─── Uso del tenant (snapshot en un momento dado) ──────────────────────────

// UsoTenant refleja el consumo actual de recursos de un tenant.
type UsoTenant struct {
	TenantID string `json:"tenant_id"`

	// Plan y suscripción
	PlanID              string `json:"plan_id"`
	PlanCodigo          string `json:"plan_codigo"`
	PlanNombre          string `json:"plan_nombre"`
	SuscripcionID       string `json:"suscripcion_id"`
	SuscripcionEstado   string `json:"suscripcion_estado"`
	SuscripcionCiclo    string `json:"suscripcion_ciclo"`
	EsTrial             bool   `json:"es_trial"`

	// Límites efectivos (ya con overrides aplicados, -1 = ilimitado)
	LimiteSedes            int `json:"limite_sedes"`
	LimiteUsuarios         int `json:"limite_usuarios"`
	LimiteReclamosMes      int `json:"limite_reclamos_mes"`
	LimiteChatbots         int `json:"limite_chatbots"`
	LimiteCanalesWhatsApp  int `json:"limite_canales_whatsapp"`
	LimiteStorageMB        int `json:"limite_storage_mb"`

	// Funcionalidades
	PermiteChatbot       bool `json:"permite_chatbot"`
	PermiteWhatsapp      bool `json:"permite_whatsapp"`
	PermiteEmail         bool `json:"permite_email"`
	PermiteReportesPDF   bool `json:"permite_reportes_pdf"`
	PermiteExportarExcel bool `json:"permite_exportar_excel"`
	PermiteAPI           bool `json:"permite_api"`
	PermiteMarcaBlanca   bool `json:"permite_marca_blanca"`
	PermiteMultiIdioma   bool `json:"permite_multi_idioma"`
	PermiteAsistenteIA   bool `json:"permite_asistente_ia"`
	PermiteAtencionVivo  bool `json:"permite_atencion_vivo"`

	// Uso actual
	UsoSedes            int `json:"uso_sedes"`
	UsoUsuarios         int `json:"uso_usuarios"`
	UsoReclamosMes      int `json:"uso_reclamos_mes"`
	UsoChatbots         int `json:"uso_chatbots"`
	UsoCanalesWhatsApp  int `json:"uso_canales_whatsapp"`
}

// LimiteDeRecurso retorna (uso, límite) para un recurso dado.
func (u *UsoTenant) LimiteDeRecurso(r Recurso) (uso int, limite int) {
	switch r {
	case RecursoSede:
		return u.UsoSedes, u.LimiteSedes
	case RecursoUsuario:
		return u.UsoUsuarios, u.LimiteUsuarios
	case RecursoReclamo:
		return u.UsoReclamosMes, u.LimiteReclamosMes
	case RecursoChatbot:
		return u.UsoChatbots, u.LimiteChatbots
	case RecursoCanalWhatsApp:
		return u.UsoCanalesWhatsApp, u.LimiteCanalesWhatsApp
	default:
		return 0, 0
	}
}

// PuedeCrear verifica si hay espacio para crear un recurso más.
func (u *UsoTenant) PuedeCrear(r Recurso) bool {
	uso, limite := u.LimiteDeRecurso(r)
	return DentroDelLimite(uso, limite)
}

// TieneFuncionalidad verifica si el plan permite una funcionalidad.
func (u *UsoTenant) TieneFuncionalidad(f Funcionalidad) bool {
	switch f {
	case FuncChatbot:
		return u.PermiteChatbot
	case FuncWhatsApp:
		return u.PermiteWhatsapp
	case FuncEmail:
		return u.PermiteEmail
	case FuncReportesPDF:
		return u.PermiteReportesPDF
	case FuncExportExcel:
		return u.PermiteExportarExcel
	case FuncAPI:
		return u.PermiteAPI
	case FuncMarcaBlanca:
		return u.PermiteMarcaBlanca
	case FuncAsistenteIA:
		return u.PermiteAsistenteIA
	case FuncAtencionVivo:
		return u.PermiteAtencionVivo
	default:
		return false
	}
}

// PorcentajeUso retorna el % de uso de un recurso (0-100). -1 si es ilimitado.
func (u *UsoTenant) PorcentajeUso(r Recurso) int {
	uso, limite := u.LimiteDeRecurso(r)
	if EsIlimitado(limite) {
		return -1
	}
	if limite == 0 {
		return 100
	}
	return int(float64(uso) / float64(limite) * 100)
}

// NombreRecurso retorna el nombre en español para mensajes de error.
func NombreRecurso(r Recurso) string {
	nombres := map[Recurso]string{
		RecursoSede:          "sedes",
		RecursoUsuario:       "usuarios",
		RecursoReclamo:       "reclamos del mes",
		RecursoChatbot:       "chatbots",
		RecursoCanalWhatsApp: "canales de WhatsApp",
	}
	if n, ok := nombres[r]; ok {
		return n
	}
	return string(r)
}

// NombreFuncionalidad retorna el nombre en español para mensajes de error.
func NombreFuncionalidad(f Funcionalidad) string {
	nombres := map[Funcionalidad]string{
		FuncChatbot:      "chatbot IA",
		FuncWhatsApp:     "WhatsApp",
		FuncEmail:        "notificaciones por email",
		FuncReportesPDF:  "reportes en PDF",
		FuncExportExcel:  "exportación a Excel",
		FuncAPI:          "acceso por API",
		FuncMarcaBlanca:  "marca blanca",
		FuncAsistenteIA:  "asistente IA interno",
		FuncAtencionVivo: "atención en vivo",
	}
	if n, ok := nombres[f]; ok {
		return n
	}
	return string(f)
}

// MensajeLimiteExcedido genera un mensaje de error legible.
func MensajeLimiteExcedido(r Recurso, uso, limite int, planNombre string) string {
	return fmt.Sprintf(
		"Has alcanzado el límite de %s de tu %s (%d/%d). Actualiza tu plan para continuar.",
		NombreRecurso(r), planNombre, uso, limite,
	)
}

// MensajeFuncionalidadNoDisponible genera un mensaje de error legible.
func MensajeFuncionalidadNoDisponible(f Funcionalidad, planNombre string) string {
	return fmt.Sprintf(
		"La funcionalidad de %s no está disponible en tu %s. Actualiza tu plan para habilitarla.",
		NombreFuncionalidad(f), planNombre,
	)
}

// ─── Compatibilidad con services existentes ────────────────────────────────

func (u *UsoTenant) CanCreateSede() bool {
	return u.PuedeCrear(RecursoSede)
}

func (u *UsoTenant) CanCreateUsuario() bool {
	return u.PuedeCrear(RecursoUsuario)
}

func (u *UsoTenant) CanCreateReclamo() bool {
	return u.PuedeCrear(RecursoReclamo)
}

func (u *UsoTenant) CanCreateChatbot() bool {
	return u.PermiteChatbot && u.PuedeCrear(RecursoChatbot)
}
