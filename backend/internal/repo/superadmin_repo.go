package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type SuperAdminRepo struct {
	db *sql.DB
}

func NewSuperAdminRepo(db *sql.DB) *SuperAdminRepo {
	return &SuperAdminRepo{db: db}
}

func (r *SuperAdminRepo) ObtenerPorEmail(ctx context.Context, email string) (*model.SuperAdmin, error) {
	query := `
		SELECT id, email, password_hash, nombre, activo, ultimo_acceso, fecha_creacion
		FROM superadmins
		WHERE email = $1`

	sa := &model.SuperAdmin{}
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&sa.ID, &sa.Email, &sa.PasswordHash, &sa.Nombre,
		&sa.Activo, &sa.UltimoAcceso, &sa.FechaCreacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("superadmin_repo.ObtenerPorEmail: %w", err)
	}
	return sa, nil
}

func (r *SuperAdminRepo) ObtenerPorID(ctx context.Context, id uuid.UUID) (*model.SuperAdmin, error) {
	query := `
		SELECT id, email, password_hash, nombre, activo, ultimo_acceso, fecha_creacion
		FROM superadmins
		WHERE id = $1`

	sa := &model.SuperAdmin{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&sa.ID, &sa.Email, &sa.PasswordHash, &sa.Nombre,
		&sa.Activo, &sa.UltimoAcceso, &sa.FechaCreacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("superadmin_repo.ObtenerPorID: %w", err)
	}
	return sa, nil
}

func (r *SuperAdminRepo) Crear(ctx context.Context, sa *model.SuperAdmin) error {
	query := `
		INSERT INTO superadmins (email, password_hash, nombre)
		VALUES ($1, $2, $3)
		RETURNING id, fecha_creacion`

	return r.db.QueryRowContext(ctx, query,
		sa.Email, sa.PasswordHash, sa.Nombre,
	).Scan(&sa.ID, &sa.FechaCreacion)
}

func (r *SuperAdminRepo) ListarTodos(ctx context.Context) ([]model.SuperAdmin, error) {
	query := `
		SELECT id, email, password_hash, nombre, activo, ultimo_acceso, fecha_creacion
		FROM superadmins
		ORDER BY nombre`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("superadmin_repo.ListarTodos: %w", err)
	}
	defer rows.Close()

	var admins []model.SuperAdmin
	for rows.Next() {
		var sa model.SuperAdmin
		if err := rows.Scan(
			&sa.ID, &sa.Email, &sa.PasswordHash, &sa.Nombre,
			&sa.Activo, &sa.UltimoAcceso, &sa.FechaCreacion,
		); err != nil {
			return nil, fmt.Errorf("superadmin_repo.ListarTodos scan: %w", err)
		}
		admins = append(admins, sa)
	}
	return admins, rows.Err()
}

func (r *SuperAdminRepo) ActualizarUltimoAcceso(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE superadmins SET ultimo_acceso = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("superadmin_repo.ActualizarUltimoAcceso: %w", err)
	}
	return nil
}
