package repo

import (
	"context"
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type MensajeAtencionRepo struct {
	db *sql.DB
}

func NewMensajeAtencionRepo(db *sql.DB) *MensajeAtencionRepo {
	return &MensajeAtencionRepo{db: db}
}

// Crear inserta un mensaje de atención.
func (r *MensajeAtencionRepo) Crear(ctx context.Context, m *model.MensajeAtencion) error {
	query := `
		INSERT INTO mensajes_atencion (tenant_id, solicitud_id, remitente, contenido, asesor_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, fecha_envio`

	return r.db.QueryRowContext(ctx, query,
		m.TenantID, m.SolicitudID, m.Remitente, m.Contenido, m.AsesorID,
	).Scan(&m.ID, &m.FechaEnvio)
}

// ListarPorSolicitud retorna todos los mensajes de una solicitud ordenados.
func (r *MensajeAtencionRepo) ListarPorSolicitud(ctx context.Context, tenantID, solicitudID uuid.UUID) ([]model.MensajeAtencion, error) {
	query := `
		SELECT tenant_id, id, solicitud_id, remitente, contenido, asesor_id, fecha_envio
		FROM mensajes_atencion
		WHERE tenant_id = $1 AND solicitud_id = $2
		ORDER BY fecha_envio ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID, solicitudID)
	if err != nil {
		return nil, fmt.Errorf("mensaje_atencion_repo.ListarPorSolicitud: %w", err)
	}
	defer rows.Close()

	var mensajes []model.MensajeAtencion
	for rows.Next() {
		var m model.MensajeAtencion
		if err := rows.Scan(
			&m.TenantID, &m.ID, &m.SolicitudID,
			&m.Remitente, &m.Contenido, &m.AsesorID,
			&m.FechaEnvio,
		); err != nil {
			return nil, fmt.Errorf("mensaje_atencion_repo.scan: %w", err)
		}
		mensajes = append(mensajes, m)
	}
	return mensajes, rows.Err()
}

// ContarMensajesCliente cuenta los mensajes enviados por el cliente en una solicitud.
func (r *MensajeAtencionRepo) ContarMensajesCliente(ctx context.Context, tenantID, solicitudID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM mensajes_atencion
		 WHERE tenant_id = $1 AND solicitud_id = $2 AND remitente = 'cliente'`,
		tenantID, solicitudID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("mensaje_atencion_repo.ContarMensajesCliente: %w", err)
	}
	return count, nil
}

// TieneRespuestaAsesor verifica si hay al menos un mensaje de asesor en la solicitud.
func (r *MensajeAtencionRepo) TieneRespuestaAsesor(ctx context.Context, tenantID, solicitudID uuid.UUID) (bool, error) {
	var existe bool
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM mensajes_atencion
		 WHERE tenant_id = $1 AND solicitud_id = $2 AND remitente = 'asesor')`,
		tenantID, solicitudID,
	).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("mensaje_atencion_repo.TieneRespuestaAsesor: %w", err)
	}
	return existe, nil
}

// ContarDespuesDe cuenta mensajes nuevos después de cierta fecha (para polling eficiente).
func (r *MensajeAtencionRepo) ContarDespuesDe(ctx context.Context, tenantID, solicitudID uuid.UUID, desde string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM mensajes_atencion
		 WHERE tenant_id = $1 AND solicitud_id = $2 AND fecha_envio > $3`,
		tenantID, solicitudID, desde,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("mensaje_atencion_repo.ContarDespuesDe: %w", err)
	}
	return count, nil
}