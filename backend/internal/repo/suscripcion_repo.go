package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type SuscripcionRepo struct {
	db *sql.DB
}

func NewSuscripcionRepo(db *sql.DB) *SuscripcionRepo {
	return &SuscripcionRepo{db: db}
}

// ─── Columnas comunes (DRY) ─────────────────────────────────────────────────

const columnasSelectSuscripcion = `
	tenant_id, id, plan_id, estado, ciclo,
	fecha_inicio, fecha_fin, fecha_proximo_cobro,
	es_trial, dias_trial, fecha_fin_trial,
	override_max_sedes, override_max_usuarios, override_max_reclamos,
	override_max_chatbots, override_max_canales_whatsapp, override_max_storage_mb,
	referencia_pago, metodo_pago, activado_por, activado_por_usuario_id, notas,
	fecha_creacion, fecha_actualizacion`

func scanSuscripcion(row interface{ Scan(...interface{}) error }) (*model.Suscripcion, error) {
	s := &model.Suscripcion{}
	err := row.Scan(
		&s.TenantID, &s.ID, &s.PlanID, &s.Estado, &s.Ciclo,
		&s.FechaInicio, &s.FechaFin, &s.FechaProximoCobro,
		&s.EsTrial, &s.DiasTrial, &s.FechaFinTrial,
		&s.OverrideMaxSedes, &s.OverrideMaxUsuarios, &s.OverrideMaxReclamos,
		&s.OverrideMaxChatbots, &s.OverrideMaxCanalesWhatsApp, &s.OverrideMaxStorageMB,
		&s.ReferenciaPago, &s.MetodoPago, &s.ActivadoPor, &s.ActivadoPorUsuarioID, &s.Notas,
		&s.FechaCreacion, &s.FechaActualizacion,
	)
	return s, err
}

// scanSuscripcionConUsuario escanea una suscripción + nombre del usuario que la activó (LEFT JOIN).
func scanSuscripcionConUsuario(row interface{ Scan(...interface{}) error }) (*model.Suscripcion, error) {
	s := &model.Suscripcion{}
	err := row.Scan(
		&s.TenantID, &s.ID, &s.PlanID, &s.Estado, &s.Ciclo,
		&s.FechaInicio, &s.FechaFin, &s.FechaProximoCobro,
		&s.EsTrial, &s.DiasTrial, &s.FechaFinTrial,
		&s.OverrideMaxSedes, &s.OverrideMaxUsuarios, &s.OverrideMaxReclamos,
		&s.OverrideMaxChatbots, &s.OverrideMaxCanalesWhatsApp, &s.OverrideMaxStorageMB,
		&s.ReferenciaPago, &s.MetodoPago, &s.ActivadoPor, &s.ActivadoPorUsuarioID, &s.Notas,
		&s.FechaCreacion, &s.FechaActualizacion,
		&s.ActivadoPorUsuarioNombre,
	)
	return s, err
}

// ─── Queries ────────────────────────────────────────────────────────────────

// GetActiva retorna la suscripción activa (ACTIVA o TRIAL) de un tenant.
func (r *SuscripcionRepo) GetActiva(ctx context.Context, tenantID uuid.UUID) (*model.Suscripcion, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM suscripciones
		WHERE tenant_id = $1 AND estado IN ('ACTIVA', 'TRIAL')
		LIMIT 1`, columnasSelectSuscripcion)

	s, err := scanSuscripcion(r.db.QueryRowContext(ctx, query, tenantID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("suscripcion_repo.GetActiva: %w", err)
	}
	return s, nil
}

// GetByID retorna una suscripción específica.
func (r *SuscripcionRepo) GetByID(ctx context.Context, tenantID, suscripcionID uuid.UUID) (*model.Suscripcion, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM suscripciones
		WHERE tenant_id = $1 AND id = $2`, columnasSelectSuscripcion)

	s, err := scanSuscripcion(r.db.QueryRowContext(ctx, query, tenantID, suscripcionID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("suscripcion_repo.GetByID: %w", err)
	}
	return s, nil
}

// GetHistorial retorna todas las suscripciones (activas e históricas) de un tenant,
// con el nombre del usuario que activó cada una.
func (r *SuscripcionRepo) GetHistorial(ctx context.Context, tenantID uuid.UUID) ([]model.Suscripcion, error) {
	query := `
		SELECT s.tenant_id, s.id, s.plan_id, s.estado, s.ciclo,
			s.fecha_inicio, s.fecha_fin, s.fecha_proximo_cobro,
			s.es_trial, s.dias_trial, s.fecha_fin_trial,
			s.override_max_sedes, s.override_max_usuarios, s.override_max_reclamos,
			s.override_max_chatbots, s.override_max_canales_whatsapp, s.override_max_storage_mb,
			s.referencia_pago, s.metodo_pago, s.activado_por, s.activado_por_usuario_id, s.notas,
			s.fecha_creacion, s.fecha_actualizacion,
			u.nombre_completo
		FROM suscripciones s
		LEFT JOIN usuarios_admin u ON u.id = s.activado_por_usuario_id AND u.tenant_id = s.tenant_id
		WHERE s.tenant_id = $1
		ORDER BY s.fecha_creacion DESC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("suscripcion_repo.GetHistorial: %w", err)
	}
	defer rows.Close()

	var suscripciones []model.Suscripcion
	for rows.Next() {
		s, err := scanSuscripcionConUsuario(rows)
		if err != nil {
			return nil, fmt.Errorf("suscripcion_repo.scan: %w", err)
		}
		suscripciones = append(suscripciones, *s)
	}
	return suscripciones, rows.Err()
}

// ListarTrialsVencidos retorna suscripciones TRIAL cuyo trial ya venció.
func (r *SuscripcionRepo) ListarTrialsVencidos(ctx context.Context) ([]model.Suscripcion, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM suscripciones
		WHERE estado = 'TRIAL'
		  AND es_trial = true
		  AND fecha_fin_trial < $1`, columnasSelectSuscripcion)

	rows, err := r.db.QueryContext(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("suscripcion_repo.ListarTrialsVencidos: %w", err)
	}
	defer rows.Close()

	var suscripciones []model.Suscripcion
	for rows.Next() {
		s, err := scanSuscripcion(rows)
		if err != nil {
			return nil, fmt.Errorf("suscripcion_repo.scan: %w", err)
		}
		suscripciones = append(suscripciones, *s)
	}
	return suscripciones, rows.Err()
}

