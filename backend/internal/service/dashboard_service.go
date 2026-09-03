package service

import (
	"context"
	"fmt"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type DashboardService struct {
	dashboardRepo *repo.DashboardRepo
}

func NewDashboardService(dashboardRepo *repo.DashboardRepo) *DashboardService {
	return &DashboardService{dashboardRepo: dashboardRepo}
}

func (s *DashboardService) GetUsoTenant(ctx context.Context, tenantID uuid.UUID) (*model.UsoTenant, error) {
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("dashboard_service.GetUsoTenant: %w", err)
	}
	if uso == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	return uso, nil
}