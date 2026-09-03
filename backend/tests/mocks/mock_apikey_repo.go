package mocks

import (
	"context"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type MockChatbotAPIKeyRepo struct {
	Keys       []model.APIKey
	KeyByHash  *model.APIKey
	CreateErr  error
	RevokeErr  error
	GetByHashErr error
}

func (m *MockChatbotAPIKeyRepo) GetByChatbot(ctx context.Context, tenantID, chatbotID uuid.UUID) ([]model.APIKey, error) {
	return m.Keys, nil
}

func (m *MockChatbotAPIKeyRepo) GetByHash(ctx context.Context, keyHash string) (*model.APIKey, error) {
	if m.GetByHashErr != nil {
		return nil, m.GetByHashErr
	}
	return m.KeyByHash, nil
}

func (m *MockChatbotAPIKeyRepo) Create(ctx context.Context, k *model.APIKey) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	k.ID = uuid.New()
	return nil
}

func (m *MockChatbotAPIKeyRepo) Revoke(ctx context.Context, tenantID, keyID uuid.UUID) error {
	return m.RevokeErr
}

func (m *MockChatbotAPIKeyRepo) IncrementUsage(ctx context.Context, tenantID, keyID uuid.UUID) error {
	return nil
}