package service

import (
	"context"
	"fmt"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type SedeService struct {
	sedeRepo      *repo.SedeRepo
	dashboardRepo *repo.DashboardRepo
}

func NewSedeService(sedeRepo *repo.SedeRepo, dashboardRepo *repo.DashboardRepo) *SedeService {
	return &SedeService{
		sedeRepo:      sedeRepo,
		dashboardRepo: dashboardRepo,
	}
}

func (s *SedeService) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]model.Sede, error) {
	return s.sedeRepo.GetByTenant(ctx, tenantID)
}

func (s *SedeService) GetByTenantAll(ctx context.Context, tenantID uuid.UUID) ([]model.Sede, error) {
	return s.sedeRepo.GetByTenantAll(ctx, tenantID)
}

func (s *SedeService) GetByID(ctx context.Context, tenantID, sedeID uuid.UUID) (*model.Sede, error) {
	sede, err := s.sedeRepo.GetByID(ctx, tenantID, sedeID)
	if err != nil {
		return nil, fmt.Errorf("sede_service.GetByID: %w", err)
	}
	if sede == nil {
		return nil, apperror.ErrNotFound
	}
	return sede, nil
}

func (s *SedeService) GetBySlug(ctx context.Context, tenantID uuid.UUID, slug string) (*model.Sede, error) {
	sede, err := s.sedeRepo.GetBySlug(ctx, tenantID, slug)
	if err != nil {
		return nil, fmt.Errorf("sede_service.GetBySlug: %w", err)
	}
	if sede == nil {
		return nil, apperror.ErrNotFound
	}
	return sede, nil
}

func (s *SedeService) Create(ctx context.Context, sede *model.Sede) error {
	// Validar límite del plan
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, sede.TenantID)
	if err != nil {
		return fmt.Errorf("sede_service.Create: %w", err)
	}
	if uso == nil {
		return apperror.ErrSuscripcionInactiva
	}
	if !uso.CanCreateSede() {
		return apperror.ErrPlanLimitSedes.Withf(uso.LimiteSedes)
	}

	// Validar slug único
	existing, err := s.sedeRepo.GetBySlug(ctx, sede.TenantID, sede.Slug)
	if err != nil {
		return fmt.Errorf("sede_service.Create: %w", err)
	}
	if existing != nil {
		return apperror.ErrConflict
	}

	// Validar que no exista otra sede principal
	if sede.EsPrincipal {
		principal, err := s.sedeRepo.GetPrincipal(ctx, sede.TenantID)
		if err != nil {
			return fmt.Errorf("sede_service.Create: %w", err)
		}
		if principal != nil {
			return apperror.ErrSedePrincipal
		}
	}

	if err := s.sedeRepo.Create(ctx, sede); err != nil {
		return fmt.Errorf("sede_service.Create: %w", err)
	}
	return nil
}

func (s *SedeService) Update(ctx context.Context, sede *model.Sede) error {
	existing, err := s.sedeRepo.GetByID(ctx, sede.TenantID, sede.ID)
	if err != nil {
		return fmt.Errorf("sede_service.Update: %w", err)
	}
	if existing == nil {
		return apperror.ErrNotFound
	}

	// Validar que no exista otra sede principal (distinta a la actual)
	if sede.EsPrincipal {
		principal, err := s.sedeRepo.GetPrincipal(ctx, sede.TenantID)
		if err != nil {
			return fmt.Errorf("sede_service.Update: %w", err)
		}
		if principal != nil && principal.ID != sede.ID {
			return apperror.ErrSedePrincipal
		}
	}

	if err := s.sedeRepo.Update(ctx, sede); err != nil {
		return fmt.Errorf("sede_service.Update: %w", err)
	}
	return nil
}

func (s *SedeService) Deactivate(ctx context.Context, tenantID, sedeID uuid.UUID) error {
	existing, err := s.sedeRepo.GetByID(ctx, tenantID, sedeID)
	if err != nil {
		return fmt.Errorf("sede_service.Deactivate: %w", err)
	}
	if existing == nil {
		return apperror.ErrNotFound
	}
	if existing.EsPrincipal {
		return apperror.New(400, "SEDE_PRINCIPAL", "No puedes desactivar la sede principal")
	}

	return s.sedeRepo.Deactivate(ctx, tenantID, sedeID)
}

func (s *SedeService) Reactivate(ctx context.Context, tenantID, sedeID uuid.UUID) error {
	existing, err := s.sedeRepo.GetByID(ctx, tenantID, sedeID)
	if err != nil {
		return fmt.Errorf("sede_service.Reactivate: %w", err)
	}
	if existing == nil {
		return apperror.ErrNotFound
	}

	// Validar límite del plan (reactivar cuenta como una sede activa más)
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("sede_service.Reactivate: %w", err)
	}
	if uso == nil {
		return apperror.ErrSuscripcionInactiva
	}
	if !uso.CanCreateSede() {
		return apperror.ErrPlanLimitSedes.Withf(uso.LimiteSedes)
	}

	return s.sedeRepo.Reactivate(ctx, tenantID, sedeID)
}