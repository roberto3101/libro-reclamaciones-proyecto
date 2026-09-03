package dto

import "github.com/google/uuid"

// ── Login Multi-Empresa ─────────────────────────────────────────────────

// TenantOption es un tenant accesible para el usuario (para el selector).
type TenantOption struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	RazonSocial string    `json:"razon_social"`
	Slug        string    `json:"slug"`
	LogoURL     *string   `json:"logo_url"`
	Rol         string    `json:"rol"`
}

// MultiLoginResponse se retorna cuando el usuario tiene acceso a 2+ tenants.
type MultiLoginResponse struct {
	RequiresSelection bool           `json:"requires_selection"`
	Tenants           []TenantOption `json:"tenants"`
	TempToken         string         `json:"temp_token"`
}

// SelectTenantRequest body para POST /auth/seleccionar-tenant.
type SelectTenantRequest struct {
	TenantID string `json:"tenant_id" binding:"required"`
}

// SwitchTenantRequest body para POST /auth/cambiar-empresa.
type SwitchTenantRequest struct {
	TenantID string `json:"tenant_id" binding:"required"`
}

// ── SuperAdmin ──────────────────────────────────────────────────────────

// CrearCuentaRequest body para POST /superadmin/cuentas.
type CrearCuentaRequest struct {
	Nombre        string `json:"nombre" binding:"required"`
	EmailContacto string `json:"email_contacto" binding:"required"`
	Telefono      string `json:"telefono"`
	RUC           string `json:"ruc"`
	Direccion     string `json:"direccion"`
	Notas         string `json:"notas"`
}

// ActualizarCuentaRequest body para PUT /superadmin/cuentas/:id.
type ActualizarCuentaRequest struct {
	Nombre        *string `json:"nombre"`
	EmailContacto *string `json:"email_contacto"`
	Telefono      *string `json:"telefono"`
	RUC           *string `json:"ruc"`
	Direccion     *string `json:"direccion"`
	Notas         *string `json:"notas"`
	Activo        *bool   `json:"activo"`
}

// CrearTenantBajoCuentaRequest body para POST /superadmin/cuentas/:id/tenants.
type CrearTenantBajoCuentaRequest struct {
	RazonSocial    string `json:"razon_social" binding:"required"`
	RUC            string `json:"ruc" binding:"required"`
	Email          string `json:"email" binding:"required"`
	Password       string `json:"password" binding:"required"`
	NombreAdmin    string `json:"nombre_admin" binding:"required"`
	Telefono       string `json:"telefono"`
	DireccionLegal string `json:"direccion_legal"`
	PlanID         string `json:"plan_id"`
	EsTrial        bool   `json:"es_trial"`
	DiasTrial      int    `json:"dias_trial"`
}

// SuperAdminLoginRequest body para POST /superadmin/auth/login.
type SuperAdminLoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// TenantDetalle para vista de SuperAdmin con métricas.
type TenantDetalle struct {
	TenantID       uuid.UUID `json:"tenant_id"`
	RazonSocial    string    `json:"razon_social"`
	RUC            string    `json:"ruc"`
	Slug           string    `json:"slug"`
	LogoURL        *string   `json:"logo_url"`
	EmailContacto  string    `json:"email_contacto"`
	Activo         bool      `json:"activo"`
	CuentaID       *string   `json:"cuenta_id"`
	CuentaNombre   *string   `json:"cuenta_nombre"`
	PlanCodigo     *string   `json:"plan_codigo"`
	PlanNombre     *string   `json:"plan_nombre"`
	TotalSedes     int       `json:"total_sedes"`
	TotalUsuarios  int       `json:"total_usuarios"`
	TotalReclamos  int       `json:"total_reclamos"`
	FechaCreacion  string    `json:"fecha_creacion"`
}
