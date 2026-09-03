package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type MensajeRepo struct {
	db *sql.DB
}

func NewMensajeRepo(db *sql.DB) *MensajeRepo {
	return &MensajeRepo{db: db}
}

func (r *MensajeRepo) GetByReclamo(ctx context.Context, tenantID, reclamoID uuid.UUID) ([]model.Mensaje, error) {
	query := `
		SELECT tenant_id, id, reclamo_id,
			tipo_mensaje, mensaje, archivo_url, archivo_nombre,
			leido, fecha_lectura, chatbot_id, fecha_mensaje
		FROM mensajes_seguimiento
		WHERE tenant_id = $1 AND reclamo_id = $2
		ORDER BY fecha_mensaje ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("mensaje_repo.GetByReclamo: %w", err)
	}
	defer rows.Close()

	var mensajes []model.Mensaje
	for rows.Next() {
		var m model.Mensaje
		if err := rows.Scan(
			&m.TenantID, &m.ID, &m.ReclamoID,
			&m.TipoMensaje, &m.MensajeTexto, &m.ArchivoURL, &m.ArchivoNombre,
			&m.Leido, &m.FechaLectura, &m.ChatbotID, &m.FechaMensaje,
		); err != nil {
			return nil, fmt.Errorf("mensaje_repo.scan: %w", err)
		}
		mensajes = append(mensajes, m)
	}
	return mensajes, rows.Err()
}

func (r *MensajeRepo) Create(ctx context.Context, m *model.Mensaje) error {
	query := `
		INSERT INTO mensajes_seguimiento (
			tenant_id, reclamo_id, tipo_mensaje, mensaje,
			archivo_url, archivo_nombre, chatbot_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, fecha_mensaje`

	return r.db.QueryRowContext(ctx, query,
		m.TenantID, m.ReclamoID, m.TipoMensaje, m.MensajeTexto,
		m.ArchivoURL, m.ArchivoNombre, m.ChatbotID,
	).Scan(&m.ID, &m.FechaMensaje)
}

func (r *MensajeRepo) MarkAsRead(ctx context.Context, tenantID, reclamoID uuid.UUID, tipo string) error {
	query := `
		UPDATE mensajes_seguimiento
		SET leido = true, fecha_lectura = $1
		WHERE tenant_id = $2 AND reclamo_id = $3 AND tipo_mensaje = $4 AND leido = false`

	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, reclamoID, tipo)
	if err != nil {
		return fmt.Errorf("mensaje_repo.MarkAsRead: %w", err)
	}
	return nil
}