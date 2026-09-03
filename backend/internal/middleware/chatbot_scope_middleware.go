package middleware

import (
	"net/http"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
)

// ChatbotScopeMiddleware carga el chatbot desde la BD y guarda sus scopes en el contexto.
// Debe ejecutarse DESPUÉS de APIKeyMiddleware (que inyecta tenant_id y chatbot_id).
func ChatbotScopeMiddleware(chatbotRepo *repo.ChatbotRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := helper.GetTenantID(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "context inválido"})
			return
		}

		chatbotID, err := helper.GetChatbotID(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "chatbot_id no encontrado en context"})
			return
		}

		chatbot, err := chatbotRepo.GetByID(c.Request.Context(), tenantID, chatbotID)
		if err != nil || chatbot == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Chatbot no encontrado o inactivo",
				"code":  "CHATBOT_NOT_FOUND",
			})
			return
		}

		if !chatbot.Activo {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "El chatbot está desactivado",
				"code":  "CHATBOT_INACTIVE",
			})
			return
		}

		// Inyectar scopes como booleanos en el contexto
		c.Set("puede_leer_reclamos", chatbot.PuedeLeerReclamos)
		c.Set("puede_responder", chatbot.PuedeResponder)
		c.Set("puede_cambiar_estado", chatbot.PuedeCambiarEstado)
		c.Set("puede_enviar_mensajes", chatbot.PuedeEnviarMensajes)
		c.Set("puede_leer_metricas", chatbot.PuedeLeerMetricas)

		c.Next()
	}
}

// RequireChatbotScope verifica que el chatbot tenga un scope específico.
// Se usa como middleware por endpoint: middleware.RequireChatbotScope("puede_leer_reclamos")
func RequireChatbotScope(scopeKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, exists := c.Get(scopeKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Scope no cargado — ¿falta ChatbotScopeMiddleware?",
				"code":  "SCOPE_NOT_LOADED",
			})
			return
		}

		allowed, ok := val.(bool)
		if !ok || !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Tu chatbot no tiene permiso para: " + scopeKey,
				"code":  "SCOPE_DENIED",
				"scope": scopeKey,
			})
			return
		}

		c.Next()
	}
}