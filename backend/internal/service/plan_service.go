package service

import (
	"context"
	"fmt"
	"strings"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type PlanService struct {
	planRepo *repo.PlanRepo
}

func NewPlanService(planRepo *repo.PlanRepo) *PlanService {
	return &PlanService{planRepo: planRepo}
}

// ─── Queries ────────────────────────────────────────────────────────────────

// GetAll retorna planes activos (para pricing page y panel del tenant).
func (s *PlanService) GetAll(ctx context.Context) ([]model.Plan, error) {
	planes, err := s.planRepo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("plan_service.GetAll: %w", err)
	}
	return planes, nil
}

// GetAllIncluyendoInactivos retorna todos los planes (superadmin).
func (s *PlanService) GetAllIncluyendoInactivos(ctx context.Context) ([]model.Plan, error) {
	planes, err := s.planRepo.GetAllIncluyendoInactivos(ctx)
	if err != nil {
		return nil, fmt.Errorf("plan_service.GetAllIncluyendoInactivos: %w", err)
	}
	return planes, nil
}

// GetByID retorna un plan por UUID.
func (s *PlanService) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	plan, err := s.planRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("plan_service.GetByID: %w", err)
	}
	if plan == nil {
		return nil, apperror.ErrNotFound
	}
	return plan, nil
}

// GetByCodigo retorna un plan por código (DEMO, EMPRENDEDOR, PYME, PRO).
func (s *PlanService) GetByCodigo(ctx context.Context, codigo string) (*model.Plan, error) {
	plan, err := s.planRepo.GetByCodigo(ctx, codigo)
	if err != nil {
		return nil, fmt.Errorf("plan_service.GetByCodigo: %w", err)
	}
	if plan == nil {
		return nil, apperror.ErrNotFound
	}
	return plan, nil
}

// ─── Comandos (superadmin) ──────────────────────────────────────────────────

// Crear registra un nuevo plan en el catálogo.
func (s *PlanService) Crear(ctx context.Context, plan *model.Plan) error {
	// Validar código único
	plan.Codigo = strings.ToUpper(strings.TrimSpace(plan.Codigo))
	if plan.Codigo == "" {
		return apperror.New(400, "PLAN_CODIGO_VACIO", "El código del plan es obligatorio")
	}

	existente, _ := s.planRepo.GetByCodigo(ctx, plan.Codigo)
	if existente != nil {
		return apperror.New(409, "PLAN_CODIGO_DUPLICADO",
			fmt.Sprintf("Ya existe un plan con código %s", plan.Codigo))
	}

	if plan.Nombre == "" {
		return apperror.New(400, "PLAN_NOMBRE_VACIO", "El nombre del plan es obligatorio")
	}

	if err := s.planRepo.Create(ctx, plan); err != nil {
		return fmt.Errorf("plan_service.Crear: %w", err)
	}
	return nil
}

// Actualizar modifica un plan existente.
func (s *PlanService) Actualizar(ctx context.Context, plan *model.Plan) error {
	existente, err := s.planRepo.GetByID(ctx, plan.ID)
	if err != nil {
		return fmt.Errorf("plan_service.Actualizar: %w", err)
	}
	if existente == nil {
		return apperror.ErrNotFound
	}

	// No permitir cambiar el código (clave de negocio).
	plan.Codigo = existente.Codigo

	if err := s.planRepo.Update(ctx, plan); err != nil {
		return fmt.Errorf("plan_service.Actualizar: %w", err)
	}
	return nil
}

// Activar habilita un plan para nuevas suscripciones.
func (s *PlanService) Activar(ctx context.Context, id uuid.UUID) error {
	plan, err := s.planRepo.GetByID(ctx, id)
	if err != nil || plan == nil {
		return apperror.ErrNotFound
	}
	plan.Activo = true
	return s.planRepo.Update(ctx, plan)
}

// Desactivar oculta un plan de nuevas suscripciones (no afecta activas).
func (s *PlanService) Desactivar(ctx context.Context, id uuid.UUID) error {
	plan, err := s.planRepo.GetByID(ctx, id)
	if err != nil || plan == nil {
		return apperror.ErrNotFound
	}

	// Verificar que no haya suscripciones activas usando este plan
	count, err := s.planRepo.ContarSuscripcionesActivas(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return apperror.New(409, "PLAN_EN_USO",
			fmt.Sprintf("No se puede desactivar: %d suscripciones activas usan este plan", count))
	}

	plan.Activo = false
	return s.planRepo.Update(ctx, plan)
}
