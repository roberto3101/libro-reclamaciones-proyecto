package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type RolRepo struct {
	db *sql.DB
}

func NewRolRepo(db *sql.DB) *RolRepo {
	return &RolRepo{db: db}
}

// ── Columnas reutilizables ──

const rolColumns = `tenant_id, id, slug, nombre, descripcion, color, permisos, es_admin, es_base, orden, fecha_creacion, fecha_actualizacion`

// ── Queries ──

// GetByTenantID retorna todos los roles de un tenant ordenados.
func (r *RolRepo) GetByTenantID(ctx context.Context, tenantID uuid.UUID) ([]model.RolTenant, error) {
	query := `
		SELECT ` + rolColumns + `
		FROM roles_tenant
		WHERE tenant_id = $1
		ORDER BY orden ASC, fecha_creacion ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("rol_repo.GetByTenantID: %w", err)
	}
	defer rows.Close()

	return r.scanRoles(rows)
}

// GetByID retorna un rol por su ID.
func (r *RolRepo) GetByID(ctx context.Context, tenantID, rolID uuid.UUID) (*model.RolTenant, error) {
	query := `SELECT ` + rolColumns + ` FROM roles_tenant WHERE tenant_id = $1 AND id = $2`
	return r.scanOne(ctx, query, tenantID, rolID)
}

// GetBySlug retorna un rol por su slug (usado por el middleware de permisos).
func (r *RolRepo) GetBySlug(ctx context.Context, tenantID uuid.UUID, slug string) (*model.RolTenant, error) {
	query := `SELECT ` + rolColumns + ` FROM roles_tenant WHERE tenant_id = $1 AND slug = $2`
	return r.scanOne(ctx, query, tenantID, slug)
}

// Create inserta un nuevo rol.
func (r *RolRepo) Create(ctx context.Context, rol *model.RolTenant) error {
	query := `
		INSERT INTO roles_tenant (
			tenant_id, slug, nombre, descripcion, color, permisos, es_admin, es_base, orden
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		rol.TenantID, rol.Slug, rol.Nombre, rol.Descripcion,
		rol.Color, rol.Permisos, rol.EsAdmin, rol.EsBase, rol.Orden,
	).Scan(&rol.ID, &rol.FechaCreacion, &rol.FechaActualizacion)
}

// Update actualiza un rol existente.
func (r *RolRepo) Update(ctx context.Context, rol *model.RolTenant) error {
	query := `
		UPDATE roles_tenant SET
			nombre = $1, descripcion = $2, color = $3,
			permisos = $4, es_admin = $5, orden = $6, fecha_actualizacion = $7
		WHERE tenant_id = $8 AND id = $9
		RETURNING fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		rol.Nombre, rol.Descripcion, rol.Color,
		rol.Permisos, rol.EsAdmin, rol.Orden, time.Now(),
		rol.TenantID, rol.ID,
	).Scan(&rol.FechaActualizacion)
}

// Delete elimina un rol por ID.
func (r *RolRepo) Delete(ctx context.Context, tenantID, rolID uuid.UUID) error {
	query := `DELETE FROM roles_tenant WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.ExecContext(ctx, query, tenantID, rolID)
	if err != nil {
		return fmt.Errorf("rol_repo.Delete: %w", err)
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CountUsuariosPorRol cuenta los usuarios que tienen un rol específico (por slug).
// Usa LOWER() porque la tabla usuarios_admin puede guardar el rol en mayúsculas (ej: "SOPORTE").
func (r *RolRepo) CountUsuariosPorRol(ctx context.Context, tenantID uuid.UUID, slug string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM usuarios_admin WHERE tenant_id = $1 AND LOWER(rol) = LOWER($2) AND activo = true",
		tenantID, slug,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("rol_repo.CountUsuariosPorRol: %w", err)
	}
	return count, nil
}

// CountByTenant cuenta el total de roles de un tenant.
func (r *RolRepo) CountByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM roles_tenant WHERE tenant_id = $1", tenantID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("rol_repo.CountByTenant: %w", err)
	}
	return count, nil
}

// ── Scanners ──

func (r *RolRepo) scanOne(ctx context.Context, query string, args ...interface{}) (*model.RolTenant, error) {
	rol := &model.RolTenant{}
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&rol.TenantID, &rol.ID, &rol.Slug, &rol.Nombre, &rol.Descripcion,
		&rol.Color, &rol.Permisos, &rol.EsAdmin, &rol.EsBase, &rol.Orden,
		&rol.FechaCreacion, &rol.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("rol_repo.scanOne: %w", err)
	}
	return rol, nil
}

func (r *RolRepo) scanRoles(rows *sql.Rows) ([]model.RolTenant, error) {
	roles := []model.RolTenant{}
	for rows.Next() {
		var rol model.RolTenant
		if err := rows.Scan(
			&rol.TenantID, &rol.ID, &rol.Slug, &rol.Nombre, &rol.Descripcion,
			&rol.Color, &rol.Permisos, &rol.EsAdmin, &rol.EsBase, &rol.Orden,
			&rol.FechaCreacion, &rol.FechaActualizacion,
		); err != nil {
			return nil, fmt.Errorf("rol_repo.scan: %w", err)
		}
		roles = append(roles, rol)
	}
	return roles, rows.Err()
}
