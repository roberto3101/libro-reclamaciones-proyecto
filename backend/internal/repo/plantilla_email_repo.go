package repo

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type PlantillaEmailRepo struct {
	db *sql.DB
}

func NewPlantillaEmailRepo(db *sql.DB) *PlantillaEmailRepo {
	return &PlantillaEmailRepo{db: db}
}

// ── Columnas reutilizables ──

const plantillaEmailColumns = `tenant_id, id, tipo_evento, nombre_visual, asunto, saludo, cuerpo_principal, texto_pie, texto_boton, variables_permitidas, activa, fecha_creacion, fecha_actualizacion`

// ── Queries ──

// GetByTenantID retorna todas las plantillas de un tenant.
func (r *PlantillaEmailRepo) GetByTenantID(ctx context.Context, tenantID uuid.UUID) ([]model.PlantillaEmail, error) {
	query := `
		SELECT ` + plantillaEmailColumns + `
		FROM plantillas_email
		WHERE tenant_id = $1
		ORDER BY tipo_evento ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_repo.GetByTenantID: %w", err)
	}
	defer rows.Close()

	return r.scanPlantillas(rows)
}

// GetByTipoEvento retorna la plantilla de un tipo de evento específico.
func (r *PlantillaEmailRepo) GetByTipoEvento(ctx context.Context, tenantID uuid.UUID, tipoEvento string) (*model.PlantillaEmail, error) {
	query := `SELECT ` + plantillaEmailColumns + ` FROM plantillas_email WHERE tenant_id = $1 AND tipo_evento = $2`
	return r.scanOne(ctx, query, tenantID, tipoEvento)
}

// GetByID retorna una plantilla por su ID.
func (r *PlantillaEmailRepo) GetByID(ctx context.Context, tenantID, plantillaID uuid.UUID) (*model.PlantillaEmail, error) {
	query := `SELECT ` + plantillaEmailColumns + ` FROM plantillas_email WHERE tenant_id = $1 AND id = $2`
	return r.scanOne(ctx, query, tenantID, plantillaID)
}

// Upsert inserta o actualiza una plantilla (usado al seedear por defecto).
func (r *PlantillaEmailRepo) Upsert(ctx context.Context, p *model.PlantillaEmail) error {
	query := `
		INSERT INTO plantillas_email (
			tenant_id, tipo_evento, nombre_visual, asunto, saludo,
			cuerpo_principal, texto_pie, texto_boton, variables_permitidas, activa
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (tenant_id, tipo_evento)
		DO UPDATE SET
			nombre_visual = EXCLUDED.nombre_visual,
			asunto = EXCLUDED.asunto,
			saludo = EXCLUDED.saludo,
			cuerpo_principal = EXCLUDED.cuerpo_principal,
			texto_pie = EXCLUDED.texto_pie,
			texto_boton = EXCLUDED.texto_boton,
			variables_permitidas = EXCLUDED.variables_permitidas,
			fecha_actualizacion = now()
		RETURNING id, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		p.TenantID, p.TipoEvento, p.NombreVisual, p.Asunto, p.Saludo,
		p.CuerpoPrincipal, p.TextoPie, p.TextoBoton,
		toCRDBArray(p.VariablesPermitidas), p.Activa,
	).Scan(&p.ID, &p.FechaCreacion, &p.FechaActualizacion)
}

// Update actualiza una plantilla existente.
func (r *PlantillaEmailRepo) Update(ctx context.Context, p *model.PlantillaEmail) error {
	query := `
		UPDATE plantillas_email SET
			asunto = $1, saludo = $2, cuerpo_principal = $3,
			texto_pie = $4, texto_boton = $5, activa = $6,
			fecha_actualizacion = $7
		WHERE tenant_id = $8 AND id = $9
		RETURNING fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		p.Asunto, p.Saludo, p.CuerpoPrincipal,
		p.TextoPie, p.TextoBoton, p.Activa,
		time.Now(), p.TenantID, p.ID,
	).Scan(&p.FechaActualizacion)
}

// ExistsByTenant verifica si un tenant tiene plantillas seedeadas.
func (r *PlantillaEmailRepo) ExistsByTenant(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM plantillas_email WHERE tenant_id = $1", tenantID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("plantilla_email_repo.ExistsByTenant: %w", err)
	}
	return count > 0, nil
}

// ── Helpers ──

// parseCRDBArray convierte un STRING[] de CockroachDB (formato {a,b,c}) a []string.
func parseCRDBArray(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" {
		return []string{}
	}
	raw = strings.TrimPrefix(raw, "{")
	raw = strings.TrimSuffix(raw, "}")
	return strings.Split(raw, ",")
}

// toCRDBArray convierte []string al formato {a,b,c} para CockroachDB.
func toCRDBArray(arr []string) string {
	if len(arr) == 0 {
		return "{}"
	}
	return "{" + strings.Join(arr, ",") + "}"
}

// ── Scanners ──

func (r *PlantillaEmailRepo) scanOne(ctx context.Context, query string, args ...interface{}) (*model.PlantillaEmail, error) {
	p := &model.PlantillaEmail{}
	var varsRaw string
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&p.TenantID, &p.ID, &p.TipoEvento, &p.NombreVisual,
		&p.Asunto, &p.Saludo, &p.CuerpoPrincipal, &p.TextoPie, &p.TextoBoton,
		&varsRaw, &p.Activa,
		&p.FechaCreacion, &p.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_repo.scanOne: %w", err)
	}
	p.VariablesPermitidas = parseCRDBArray(varsRaw)
	return p, nil
}

func (r *PlantillaEmailRepo) scanPlantillas(rows *sql.Rows) ([]model.PlantillaEmail, error) {
	plantillas := []model.PlantillaEmail{}
	for rows.Next() {
		var p model.PlantillaEmail
		var varsRaw string
		if err := rows.Scan(
			&p.TenantID, &p.ID, &p.TipoEvento, &p.NombreVisual,
			&p.Asunto, &p.Saludo, &p.CuerpoPrincipal, &p.TextoPie, &p.TextoBoton,
			&varsRaw, &p.Activa,
			&p.FechaCreacion, &p.FechaActualizacion,
		); err != nil {
			return nil, fmt.Errorf("plantilla_email_repo.scan: %w", err)
		}
		p.VariablesPermitidas = parseCRDBArray(varsRaw)
		plantillas = append(plantillas, p)
	}
	return plantillas, rows.Err()
}
