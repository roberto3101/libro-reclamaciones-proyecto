package integration

import (
	"context"
	"testing"
	"time"

	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/tests/testdata"

	"github.com/google/uuid"
)

func TestChatbotLogRepo_Create(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	logRepo := repo.NewChatbotLogRepo(testDB)
	ctx := context.Background()

	log := &model.ChatbotLog{
		TenantModel: model.TenantModel{TenantID: testdata.TestTenantID},
		ChatbotID:   testdata.TestChatbotID,
		APIKeyID:    testdata.TestAPIKeyID,
		Metodo:      "GET",
		Endpoint:    "/api/bot/v1/reclamos",
		StatusCode:  200,
		IPAddress:   model.NullString{String: "10.0.0.1", Valid: true},
		DuracionMS:  model.NullInt64{Int64: 42, Valid: true},
		Accion:      model.NullString{String: "listar_reclamos", Valid: true},
	}

	err := logRepo.Create(ctx, log)
	if err != nil {
		t.Fatalf("Create log error: %v", err)
	}
	if log.ID == uuid.Nil {
		t.Fatal("expected ID after create")
	}
}

func TestChatbotLogRepo_CountInWindow(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	logRepo := repo.NewChatbotLogRepo(testDB)
	ctx := context.Background()

	count, err := logRepo.CountInWindow(ctx, testdata.TestAPIKeyID, time.Minute)
	if err != nil {
		t.Fatalf("CountInWindow error: %v", err)
	}
	t.Logf("Requests in last minute: %d", count)
}

func TestChatbotLogRepo_CountTodayByTenant(t *testing.T) {
	if testDB == nil {
		t.Skip("DB no disponible")
	}

	logRepo := repo.NewChatbotLogRepo(testDB)
	ctx := context.Background()

	count, err := logRepo.CountTodayByTenant(ctx, testdata.TestTenantID)
	if err != nil {
		t.Fatalf("CountTodayByTenant error: %v", err)
	}
	t.Logf("Requests today: %d", count)
}