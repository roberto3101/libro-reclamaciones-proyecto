package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────────────────────────────────────
// AsistenteHistorialRepo — Persistencia de conversaciones del asistente IA.
//
// Límites:
//   - Máximo 10 conversaciones activas por usuario (al crear la 11va, borra la más vieja)
//   - Máximo 50 mensajes por conversación (rechaza después de 50)
//   - TTL de 7 días gestionado por CockroachDB (no requiere lógica en Go)
// ──────────────────────────────────────────────────────────────────────────────

type AsistenteHistorialRepo struct {
	db *sql.DB
}

func NewAsistenteHistorialRepo(db *sql.DB) *AsistenteHistorialRepo {
	return &AsistenteHistorialRepo{db: db}
}

const maxConversacionesPorUsuario = 10
const maxMensajesPorConversacion = 50

// ──────────────────────────────────────────────────────────────────────────────
// Modelos de lectura
// ──────────────────────────────────────────────────────────────────────────────

// ConversacionResumen es la vista resumida para el listado del sidebar.
type ConversacionResumen struct {
	ID                 uuid.UUID `json:"id"`
	Titulo             string    `json:"titulo"`
	TotalMensajes      int       `json:"total_mensajes"`
	TotalTokensPrompt  int       `json:"total_tokens_prompt"`
	TotalTokensOutput  int       `json:"total_tokens_output"`
	ProveedorIA        string    `json:"proveedor_ia"`
	FechaCreacion      time.Time `json:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion"`
}

// MensajeHistorial es un mensaje individual de una conversación.
type MensajeHistorial struct {
	ID            uuid.UUID `json:"id"`
	Rol           string    `json:"rol"` // USER | ASSISTANT
	Contenido     string    `json:"contenido"`
	TokensPrompt  int       `json:"tokens_prompt"`
	TokensOutput  int       `json:"tokens_output"`
	Proveedor     string    `json:"proveedor"`
	DuracionMs    int       `json:"duracion_ms"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Conversaciones
// ──────────────────────────────────────────────────────────────────────────────

// ListarConversaciones retorna las conversaciones activas de un usuario,
// ordenadas por la más reciente. Máximo 10.
func (r *AsistenteHistorialRepo) ListarConversaciones(ctx context.Context, tenantID, usuarioID uuid.UUID) ([]ConversacionResumen, error) {
	query := `
		SELECT id, titulo, total_mensajes, total_tokens_prompt, total_tokens_output,
			COALESCE(proveedor_ia, ''), fecha_creacion, fecha_actualizacion
		FROM asistente_conversaciones
		WHERE tenant_id = $1 AND usuario_id = $2 AND activa = true
		ORDER BY fecha_actualizacion DESC
		LIMIT $3`

	rows, err := r.db.QueryContext(ctx, query, tenantID, usuarioID, maxConversacionesPorUsuario)
	if err != nil {
		return nil, fmt.Errorf("asistente_historial_repo.ListarConversaciones: %w", err)
	}
	defer rows.Close()

	var conversaciones []ConversacionResumen
	for rows.Next() {
		var c ConversacionResumen
		if err := rows.Scan(
			&c.ID, &c.Titulo, &c.TotalMensajes,
			&c.TotalTokensPrompt, &c.TotalTokensOutput,
			&c.ProveedorIA, &c.FechaCreacion, &c.FechaActualizacion,
		); err != nil {
			return nil, fmt.Errorf("asistente_historial_repo.scan: %w", err)
		}
		conversaciones = append(conversaciones, c)
	}
	return conversaciones, rows.Err()
}

// CrearConversacion crea una nueva conversación. Si el usuario ya tiene 10,
// borra la más vieja en la misma operación (sin crons ni jobs).
func (r *AsistenteHistorialRepo) CrearConversacion(ctx context.Context, tenantID, usuarioID uuid.UUID, titulo string) (uuid.UUID, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return uuid.Nil, fmt.Errorf("asistente_historial_repo.CrearConversacion tx: %w", err)
	}
	defer tx.Rollback()

	// Contar conversaciones activas del usuario
	var count int
	err = tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM asistente_conversaciones WHERE tenant_id = $1 AND usuario_id = $2 AND activa = true`,
		tenantID, usuarioID,
	).Scan(&count)
	if err != nil {
		return uuid.Nil, fmt.Errorf("asistente_historial_repo.CrearConversacion count: %w", err)
	}

	// Si ya tiene 10, borrar la más vieja (CASCADE borra sus mensajes)
	if count >= maxConversacionesPorUsuario {
		_, err = tx.ExecContext(ctx, `
			DELETE FROM asistente_conversaciones
			WHERE tenant_id = $1 AND id = (
				SELECT id FROM asistente_conversaciones
				WHERE tenant_id = $1 AND usuario_id = $2 AND activa = true
				ORDER BY fecha_actualizacion ASC
				LIMIT 1
			)`, tenantID, usuarioID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("asistente_historial_repo.CrearConversacion delete: %w", err)
		}
	}

	// Truncar título a 80 caracteres
	if len(titulo) > 80 {
		titulo = titulo[:80]
	}

	// Crear la nueva conversación
	var id uuid.UUID
	err = tx.QueryRowContext(ctx, `
		INSERT INTO asistente_conversaciones (tenant_id, usuario_id, titulo)
		VALUES ($1, $2, $3)
		RETURNING id`,
		tenantID, usuarioID, titulo,
	).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("asistente_historial_repo.CrearConversacion insert: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return uuid.Nil, fmt.Errorf("asistente_historial_repo.CrearConversacion commit: %w", err)
	}
	return id, nil
}

