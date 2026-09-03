package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterMensajeRoutes(r *gin.Engine, ctrl *controller.MensajeController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	mensajes := r.Group("/api/v1/reclamos")
	mensajes.Use(authMw, tenantMw, permisoMw)
	{
		mensajes.GET("/:id/mensajes", middleware.RequierePermiso(model.ModuloReclamos, model.AccionVer), ctrl.GetByReclamo)
		mensajes.POST("/:id/mensajes", middleware.RequierePermiso(model.ModuloReclamos, model.AccionEditar), ctrl.Create)
	}
}
