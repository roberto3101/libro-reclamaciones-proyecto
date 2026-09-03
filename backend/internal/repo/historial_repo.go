package repo

import (
	"context"
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type HistorialRepo struct {
	db       *sql.DB
	ejecutor EjecutorSQL
}

func NewHistorialRepo(db *sql.DB) *HistorialRepo {
	return &HistorialRepo{db: db, ejecutor: db}
}

// ConTransaccion retorna una copia del repo que opera dentro de la transacción dada.
func (r *HistorialRepo) ConTransaccion(tx *sql.Tx) *HistorialRepo {
	return &HistorialRepo{db: r.db, ejecutor: tx}
}

func (r *HistorialRepo) GetByReclamo(ctx context.Context, tenantID, reclamoID uuid.UUID) ([]model.Historial, error) {
	query := `
		SELECT tenant_id, id, reclamo_id,
			estado_anterior, estado_nuevo, tipo_accion,
			comentario, usuario_accion, chatbot_id, ip_address, fecha_accion
		FROM historial_reclamos
		WHERE tenant_id = $1 AND reclamo_id = $2
		ORDER BY fecha_accion DESC`

	rows, err := r.ejecutor.QueryContext(ctx, query, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("historial_repo.GetByReclamo: %w", err)
	}
	defer rows.Close()

	var historial []model.Historial
	for rows.Next() {
		var h model.Historial
		if err := rows.Scan(
			&h.TenantID, &h.ID, &h.ReclamoID,
			&h.EstadoAnterior, &h.EstadoNuevo, &h.TipoAccion,
			&h.Comentario, &h.UsuarioAccion, &h.ChatbotID, &h.IPAddress, &h.FechaAccion,
		); err != nil {
			return nil, fmt.Errorf("historial_repo.scan: %w", err)
		}
		historial = append(historial, h)
	}
	return historial, rows.Err()
}

func (r *HistorialRepo) Create(ctx context.Context, h *model.Historial) error {
	query := `
		INSERT INTO historial_reclamos (
			tenant_id, reclamo_id, estado_anterior, estado_nuevo,
			tipo_accion, comentario, usuario_accion, chatbot_id, ip_address
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, fecha_accion`

	return r.ejecutor.QueryRowContext(ctx, query,
		h.TenantID, h.ReclamoID, h.EstadoAnterior, h.EstadoNuevo,
		h.TipoAccion, h.Comentario, h.UsuarioAccion, h.ChatbotID, h.IPAddress,
	).Scan(&h.ID, &h.FechaAccion)
}