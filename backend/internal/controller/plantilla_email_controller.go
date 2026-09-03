package controller

import (
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PlantillaEmailController maneja los endpoints de gestión de plantillas de email.
type PlantillaEmailController struct {
	plantillaService *service.PlantillaEmailService
}

// NewPlantillaEmailController crea una nueva instancia del controlador.
func NewPlantillaEmailController(plantillaService *service.PlantillaEmailService) *PlantillaEmailController {
	return &PlantillaEmailController{plantillaService: plantillaService}
}

// Listar GET /api/v1/plantillas-email
func (ctrl *PlantillaEmailController) Listar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	plantillas, err := ctrl.plantillaService.ListarPorTenant(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, plantillas)
}

// ObtenerPorID GET /api/v1/plantillas-email/:id
func (ctrl *PlantillaEmailController) ObtenerPorID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	plantillaID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de plantilla inválido")
		return
	}

	p, err := ctrl.plantillaService.ObtenerPorID(c.Request.Context(), tenantID, plantillaID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, p)
}

// Actualizar PUT /api/v1/plantillas-email/:id
func (ctrl *PlantillaEmailController) Actualizar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	plantillaID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de plantilla inválido")
		return
	}

	var req dto.ActualizarPlantillaEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "Asunto y cuerpo principal son obligatorios")
		return
	}

	p, err := ctrl.plantillaService.Actualizar(c.Request.Context(), tenantID, plantillaID, req)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, p)
}

// RestaurarDefecto POST /api/v1/plantillas-email/:id/restaurar
func (ctrl *PlantillaEmailController) RestaurarDefecto(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	plantillaID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de plantilla inválido")
		return
	}

	p, err := ctrl.plantillaService.RestaurarDefecto(c.Request.Context(), tenantID, plantillaID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, p)
}

// ObtenerDefinicion GET /api/v1/plantillas-email/definicion
// Retorna las etiquetas de tipos de evento y variables disponibles.
func (ctrl *PlantillaEmailController) ObtenerDefinicion(c *gin.Context) {
	helper.Success(c, gin.H{
		"tipos_evento":          model.EtiquetasTiposEvento(),
		"tipos_evento_validos":  model.TiposEventoValidos(),
		"plantillas_por_defecto": model.DefinicionPlantillasEmail(),
	})
}
