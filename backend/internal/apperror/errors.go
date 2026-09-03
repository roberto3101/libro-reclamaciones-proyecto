package apperror

import "fmt"

// AppError error de aplicación con status HTTP y código identificador.
type AppError struct {
	Status  int    `json:"-"`       // HTTP status code
	Code    string `json:"code"`    // Código identificador (PLAN_LIMIT_SEDES)
	Message string `json:"message"` // Mensaje legible
}

// Error implementa la interfaz error.
func (e *AppError) Error() string {
	return e.Message
}

// New crea un AppError nuevo.
func New(status int, code, message string) *AppError {
	return &AppError{
		Status:  status,
		Code:    code,
		Message: message,
	}
}

// Withf crea una copia del error con mensaje formateado.
// Permite reusar errores base con datos dinámicos.
func (e *AppError) Withf(args ...interface{}) *AppError {
	return &AppError{
		Status:  e.Status,
		Code:    e.Code,
		Message: fmt.Sprintf(e.Message, args...),
	}
}

// Errores genéricos reutilizables.
var (
	ErrInternal   = New(500, "INTERNAL_ERROR", "Error interno del servidor")
	ErrNotFound   = New(404, "NOT_FOUND", "Recurso no encontrado")
	ErrBadRequest = New(400, "BAD_REQUEST", "Solicitud inválida")
	ErrForbidden  = New(403, "FORBIDDEN", "No tienes permiso para esta acción")
	ErrConflict        = New(409, "CONFLICT", "El recurso ya existe")
	ErrSedePrincipal   = New(409, "SEDE_PRINCIPAL_EXISTS", "Ya existe una sede principal activa. Desactiva la actual antes de asignar otra")
)
