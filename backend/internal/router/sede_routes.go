package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterSedeRoutes(r *gin.Engine, ctrl *controller.SedeController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	sedes := r.Group("/api/v1/sedes")
	sedes.Use(authMw, tenantMw, permisoMw)
	{
		sedes.GET("", middleware.RequierePermiso(model.ModuloSedes, model.AccionVer), ctrl.GetAll)
		sedes.GET("/:id", middleware.RequierePermiso(model.ModuloSedes, model.AccionVer), ctrl.GetByID)
		sedes.POST("", middleware.RequierePermiso(model.ModuloSedes, model.AccionCrear), ctrl.Create)
		sedes.PUT("/:id", middleware.RequierePermiso(model.ModuloSedes, model.AccionEditar), ctrl.Update)
		sedes.DELETE("/:id", middleware.RequierePermiso(model.ModuloSedes, model.AccionEliminar), ctrl.Deactivate)
		sedes.POST("/:id/reactivar", middleware.RequierePermiso(model.ModuloSedes, model.AccionEditar), ctrl.Reactivate)
	}
}