// EliminarConversacion marca una conversación como inactiva (soft delete lógico).
func (r *AsistenteHistorialRepo) EliminarConversacion(ctx context.Context, tenantID, usuarioID, conversacionID uuid.UUID) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE asistente_conversaciones SET activa = false, fecha_actualizacion = now()
		 WHERE tenant_id = $1 AND id = $2 AND usuario_id = $3 AND activa = true`,
		tenantID, conversacionID, usuarioID,
	)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.EliminarConversacion: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not_found")
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Mensajes
// ──────────────────────────────────────────────────────────────────────────────

// ListarMensajes retorna todos los mensajes de una conversación, ordenados cronológicamente.
func (r *AsistenteHistorialRepo) ListarMensajes(ctx context.Context, tenantID, conversacionID uuid.UUID) ([]MensajeHistorial, error) {
	query := `
		SELECT id, rol, contenido, COALESCE(tokens_prompt, 0), COALESCE(tokens_output, 0),
			COALESCE(proveedor, ''), COALESCE(duracion_ms, 0), fecha_creacion
		FROM asistente_mensajes
		WHERE tenant_id = $1 AND conversacion_id = $2
		ORDER BY fecha_creacion ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID, conversacionID)
	if err != nil {
		return nil, fmt.Errorf("asistente_historial_repo.ListarMensajes: %w", err)
	}
	defer rows.Close()

	var mensajes []MensajeHistorial
	for rows.Next() {
		var m MensajeHistorial
		if err := rows.Scan(
			&m.ID, &m.Rol, &m.Contenido,
			&m.TokensPrompt, &m.TokensOutput,
			&m.Proveedor, &m.DuracionMs, &m.FechaCreacion,
		); err != nil {
			return nil, fmt.Errorf("asistente_historial_repo.scan: %w", err)
		}
		mensajes = append(mensajes, m)
	}
	return mensajes, rows.Err()
}

