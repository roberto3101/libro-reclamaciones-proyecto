package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterDashboardRoutes(r *gin.Engine, ctrl *controller.DashboardController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	dashboard := r.Group("/api/v1/dashboard")
	dashboard.Use(authMw, tenantMw, permisoMw)
	{
		dashboard.GET("/uso", middleware.RequierePermiso(model.ModuloDashboard, model.AccionVer), ctrl.GetUso)
		dashboard.GET("/metricas", middleware.RequierePermiso(model.ModuloDashboard, model.AccionVer), ctrl.GetMetricas)
	}
}