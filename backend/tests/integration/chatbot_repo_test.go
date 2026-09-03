package integration

import (
	"context"
	"testing"

	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/tests/testdata"
)

func TestChatbotRepo_Create(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible — ejecuta con: go test ./tests/integration/ -v -tags=integration")
	}

	chatbotRepo := repo.NewChatbotRepo(testDB)
	ctx := context.Background()

	c := &model.Chatbot{
		TenantModel: model.TenantModel{TenantID: testdata.TestTenantID},
		Nombre:      "Bot Integración",
		Tipo:        model.ChatbotAsistenteIA,
		Descripcion: model.NullString{String: "Bot de prueba", Valid: true},
	}

	err := chatbotRepo.Create(ctx, c)
	if err != nil {
		t.Fatalf("Create error: %v", err)
	}
	if c.ID.String() == "" {
		t.Fatal("expected ID to be set after Create")
	}

	// Cleanup
	chatbotRepo.Deactivate(ctx, testdata.TestTenantID, c.ID)
}

func TestChatbotRepo_GetByTenant(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	chatbotRepo := repo.NewChatbotRepo(testDB)
	ctx := context.Background()

	chatbots, err := chatbotRepo.GetByTenant(ctx, testdata.TestTenantID)
	if err != nil {
		t.Fatalf("GetByTenant error: %v", err)
	}

	// Puede ser 0 si no hay datos — solo verifica que no da error
	t.Logf("Found %d chatbots for tenant", len(chatbots))
}

func TestChatbotRepo_GetByID_NotFound(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	chatbotRepo := repo.NewChatbotRepo(testDB)
	ctx := context.Background()

	result, err := chatbotRepo.GetByID(ctx, testdata.TestTenantID, testdata.TestChatbotID)
	if err != nil {
		t.Fatalf("GetByID error: %v", err)
	}
	// Puede ser nil si no existe — eso es correcto (no error)
	if result != nil {
		t.Logf("Found chatbot: %s", result.Nombre)
	}
}

func TestChatbotRepo_CountActivos(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	chatbotRepo := repo.NewChatbotRepo(testDB)
	ctx := context.Background()

	count, err := chatbotRepo.CountActivos(ctx, testdata.TestTenantID)
	if err != nil {
		t.Fatalf("CountActivos error: %v", err)
	}
	t.Logf("Activos: %d", count)
}

func TestChatbotRepo_Update(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	chatbotRepo := repo.NewChatbotRepo(testDB)
	ctx := context.Background()

	// Create
	c := &model.Chatbot{
		TenantModel: model.TenantModel{TenantID: testdata.TestTenantID},
		Nombre:      "Bot Update Test",
		Tipo:        model.ChatbotCustom,
	}
	if err := chatbotRepo.Create(ctx, c); err != nil {
		t.Fatalf("Create error: %v", err)
	}

	// Update
	c.Nombre = "Bot Actualizado"
	c.Tipo = model.ChatbotWhatsapp
	c.Activo = true
	if err := chatbotRepo.Update(ctx, c); err != nil {
		t.Fatalf("Update error: %v", err)
	}

	// Verify
	updated, err := chatbotRepo.GetByID(ctx, testdata.TestTenantID, c.ID)
	if err != nil {
		t.Fatalf("GetByID error: %v", err)
	}
	if updated.Nombre != "Bot Actualizado" {
		t.Fatalf("expected 'Bot Actualizado', got %s", updated.Nombre)
	}
	if updated.Tipo != model.ChatbotWhatsapp {
		t.Fatalf("expected WHATSAPP_BOT, got %s", updated.Tipo)
	}

	// Cleanup
	chatbotRepo.Deactivate(ctx, testdata.TestTenantID, c.ID)
}