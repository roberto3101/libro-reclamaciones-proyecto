package controller

import (
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MensajeController struct {
	mensajeService *service.MensajeService
}

func NewMensajeController(mensajeService *service.MensajeService) *MensajeController {
	return &MensajeController{mensajeService: mensajeService}
}

// GetByReclamo GET /api/v1/reclamos/:id/mensajes
func (ctrl *MensajeController) GetByReclamo(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de reclamo inválido")
		return
	}

	mensajes, err := ctrl.mensajeService.GetByReclamo(c.Request.Context(), tenantID, reclamoID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, mensajes)
}

// Create POST /api/v1/reclamos/:id/mensajes
func (ctrl *MensajeController) Create(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de reclamo inválido")
		return
	}

	var req dto.CreateMensajeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "mensaje y tipo_mensaje son obligatorios")
		return
	}

	msg, err := ctrl.mensajeService.Crear(
		c.Request.Context(), tenantID, reclamoID,
		req.TipoMensaje, req.Mensaje, req.ArchivoURL, req.ArchivoNombre,
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Created(c, msg)
}