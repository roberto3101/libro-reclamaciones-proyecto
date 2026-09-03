package router

import (
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
)

func RegisterBotAPIRoutes(
	r *gin.Engine,
	ctrl *controller.BotAPIController,
	apiKeyRepo *repo.ChatbotAPIKeyRepo,
	chatbotRepo *repo.ChatbotRepo,
	logRepo *repo.ChatbotLogRepo,
	rateCfg config.RateLimitConfig,
) {
	bot := r.Group("/api/bot/v1")
	bot.Use(
		middleware.APIKeyMiddleware(apiKeyRepo, chatbotRepo),
		middleware.ChatbotScopeMiddleware(chatbotRepo),
		middleware.RateLimitMiddleware(logRepo, rateCfg),
	)
	{
		// Lectura — requiere puede_leer_reclamos
		bot.GET("/reclamos",
			middleware.RequireChatbotScope("puede_leer_reclamos"),
			ctrl.GetReclamos,
		)
		bot.GET("/reclamos/:id",
			middleware.RequireChatbotScope("puede_leer_reclamos"),
			ctrl.GetReclamo,
		)

		// Mensajes — requiere puede_enviar_mensajes
		bot.POST("/reclamos/:id/mensajes",
			middleware.RequireChatbotScope("puede_enviar_mensajes"),
			ctrl.CreateMensaje,
		)

		// Cambiar estado — requiere puede_cambiar_estado
		bot.PATCH("/reclamos/:id/estado",
			middleware.RequireChatbotScope("puede_cambiar_estado"),
			ctrl.CambiarEstado,
		)
	}
}