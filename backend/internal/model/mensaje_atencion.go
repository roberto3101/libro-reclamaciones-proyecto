package model

import (
	"time"

	"github.com/google/uuid"
)

// Remitentes de mensajes de atención.
const (
	RemitentCliente = "CLIENTE"
	RemitentAsesor  = "ASESOR"
	RemitentSistema = "SISTEMA"
)

// MensajeAtencion representa un mensaje en el chat asesor ↔ cliente.
type MensajeAtencion struct {
	TenantID    uuid.UUID `json:"tenant_id" db:"tenant_id"`
	ID          uuid.UUID `json:"id" db:"id"`
	SolicitudID uuid.UUID `json:"solicitud_id" db:"solicitud_id"`

	Remitente string `json:"remitente" db:"remitente"`
	Contenido string `json:"contenido" db:"contenido"`
	AsesorID  NullUUID `json:"asesor_id" db:"asesor_id"`

	FechaEnvio time.Time `json:"fecha_envio" db:"fecha_envio"`
}