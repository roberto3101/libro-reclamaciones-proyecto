package middleware

import (
	"net/http"
	"strings"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
)

// APIKeyMiddleware valida el API key del header X-API-Key.
func APIKeyMiddleware(apiKeyRepo *repo.ChatbotAPIKeyRepo, chatbotRepo *repo.ChatbotRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Extraer Header
		apiKey := strings.TrimSpace(c.GetHeader("X-API-Key"))
		if apiKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Se requiere el header X-API-Key",
				"code":  "API_KEY_MISSING",
			})
			return
		}

		// 2. Calcular Hash (Nunca buscamos por texto plano en DB)
		keyHash := helper.SHA256Hash(apiKey)

		// 3. Buscar en DB por Hash
		key, err := apiKeyRepo.GetByHash(c.Request.Context(), keyHash)
		if err != nil {
			helper.Error(c, apperror.ErrInternal)
			c.Abort()
			return
		}
		
		// 4. Validar existencia
		if key == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "API Key inválida o revocada",
				"code":  "API_KEY_INVALID",
			})
			return
		}

		// 5. Validar Expiración
		if key.FechaExpiracion.Valid && key.FechaExpiracion.Time.Before(time.Now()) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "La API Key ha expirado",
				"code":  "API_KEY_EXPIRED",
			})
			return
		}

		// 6. Inyectar datos en el contexto de Gin
		helper.SetContext(c, helper.CtxTenantID, key.TenantID)
		helper.SetContext(c, helper.CtxChatbotID, key.ChatbotID)
		helper.SetContext(c, helper.CtxAPIKeyID, key.ID)

		// 7. Incrementar contador de uso + registrar actividad del chatbot
		go func() {
			_ = apiKeyRepo.IncrementUsage(c.Request.Context(), key.TenantID, key.ID)
			_ = chatbotRepo.TouchActivity(c.Request.Context(), key.TenantID, key.ChatbotID)
		}()

		c.Next()
	}
}

