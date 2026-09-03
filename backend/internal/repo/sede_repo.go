package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type SedeRepo struct {
	db *sql.DB
}

func NewSedeRepo(db *sql.DB) *SedeRepo {
	return &SedeRepo{db: db}
}

// ── Queries ──

func (r *SedeRepo) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]model.Sede, error) {
	query := `
		SELECT tenant_id, id, nombre, slug, codigo_sede,
			direccion, departamento, provincia, distrito, referencia,
			telefono, email, responsable_nombre, responsable_cargo,
			horario_atencion, latitud, longitud,
			activo, es_principal, fecha_creacion, fecha_actualizacion
		FROM sedes
		WHERE tenant_id = $1 AND activo = true
		ORDER BY es_principal DESC, nombre ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("sede_repo.GetByTenant: %w", err)
	}
	defer rows.Close()

	return r.scanSedes(rows)
}

func (r *SedeRepo) GetByID(ctx context.Context, tenantID, sedeID uuid.UUID) (*model.Sede, error) {
	query := `
		SELECT tenant_id, id, nombre, slug, codigo_sede,
			direccion, departamento, provincia, distrito, referencia,
			telefono, email, responsable_nombre, responsable_cargo,
			horario_atencion, latitud, longitud,
			activo, es_principal, fecha_creacion, fecha_actualizacion
		FROM sedes
		WHERE tenant_id = $1 AND id = $2`

	s := &model.Sede{}
	err := r.db.QueryRowContext(ctx, query, tenantID, sedeID).Scan(
		&s.TenantID, &s.ID, &s.Nombre, &s.Slug, &s.CodigoSede,
		&s.Direccion, &s.Departamento, &s.Provincia, &s.Distrito, &s.Referencia,
		&s.Telefono, &s.Email, &s.ResponsableNombre, &s.ResponsableCargo,
		&s.HorarioAtencion, &s.Latitud, &s.Longitud,
		&s.Activo, &s.EsPrincipal, &s.FechaCreacion, &s.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sede_repo.GetByID: %w", err)
	}
	return s, nil
}

func (r *SedeRepo) GetBySlug(ctx context.Context, tenantID uuid.UUID, slug string) (*model.Sede, error) {
	query := `
		SELECT tenant_id, id, nombre, slug, codigo_sede,
			direccion, departamento, provincia, distrito, referencia,
			telefono, email, responsable_nombre, responsable_cargo,
			horario_atencion, latitud, longitud,
			activo, es_principal, fecha_creacion, fecha_actualizacion
		FROM sedes
		WHERE tenant_id = $1 AND slug = $2`

	s := &model.Sede{}
	err := r.db.QueryRowContext(ctx, query, tenantID, slug).Scan(
		&s.TenantID, &s.ID, &s.Nombre, &s.Slug, &s.CodigoSede,
		&s.Direccion, &s.Departamento, &s.Provincia, &s.Distrito, &s.Referencia,
		&s.Telefono, &s.Email, &s.ResponsableNombre, &s.ResponsableCargo,
		&s.HorarioAtencion, &s.Latitud, &s.Longitud,
		&s.Activo, &s.EsPrincipal, &s.FechaCreacion, &s.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sede_repo.GetBySlug: %w", err)
	}
	return s, nil
}

func (r *SedeRepo) Create(ctx context.Context, s *model.Sede) error {
	query := `
		INSERT INTO sedes (
			tenant_id, nombre, slug, codigo_sede,
			direccion, departamento, provincia, distrito, referencia,
			telefono, email, responsable_nombre, responsable_cargo,
			horario_atencion, latitud, longitud, es_principal
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		RETURNING id, activo, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		s.TenantID, s.Nombre, s.Slug, s.CodigoSede,
		s.Direccion, s.Departamento, s.Provincia, s.Distrito, s.Referencia,
		s.Telefono, s.Email, s.ResponsableNombre, s.ResponsableCargo,
		s.HorarioAtencion, s.Latitud, s.Longitud, s.EsPrincipal,
	).Scan(&s.ID, &s.Activo, &s.FechaCreacion, &s.FechaActualizacion)
}

