package model

import "time"

type UsuarioAdmin struct {
	TenantModel

	Email               string   `json:"email" db:"email"`
	NombreCompleto      string   `json:"nombre_completo" db:"nombre_completo"`
	PasswordHash        string   `json:"-" db:"password_hash"` // Nunca se serializa a JSON
	Rol                 string   `json:"rol" db:"rol"`
	Activo              bool     `json:"activo" db:"activo"`
	DebeCambiarPassword bool     `json:"debe_cambiar_password" db:"debe_cambiar_password"`
	UltimoAcceso        NullTime `json:"ultimo_acceso" db:"ultimo_acceso"`

	FechaCreacion time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	CreadoPor     NullUUID  `json:"creado_por" db:"creado_por"`
}

// Roles válidos.
const (
	RolAdmin   = "ADMIN"
	RolSoporte = "SOPORTE"
)
