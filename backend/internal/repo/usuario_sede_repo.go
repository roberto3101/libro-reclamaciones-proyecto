package repo

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type UsuarioSedeRepo struct {
	db *sql.DB
}

func NewUsuarioSedeRepo(db *sql.DB) *UsuarioSedeRepo {
	return &UsuarioSedeRepo{db: db}
}

// ObtenerSedesPorUsuario retorna los IDs de las sedes asignadas al usuario.
// Slice vacío = acceso global (sin restricción de sedes).
func (r *UsuarioSedeRepo) ObtenerSedesPorUsuario(ctx context.Context, tenantID, userID uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT sede_id FROM usuarios_sedes WHERE tenant_id = $1 AND usuario_id = $2`
	rows, err := r.db.QueryContext(ctx, query, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("usuario_sede_repo.ObtenerSedesPorUsuario: %w", err)
	}
	defer rows.Close()

	var sedes []uuid.UUID
	for rows.Next() {
		var sedeID uuid.UUID
		if err := rows.Scan(&sedeID); err != nil {
			return nil, fmt.Errorf("usuario_sede_repo.ObtenerSedesPorUsuario scan: %w", err)
		}
		sedes = append(sedes, sedeID)
	}
	return sedes, rows.Err()
}

// AsignarSedes reemplaza todas las sedes asignadas al usuario.
// Slice vacío = acceso global (elimina todos los registros).
func (r *UsuarioSedeRepo) AsignarSedes(ctx context.Context, tenantID, userID uuid.UUID, sedeIDs []uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("usuario_sede_repo.AsignarSedes begin: %w", err)
	}
	defer tx.Rollback()

	// Eliminar asignaciones anteriores
	_, err = tx.ExecContext(ctx, `DELETE FROM usuarios_sedes WHERE tenant_id = $1 AND usuario_id = $2`, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_sede_repo.AsignarSedes delete: %w", err)
	}

	// Insertar nuevas asignaciones
	if len(sedeIDs) > 0 {
		var placeholders []string
		var args []interface{}
		args = append(args, tenantID, userID)
		for i, sedeID := range sedeIDs {
			placeholders = append(placeholders, fmt.Sprintf("($1, $2, $%d)", i+3))
			args = append(args, sedeID)
		}
		query := `INSERT INTO usuarios_sedes (tenant_id, usuario_id, sede_id) VALUES ` + strings.Join(placeholders, ", ")
		_, err = tx.ExecContext(ctx, query, args...)
		if err != nil {
			return fmt.Errorf("usuario_sede_repo.AsignarSedes insert: %w", err)
		}
	}

	return tx.Commit()
}

// TieneAccesoASede verifica si el usuario tiene acceso a una sede específica.
// Retorna true si tiene acceso global (sin registros) o si la sede está asignada.
func (r *UsuarioSedeRepo) TieneAccesoASede(ctx context.Context, tenantID, userID, sedeID uuid.UUID) (bool, error) {
	var count int
	// Contar registros del usuario
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM usuarios_sedes WHERE tenant_id = $1 AND usuario_id = $2`, tenantID, userID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("usuario_sede_repo.TieneAccesoASede count: %w", err)
	}

	// Sin registros = acceso global
	if count == 0 {
		return true, nil
	}

	// Verificar si la sede específica está asignada
	err = r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM usuarios_sedes WHERE tenant_id = $1 AND usuario_id = $2 AND sede_id = $3`,
		tenantID, userID, sedeID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("usuario_sede_repo.TieneAccesoASede check: %w", err)
	}

	return count > 0, nil
}