// GuardarMensajeUsuario inserta el mensaje del usuario y actualiza contadores.
func (r *AsistenteHistorialRepo) GuardarMensajeUsuario(ctx context.Context, tenantID, conversacionID uuid.UUID, contenido string) error {
	// Verificar límite de mensajes
	if excede, err := r.excedeLimiteMensajes(ctx, tenantID, conversacionID); err != nil {
		return err
	} else if excede {
		return fmt.Errorf("limite_mensajes_alcanzado")
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.GuardarMensajeUsuario tx: %w", err)
	}
	defer tx.Rollback()

	// Insertar mensaje
	_, err = tx.ExecContext(ctx, `
		INSERT INTO asistente_mensajes (tenant_id, conversacion_id, rol, contenido)
		VALUES ($1, $2, 'USER', $3)`,
		tenantID, conversacionID, contenido,
	)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.GuardarMensajeUsuario insert: %w", err)
	}

	// Actualizar contadores y fecha de la conversación
	_, err = tx.ExecContext(ctx, `
		UPDATE asistente_conversaciones
		SET total_mensajes = total_mensajes + 1,
			fecha_actualizacion = now(),
			fecha_expiracion = now() + INTERVAL '7 days'
		WHERE tenant_id = $1 AND id = $2`,
		tenantID, conversacionID,
	)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.GuardarMensajeUsuario update: %w", err)
	}

	return tx.Commit()
}

// GuardarMensajeAsistente inserta la respuesta de la IA y actualiza contadores y métricas.
func (r *AsistenteHistorialRepo) GuardarMensajeAsistente(ctx context.Context, tenantID, conversacionID uuid.UUID, contenido string, tokensPrompt, tokensOutput, duracionMs int, proveedor string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.GuardarMensajeAsistente tx: %w", err)
	}
	defer tx.Rollback()

	// Insertar mensaje
	_, err = tx.ExecContext(ctx, `
		INSERT INTO asistente_mensajes (tenant_id, conversacion_id, rol, contenido, tokens_prompt, tokens_output, proveedor, duracion_ms)
		VALUES ($1, $2, 'ASSISTANT', $3, $4, $5, $6, $7)`,
		tenantID, conversacionID, contenido, tokensPrompt, tokensOutput, proveedor, duracionMs,
	)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.GuardarMensajeAsistente insert: %w", err)
	}

	// Actualizar contadores, tokens y proveedor
	_, err = tx.ExecContext(ctx, `
		UPDATE asistente_conversaciones
		SET total_mensajes = total_mensajes + 1,
			total_tokens_prompt = total_tokens_prompt + $3,
			total_tokens_output = total_tokens_output + $4,
			proveedor_ia = $5,
			fecha_actualizacion = now(),
			fecha_expiracion = now() + INTERVAL '7 days'
		WHERE tenant_id = $1 AND id = $2`,
		tenantID, conversacionID, tokensPrompt, tokensOutput, proveedor,
	)
	if err != nil {
		return fmt.Errorf("asistente_historial_repo.GuardarMensajeAsistente update: %w", err)
	}

	return tx.Commit()
}

// VerificarConversacionDelUsuario valida que la conversación pertenece al usuario y está activa.
func (r *AsistenteHistorialRepo) VerificarConversacionDelUsuario(ctx context.Context, tenantID, usuarioID, conversacionID uuid.UUID) (bool, error) {
	var existe bool
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM asistente_conversaciones
			WHERE tenant_id = $1 AND id = $2 AND usuario_id = $3 AND activa = true
		)`, tenantID, conversacionID, usuarioID,
	).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("asistente_historial_repo.VerificarConversacionDelUsuario: %w", err)
	}
	return existe, nil
}

// excedeLimiteMensajes verifica si la conversación ya tiene 50 mensajes.
func (r *AsistenteHistorialRepo) excedeLimiteMensajes(ctx context.Context, tenantID, conversacionID uuid.UUID) (bool, error) {
	var total int
	err := r.db.QueryRowContext(ctx,
		`SELECT total_mensajes FROM asistente_conversaciones WHERE tenant_id = $1 AND id = $2`,
		tenantID, conversacionID,
	).Scan(&total)
	if err != nil {
		return false, fmt.Errorf("asistente_historial_repo.excedeLimiteMensajes: %w", err)
	}
	return total >= maxMensajesPorConversacion, nil
}