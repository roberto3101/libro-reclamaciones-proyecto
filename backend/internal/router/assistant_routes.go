package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterAssistantRoutes(r *gin.Engine, ctrl *controller.AssistantController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	assistant := r.Group("/api/v1/assistant")
	assistant.Use(authMw, tenantMw, permisoMw)
	{
		assistant.POST("/chat", middleware.LimitadorAsistentePorUsuario(20), middleware.RequierePermiso(model.ModuloAsistente, model.AccionVer), ctrl.Chat)
		assistant.GET("/conversations", middleware.RequierePermiso(model.ModuloAsistente, model.AccionVer), ctrl.ListarConversaciones)
		assistant.GET("/conversations/:id/messages", middleware.RequierePermiso(model.ModuloAsistente, model.AccionVer), ctrl.ObtenerMensajes)
		assistant.DELETE("/conversations/:id", middleware.RequierePermiso(model.ModuloAsistente, model.AccionVer), ctrl.EliminarConversacion)
		assistant.GET("/health", ctrl.Health)
		assistant.GET("/providers", ctrl.Providers)
	}
}