// ─── Comandos ───────────────────────────────────────────────────────────────

// Create inserta una nueva suscripción.
func (r *SuscripcionRepo) Create(ctx context.Context, s *model.Suscripcion) error {
	query := `
		INSERT INTO suscripciones (
			tenant_id, plan_id, estado, ciclo,
			fecha_inicio, fecha_fin, fecha_proximo_cobro,
			es_trial, dias_trial, fecha_fin_trial,
			override_max_sedes, override_max_usuarios, override_max_reclamos,
			override_max_chatbots, override_max_canales_whatsapp, override_max_storage_mb,
			referencia_pago, metodo_pago, activado_por, activado_por_usuario_id, notas
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
		RETURNING id, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		s.TenantID, s.PlanID, s.Estado, s.Ciclo,
		s.FechaInicio, s.FechaFin, s.FechaProximoCobro,
		s.EsTrial, s.DiasTrial, s.FechaFinTrial,
		s.OverrideMaxSedes, s.OverrideMaxUsuarios, s.OverrideMaxReclamos,
		s.OverrideMaxChatbots, s.OverrideMaxCanalesWhatsApp, s.OverrideMaxStorageMB,
		s.ReferenciaPago, s.MetodoPago, s.ActivadoPor, s.ActivadoPorUsuarioID, s.Notas,
	).Scan(&s.ID, &s.FechaCreacion, &s.FechaActualizacion)
}

// CancelActiva cancela la suscripción activa de un tenant.
func (r *SuscripcionRepo) CancelActiva(ctx context.Context, tenantID uuid.UUID) error {
	query := `
		UPDATE suscripciones
		SET estado = 'CANCELADA', fecha_fin = $1, fecha_actualizacion = $1

		WHERE tenant_id = $2 AND estado IN ('ACTIVA', 'TRIAL')`

	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID)
	if err != nil {
		return fmt.Errorf("suscripcion_repo.CancelActiva: %w", err)
	}
	return nil
}

// CambiarEstado actualiza el estado de una suscripción específica.
func (r *SuscripcionRepo) CambiarEstado(ctx context.Context, tenantID, suscripcionID uuid.UUID, nuevoEstado string) error {
	query := `
		UPDATE suscripciones
		SET estado = $1, fecha_actualizacion = $2
		WHERE tenant_id = $3 AND id = $4`

	_, err := r.db.ExecContext(ctx, query, nuevoEstado, time.Now(), tenantID, suscripcionID)
	if err != nil {
		return fmt.Errorf("suscripcion_repo.CambiarEstado: %w", err)
	}
	return nil
}

// ActualizarOverrides modifica los overrides de una suscripción.
func (r *SuscripcionRepo) ActualizarOverrides(ctx context.Context, tenantID, suscripcionID uuid.UUID,
	sedes, usuarios, reclamos, chatbots, canalesWA, storageMB *int64) error {

	query := `
		UPDATE suscripciones SET
			override_max_sedes = $1,
			override_max_usuarios = $2,
			override_max_reclamos = $3,
			override_max_chatbots = $4,
			override_max_canales_whatsapp = $5,
			override_max_storage_mb = $6,
			fecha_actualizacion = $7
		WHERE tenant_id = $8 AND id = $9`

	_, err := r.db.ExecContext(ctx, query,
		sedes, usuarios, reclamos, chatbots, canalesWA, storageMB,
		time.Now(), tenantID, suscripcionID,
	)
	if err != nil {
		return fmt.Errorf("suscripcion_repo.ActualizarOverrides: %w", err)
	}
	return nil
}

// MarcarVencidas cambia estado de TRIAL a VENCIDA para suscripciones cuyo trial expiró.
// Retorna el número de suscripciones afectadas.
func (r *SuscripcionRepo) MarcarVencidas(ctx context.Context) (int64, error) {
	query := `
		UPDATE suscripciones
		SET estado = 'VENCIDA', fecha_actualizacion = $1
		WHERE estado = 'TRIAL'
		  AND es_trial = true
		  AND fecha_fin_trial < $1`

	result, err := r.db.ExecContext(ctx, query, time.Now())
	if err != nil {
		return 0, fmt.Errorf("suscripcion_repo.MarcarVencidas: %w", err)
	}
	return result.RowsAffected()
}
