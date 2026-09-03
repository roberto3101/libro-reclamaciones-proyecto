package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

// RegisterWhatsAppConfigRoutes rutas admin para gestionar canales WhatsApp.
func RegisterWhatsAppConfigRoutes(r *gin.Engine, ctrl *controller.WhatsAppConfigController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	canales := r.Group("/api/v1/canales/whatsapp")
	canales.Use(authMw, tenantMw, permisoMw)
	{
		canales.GET("", middleware.RequierePermiso(model.ModuloCanalesWhatsApp, model.AccionVer), ctrl.GetAll)
		canales.GET("/:id", middleware.RequierePermiso(model.ModuloCanalesWhatsApp, model.AccionVer), ctrl.GetByID)
		canales.POST("", middleware.RequierePermiso(model.ModuloCanalesWhatsApp, model.AccionCrear), ctrl.Create)
		canales.PUT("/:id", middleware.RequierePermiso(model.ModuloCanalesWhatsApp, model.AccionEditar), ctrl.Update)
		canales.DELETE("/:id", middleware.RequierePermiso(model.ModuloCanalesWhatsApp, model.AccionEliminar), ctrl.Deactivate)
	}
}
