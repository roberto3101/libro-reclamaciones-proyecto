package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterReclamoRoutes(r *gin.Engine, ctrl *controller.ReclamoController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	reclamos := r.Group("/api/v1/reclamos")
	reclamos.Use(authMw, tenantMw, permisoMw)
	{
		reclamos.GET("", middleware.RequierePermiso(model.ModuloReclamos, model.AccionVer), ctrl.GetAll)
		reclamos.GET("/:id", middleware.RequierePermiso(model.ModuloReclamos, model.AccionVer), ctrl.GetByID)
		reclamos.POST("/:id/estado", middleware.RequierePermiso(model.ModuloReclamos, model.AccionCambiarEstado), ctrl.CambiarEstado)
		reclamos.POST("/:id/asignar", middleware.RequierePermiso(model.ModuloReclamos, model.AccionAsignar), ctrl.Asignar)
	}
}
