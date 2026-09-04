package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type ChatbotRepo struct {
	db *sql.DB
}

func NewChatbotRepo(db *sql.DB) *ChatbotRepo {
	return &ChatbotRepo{db: db}
}

// scanChatbot escanea una fila completa del chatbot, incluyendo campos IA.
func scanChatbot(scanner interface{ Scan(...interface{}) error }) (*model.Chatbot, error) {
	c := &model.Chatbot{}
	err := scanner.Scan(
		&c.TenantID, &c.ID, &c.Nombre, &c.Descripcion, &c.Tipo,
		// Config IA
		&c.ModeloIA, &c.PromptSistema, &c.Temperatura, &c.MaxTokensRespuesta,
		// Scopes
		&c.PuedeLeerReclamos, &c.PuedeResponder, &c.PuedeCambiarEstado,
		&c.PuedeEnviarMensajes, &c.PuedeLeerMetricas,
		// Restricciones
		&c.RequiereAprobacion,
		// Estado
		&c.Activo, &c.UltimaActividad, &c.FechaCreacion, &c.FechaActualizacion,
	)
	return c, err
}

const chatbotColumns = `
	tenant_id, id, nombre, descripcion, tipo,
	modelo_ia, prompt_sistema, temperatura, max_tokens_respuesta,
	puede_leer_reclamos, puede_responder, puede_cambiar_estado,
	puede_enviar_mensajes, puede_leer_metricas,
	requiere_aprobacion,
	activo, ultima_actividad, fecha_creacion, fecha_actualizacion`

func (r *ChatbotRepo) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]model.Chatbot, error) {
	query := `SELECT ` + chatbotColumns + `
		FROM chatbots
		WHERE tenant_id = $1
		ORDER BY activo DESC, nombre ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("chatbot_repo.GetByTenant: %w", err)
	}
	defer rows.Close()

	chatbots := []model.Chatbot{}
	for rows.Next() {
		c, err := scanChatbot(rows)
		if err != nil {
			return nil, fmt.Errorf("chatbot_repo.scan: %w", err)
		}
		chatbots = append(chatbots, *c)
	}
	return chatbots, rows.Err()
}

func (r *ChatbotRepo) GetByID(ctx context.Context, tenantID, chatbotID uuid.UUID) (*model.Chatbot, error) {
	query := `SELECT ` + chatbotColumns + `
		FROM chatbots
		WHERE tenant_id = $1 AND id = $2`

	c, err := scanChatbot(r.db.QueryRowContext(ctx, query, tenantID, chatbotID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("chatbot_repo.GetByID: %w", err)
	}
	return c, nil
}

func (r *ChatbotRepo) Create(ctx context.Context, c *model.Chatbot) error {
	query := `
		INSERT INTO chatbots (
			tenant_id, nombre, descripcion, tipo,
			modelo_ia, prompt_sistema, temperatura, max_tokens_respuesta,
			creado_por
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		c.TenantID, c.Nombre, c.Descripcion, c.Tipo,
		c.ModeloIA, c.PromptSistema, c.Temperatura, c.MaxTokensRespuesta,
		c.CreadoPor,
	).Scan(&c.ID, &c.FechaCreacion, &c.FechaActualizacion)
}

func (r *ChatbotRepo) Update(ctx context.Context, c *model.Chatbot) error {
	query := `
		UPDATE chatbots SET
			nombre = $1, descripcion = $2, tipo = $3,
			modelo_ia = $4, prompt_sistema = $5, temperatura = $6, max_tokens_respuesta = $7,
			activo = $8,
			puede_leer_reclamos = $9, puede_responder = $10,
			puede_cambiar_estado = $11, puede_enviar_mensajes = $12,
			puede_leer_metricas = $13, requiere_aprobacion = $14,
			fecha_actualizacion = $15
		WHERE tenant_id = $16 AND id = $17`

	_, err := r.db.ExecContext(ctx, query,
		c.Nombre, c.Descripcion, c.Tipo,
		c.ModeloIA, c.PromptSistema, c.Temperatura, c.MaxTokensRespuesta,
		c.Activo,
		c.PuedeLeerReclamos, c.PuedeResponder,
		c.PuedeCambiarEstado, c.PuedeEnviarMensajes,
		c.PuedeLeerMetricas, c.RequiereAprobacion,
		time.Now(), c.TenantID, c.ID,
	)
	if err != nil {
		return fmt.Errorf("chatbot_repo.Update: %w", err)
	}
	return nil
}

func (r *ChatbotRepo) Deactivate(ctx context.Context, tenantID, chatbotID uuid.UUID) error {
	query := `UPDATE chatbots SET activo = false, fecha_actualizacion = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, chatbotID)
	if err != nil {
		return fmt.Errorf("chatbot_repo.Deactivate: %w", err)
	}
	return nil
}

func (r *ChatbotRepo) Reactivate(ctx context.Context, tenantID, chatbotID uuid.UUID) error {
	query := `UPDATE chatbots SET activo = true, fecha_actualizacion = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, chatbotID)
	if err != nil {
		return fmt.Errorf("chatbot_repo.Reactivate: %w", err)
	}
	return nil
}

func (r *ChatbotRepo) SoftDelete(ctx context.Context, tenantID, chatbotID uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("chatbot_repo.SoftDelete tx: %w", err)
	}
	defer tx.Rollback()

	now := time.Now()

	_, err = tx.ExecContext(ctx,
		`UPDATE chatbots SET activo = false, fecha_actualizacion = $1 WHERE tenant_id = $2 AND id = $3`,
		now, tenantID, chatbotID,
	)
	if err != nil {
		return fmt.Errorf("chatbot_repo.SoftDelete chatbot: %w", err)
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE chatbot_api_keys SET activa = false WHERE tenant_id = $1 AND chatbot_id = $2 AND activa = true`,
		tenantID, chatbotID,
	)
	if err != nil {
		return fmt.Errorf("chatbot_repo.SoftDelete keys: %w", err)
	}

	return tx.Commit()
}

func (r *ChatbotRepo) RevokeAllKeysByChatbot(ctx context.Context, tenantID, chatbotID uuid.UUID) error {
	query := `UPDATE chatbot_api_keys SET activa = false WHERE tenant_id = $1 AND chatbot_id = $2 AND activa = true`
	_, err := r.db.ExecContext(ctx, query, tenantID, chatbotID)
	if err != nil {
		return fmt.Errorf("chatbot_repo.RevokeAllKeys: %w", err)
	}
	return nil
}

// TouchActivity actualiza ultima_actividad del chatbot a NOW().
// Se ejecuta en goroutine desde WhatsApp y API middleware, por eso es fire-and-forget.
func (r *ChatbotRepo) TouchActivity(ctx context.Context, tenantID, chatbotID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatbots SET ultima_actividad = $1 WHERE tenant_id = $2 AND id = $3`,
		time.Now(), tenantID, chatbotID,
	)
	if err != nil {
		return fmt.Errorf("chatbot_repo.TouchActivity: %w", err)
	}
	return nil
}

func (r *ChatbotRepo) CountActivos(ctx context.Context, tenantID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM chatbots WHERE tenant_id = $1 AND activo = true", tenantID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("chatbot_repo.CountActivos: %w", err)
	}
	return count, nil
}