package mocks

import (
	"context"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type MockChatbotRepo struct {
	Chatbots       []model.Chatbot
	ChatbotByID    *model.Chatbot
	CountActivosN  int
	CreateErr      error
	UpdateErr      error
	DeactivateErr  error
	GetByTenantErr error
	GetByIDErr     error
}

func (m *MockChatbotRepo) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]model.Chatbot, error) {
	if m.GetByTenantErr != nil {
		return nil, m.GetByTenantErr
	}
	return m.Chatbots, nil
}

func (m *MockChatbotRepo) GetByID(ctx context.Context, tenantID, chatbotID uuid.UUID) (*model.Chatbot, error) {
	if m.GetByIDErr != nil {
		return nil, m.GetByIDErr
	}
	return m.ChatbotByID, nil
}

func (m *MockChatbotRepo) Create(ctx context.Context, c *model.Chatbot) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	c.ID = uuid.New()
	return nil
}

func (m *MockChatbotRepo) Update(ctx context.Context, c *model.Chatbot) error {
	return m.UpdateErr
}

func (m *MockChatbotRepo) Deactivate(ctx context.Context, tenantID, chatbotID uuid.UUID) error {
	return m.DeactivateErr
}

func (m *MockChatbotRepo) CountActivos(ctx context.Context, tenantID uuid.UUID) (int, error) {
	return m.CountActivosN, nil
}