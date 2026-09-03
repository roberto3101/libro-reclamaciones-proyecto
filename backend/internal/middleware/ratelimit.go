package middleware

import (
	"net/http"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
)

// RateLimitMiddleware verifica límites por minuto y por día.
func RateLimitMiddleware(logRepo *repo.ChatbotLogRepo, rateCfg config.RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKeyID, err := helper.GetUUIDFromContext(c, helper.CtxAPIKeyID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "context inválido"})
			return
		}
		tenantID, err := helper.GetTenantID(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "context inválido"})
			return
		}

		// Check por minuto
		countMin, err := logRepo.CountInWindow(c.Request.Context(), apiKeyID, time.Minute)
		if err == nil && countMin >= rateCfg.RequestsPerMin {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":               apperror.ErrRateLimitMinuto.Message,
				"code":                apperror.ErrRateLimitMinuto.Code,
				"retry_after_seconds": 60,
			})
			return
		}

		// Check por día
		countDay, err := logRepo.CountTodayByTenant(c.Request.Context(), tenantID)
		if err == nil && countDay >= rateCfg.RequestsPerDay {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": apperror.ErrRateLimitDia.Message,
				"code":  apperror.ErrRateLimitDia.Code,
			})
			return
		}

		c.Next()
	}
}