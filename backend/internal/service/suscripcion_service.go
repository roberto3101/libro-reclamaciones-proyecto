package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type SuscripcionService struct {
	suscripcionRepo *repo.SuscripcionRepo
	planRepo        *repo.PlanRepo
}

func NewSuscripcionService(suscripcionRepo *repo.SuscripcionRepo, planRepo *repo.PlanRepo) *SuscripcionService {
	return &SuscripcionService{
		suscripcionRepo: suscripcionRepo,
		planRepo:        planRepo,
	}
}

// ─── Queries ────────────────────────────────────────────────────────────────

// GetActiva retorna la suscripción activa del tenant.
func (s *SuscripcionService) GetActiva(ctx context.Context, tenantID uuid.UUID) (*model.Suscripcion, error) {
	sus, err := s.suscripcionRepo.GetActiva(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("suscripcion_service.GetActiva: %w", err)
	}
	if sus == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	return sus, nil
}

// GetActivaConPlan retorna suscripción + datos del plan en un solo struct.
type SuscripcionConPlan struct {
	Suscripcion model.Suscripcion `json:"suscripcion"`
	Plan        model.Plan        `json:"plan"`
}

func (s *SuscripcionService) GetActivaConPlan(ctx context.Context, tenantID uuid.UUID) (*SuscripcionConPlan, error) {
	sus, err := s.suscripcionRepo.GetActiva(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("suscripcion_service.GetActivaConPlan: %w", err)
	}
	if sus == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}

	plan, err := s.planRepo.GetByID(ctx, sus.PlanID)
	if err != nil || plan == nil {
		return nil, fmt.Errorf("suscripcion_service.GetActivaConPlan plan: %w", err)
	}

	return &SuscripcionConPlan{Suscripcion: *sus, Plan: *plan}, nil
}

// GetHistorial retorna todas las suscripciones del tenant.
func (s *SuscripcionService) GetHistorial(ctx context.Context, tenantID uuid.UUID) ([]model.Suscripcion, error) {
	return s.suscripcionRepo.GetHistorial(ctx, tenantID)
}

// ─── Comandos ───────────────────────────────────────────────────────────────

// CambiarPlan cancela la suscripción actual y crea una nueva.
// Valida que el plan existe y está activo.
func (s *SuscripcionService) CambiarPlan(ctx context.Context, tenantID uuid.UUID, params CambiarPlanParams) (*model.Suscripcion, error) {
	// Validar plan destino
	plan, err := s.planRepo.GetByCodigo(ctx, params.NuevoPlanCodigo)
	if err != nil {
		return nil, fmt.Errorf("suscripcion_service.CambiarPlan: %w", err)
	}
	if plan == nil || !plan.Activo {
		return nil, apperror.New(404, "PLAN_NO_ENCONTRADO",
			fmt.Sprintf("El plan %s no existe o no está disponible", params.NuevoPlanCodigo))
	}

	// No permitir "cambiar" al mismo plan
	actual, _ := s.suscripcionRepo.GetActiva(ctx, tenantID)
	if actual != nil && actual.PlanID == plan.ID {
		return nil, apperror.New(400, "MISMO_PLAN", "Ya tienes este plan activo")
	}

	// Cancelar suscripción actual (si existe)
	if err := s.suscripcionRepo.CancelActiva(ctx, tenantID); err != nil {
		return nil, fmt.Errorf("suscripcion_service.CambiarPlan cancel: %w", err)
	}

	// Validar ciclo
	ciclo := params.Ciclo
	if ciclo != model.CicloAnual {
		ciclo = model.CicloMensual
	}

	// Calcular próximo cobro
	var proximoCobro time.Time
	if ciclo == model.CicloAnual {
		proximoCobro = time.Now().AddDate(1, 0, 0)
	} else {
		proximoCobro = time.Now().AddDate(0, 1, 0)
	}

	nueva := &model.Suscripcion{
		TenantModel:   model.TenantModel{TenantID: tenantID},
		PlanID:        plan.ID,
		Estado:        model.SuscripcionActiva,
		Ciclo:         ciclo,
		FechaInicio:   time.Now(),
		FechaProximoCobro: model.NullTime{NullTime: sql.NullTime{Time: proximoCobro, Valid: true}},
		ReferenciaPago: model.NullString{NullString: sql.NullString{
			String: params.ReferenciaPago, Valid: params.ReferenciaPago != ""}},
		MetodoPago: model.NullString{NullString: sql.NullString{
			String: params.MetodoPago, Valid: params.MetodoPago != ""}},
		ActivadoPor: model.NullString{NullString: sql.NullString{
			String: params.ActivadoPor, Valid: true}},
		ActivadoPorUsuarioID: model.NullUUID{UUID: params.UsuarioID, Valid: params.UsuarioID != uuid.Nil},
		Notas: model.NullString{NullString: sql.NullString{
			String: params.Notas, Valid: params.Notas != ""}},
	}

	if err := s.suscripcionRepo.Create(ctx, nueva); err != nil {
		return nil, fmt.Errorf("suscripcion_service.CambiarPlan create: %w", err)
	}

	fmt.Printf("[Suscripcion] ✅ Tenant %s cambió a plan %s (%s)\n", tenantID, plan.Codigo, ciclo)
	return nueva, nil
}

