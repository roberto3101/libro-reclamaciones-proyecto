package model

import (
	"time"

	"github.com/google/uuid"
)

// Plan define un plan de suscripción del catálogo global.
// No tiene tenant_id — es compartido entre todos los tenants.
type Plan struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Codigo      string     `json:"codigo" db:"codigo"`
	Nombre      string     `json:"nombre" db:"nombre"`
	Descripcion NullString `json:"descripcion" db:"descripcion"`

	// ── Precios (soles S/) ──
	PrecioMensual     float64     `json:"precio_mensual" db:"precio_mensual"`
	PrecioAnual       NullFloat64 `json:"precio_anual" db:"precio_anual"`
	PrecioSedeExtra   float64     `json:"precio_sede_extra" db:"precio_sede_extra"`
	PrecioUsuarioExtra float64    `json:"precio_usuario_extra" db:"precio_usuario_extra"`

	// ── Límites de recursos (-1 = ilimitado) ──
	MaxSedes            int `json:"max_sedes" db:"max_sedes"`
	MaxUsuarios         int `json:"max_usuarios" db:"max_usuarios"`
	MaxReclamosMes      int `json:"max_reclamos_mes" db:"max_reclamos_mes"`
	MaxChatbots         int `json:"max_chatbots" db:"max_chatbots"`
	MaxCanalesWhatsApp  int `json:"max_canales_whatsapp" db:"max_canales_whatsapp"`

	// ── Funcionalidades habilitadas ──
	PermiteChatbot       bool `json:"permite_chatbot" db:"permite_chatbot"`
	PermiteWhatsapp      bool `json:"permite_whatsapp" db:"permite_whatsapp"`
	PermiteEmail         bool `json:"permite_email" db:"permite_email"`
	PermiteReportesPDF   bool `json:"permite_reportes_pdf" db:"permite_reportes_pdf"`
	PermiteExportarExcel bool `json:"permite_exportar_excel" db:"permite_exportar_excel"`
	PermiteAPI           bool `json:"permite_api" db:"permite_api"`
	PermiteMarcaBlanca   bool `json:"permite_marca_blanca" db:"permite_marca_blanca"`
	PermiteMultiIdioma   bool `json:"permite_multi_idioma" db:"permite_multi_idioma"`
	PermiteAsistenteIA   bool `json:"permite_asistente_ia" db:"permite_asistente_ia"`
	PermiteAtencionVivo  bool `json:"permite_atencion_vivo" db:"permite_atencion_vivo"`

	// ── Storage ──
	MaxStorageMB int `json:"max_storage_mb" db:"max_storage_mb"`

	// ── Display ──
	Orden     int  `json:"orden" db:"orden"`
	Activo    bool `json:"activo" db:"activo"`
	Destacado bool `json:"destacado" db:"destacado"`

	FechaCreacion time.Time `json:"fecha_creacion" db:"fecha_creacion"`
}

// Códigos de plan conocidos.
const (
	PlanDemo         = "DEMO"
	PlanEmprendedor  = "EMPRENDEDOR"
	PlanPyme         = "PYME"
	PlanPro          = "PRO"
)

// EsIlimitado verifica si un límite es ilimitado (-1).
func EsIlimitado(limite int) bool {
	return limite == -1
}

// DentroDelLimite verifica si el uso actual no excede el límite.
// Retorna true si hay espacio o si el límite es ilimitado.
func DentroDelLimite(usoActual, limite int) bool {
	return EsIlimitado(limite) || usoActual < limite
}

// EsGratuito indica si el plan no tiene costo.
func (p *Plan) EsGratuito() bool {
	return p.PrecioMensual == 0
}

// PrecioEfectivo retorna el precio mensual efectivo según el ciclo.
func (p *Plan) PrecioEfectivo(ciclo string) float64 {
	if ciclo == CicloAnual && p.PrecioAnual.Valid {
		return p.PrecioAnual.Float64 / 12
	}
	return p.PrecioMensual
}
