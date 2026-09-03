package mocks

import (
	"context"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type MockChatbotLogRepo struct {
	CreateErr        error
	CountInWindowN   int
	CountTodayN      int
	CountInWindowErr error
	CountTodayErr    error
}

func (m *MockChatbotLogRepo) Create(ctx context.Context, log *model.ChatbotLog) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	log.ID = uuid.New()
	return nil
}

func (m *MockChatbotLogRepo) CountInWindow(ctx context.Context, apiKeyID uuid.UUID, window time.Duration) (int, error) {
	if m.CountInWindowErr != nil {
		return 0, m.CountInWindowErr
	}
	return m.CountInWindowN, nil
}

func (m *MockChatbotLogRepo) CountTodayByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	if m.CountTodayErr != nil {
		return 0, m.CountTodayErr
	}
	return m.CountTodayN, nil
}