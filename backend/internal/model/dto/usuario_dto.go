package dto

import "github.com/google/uuid"

type CreateUsuarioRequest struct {
	Email          string   `json:"email" binding:"required,email,max=80"`
	NombreCompleto string   `json:"nombre_completo" binding:"required,min=3,max=60"`
	Password       string   `json:"password" binding:"required,min=8,max=72"`
	Rol            string   `json:"rol" binding:"required,min=2,max=40"`
	SedeIDs        []string `json:"sede_ids"`
}

// AgregarUsuarioExistenteRequest — body del flujo "Agregar usuario existente".
// No incluye password porque se reutiliza el hash del usuario en otra empresa
// de la misma cuenta. No incluye nombre porque se copia del registro existente.
type AgregarUsuarioExistenteRequest struct {
	Email   string   `json:"email" binding:"required,email,max=80"`
	Rol     string   `json:"rol" binding:"required,min=2,max=40"`
	SedeIDs []string `json:"sede_ids"`
}

type UpdateUsuarioRequest struct {
	NombreCompleto string   `json:"nombre_completo" binding:"required,min=3,max=60"`
	Rol            string   `json:"rol" binding:"required,min=2,max=40"`
	SedeIDs        []string `json:"sede_ids"`
	Activo         bool     `json:"activo"`
}

type UsuarioResponse struct {
	ID             uuid.UUID `json:"id"`
	Email          string    `json:"email"`
	NombreCompleto string    `json:"nombre_completo"`
	Rol            string    `json:"rol"`
	Activo         bool      `json:"activo"`
	SedeIDs        []string  `json:"sede_ids"`
	UltimoAcceso   *string   `json:"ultimo_acceso"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

type AdminResetPasswordRequest struct {
	Password string `json:"password" binding:"required,min=8"`
}
