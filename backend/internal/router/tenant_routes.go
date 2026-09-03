package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterTenantRoutes(r *gin.Engine, ctrl *controller.TenantController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	tenant := r.Group("/api/v1/tenant")
	tenant.Use(authMw, tenantMw, permisoMw)
	{
		tenant.GET("", middleware.RequierePermiso(model.ModuloConfiguracion, model.AccionVer), ctrl.Get)
		tenant.PUT("", middleware.RequierePermiso(model.ModuloConfiguracion, model.AccionEditar), ctrl.Update)
	}
}
