package service

import (
	"context"
	"fmt"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type TenantService struct {
	tenantRepo *repo.TenantRepo
}

func NewTenantService(tenantRepo *repo.TenantRepo) *TenantService {
	return &TenantService{tenantRepo: tenantRepo}
}

func (s *TenantService) GetByTenantID(ctx context.Context, tenantID uuid.UUID) (*model.Tenant, error) {
	t, err := s.tenantRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("tenant_service.GetByTenantID: %w", err)
	}
	if t == nil {
		return nil, apperror.ErrNotFound
	}
	return t, nil
}

func (s *TenantService) GetBySlug(ctx context.Context, slug string) (*model.Tenant, error) {
	t, err := s.tenantRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("tenant_service.GetBySlug: %w", err)
	}
	if t == nil {
		return nil, apperror.ErrNotFound
	}
	return t, nil
}

func (s *TenantService) Create(ctx context.Context, t *model.Tenant) error {
	existing, err := s.tenantRepo.GetBySlug(ctx, t.Slug)
	if err != nil {
		return fmt.Errorf("tenant_service.Create: %w", err)
	}
	if existing != nil {
		return apperror.ErrConflict
	}

	if err := s.tenantRepo.Create(ctx, t); err != nil {
		return fmt.Errorf("tenant_service.Create: %w", err)
	}
	return nil
}

func (s *TenantService) Update(ctx context.Context, t *model.Tenant) error {
	err := s.tenantRepo.Update(ctx, t)
	if err != nil && err.Error() == "optimistic_lock" {
		return apperror.ErrOptimisticLock
	}
	if err != nil {
		return fmt.Errorf("tenant_service.Update: %w", err)
	}
	return nil
}