package model

import (
	"time"

	"github.com/google/uuid"
)

// SuperAdmin es un usuario del staff interno de la plataforma.
// No pertenece a ningun tenant. Auth flow separado.
type SuperAdmin struct {
	ID            uuid.UUID `json:"id" db:"id"`
	Email         string    `json:"email" db:"email"`
	PasswordHash  string    `json:"-" db:"password_hash"`
	Nombre        string    `json:"nombre" db:"nombre"`
	Activo        bool      `json:"activo" db:"activo"`
	UltimoAcceso  NullTime  `json:"ultimo_acceso" db:"ultimo_acceso"`
	FechaCreacion time.Time `json:"fecha_creacion" db:"fecha_creacion"`
}
