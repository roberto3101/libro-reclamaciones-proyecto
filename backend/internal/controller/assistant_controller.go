package controller

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"libro-reclamaciones/internal/ai"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AssistantController struct {
	assistantService *service.AssistantService
	primaryCfg       ai.GatewayConfig
	fallbackCfg      *ai.GatewayConfig
	extraCfgs        []ai.ExtraGatewayConfig
}

func NewAssistantController(assistantService *service.AssistantService, primaryCfg ai.GatewayConfig, fallbackCfg *ai.GatewayConfig, extraCfgs []ai.ExtraGatewayConfig) *AssistantController {
	return &AssistantController{
		assistantService: assistantService,
		primaryCfg:       primaryCfg,
		fallbackCfg:      fallbackCfg,
		extraCfgs:        extraCfgs,
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat POST /api/v1/assistant/chat
// Envía un mensaje al asistente. Si no se envía conversacion_id, crea una nueva.
// ──────────────────────────────────────────────────────────────────────────────

func (ctrl *AssistantController) Chat(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, err := helper.GetUserID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	const limiteCaracteresMensaje = 1000

	var req struct {
		ConversacionID string `json:"conversacion_id"` // Opcional — vacío = nueva conversación
		Message        string `json:"message" binding:"required"`
		ProviderID     string `json:"provider_id"`     // Opcional — "primary" | "fallback" (vacío = automático con fallback)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "El campo 'message' es obligatorio")
		return
	}

	if len([]rune(req.Message)) > limiteCaracteresMensaje {
		helper.ValidationError(c, fmt.Sprintf("El mensaje excede el límite de %d caracteres", limiteCaracteresMensaje))
		return
	}

	// Parsear conversacion_id (uuid.Nil si viene vacío = crear nueva)
	var convID uuid.UUID
	if req.ConversacionID != "" {
		convID, err = uuid.Parse(req.ConversacionID)
		if err != nil {
			helper.ValidationError(c, "conversacion_id inválido")
			return
		}
	}

	// Timeout de 120s para Ollama local
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	result, err := ctrl.assistantService.Chat(ctx, tenantID, userID, convID, req.Message, req.ProviderID)
	if err != nil {
		fmt.Printf("[ERROR Assistant] %v\n", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "El asistente no está disponible en este momento",
			"detalle": err.Error(),
		})
		return
	}

	helper.Success(c, gin.H{
		"response":        result.Response,
		"prompt_tokens":   result.PromptTokens,
		"output_tokens":   result.OutputTokens,
		"provider":        result.Provider,
		"conversacion_id": result.ConversacionID,
	})
}

// ──────────────────────────────────────────────────────────────────────────────
// ListarConversaciones GET /api/v1/assistant/conversations
// Retorna las conversaciones activas del usuario (máximo 10).
// ──────────────────────────────────────────────────────────────────────────────

func (ctrl *AssistantController) ListarConversaciones(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, err := helper.GetUserID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	conversaciones, err := ctrl.assistantService.ListarConversaciones(c.Request.Context(), tenantID, userID)
	if err != nil {
		fmt.Printf("[ERROR Assistant] ListarConversaciones: %v\n", err)
		helper.Error(c, err)
		return
	}

	// Siempre retornar array vacío, nunca null
	if conversaciones == nil {
		helper.Success(c, []struct{}{})
		return
	}

	helper.Success(c, conversaciones)
}

// ──────────────────────────────────────────────────────────────────────────────
// ObtenerMensajes GET /api/v1/assistant/conversations/:id/messages
// Retorna los mensajes de una conversación específica.
// ──────────────────────────────────────────────────────────────────────────────

func (ctrl *AssistantController) ObtenerMensajes(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, err := helper.GetUserID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de conversación inválido")
		return
	}

	mensajes, err := ctrl.assistantService.ObtenerMensajes(c.Request.Context(), tenantID, userID, convID)
	if err != nil {
		if err.Error() == "conversacion_no_encontrada" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Conversación no encontrada"})
			return
		}
		helper.Error(c, err)
		return
	}

	// Siempre retornar array vacío, nunca null
	if mensajes == nil {
		helper.Success(c, []struct{}{})
		return
	}

	helper.Success(c, mensajes)
}

// ──────────────────────────────────────────────────────────────────────────────
// EliminarConversacion DELETE /api/v1/assistant/conversations/:id
// Desactiva una conversación (soft delete).
// ──────────────────────────────────────────────────────────────────────────────

func (ctrl *AssistantController) EliminarConversacion(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, err := helper.GetUserID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de conversación inválido")
		return
	}

	if err := ctrl.assistantService.EliminarConversacion(c.Request.Context(), tenantID, userID, convID); err != nil {
		if err.Error() == "not_found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Conversación no encontrada"})
			return
		}
		helper.Error(c, err)
		return
	}

	helper.Success(c, gin.H{"message": "Conversación eliminada"})
}

// ──────────────────────────────────────────────────────────────────────────────
// Health GET /api/v1/assistant/health
// ──────────────────────────────────────────────────────────────────────────────

func (ctrl *AssistantController) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Asistente IA activo",
	})
}

// ──────────────────────────────────────────────────────────────────────────────
// Providers GET /api/v1/assistant/providers
// Retorna los modelos de IA configurados con su estado (health check sin tokens).
// ──────────────────────────────────────────────────────────────────────────────

func (ctrl *AssistantController) Providers(c *gin.Context) {
	providers := ai.GetConfiguredProviders(ctrl.primaryCfg, ctrl.fallbackCfg, ctrl.extraCfgs)
	helper.Success(c, providers)
}