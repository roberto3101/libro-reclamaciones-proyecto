package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterRespuestaRoutes(r *gin.Engine, ctrl *controller.RespuestaController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	respuestas := r.Group("/api/v1/reclamos")
	respuestas.Use(authMw, tenantMw, permisoMw)
	{
		respuestas.GET("/:id/respuestas", middleware.RequierePermiso(model.ModuloReclamos, model.AccionVer), ctrl.GetByReclamo)
		respuestas.POST("/:id/respuestas", middleware.RequierePermiso(model.ModuloReclamos, model.AccionEditar), ctrl.Create)
	}
}
