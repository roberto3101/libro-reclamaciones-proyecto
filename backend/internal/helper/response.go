package helper

import (
	"errors"
	"net/http"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model/dto"

	"github.com/gin-gonic/gin"
	"fmt"
)

// Success respuesta exitosa con datos.
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    data,
	})
}

// Created respuesta de recurso creado.
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, dto.APIResponse{
		Success: true,
		Data:    data,
	})
}

// NoContent respuesta sin cuerpo (204).
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// Error respuesta de error. Detecta AppError automáticamente, incluso
// cuando viene wrappeado con fmt.Errorf("...: %w", err) por capas intermedias.
func Error(c *gin.Context, err error) {
	// Guardar error real en el contexto para que el middleware de logging lo capture
	_ = c.Error(err)

	// errors.As atraviesa la cadena de wraps hasta encontrar un *AppError.
	// Esto es clave: los services suelen wrappear errores con fmt.Errorf(%w)
	// para dar contexto, y sin esto se perdería el status/code original.
	var appErr *apperror.AppError
	if errors.As(err, &appErr) {
		c.JSON(appErr.Status, dto.APIResponse{
			Success: false,
			Error: &dto.APIError{
				Code:    appErr.Code,
				Message: appErr.Message,
			},
		})
		return
	}

	fmt.Println("[ERROR 500]", err.Error())
	c.JSON(http.StatusInternalServerError, dto.APIResponse{
		Success: false,
		Error: &dto.APIError{
			Code:    "INTERNAL_ERROR",
			Message: "Error interno del servidor",
		},
	})
}

// ValidationError respuesta de error de validación (400).
func ValidationError(c *gin.Context, message string) {
	_ = c.Error(fmt.Errorf("VALIDATION: %s", message))
	c.JSON(http.StatusBadRequest, dto.APIResponse{
		Success: false,
		Error: &dto.APIError{
			Code:    "VALIDATION_ERROR",
			Message: message,
		},
	})
}

func ForbiddenError(c *gin.Context, message string) {
	_ = c.Error(fmt.Errorf("FORBIDDEN: %s", message))
	c.JSON(http.StatusForbidden, dto.APIResponse{
		Success: false,
		Error: &dto.APIError{
			Code:    "FORBIDDEN",
			Message: message,
		},
	})
}
