package integration

import (
	"context"
	"testing"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/tests/testdata"

	"github.com/google/uuid"
)

func TestAPIKeyRepo_CreateAndGetByHash(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	apiKeyRepo := repo.NewChatbotAPIKeyRepo(testDB)
	chatbotRepo := repo.NewChatbotRepo(testDB)
	ctx := context.Background()

	// Crear chatbot primero (FK)
	chatbot := &model.Chatbot{
		TenantModel: model.TenantModel{TenantID: testdata.TestTenantID},
		Nombre:      "Bot para APIKey test",
		Tipo:        model.ChatbotAsistenteIA,
	}
	if err := chatbotRepo.Create(ctx, chatbot); err != nil {
		t.Fatalf("Create chatbot error: %v", err)
	}

	// Generar API key — 3 return values
	plainKey, keyPrefix, err := helper.GenerateAPIKey("crb", "TEST")
	if err != nil {
		t.Fatalf("GenerateAPIKey error: %v", err)
	}
	keyHash := helper.SHA256Hash(plainKey)

	key := &model.APIKey{
		TenantModel: model.TenantModel{TenantID: testdata.TestTenantID},
		ChatbotID:   chatbot.ID,
		Nombre:      "Key Integration Test",
		KeyHash:     keyHash,
		KeyPrefix:   keyPrefix,
		Entorno:     model.EntornoTest,
		CreadoPor:   model.NullUUID{UUID: testdata.TestUserID, Valid: true},
	}

	if err := apiKeyRepo.Create(ctx, key); err != nil {
		t.Fatalf("Create APIKey error: %v", err)
	}
	if key.ID == uuid.Nil {
		t.Fatal("expected ID to be set after Create")
	}

	// GetByHash
	found, err := apiKeyRepo.GetByHash(ctx, keyHash)
	if err != nil {
		t.Fatalf("GetByHash error: %v", err)
	}
	if found == nil {
		t.Fatal("expected to find key by hash")
	}
	if found.Nombre != "Key Integration Test" {
		t.Fatalf("expected 'Key Integration Test', got %s", found.Nombre)
	}
	if found.Entorno != "TEST" {
		t.Fatalf("expected TEST, got %s", found.Entorno)
	}

	// Revoke
	if err := apiKeyRepo.Revoke(ctx, testdata.TestTenantID, key.ID); err != nil {
		t.Fatalf("Revoke error: %v", err)
	}

	// After revoke, GetByHash should return nil (only finds activa=true)
	revoked, err := apiKeyRepo.GetByHash(ctx, keyHash)
	if err != nil {
		t.Fatalf("GetByHash after revoke error: %v", err)
	}
	if revoked != nil {
		t.Fatal("expected nil after revoke (key is inactive)")
	}
}

func TestAPIKeyRepo_GetByChatbot(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	apiKeyRepo := repo.NewChatbotAPIKeyRepo(testDB)
	ctx := context.Background()

	keys, err := apiKeyRepo.GetByChatbot(ctx, testdata.TestTenantID, testdata.TestChatbotID)
	if err != nil {
		t.Fatalf("GetByChatbot error: %v", err)
	}
	t.Logf("Found %d keys for chatbot", len(keys))
}