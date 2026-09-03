package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterChatbotRoutes(r *gin.Engine, ctrl *controller.ChatbotController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	chatbots := r.Group("/api/v1/chatbots")
	chatbots.Use(authMw, tenantMw, permisoMw)
	{
		// Rutas sin :id primero (evitar conflicto con param)
		chatbots.GET("/ai-providers", middleware.RequierePermiso(model.ModuloChatbots, model.AccionVer), ctrl.GetAIProviders)

		chatbots.GET("", middleware.RequierePermiso(model.ModuloChatbots, model.AccionVer), ctrl.GetAll)
		chatbots.GET("/:id", middleware.RequierePermiso(model.ModuloChatbots, model.AccionVer), ctrl.GetByID)
		chatbots.POST("", middleware.RequierePermiso(model.ModuloChatbots, model.AccionCrear), ctrl.Create)
		chatbots.PUT("/:id", middleware.RequierePermiso(model.ModuloChatbots, model.AccionEditar), ctrl.Update)
		chatbots.DELETE("/:id", middleware.RequierePermiso(model.ModuloChatbots, model.AccionEliminar), ctrl.Delete)

		// Lifecycle
		chatbots.POST("/:id/deactivate", middleware.RequierePermiso(model.ModuloChatbots, model.AccionEditar), ctrl.Deactivate)
		chatbots.POST("/:id/reactivate", middleware.RequierePermiso(model.ModuloChatbots, model.AccionEditar), ctrl.Reactivate)

		// Health Check
		chatbots.GET("/:id/health", middleware.RequierePermiso(model.ModuloChatbots, model.AccionVer), ctrl.HealthCheck)
		chatbots.GET("/:id/health/stream", middleware.RequierePermiso(model.ModuloChatbots, model.AccionVer), ctrl.HealthStream)

		// API Keys (parte del módulo chatbots)
		chatbots.GET("/:id/api-keys", middleware.RequierePermiso(model.ModuloChatbots, model.AccionVer), ctrl.GetAPIKeys)
		chatbots.POST("/:id/api-keys", middleware.RequierePermiso(model.ModuloChatbots, model.AccionCrear), ctrl.GenerateAPIKey)
		chatbots.DELETE("/:id/api-keys/:keyId", middleware.RequierePermiso(model.ModuloChatbots, model.AccionEliminar), ctrl.RevokeAPIKey)
	}
}
