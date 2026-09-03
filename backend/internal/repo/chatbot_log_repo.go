package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type ChatbotLogRepo struct {
	db *sql.DB
}

func NewChatbotLogRepo(db *sql.DB) *ChatbotLogRepo {
	return &ChatbotLogRepo{db: db}
}

func (r *ChatbotLogRepo) Create(ctx context.Context, log *model.ChatbotLog) error {
	query := `
		INSERT INTO chatbot_logs (
			tenant_id, chatbot_id, api_key_id, endpoint, metodo,
			status_code, ip_address, duracion_ms, accion
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, fecha`

	return r.db.QueryRowContext(ctx, query,
		log.TenantID, log.ChatbotID, log.APIKeyID, log.Endpoint, log.Metodo,
		log.StatusCode, log.IPAddress, log.DuracionMS, log.Accion,
	).Scan(&log.ID, &log.Fecha)
}

// CountInWindow cuenta requests de un API key en una ventana de tiempo.
func (r *ChatbotLogRepo) CountInWindow(ctx context.Context, apiKeyID uuid.UUID, window time.Duration) (int, error) {
	since := time.Now().Add(-window)
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM chatbot_logs WHERE api_key_id = $1 AND fecha >= $2",
		apiKeyID, since,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("chatbot_log_repo.CountInWindow: %w", err)
	}
	return count, nil
}

// CountTodayByTenant cuenta requests totales del tenant hoy.
func (r *ChatbotLogRepo) CountTodayByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	today := time.Now().Truncate(24 * time.Hour)
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM chatbot_logs WHERE tenant_id = $1 AND fecha >= $2",
		tenantID, today,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("chatbot_log_repo.CountTodayByTenant: %w", err)
	}
	return count, nil
}