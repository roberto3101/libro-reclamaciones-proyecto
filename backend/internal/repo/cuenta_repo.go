package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type CuentaRepo struct {
	db *sql.DB
}

func NewCuentaRepo(db *sql.DB) *CuentaRepo {
	return &CuentaRepo{db: db}
}

func (r *CuentaRepo) Crear(ctx context.Context, c *model.Cuenta) error {
	query := `
		INSERT INTO cuentas (nombre, email_contacto, telefono, ruc, direccion, notas)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		c.Nombre, c.EmailContacto, c.Telefono, c.RUC, c.Direccion, c.Notas,
	).Scan(&c.ID, &c.FechaCreacion, &c.FechaActualizacion)
}

func (r *CuentaRepo) ObtenerPorID(ctx context.Context, id uuid.UUID) (*model.Cuenta, error) {
	query := `
		SELECT id, nombre, email_contacto, telefono, ruc, direccion, notas,
			activo, fecha_creacion, fecha_actualizacion
		FROM cuentas
		WHERE id = $1`

	c := &model.Cuenta{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Nombre, &c.EmailContacto, &c.Telefono, &c.RUC, &c.Direccion, &c.Notas,
		&c.Activo, &c.FechaCreacion, &c.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cuenta_repo.ObtenerPorID: %w", err)
	}
	return c, nil
}

func (r *CuentaRepo) ListarActivas(ctx context.Context, offset, limite int) ([]model.Cuenta, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM cuentas WHERE activo = true`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("cuenta_repo.ListarActivas count: %w", err)
	}

	query := `
		SELECT id, nombre, email_contacto, telefono, ruc, direccion, notas,
			activo, fecha_creacion, fecha_actualizacion
		FROM cuentas
		WHERE activo = true
		ORDER BY nombre
		LIMIT $1 OFFSET $2`

	rows, err := r.db.QueryContext(ctx, query, limite, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("cuenta_repo.ListarActivas: %w", err)
	}
	defer rows.Close()

	cuentas := []model.Cuenta{}
	for rows.Next() {
		var c model.Cuenta
		if err := rows.Scan(
			&c.ID, &c.Nombre, &c.EmailContacto, &c.Telefono, &c.RUC, &c.Direccion, &c.Notas,
			&c.Activo, &c.FechaCreacion, &c.FechaActualizacion,
		); err != nil {
			return nil, 0, fmt.Errorf("cuenta_repo.ListarActivas scan: %w", err)
		}
		cuentas = append(cuentas, c)
	}
	return cuentas, total, rows.Err()
}

func (r *CuentaRepo) ListarTodas(ctx context.Context, offset, limite int) ([]model.Cuenta, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM cuentas`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("cuenta_repo.ListarTodas count: %w", err)
	}

	query := `
		SELECT id, nombre, email_contacto, telefono, ruc, direccion, notas,
			activo, fecha_creacion, fecha_actualizacion
		FROM cuentas
		ORDER BY nombre, id
		LIMIT $1 OFFSET $2`

	rows, err := r.db.QueryContext(ctx, query, limite, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("cuenta_repo.ListarTodas: %w", err)
	}
	defer rows.Close()

	cuentas := []model.Cuenta{}
	for rows.Next() {
		var c model.Cuenta
		if err := rows.Scan(
			&c.ID, &c.Nombre, &c.EmailContacto, &c.Telefono, &c.RUC, &c.Direccion, &c.Notas,
			&c.Activo, &c.FechaCreacion, &c.FechaActualizacion,
		); err != nil {
			return nil, 0, fmt.Errorf("cuenta_repo.ListarTodas scan: %w", err)
		}
		cuentas = append(cuentas, c)
	}
	return cuentas, total, rows.Err()
}

func (r *CuentaRepo) Actualizar(ctx context.Context, c *model.Cuenta) error {
	query := `
		UPDATE cuentas SET
			nombre = $1, email_contacto = $2, telefono = $3, ruc = $4,
			direccion = $5, notas = $6, activo = $7, fecha_actualizacion = $8
		WHERE id = $9`

	_, err := r.db.ExecContext(ctx, query,
		c.Nombre, c.EmailContacto, c.Telefono, c.RUC,
		c.Direccion, c.Notas, c.Activo, time.Now(), c.ID,
	)
	if err != nil {
		return fmt.Errorf("cuenta_repo.Actualizar: %w", err)
	}
	return nil
}

func (r *CuentaRepo) CambiarEstado(ctx context.Context, id uuid.UUID, activo bool) error {
	query := `UPDATE cuentas SET activo = $1, fecha_actualizacion = $2 WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, activo, time.Now(), id)
	if err != nil {
		return fmt.Errorf("cuenta_repo.CambiarEstado: %w", err)
	}
	return nil
}

// BuscarPorEmailONombre busca cuentas por nombre/email/RUC con paginación
// real desde la DB. Retorna las filas de la página solicitada y el total de
// resultados que cumplen el filtro — igual que ListarTodas, para que el
// frontend pueda mostrar un paginador normal cuando el buscador está activo.
func (r *CuentaRepo) BuscarPorEmailONombre(ctx context.Context, termino string, offset, limite int) ([]model.Cuenta, int, error) {
	if limite <= 0 || limite > 200 {
		limite = 20
	}
	if offset < 0 {
		offset = 0
	}

	// COUNT con los mismos predicados para que la paginación conozca el total.
	var total int
	countQuery := `
		SELECT COUNT(*) FROM cuentas
		WHERE lower(nombre) LIKE '%' || lower($1) || '%'
		   OR lower(email_contacto) LIKE '%' || lower($1) || '%'
		   OR ruc LIKE '%' || $1 || '%'`
	if err := r.db.QueryRowContext(ctx, countQuery, termino).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("cuenta_repo.BuscarPorEmailONombre count: %w", err)
	}

	query := `
		SELECT id, nombre, email_contacto, telefono, ruc, direccion, notas,
			activo, fecha_creacion, fecha_actualizacion
		FROM cuentas
		WHERE lower(nombre) LIKE '%' || lower($1) || '%'
		   OR lower(email_contacto) LIKE '%' || lower($1) || '%'
		   OR ruc LIKE '%' || $1 || '%'
		ORDER BY nombre, id
		LIMIT $2 OFFSET $3`

	rows, err := r.db.QueryContext(ctx, query, termino, limite, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("cuenta_repo.BuscarPorEmailONombre: %w", err)
	}
	defer rows.Close()

	cuentas := []model.Cuenta{}
	for rows.Next() {
		var c model.Cuenta
		if err := rows.Scan(
			&c.ID, &c.Nombre, &c.EmailContacto, &c.Telefono, &c.RUC, &c.Direccion, &c.Notas,
			&c.Activo, &c.FechaCreacion, &c.FechaActualizacion,
		); err != nil {
			return nil, 0, fmt.Errorf("cuenta_repo.BuscarPorEmailONombre scan: %w", err)
		}
		cuentas = append(cuentas, c)
	}
	return cuentas, total, rows.Err()
}
