package controller

import (
	"net/http"
	"strings"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MensajeAtencionController struct {
	mensajeService *service.MensajeAtencionService
}

func NewMensajeAtencionController(mensajeService *service.MensajeAtencionService) *MensajeAtencionController {
	return &MensajeAtencionController{mensajeService: mensajeService}
}

// ListarMensajes GET /api/v1/solicitudes-asesor/:id/mensajes
func (c *MensajeAtencionController) ListarMensajes(ctx *gin.Context) {
	tenantID, _ := helper.GetTenantID(ctx)
	solicitudID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	mensajes, err := c.mensajeService.ListarMensajes(ctx, tenantID, solicitudID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if mensajes == nil {
		mensajes = []model.MensajeAtencion{}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": mensajes})
}

// EnviarMensaje POST /api/v1/solicitudes-asesor/:id/mensajes
func (c *MensajeAtencionController) EnviarMensaje(ctx *gin.Context) {
	tenantID, _ := helper.GetTenantID(ctx)
	userID, _ := helper.GetUserID(ctx)

	solicitudID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var body struct {
		Contenido string `json:"contenido"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	contenido := strings.TrimSpace(body.Contenido)
	if contenido == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "El mensaje no puede estar vacío"})
		return
	}

	msg, err := c.mensajeService.EnviarComoAsesor(ctx, tenantID, solicitudID, userID, contenido)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": msg})
}