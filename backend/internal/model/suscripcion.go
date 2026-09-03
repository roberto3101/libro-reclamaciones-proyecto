package model

import (
	"time"

	"github.com/google/uuid"
)

// Suscripcion vincula un tenant con un plan.
// Un tenant tiene UNA suscripción activa a la vez.
type Suscripcion struct {
	TenantModel

	PlanID uuid.UUID `json:"plan_id" db:"plan_id"`
	Estado string    `json:"estado" db:"estado"`
	Ciclo  string    `json:"ciclo" db:"ciclo"`

	FechaInicio       time.Time `json:"fecha_inicio" db:"fecha_inicio"`
	FechaFin          NullTime  `json:"fecha_fin" db:"fecha_fin"`
	FechaProximoCobro NullTime  `json:"fecha_proximo_cobro" db:"fecha_proximo_cobro"`

	// ── Trial ──
	EsTrial       bool     `json:"es_trial" db:"es_trial"`
	DiasTrial     int      `json:"dias_trial" db:"dias_trial"`
	FechaFinTrial NullTime `json:"fecha_fin_trial" db:"fecha_fin_trial"`

	// ── Overrides (NULL = usa límite del plan) ──
	OverrideMaxSedes            NullInt64 `json:"override_max_sedes" db:"override_max_sedes"`
	OverrideMaxUsuarios         NullInt64 `json:"override_max_usuarios" db:"override_max_usuarios"`
	OverrideMaxReclamos         NullInt64 `json:"override_max_reclamos" db:"override_max_reclamos"`
	OverrideMaxChatbots         NullInt64 `json:"override_max_chatbots" db:"override_max_chatbots"`
	OverrideMaxCanalesWhatsApp  NullInt64 `json:"override_max_canales_whatsapp" db:"override_max_canales_whatsapp"`
	OverrideMaxStorageMB        NullInt64 `json:"override_max_storage_mb" db:"override_max_storage_mb"`

	// ── Pago ──
	ReferenciaPago NullString `json:"referencia_pago" db:"referencia_pago"`
	MetodoPago     NullString `json:"metodo_pago" db:"metodo_pago"`

	ActivadoPor          NullString `json:"activado_por" db:"activado_por"`
	ActivadoPorUsuarioID NullUUID   `json:"activado_por_usuario_id" db:"activado_por_usuario_id"`
	Notas                NullString `json:"notas" db:"notas"`

	// Campo computed (JOIN) — no se persiste directamente
	ActivadoPorUsuarioNombre NullString `json:"activado_por_usuario_nombre,omitempty" db:"-"`

	FechaCreacion      time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion" db:"fecha_actualizacion"`
}

// Estados de suscripción.
const (
	SuscripcionActiva    = "ACTIVA"
	SuscripcionTrial     = "TRIAL"
	SuscripcionSuspendida = "SUSPENDIDA"
	SuscripcionCancelada = "CANCELADA"
	SuscripcionVencida   = "VENCIDA"
)

// Ciclos de facturación.
const (
	CicloMensual = "MENSUAL"
	CicloAnual   = "ANUAL"
)

// Orígenes de activación.
const (
	ActivadoPorOnboarding = "ONBOARDING"
	ActivadoPorUpgrade    = "UPGRADE"
	ActivadoPorAdmin      = "ADMIN_MANUAL"
	ActivadoPorRenovacion = "RENOVACION"
)

// Métodos de pago soportados.
const (
	MetodoPagoTarjeta      = "TARJETA"
	MetodoPagoTransferencia = "TRANSFERENCIA"
	MetodoPagoYape         = "YAPE"
	MetodoPagoPlin         = "PLIN"
)

// EstaActiva indica si la suscripción permite operar.
func (s *Suscripcion) EstaActiva() bool {
	return s.Estado == SuscripcionActiva || s.Estado == SuscripcionTrial
}

// EstaVencida verifica si el trial o la suscripción venció.
func (s *Suscripcion) EstaVencida() bool {
	if s.EsTrial && s.FechaFinTrial.Valid {
		return time.Now().After(s.FechaFinTrial.Time)
	}
	if s.FechaFin.Valid {
		return time.Now().After(s.FechaFin.Time)
	}
	return false
}
