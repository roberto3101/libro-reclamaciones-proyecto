package service

import (
	"context"
	"fmt"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

// LimitesService es la ÚNICA fuente de verdad para validar límites del plan.
//
// Principio DRY: todos los services que necesiten validar límites llaman aquí.
// Nunca consultan v_uso_tenant ni dashboard_repo directamente.
//
// Uso:
//
//	if err := limitesService.ValidarCreacion(ctx, tenantID, model.RecursoSede); err != nil {
//	    return err // ya es un apperror con código y mensaje legible
//	}
//
//	if err := limitesService.ValidarFuncionalidad(ctx, tenantID, model.FuncWhatsApp); err != nil {
//	    return err
//	}
type LimitesService struct {
	limitesRepo *repo.LimitesRepo
	bypassDev   bool // true = no valida nada (entorno desarrollo)
}

func NewLimitesService(limitesRepo *repo.LimitesRepo, entorno string) *LimitesService {
	bypass := entorno == "development" || entorno == "dev" || entorno == "local"
	if bypass {
		fmt.Println("[INFO] LimitesService: bypass activado (entorno desarrollo) — límites de plan NO se validan")
	}
	return &LimitesService{
		limitesRepo: limitesRepo,
		bypassDev:   bypass,
	}
}

// ─── Validaciones públicas ──────────────────────────────────────────────────

// ValidarCreacion verifica que el tenant puede crear un recurso más.
// Retorna nil si puede, o un apperror.AppError si excedió el límite.
func (s *LimitesService) ValidarCreacion(ctx context.Context, tenantID uuid.UUID, recurso model.Recurso) error {
	if s.bypassDev {
		return nil
	}

	uso, err := s.obtenerUsoOError(ctx, tenantID)
	if err != nil {
		return err
	}

	if uso.PuedeCrear(recurso) {
		return nil
	}

	actual, limite := uso.LimiteDeRecurso(recurso)
	return apperror.New(
		403,
		"LIMITE_PLAN_EXCEDIDO",
		model.MensajeLimiteExcedido(recurso, actual, limite, uso.PlanNombre),
	)
}

// ValidarFuncionalidad verifica que el plan del tenant incluye una funcionalidad.
// Retorna nil si la tiene, o un apperror.AppError si no.
func (s *LimitesService) ValidarFuncionalidad(ctx context.Context, tenantID uuid.UUID, funcionalidad model.Funcionalidad) error {
	if s.bypassDev {
		return nil
	}

	uso, err := s.obtenerUsoOError(ctx, tenantID)
	if err != nil {
		return err
	}

	if uso.TieneFuncionalidad(funcionalidad) {
		return nil
	}

	return apperror.New(
		403,
		"FUNCIONALIDAD_NO_DISPONIBLE",
		model.MensajeFuncionalidadNoDisponible(funcionalidad, uso.PlanNombre),
	)
}

// ValidarSuscripcionActiva verifica que el tenant tiene suscripción activa.
func (s *LimitesService) ValidarSuscripcionActiva(ctx context.Context, tenantID uuid.UUID) error {
	if s.bypassDev {
		return nil
	}

	uso, err := s.limitesRepo.ObtenerUso(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("limites_service.ValidarSuscripcionActiva: %w", err)
	}
	if uso == nil {
		return apperror.ErrSuscripcionInactiva
	}
	return nil
}

// ─── Queries públicas ───────────────────────────────────────────────────────

// ObtenerUso retorna el snapshot completo de uso + límites del tenant.
// Útil para el dashboard, panel de suscripción, etc.
func (s *LimitesService) ObtenerUso(ctx context.Context, tenantID uuid.UUID) (*model.UsoTenant, error) {
	uso, err := s.limitesRepo.ObtenerUso(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("limites_service.ObtenerUso: %w", err)
	}
	if uso == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	return uso, nil
}

// PuedeCrear retorna true/false sin error (para checks opcionales).
func (s *LimitesService) PuedeCrear(ctx context.Context, tenantID uuid.UUID, recurso model.Recurso) bool {
	if s.bypassDev {
		return true
	}
	uso, err := s.limitesRepo.ObtenerUso(ctx, tenantID)
	if err != nil || uso == nil {
		return false
	}
	return uso.PuedeCrear(recurso)
}

// TieneFuncionalidad retorna true/false sin error.
func (s *LimitesService) TieneFuncionalidad(ctx context.Context, tenantID uuid.UUID, funcionalidad model.Funcionalidad) bool {
	if s.bypassDev {
		return true
	}
	uso, err := s.limitesRepo.ObtenerUso(ctx, tenantID)
	if err != nil || uso == nil {
		return false
	}
	return uso.TieneFuncionalidad(funcionalidad)
}

// ─── Internos ───────────────────────────────────────────────────────────────

func (s *LimitesService) obtenerUsoOError(ctx context.Context, tenantID uuid.UUID) (*model.UsoTenant, error) {
	uso, err := s.limitesRepo.ObtenerUso(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("limites_service: %w", err)
	}
	if uso == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	return uso, nil
}