func (r *SedeRepo) Update(ctx context.Context, s *model.Sede) error {
	query := `
		UPDATE sedes SET
			nombre = $1, slug = $2, codigo_sede = $3,
			direccion = $4, departamento = $5, provincia = $6, distrito = $7, referencia = $8,
			telefono = $9, email = $10, responsable_nombre = $11, responsable_cargo = $12,
			horario_atencion = $13, latitud = $14, longitud = $15,
			es_principal = $16, fecha_actualizacion = $17
		WHERE tenant_id = $18 AND id = $19
		RETURNING fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		s.Nombre, s.Slug, s.CodigoSede,
		s.Direccion, s.Departamento, s.Provincia, s.Distrito, s.Referencia,
		s.Telefono, s.Email, s.ResponsableNombre, s.ResponsableCargo,
		s.HorarioAtencion, s.Latitud, s.Longitud,
		s.EsPrincipal, time.Now(), s.TenantID, s.ID,
	).Scan(&s.FechaActualizacion)
}

func (r *SedeRepo) GetByTenantAll(ctx context.Context, tenantID uuid.UUID) ([]model.Sede, error) {
	query := `
		SELECT tenant_id, id, nombre, slug, codigo_sede,
			direccion, departamento, provincia, distrito, referencia,
			telefono, email, responsable_nombre, responsable_cargo,
			horario_atencion, latitud, longitud,
			activo, es_principal, fecha_creacion, fecha_actualizacion
		FROM sedes
		WHERE tenant_id = $1
		ORDER BY activo DESC, es_principal DESC, nombre ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("sede_repo.GetByTenantAll: %w", err)
	}
	defer rows.Close()

	return r.scanSedes(rows)
}

func (r *SedeRepo) Reactivate(ctx context.Context, tenantID, sedeID uuid.UUID) error {
	query := `UPDATE sedes SET activo = true, fecha_actualizacion = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, sedeID)
	if err != nil {
		return fmt.Errorf("sede_repo.Reactivate: %w", err)
	}
	return nil
}

func (r *SedeRepo) Deactivate(ctx context.Context, tenantID, sedeID uuid.UUID) error {
	query := `UPDATE sedes SET activo = false, fecha_actualizacion = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, sedeID)
	if err != nil {
		return fmt.Errorf("sede_repo.Deactivate: %w", err)
	}
	return nil
}

// GetPrincipal devuelve la sede principal activa de un tenant, o nil si no existe.
func (r *SedeRepo) GetPrincipal(ctx context.Context, tenantID uuid.UUID) (*model.Sede, error) {
	query := `
		SELECT tenant_id, id, nombre, slug, codigo_sede,
			direccion, departamento, provincia, distrito, referencia,
			telefono, email, responsable_nombre, responsable_cargo,
			horario_atencion, latitud, longitud,
			activo, es_principal, fecha_creacion, fecha_actualizacion
		FROM sedes
		WHERE tenant_id = $1 AND es_principal = true AND activo = true
		LIMIT 1`

	var s model.Sede
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(
		&s.TenantID, &s.ID, &s.Nombre, &s.Slug, &s.CodigoSede,
		&s.Direccion, &s.Departamento, &s.Provincia, &s.Distrito, &s.Referencia,
		&s.Telefono, &s.Email, &s.ResponsableNombre, &s.ResponsableCargo,
		&s.HorarioAtencion, &s.Latitud, &s.Longitud,
		&s.Activo, &s.EsPrincipal, &s.FechaCreacion, &s.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sede_repo.GetPrincipal: %w", err)
	}
	return &s, nil
}

func (r *SedeRepo) CountActivas(ctx context.Context, tenantID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM sedes WHERE tenant_id = $1 AND activo = true", tenantID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("sede_repo.CountActivas: %w", err)
	}
	return count, nil
}

// ── Scanner ──

func (r *SedeRepo) scanSedes(rows *sql.Rows) ([]model.Sede, error) {
	var sedes []model.Sede
	for rows.Next() {
		var s model.Sede
		if err := rows.Scan(
			&s.TenantID, &s.ID, &s.Nombre, &s.Slug, &s.CodigoSede,
			&s.Direccion, &s.Departamento, &s.Provincia, &s.Distrito, &s.Referencia,
			&s.Telefono, &s.Email, &s.ResponsableNombre, &s.ResponsableCargo,
			&s.HorarioAtencion, &s.Latitud, &s.Longitud,
			&s.Activo, &s.EsPrincipal, &s.FechaCreacion, &s.FechaActualizacion,
		); err != nil {
			return nil, fmt.Errorf("sede_repo.scan: %w", err)
		}

		// Normalizar NULL → "[]" para el frontend
		if !s.HorarioAtencion.Valid || s.HorarioAtencion.String == "" {
			s.HorarioAtencion = sql.NullString{String: "[]", Valid: true}
		}

		sedes = append(sedes, s)
	}
	return sedes, rows.Err()
}