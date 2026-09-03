package model

import (
	"time"

	"github.com/google/uuid"
)

// Cuenta agrupa empresas (tenants) bajo un cliente.
// No tiene TenantModel porque es cross-tenant.
type Cuenta struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	Nombre          string     `json:"nombre" db:"nombre"`
	EmailContacto   string     `json:"email_contacto" db:"email_contacto"`
	Telefono        NullString `json:"telefono" db:"telefono"`
	RUC             NullString `json:"ruc" db:"ruc"`
	Direccion       NullString `json:"direccion" db:"direccion"`
	Notas           NullString `json:"notas" db:"notas"`
	Activo          bool       `json:"activo" db:"activo"`
	FechaCreacion   time.Time  `json:"fecha_creacion" db:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion" db:"fecha_actualizacion"`
}

// CuentaConTenants es una cuenta con sus empresas (para panel SuperAdmin).
type CuentaConTenants struct {
	Cuenta
	Tenants []TenantResumen `json:"tenants"`
}

// TenantResumen es un resumen ligero de un tenant (para listados).
type TenantResumen struct {
	TenantID    uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	RazonSocial string     `json:"razon_social" db:"razon_social"`
	RUC         string     `json:"ruc" db:"ruc"`
	Slug        string     `json:"slug" db:"slug"`
	LogoURL     NullString `json:"logo_url" db:"logo_url"`
	Activo      bool       `json:"activo" db:"activo"`
}
