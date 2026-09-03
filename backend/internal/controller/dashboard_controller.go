package controller

import (
	"regexp"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// reISO8601Date solo acepta formato YYYY-MM-DD estricto.
var reISO8601Date = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type DashboardController struct {
	dashboardRepo *repo.DashboardRepo
}

func NewDashboardController(dashboardRepo *repo.DashboardRepo) *DashboardController {
	return &DashboardController{dashboardRepo: dashboardRepo}
}

// GetUso GET /api/v1/dashboard/uso
func (ctrl *DashboardController) GetUso(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	uso, err := ctrl.dashboardRepo.GetUsoTenant(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if uso == nil {
		helper.Error(c, apperror.ErrSuscripcionInactiva)
		return
	}
	helper.Success(c, uso)
}

// GetMetricas GET /api/v1/dashboard/metricas
func (ctrl *DashboardController) GetMetricas(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var sedeIDs []uuid.UUID
	if sedeParam := c.Query("sede_id"); sedeParam != "" {
		if parsed, err := uuid.Parse(sedeParam); err == nil {
			sedeIDs = []uuid.UUID{parsed}
		}
	}
	// Usuario con sedes asignadas: restringir a sus sedes
	if userSedes := helper.GetUserSedesIDs(c); len(userSedes) > 0 {
		sedeIDs = userSedes
	}

	// Periodo predefinido: "todo" | "esta_semana" | "este_mes" | "este_anio"
	periodo := c.DefaultQuery("periodo", "todo")

	// Rango de fecha personalizado (tiene prioridad sobre periodo)
	var fechaDesde, fechaHasta *time.Time
	if fd := c.Query("fecha_desde"); fd != "" {
		if !reISO8601Date.MatchString(fd) {
			helper.Error(c, apperror.New(400, "BAD_REQUEST", "fecha_desde debe tener formato YYYY-MM-DD"))
			return
		}
		t, err := time.Parse("2006-01-02", fd)
		if err != nil {
			helper.Error(c, apperror.New(400, "BAD_REQUEST", "fecha_desde inválida"))
			return
		}
		fechaDesde = &t
	}
	if fh := c.Query("fecha_hasta"); fh != "" {
		if !reISO8601Date.MatchString(fh) {
			helper.Error(c, apperror.New(400, "BAD_REQUEST", "fecha_hasta debe tener formato YYYY-MM-DD"))
			return
		}
		t, err := time.Parse("2006-01-02", fh)
		if err != nil {
			helper.Error(c, apperror.New(400, "BAD_REQUEST", "fecha_hasta inválida"))
			return
		}
		fechaHasta = &t
	}

	// Validación: fecha_desde no puede ser posterior a fecha_hasta
	if fechaDesde != nil && fechaHasta != nil {
		if fechaDesde.After(*fechaHasta) {
			helper.Error(c, apperror.New(400, "BAD_REQUEST", "fecha_desde no puede ser posterior a fecha_hasta"))
			return
		}
	}

	// Si hay rango personalizado, usarlo; si no, usar periodo predefinido
	if fechaDesde != nil || fechaHasta != nil {
		metricas, err := ctrl.dashboardRepo.GetMetricasRango(c.Request.Context(), tenantID, sedeIDs, fechaDesde, fechaHasta)
		if err != nil {
			helper.Error(c, err)
			return
		}
		helper.Success(c, metricas)
		return
	}

	metricas, err := ctrl.dashboardRepo.GetMetricas(c.Request.Context(), tenantID, sedeIDs, periodo)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, metricas)
}