// CambiarPlanParams agrupa los datos para cambiar de plan.
type CambiarPlanParams struct {
	NuevoPlanCodigo string
	Ciclo           string
	ReferenciaPago  string
	MetodoPago      string
	ActivadoPor     string
	UsuarioID       uuid.UUID // Quién realizó la acción
	Notas           string
}

// CrearTrial crea una suscripción DEMO trial para un nuevo tenant.
func (s *SuscripcionService) CrearTrial(ctx context.Context, tenantID uuid.UUID, diasTrial int) (*model.Suscripcion, error) {
	planDemo, err := s.planRepo.GetByCodigo(ctx, model.PlanDemo)
	if err != nil || planDemo == nil {
		return nil, fmt.Errorf("suscripcion_service.CrearTrial: plan DEMO no encontrado")
	}

	finTrial := time.Now().AddDate(0, 0, diasTrial)

	nueva := &model.Suscripcion{
		TenantModel: model.TenantModel{TenantID: tenantID},
		PlanID:      planDemo.ID,
		Estado:      model.SuscripcionTrial,
		Ciclo:       model.CicloMensual,
		FechaInicio: time.Now(),
		EsTrial:     true,
		DiasTrial:   diasTrial,
		FechaFinTrial: model.NullTime{NullTime: sql.NullTime{Time: finTrial, Valid: true}},
		ActivadoPor: model.NullString{NullString: sql.NullString{
			String: model.ActivadoPorOnboarding, Valid: true}},
	}

	if err := s.suscripcionRepo.Create(ctx, nueva); err != nil {
		return nil, fmt.Errorf("suscripcion_service.CrearTrial: %w", err)
	}

	fmt.Printf("[Suscripcion] 🆕 Trial creado para tenant %s (%d días)\n", tenantID, diasTrial)
	return nueva, nil
}

// ActivarManual permite al superadmin activar un plan para un tenant sin pago.
// Útil para demos, cortesías, y entorno de desarrollo.
func (s *SuscripcionService) ActivarManual(ctx context.Context, tenantID uuid.UUID, planCodigo, ciclo, notas string, usuarioID uuid.UUID) (*model.Suscripcion, error) {
	return s.CambiarPlan(ctx, tenantID, CambiarPlanParams{
		NuevoPlanCodigo: planCodigo,
		Ciclo:           ciclo,
		ActivadoPor:     model.ActivadoPorAdmin,
		UsuarioID:       usuarioID,
		Notas:           notas,
	})
}

// CancelarSuscripcion cancela la suscripción activa del tenant.
func (s *SuscripcionService) CancelarSuscripcion(ctx context.Context, tenantID uuid.UUID) error {
	if err := s.suscripcionRepo.CancelActiva(ctx, tenantID); err != nil {
		return fmt.Errorf("suscripcion_service.Cancelar: %w", err)
	}
	fmt.Printf("[Suscripcion] ❌ Suscripción cancelada para tenant %s\n", tenantID)
	return nil
}

// ProcesarVencimientos marca como VENCIDA todas las suscripciones trial expiradas.
// Diseñado para ejecutarse con un cron job.
func (s *SuscripcionService) ProcesarVencimientos(ctx context.Context) (int64, error) {
	afectadas, err := s.suscripcionRepo.MarcarVencidas(ctx)
	if err != nil {
		return 0, fmt.Errorf("suscripcion_service.ProcesarVencimientos: %w", err)
	}
	if afectadas > 0 {
		fmt.Printf("[Suscripcion] ⏰ %d suscripciones trial marcadas como VENCIDAS\n", afectadas)
	}
	return afectadas, nil
}
