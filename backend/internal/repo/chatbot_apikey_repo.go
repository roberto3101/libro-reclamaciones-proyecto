package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type ChatbotAPIKeyRepo struct {
	db *sql.DB
}

func NewChatbotAPIKeyRepo(db *sql.DB) *ChatbotAPIKeyRepo {
	return &ChatbotAPIKeyRepo{db: db}
}

func (r *ChatbotAPIKeyRepo) GetByChatbot(ctx context.Context, tenantID, chatbotID uuid.UUID) ([]model.APIKey, error) {
	query := `
		SELECT tenant_id, id, chatbot_id, nombre, key_prefix, key_hash,
			entorno, activa, fecha_expiracion, ultimo_uso,
			requests_por_minuto, requests_por_dia,
			fecha_creacion, creado_por
		FROM chatbot_api_keys
		WHERE tenant_id = $1 AND chatbot_id = $2
		ORDER BY fecha_creacion DESC`

	rows, err := r.db.QueryContext(ctx, query, tenantID, chatbotID)
	if err != nil {
		return nil, fmt.Errorf("apikey_repo.GetByChatbot: %w", err)
	}
	defer rows.Close()

	var keys []model.APIKey
	for rows.Next() {
		var k model.APIKey
		if err := rows.Scan(
			&k.TenantID, &k.ID, &k.ChatbotID, &k.Nombre, &k.KeyPrefix, &k.KeyHash,
			&k.Entorno, &k.Activa, &k.FechaExpiracion, &k.UltimoUso,
			&k.RequestsPorMinuto, &k.RequestsPorDia,
			&k.FechaCreacion, &k.CreadoPor,
		); err != nil {
			return nil, fmt.Errorf("apikey_repo.scan: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *ChatbotAPIKeyRepo) GetByHash(ctx context.Context, keyHash string) (*model.APIKey, error) {
	query := `
		SELECT tenant_id, id, chatbot_id, nombre, key_prefix, key_hash,
			entorno, activa, fecha_expiracion, ultimo_uso,
			requests_por_minuto, requests_por_dia,
			fecha_creacion, creado_por
		FROM chatbot_api_keys
		WHERE key_hash = $1 AND activa = true
		AND (fecha_expiracion IS NULL OR fecha_expiracion > NOW())`

	k := &model.APIKey{}
	err := r.db.QueryRowContext(ctx, query, keyHash).Scan(
		&k.TenantID, &k.ID, &k.ChatbotID, &k.Nombre, &k.KeyPrefix, &k.KeyHash,
		&k.Entorno, &k.Activa, &k.FechaExpiracion, &k.UltimoUso,
		&k.RequestsPorMinuto, &k.RequestsPorDia,
		&k.FechaCreacion, &k.CreadoPor,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("apikey_repo.GetByHash: %w", err)
	}
	return k, nil
}

func (r *ChatbotAPIKeyRepo) Create(ctx context.Context, k *model.APIKey) error {
	query := `
		INSERT INTO chatbot_api_keys (
			tenant_id, chatbot_id, nombre, key_hash, key_prefix,
			entorno, fecha_expiracion, creado_por
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, fecha_creacion`

	return r.db.QueryRowContext(ctx, query,
		k.TenantID, k.ChatbotID, k.Nombre, k.KeyHash, k.KeyPrefix,
		k.Entorno, k.FechaExpiracion, k.CreadoPor,
	).Scan(&k.ID, &k.FechaCreacion)
}

func (r *ChatbotAPIKeyRepo) Revoke(ctx context.Context, tenantID, keyID uuid.UUID) error {
	query := `UPDATE chatbot_api_keys SET activa = false WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, keyID)
	if err != nil {
		return fmt.Errorf("apikey_repo.Revoke: %w", err)
	}
	return nil
}

func (r *ChatbotAPIKeyRepo) IncrementUsage(ctx context.Context, tenantID, keyID uuid.UUID) error {
	query := `UPDATE chatbot_api_keys SET ultimo_uso = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, keyID)
	if err != nil {
		return fmt.Errorf("apikey_repo.IncrementUsage: %w", err)
	}
	return nil
}

// CountActiveKeys cuenta las API keys activas y no expiradas de un chatbot.
func (r *ChatbotAPIKeyRepo) CountActiveKeys(ctx context.Context, tenantID, chatbotID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*) FROM chatbot_api_keys
		WHERE tenant_id = $1 AND chatbot_id = $2 AND activa = true
		AND (fecha_expiracion IS NULL OR fecha_expiracion > NOW())`
	var count int
	err := r.db.QueryRowContext(ctx, query, tenantID, chatbotID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("apikey_repo.CountActiveKeys: %w", err)
	}
	return count, nil
}

// GetLastActivity obtiene la fecha del último uso de cualquier API key del chatbot.
func (r *ChatbotAPIKeyRepo) GetLastActivity(ctx context.Context, tenantID, chatbotID uuid.UUID) (*time.Time, error) {
	query := `
		SELECT MAX(ultimo_uso) FROM chatbot_api_keys
		WHERE tenant_id = $1 AND chatbot_id = $2`
	var t sql.NullTime
	err := r.db.QueryRowContext(ctx, query, tenantID, chatbotID).Scan(&t)
	if err != nil {
		return nil, fmt.Errorf("apikey_repo.GetLastActivity: %w", err)
	}
	if !t.Valid {
		return nil, nil
	}
	return &t.Time, nil
}