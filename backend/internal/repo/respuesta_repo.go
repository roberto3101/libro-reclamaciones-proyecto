package repo

import (
	"context"
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type RespuestaRepo struct {
	db       *sql.DB
	ejecutor EjecutorSQL
}

func NewRespuestaRepo(db *sql.DB) *RespuestaRepo {
	return &RespuestaRepo{db: db, ejecutor: db}
}

// ConTransaccion retorna una copia del repo que opera dentro de la transacción dada.
func (r *RespuestaRepo) ConTransaccion(tx *sql.Tx) *RespuestaRepo {
	return &RespuestaRepo{db: r.db, ejecutor: tx}
}

func (r *RespuestaRepo) GetByReclamo(ctx context.Context, tenantID, reclamoID uuid.UUID) ([]model.Respuesta, error) {
	query := `
		SELECT tenant_id, id, reclamo_id,
			respuesta_empresa, accion_tomada, compensacion_ofrecida,
			respondido_por, cargo_responsable, archivos_adjuntos,
			notificado_cliente, canal_notificacion, fecha_notificacion,
			origen, chatbot_id, fecha_respuesta
		FROM respuestas
		WHERE tenant_id = $1 AND reclamo_id = $2
		ORDER BY fecha_respuesta DESC`

	rows, err := r.ejecutor.QueryContext(ctx, query, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("respuesta_repo.GetByReclamo: %w", err)
	}
	defer rows.Close()

	var respuestas []model.Respuesta
	for rows.Next() {
		var resp model.Respuesta
		if err := rows.Scan(
			&resp.TenantID, &resp.ID, &resp.ReclamoID,
			&resp.RespuestaEmpresa, &resp.AccionTomada, &resp.CompensacionOfrecida,
			&resp.RespondidoPor, &resp.CargoResponsable, &resp.ArchivosAdjuntos,
			&resp.NotificadoCliente, &resp.CanalNotificacion, &resp.FechaNotificacion,
			&resp.Origen, &resp.ChatbotID, &resp.FechaRespuesta,
		); err != nil {
			return nil, fmt.Errorf("respuesta_repo.scan: %w", err)
		}
		respuestas = append(respuestas, resp)
	}
	return respuestas, rows.Err()
}

func (r *RespuestaRepo) Create(ctx context.Context, resp *model.Respuesta) error {
	query := `
		INSERT INTO respuestas (
			tenant_id, reclamo_id, respuesta_empresa, accion_tomada,
			compensacion_ofrecida, respondido_por, cargo_responsable,
			origen, chatbot_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, fecha_respuesta`

	return r.ejecutor.QueryRowContext(ctx, query,
		resp.TenantID, resp.ReclamoID, resp.RespuestaEmpresa, resp.AccionTomada,
		resp.CompensacionOfrecida, resp.RespondidoPor, resp.CargoResponsable,
		resp.Origen, resp.ChatbotID,
	).Scan(&resp.ID, &resp.FechaRespuesta)
}
