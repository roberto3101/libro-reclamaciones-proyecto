package controller

import (
	"encoding/json"
	"fmt"
	"time"

	"libro-reclamaciones/internal/ai"
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChatbotController struct {
	chatbotService *service.ChatbotService
	aiConfig       config.AIConfig
	auditRepo      *repo.AuditoriaRepo
}

func NewChatbotController(chatbotService *service.ChatbotService, aiConfig config.AIConfig, auditRepo *repo.AuditoriaRepo) *ChatbotController {
	return &ChatbotController{chatbotService: chatbotService, aiConfig: aiConfig, auditRepo: auditRepo}
}

// GetAll GET /api/v1/chatbots
func (ctrl *ChatbotController) GetAll(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbots, err := ctrl.chatbotService.GetByTenant(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, chatbots)
}

// GetByID GET /api/v1/chatbots/:id
func (ctrl *ChatbotController) GetByID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	chatbot, err := ctrl.chatbotService.GetByID(c.Request.Context(), tenantID, chatbotID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, chatbot)
}

// Create POST /api/v1/chatbots
func (ctrl *ChatbotController) Create(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)

	var req dto.CreateChatbotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre y tipo son obligatorios")
		return
	}

	chatbot, err := ctrl.chatbotService.Create(
		c.Request.Context(), tenantID,
		service.CreateChatbotParams{
			Nombre:             req.Nombre,
			Tipo:               req.Tipo,
			Descripcion:        req.Descripcion,
			ModeloIA:           req.ModeloIA,
			PromptSistema:      req.PromptSistema,
			Temperatura:        req.Temperatura,
			MaxTokensRespuesta: req.MaxTokensRespuesta,
			CreadoPor:          userID,
		},
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if chatbot != nil {
		ctrl.auditRepo.RegistrarAccionChatbot(
			tenantID, userID, chatbot.ID,
			repo.AccionAuditCrearChatbot,
			map[string]interface{}{"descripcion": req.Descripcion, "modelo_ia": req.ModeloIA},
			helper.GetClientIP(c),
		)
	}
	helper.Created(c, chatbot)
}

// Update PUT /api/v1/chatbots/:id
func (ctrl *ChatbotController) Update(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	var req dto.UpdateChatbotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre y tipo son obligatorios")
		return
	}

	params := service.UpdateChatbotParams{
		Nombre:              req.Nombre,
		Tipo:                req.Tipo,
		Descripcion:         req.Descripcion,
		Activo:              req.Activo,
		ModeloIA:            req.ModeloIA,
		PromptSistema:       req.PromptSistema,
		Temperatura:         req.Temperatura,
		MaxTokensRespuesta:  req.MaxTokensRespuesta,
		PuedeLeerReclamos:   req.PuedeLeerReclamos,
		PuedeResponder:      req.PuedeResponder,
		PuedeCambiarEstado:  req.PuedeCambiarEstado,
		PuedeEnviarMensajes: req.PuedeEnviarMensajes,
		PuedeLeerMetricas:   req.PuedeLeerMetricas,
		RequiereAprobacion:  req.RequiereAprobacion,
	}

	if err := ctrl.chatbotService.Update(
		c.Request.Context(), tenantID, chatbotID, params,
	); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Chatbot actualizado"})
}

// Deactivate POST /api/v1/chatbots/:id/deactivate
func (ctrl *ChatbotController) Deactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	if err := ctrl.chatbotService.Deactivate(c.Request.Context(), tenantID, chatbotID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Chatbot desactivado y API keys revocadas"})
}

// Reactivate POST /api/v1/chatbots/:id/reactivate
func (ctrl *ChatbotController) Reactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	if err := ctrl.chatbotService.Reactivate(c.Request.Context(), tenantID, chatbotID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Chatbot reactivado"})
}

