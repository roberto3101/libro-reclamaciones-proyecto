package repo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

type CuentaNotasRepo struct {
	db *sql.DB
}

func NuevoCuentaNotasRepo(db *sql.DB) *CuentaNotasRepo {
	return &CuentaNotasRepo{db: db}
}

type CuentaNota struct {
	ID          uuid.UUID `json:"id"`
	CuentaID    uuid.UUID `json:"cuenta_id"`
	Contenido   string    `json:"contenido"`
	AutorID     uuid.UUID `json:"autor_id"`
	AutorNombre string    `json:"autor_nombre"`
	Fecha       string    `json:"fecha"`
}

func (r *CuentaNotasRepo) Crear(ctx context.Context, cuentaID, autorID uuid.UUID, autorNombre, contenido string) (*CuentaNota, error) {
	nota := &CuentaNota{CuentaID: cuentaID, AutorID: autorID, AutorNombre: autorNombre, Contenido: contenido}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO cuenta_notas (cuenta_id, autor_id, autor_nombre, contenido) VALUES ($1, $2, $3, $4) RETURNING id, fecha`,
		cuentaID, autorID, autorNombre, contenido).Scan(&nota.ID, &nota.Fecha)
	if err != nil {
		return nil, fmt.Errorf("cuenta_notas_repo.Crear: %w", err)
	}
	return nota, nil
}

func (r *CuentaNotasRepo) ListarPorCuenta(ctx context.Context, cuentaID uuid.UUID, limite int) ([]CuentaNota, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, cuenta_id, contenido, autor_id, autor_nombre, fecha FROM cuenta_notas WHERE cuenta_id = $1 ORDER BY fecha DESC LIMIT $2`,
		cuentaID, limite)
	if err != nil {
		return nil, fmt.Errorf("cuenta_notas_repo.ListarPorCuenta: %w", err)
	}
	defer rows.Close()

	notas := []CuentaNota{}
	for rows.Next() {
		var n CuentaNota
		if err := rows.Scan(&n.ID, &n.CuentaID, &n.Contenido, &n.AutorID, &n.AutorNombre, &n.Fecha); err != nil {
			return nil, err
		}
		notas = append(notas, n)
	}
	return notas, rows.Err()
}
