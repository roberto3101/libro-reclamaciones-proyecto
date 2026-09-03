package controller

import (
	"net/http"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
)

type SuscripcionController struct {
	suscripcionService *service.SuscripcionService
	limitesService     *service.LimitesService
	auditRepo          *repo.AuditoriaRepo
}

func NewSuscripcionController(suscripcionService *service.SuscripcionService, limitesService *service.LimitesService, auditRepo *repo.AuditoriaRepo) *SuscripcionController {
	return &SuscripcionController{
		suscripcionService: suscripcionService,
		limitesService:     limitesService,
		auditRepo:          auditRepo,
	}
}

// GetActiva retorna la suscripción activa del tenant con datos del plan.
// GET /api/v1/suscripcion
func (c *SuscripcionController) GetActiva(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	data, err := c.suscripcionService.GetActivaConPlan(ctx.Request.Context(), tenantID)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, data)
}

// GetUso retorna el uso actual del tenant vs límites del plan.
// GET /api/v1/suscripcion/uso
func (c *SuscripcionController) GetUso(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	uso, err := c.limitesService.ObtenerUso(ctx.Request.Context(), tenantID)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, uso)
}

// GetHistorial retorna el historial de suscripciones del tenant.
// GET /api/v1/suscripcion/historial
func (c *SuscripcionController) GetHistorial(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	historial, err := c.suscripcionService.GetHistorial(ctx.Request.Context(), tenantID)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, historial)
}

// CambiarPlan cambia el plan del tenant.
// POST /api/v1/suscripcion/cambiar-plan
func (c *SuscripcionController) CambiarPlan(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	userID, _ := helper.GetUserID(ctx)

	var req struct {
		PlanCodigo     string `json:"plan_codigo" binding:"required"`
		Ciclo          string `json:"ciclo"`
		ReferenciaPago string `json:"referencia_pago"`
		MetodoPago     string `json:"metodo_pago"`
		Notas          string `json:"notas"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "detalle": err.Error()})
		return
	}

	params := service.CambiarPlanParams{
		NuevoPlanCodigo: req.PlanCodigo,
		Ciclo:           req.Ciclo,
		ReferenciaPago:  req.ReferenciaPago,
		MetodoPago:      req.MetodoPago,
		ActivadoPor:     "UPGRADE",
		UsuarioID:       userID,
		Notas:           req.Notas,
	}

	nueva, err := c.suscripcionService.CambiarPlan(ctx.Request.Context(), tenantID, params)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	c.auditRepo.RegistrarAsync(
		tenantID, userID,
		repo.AccionAuditCambiarPlan,
		"SUSCRIPCION",
		"",
		map[string]interface{}{
			"plan_codigo":     req.PlanCodigo,
			"ciclo":           req.Ciclo,
			"metodo_pago":     req.MetodoPago,
			"referencia_pago": req.ReferenciaPago,
		},
		helper.GetClientIP(ctx),
	)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    nueva,
		"message": "Plan actualizado exitosamente",
	})
}