// Delete DELETE /api/v1/chatbots/:id
func (ctrl *ChatbotController) Delete(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	if err := ctrl.chatbotService.Delete(c.Request.Context(), tenantID, chatbotID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.NoContent(c)
}

// HealthCheck GET /api/v1/chatbots/:id/health
func (ctrl *ChatbotController) HealthCheck(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	result, err := ctrl.chatbotService.HealthCheck(c.Request.Context(), tenantID, chatbotID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, result)
}

// HealthStream GET /api/v1/chatbots/:id/health/stream (SSE)
func (ctrl *ChatbotController) HealthStream(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.Flush()

	ctx := c.Request.Context()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Enviar inmediatamente el primer health check
	sendHealth := func() bool {
		result, err := ctrl.chatbotService.HealthCheck(ctx, tenantID, chatbotID)
		if err != nil {
			return false
		}
		data, _ := json.Marshal(result)
		_, writeErr := fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		if writeErr != nil {
			return false
		}
		c.Writer.Flush()
		return true
	}

	if !sendHealth() {
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !sendHealth() {
				return
			}
		}
	}
}

// --- AI Providers ---

// GetAIProviders GET /api/v1/chatbots/ai-providers
func (ctrl *ChatbotController) GetAIProviders(c *gin.Context) {
	primary := ai.GatewayConfig{
		Provider: ctrl.aiConfig.Provider,
		APIKey:   ctrl.aiConfig.APIKey,
		Model:    ctrl.aiConfig.Model,
		BaseURL:  ctrl.aiConfig.BaseURL,
	}

	var fallback *ai.GatewayConfig
	if ctrl.aiConfig.FallbackProvider != "" {
		fallback = &ai.GatewayConfig{
			Provider: ctrl.aiConfig.FallbackProvider,
			APIKey:   ctrl.aiConfig.FallbackAPIKey,
			Model:    ctrl.aiConfig.FallbackModel,
			BaseURL:  ctrl.aiConfig.FallbackBaseURL,
		}
	}

	var extras []ai.ExtraGatewayConfig
	for _, ep := range ctrl.aiConfig.ExtraProviders {
		extras = append(extras, ai.ExtraGatewayConfig{
			ID: ep.ID,
			GatewayConfig: ai.GatewayConfig{
				Provider: ep.Provider,
				APIKey:   ep.APIKey,
				Model:    ep.Model,
				BaseURL:  ep.BaseURL,
			},
		})
	}

	providers := ai.GetConfiguredProviders(primary, fallback, extras)
	helper.Success(c, providers)
}

// --- API Keys ---

// GetAPIKeys GET /api/v1/chatbots/:id/api-keys
func (ctrl *ChatbotController) GetAPIKeys(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	keys, err := ctrl.chatbotService.GetAPIKeys(c.Request.Context(), tenantID, chatbotID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, keys)
}

// GenerateAPIKey POST /api/v1/chatbots/:id/api-keys
func (ctrl *ChatbotController) GenerateAPIKey(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)

	chatbotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de chatbot inválido")
		return
	}

	var req dto.CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre y entorno son obligatorios")
		return
	}

	key, plainKey, err := ctrl.chatbotService.GenerateAPIKey(
		c.Request.Context(), tenantID, chatbotID,
		req.Nombre, req.Entorno, userID,
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	ctrl.auditRepo.RegistrarAccionAPIKey(
		tenantID, userID, chatbotID, key.ID,
		repo.AccionAuditGenerarAPIKey,
		nil, // el helper trae nombre del chatbot, prefix, entorno automáticamente
		helper.GetClientIP(c),
	)

	helper.Created(c, dto.APIKeyResponse{
		ID:        key.ID,
		Nombre:    key.Nombre,
		KeyPrefix: key.KeyPrefix,
		PlainKey:  plainKey,
		Entorno:   key.Entorno,
		Activa:    key.Activa,
	})
}

// RevokeAPIKey DELETE /api/v1/chatbots/:id/api-keys/:keyId
func (ctrl *ChatbotController) RevokeAPIKey(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		helper.ValidationError(c, "ID de API key inválido")
		return
	}

	// Snapshot ANTES de revocar para que el helper enriquecedor encuentre la
	// key con sus datos antes de marcarse como inactiva.
	actorID, _ := helper.GetUserID(c)
	chatbotID, _ := uuid.Parse(c.Param("id"))
	ctrl.auditRepo.RegistrarAccionAPIKey(
		tenantID, actorID, chatbotID, keyID,
		repo.AccionAuditRevocarAPIKey,
		nil,
		helper.GetClientIP(c),
	)
	if err := ctrl.chatbotService.RevokeAPIKey(c.Request.Context(), tenantID, keyID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.NoContent(c)
}