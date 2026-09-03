package e2e

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func init() {
	gin.SetMode(gin.TestMode)
}

type apiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// --- API Key Middleware E2E ---

func TestBotAPI_NoAPIKey_Returns401(t *testing.T) {
	r := gin.New()
	r.Use(middleware.APIKeyMiddleware(nil, nil))
	r.GET("/api/bot/v1/reclamos", func(c *gin.Context) {
		helper.Success(c, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/bot/v1/reclamos", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}

	var resp apiResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error == nil || resp.Error.Code != "API_KEY_REQUIRED" {
		t.Fatalf("expected API_KEY_REQUIRED, got %+v", resp.Error)
	}
}

// --- Scope Middleware E2E ---

func TestBotAPI_ScopeLeerReclamos_Allowed(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		helper.SetContext(c, helper.CtxTenantID, uuid.New())
		c.Set("puede_leer_reclamos", true)
		c.Next()
	})
	r.Use(middleware.RequireChatbotScope("puede_leer_reclamos"))
	r.GET("/api/bot/v1/reclamos", func(c *gin.Context) {
		helper.Success(c, gin.H{"reclamos": []string{}})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/bot/v1/reclamos", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestBotAPI_ScopeResponder_Denied(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("puede_responder", false)
		c.Next()
	})
	r.Use(middleware.RequireChatbotScope("puede_responder"))
	r.POST("/api/bot/v1/reclamos/:id/respuesta", func(c *gin.Context) {
		helper.Success(c, gin.H{})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/bot/v1/reclamos/123/respuesta", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

// --- Context Injection E2E ---

func TestBotAPI_ContextRoundtrip(t *testing.T) {
	tenantID := uuid.New()
	chatbotID := uuid.New()
	apiKeyID := uuid.New()

	r := gin.New()
	r.Use(func(c *gin.Context) {
		helper.SetContext(c, helper.CtxTenantID, tenantID)
		helper.SetContext(c, helper.CtxChatbotID, chatbotID)
		helper.SetContext(c, helper.CtxAPIKeyID, apiKeyID)
		c.Next()
	})
	r.GET("/test", func(c *gin.Context) {
		gotTenant, _ := helper.GetTenantID(c)
		gotChatbot, _ := helper.GetChatbotID(c)
		gotKey, _ := helper.GetUUIDFromContext(c, helper.CtxAPIKeyID)

		helper.Success(c, gin.H{
			"tenant_id":  gotTenant.String(),
			"chatbot_id": gotChatbot.String(),
			"api_key_id": gotKey.String(),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp apiResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp.Success {
		t.Fatal("expected success=true")
	}

	data := resp.Data.(map[string]interface{})
	if data["tenant_id"] != tenantID.String() {
		t.Fatalf("tenant mismatch: %v", data["tenant_id"])
	}
	if data["chatbot_id"] != chatbotID.String() {
		t.Fatalf("chatbot mismatch: %v", data["chatbot_id"])
	}
	if data["api_key_id"] != apiKeyID.String() {
		t.Fatalf("apikey mismatch: %v", data["api_key_id"])
	}
}