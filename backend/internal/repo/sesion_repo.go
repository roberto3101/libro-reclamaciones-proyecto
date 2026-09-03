package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type SesionRepo struct {
	db *sql.DB
}

func NewSesionRepo(db *sql.DB) *SesionRepo {
	return &SesionRepo{db: db}
}

func (r *SesionRepo) Create(ctx context.Context, s *model.Sesion) error {
	query := `
		INSERT INTO sesiones_admin (
			tenant_id, usuario_id, token_hash, ip_address, user_agent, fecha_expiracion
		) VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, fecha_inicio`

	return r.db.QueryRowContext(ctx, query,
		s.TenantID, s.UsuarioID, s.TokenHash, s.IPAddress, s.UserAgent, s.FechaExpiracion,
	).Scan(&s.ID, &s.FechaInicio)
}

func (r *SesionRepo) InvalidateByUsuario(ctx context.Context, tenantID, usuarioID uuid.UUID) error {
	query := `UPDATE sesiones_admin SET activa = false WHERE tenant_id = $1 AND usuario_id = $2 AND activa = true`
	_, err := r.db.ExecContext(ctx, query, tenantID, usuarioID)
	if err != nil {
		return fmt.Errorf("sesion_repo.InvalidateByUsuario: %w", err)
	}
	return nil
}

func (r *SesionRepo) InvalidateByToken(ctx context.Context, tokenHash string) error {
	query := `UPDATE sesiones_admin SET activa = false WHERE token_hash = $1 AND activa = true`
	_, err := r.db.ExecContext(ctx, query, tokenHash)
	if err != nil {
		return fmt.Errorf("sesion_repo.InvalidateByToken: %w", err)
	}
	return nil
}

func (r *SesionRepo) IsValid(ctx context.Context, tokenHash string) (bool, error) {
	var activa bool
	err := r.db.QueryRowContext(ctx,
		"SELECT activa FROM sesiones_admin WHERE token_hash = $1 AND activa = true AND fecha_expiracion > $2",
		tokenHash, time.Now(),
	).Scan(&activa)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("sesion_repo.IsValid: %w", err)
	}
	return activa, nil
}