package controller

import (
	"net/http"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PlanController struct {
	planService *service.PlanService
}

func NewPlanController(planService *service.PlanService) *PlanController {
	return &PlanController{planService: planService}
}

// GetAll retorna planes activos (para el tenant).
// GET /api/v1/planes
func (c *PlanController) GetAll(ctx *gin.Context) {
	planes, err := c.planService.GetAll(ctx.Request.Context())
	if err != nil {
		helper.Error(ctx, err)
		return
	}
	helper.Success(ctx, planes)
}

// GetAllAdmin retorna TODOS los planes incluyendo inactivos (superadmin).
// GET /api/v1/admin/planes
func (c *PlanController) GetAllAdmin(ctx *gin.Context) {
	planes, err := c.planService.GetAllIncluyendoInactivos(ctx.Request.Context())
	if err != nil {
		helper.Error(ctx, err)
		return
	}
	helper.Success(ctx, planes)
}

// GetByID retorna un plan específico.
// GET /api/v1/planes/:id
func (c *PlanController) GetByID(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID de plan inválido"})
		return
	}

	plan, err := c.planService.GetByID(ctx.Request.Context(), id)
	if err != nil {
		helper.Error(ctx, err)
		return
	}
	helper.Success(ctx, plan)
}

// Crear registra un nuevo plan.
// POST /api/v1/admin/planes
func (c *PlanController) Crear(ctx *gin.Context) {
	var plan model.Plan
	if err := ctx.ShouldBindJSON(&plan); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "detalle": err.Error()})
		return
	}

	if err := c.planService.Crear(ctx.Request.Context(), &plan); err != nil {
		helper.Error(ctx, err)
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"success": true, "data": plan})
}

// Actualizar modifica un plan existente.
// PUT /api/v1/admin/planes/:id
func (c *PlanController) Actualizar(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID de plan inválido"})
		return
	}

	var plan model.Plan
	if err := ctx.ShouldBindJSON(&plan); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "detalle": err.Error()})
		return
	}
	plan.ID = id

	if err := c.planService.Actualizar(ctx.Request.Context(), &plan); err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, plan)
}

// Activar habilita un plan.
// PATCH /api/v1/admin/planes/:id/activar
func (c *PlanController) Activar(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID de plan inválido"})
		return
	}

	if err := c.planService.Activar(ctx.Request.Context(), id); err != nil {
		helper.Error(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true, "message": "Plan activado"})
}

// Desactivar oculta un plan (no afecta suscripciones activas).
// PATCH /api/v1/admin/planes/:id/desactivar
func (c *PlanController) Desactivar(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID de plan inválido"})
		return
	}

	if err := c.planService.Desactivar(ctx.Request.Context(), id); err != nil {
		helper.Error(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true, "message": "Plan desactivado"})
}
