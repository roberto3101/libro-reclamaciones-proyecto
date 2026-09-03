package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

// Acciones registradas en auditoria_admin.
// Mantener sincronizadas con el dropdown del frontend en SAActividad.tsx.
const (
	AccionAuditLogin              = "LOGIN"
	AccionAuditLogout             = "LOGOUT"
	AccionAuditResponder          = "RESPONDER"
	AccionAuditCambiarEstado      = "CAMBIAR_ESTADO"
	AccionAuditAsignar            = "ASIGNAR"
	AccionAuditExportar           = "EXPORTAR"
	AccionAuditConfigurar         = "CONFIGURAR"
	AccionAuditCrearUsuario       = "CREAR_USUARIO"
	AccionAuditDesactivarUsuario  = "DESACTIVAR_USUARIO"
	AccionAuditCrearChatbot       = "CREAR_CHATBOT"
	AccionAuditGenerarAPIKey      = "GENERAR_API_KEY"
	AccionAuditRevocarAPIKey      = "REVOCAR_API_KEY"
	AccionAuditCambiarPlan        = "CAMBIAR_PLAN"
	AccionAuditActivarSuscripcion = "ACTIVAR_SUSCRIPCION"
	AccionAuditCancelarSuscripcion = "CANCELAR_SUSCRIPCION"
)

type AuditoriaRepo struct {
	db *sql.DB
}

func NewAuditoriaRepo(db *sql.DB) *AuditoriaRepo {
	return &AuditoriaRepo{db: db}
}

func (r *AuditoriaRepo) Create(ctx context.Context, a *model.Auditoria) error {
	query := `
		INSERT INTO auditoria_admin (
			tenant_id, usuario_id, accion, entidad, entidad_id, detalles, ip_address
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, fecha`

	return r.db.QueryRowContext(ctx, query,
		a.TenantID, a.UsuarioID, a.Accion, a.Entidad, a.EntidadID, a.Detalles, a.IPAddress,
	).Scan(&a.ID, &a.Fecha)
}

// RegistrarAsync inserta una entrada en auditoria_admin sin bloquear al
// caller. Diseñado para llamarse desde controllers después de operaciones
// exitosas — un fallo de auditoría NUNCA debe romper la respuesta del
// usuario, así que los errores solo se loguean.
//
// `entidadID` puede estar vacío si la acción no apunta a una entidad puntual
// (p.ej. LOGIN/LOGOUT). `detalles` se serializa como JSONB; si nil queda NULL.
//
// Si tenantID o usuarioID son zero, no inserta (algunas acciones — como
// errores de login — no tienen identidad para auditar).
func (r *AuditoriaRepo) RegistrarAsync(
	tenantID uuid.UUID,
	usuarioID uuid.UUID,
	accion string,
	entidad string,
	entidadID string,
	detalles map[string]interface{},
	ipAddress string,
) {
	if tenantID == uuid.Nil || usuarioID == uuid.Nil {
		return
	}
	var detallesJSON []byte
	if len(detalles) > 0 {
		b, err := json.Marshal(detalles)
		if err == nil {
			detallesJSON = b
		}
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, err := r.db.ExecContext(ctx,
			`INSERT INTO auditoria_admin (tenant_id, usuario_id, accion, entidad, entidad_id, detalles, ip_address)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			tenantID, usuarioID, accion, entidad, nullStr(entidadID), nullJSON(detallesJSON), nullStr(ipAddress),
		)
		if err != nil {
			log.Printf("[audit] error registrando %s/%s para tenant=%s usuario=%s: %v",
				accion, entidad, tenantID, usuarioID, err)
		}
	}()
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullJSON(b []byte) interface{} {
	if len(b) == 0 {
		return nil
	}
	return b
}

// ── Helpers enriquecedores ────────────────────────────────────────────────
//
// Estos métodos hacen un lookup adicional a la DB en background ANTES de
// insertar la fila de auditoría, para que el campo `detalles` lleve nombres
// legibles en vez de solo IDs (p.ej. "código del reclamo" en vez de UUID).
// Todos son fire-and-forget — un error de auditoría nunca rompe la respuesta
// del usuario.

// RegistrarAccionReclamo audita una acción sobre un reclamo, agregando
// automáticamente `codigo_reclamo` y `estado` al detalles para que el log
// sea autodescriptivo. Si extra es nil se inicializa.
func (r *AuditoriaRepo) RegistrarAccionReclamo(
	tenantID, usuarioID, reclamoID uuid.UUID,
	accion string,
	extra map[string]interface{},
	ipAddress string,
) {
	if tenantID == uuid.Nil || usuarioID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var codigo, estado string
		_ = r.db.QueryRowContext(ctx,
			`SELECT codigo_reclamo, estado FROM reclamos WHERE tenant_id = $1 AND id = $2`,
			tenantID, reclamoID,
		).Scan(&codigo, &estado)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if codigo != "" {
			extra["codigo_reclamo"] = codigo
		}
		if estado != "" {
			extra["estado_actual"] = estado
		}
		r.insertSync(tenantID, usuarioID, accion, "RECLAMO", reclamoID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionUsuario audita una acción sobre un usuario admin del tenant.
// Agrega `usuario_objetivo_email` y `usuario_objetivo_nombre` al detalles.
// Útil para CREAR_USUARIO/DESACTIVAR_USUARIO donde "quién" (usuarioID) puede
// ser distinto de "a quién" (targetUserID).
func (r *AuditoriaRepo) RegistrarAccionUsuario(
	tenantID, actorID, targetUserID uuid.UUID,
	accion string,
	extra map[string]interface{},
	ipAddress string,
) {
	if tenantID == uuid.Nil || actorID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var email, nombre, rol string
		_ = r.db.QueryRowContext(ctx,
			`SELECT email, nombre_completo, rol FROM usuarios_admin WHERE tenant_id = $1 AND id = $2`,
			tenantID, targetUserID,
		).Scan(&email, &nombre, &rol)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if email != "" {
			extra["usuario_objetivo_email"] = email
		}
		if nombre != "" {
			extra["usuario_objetivo_nombre"] = nombre
		}
		if rol != "" {
			extra["usuario_objetivo_rol"] = rol
		}
		r.insertSync(tenantID, actorID, accion, "USUARIO", targetUserID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionChatbot audita una acción sobre un chatbot. Agrega
// `chatbot_nombre` y `chatbot_tipo` al detalles.
func (r *AuditoriaRepo) RegistrarAccionChatbot(
	tenantID, usuarioID, chatbotID uuid.UUID,
	accion string,
	extra map[string]interface{},
	ipAddress string,
) {
	if tenantID == uuid.Nil || usuarioID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var nombre, tipo string
		_ = r.db.QueryRowContext(ctx,
			`SELECT nombre, tipo FROM chatbots WHERE tenant_id = $1 AND id = $2`,
			tenantID, chatbotID,
		).Scan(&nombre, &tipo)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if nombre != "" {
			extra["chatbot_nombre"] = nombre
		}
		if tipo != "" {
			extra["chatbot_tipo"] = tipo
		}
		r.insertSync(tenantID, usuarioID, accion, "CHATBOT", chatbotID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionAPIKey audita una acción sobre una API key. Agrega nombre
// del chatbot dueño y prefijo de la key (NUNCA la key plana).
func (r *AuditoriaRepo) RegistrarAccionAPIKey(
	tenantID, usuarioID, chatbotID, apiKeyID uuid.UUID,
	accion string,
	extra map[string]interface{},
	ipAddress string,
) {
	if tenantID == uuid.Nil || usuarioID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var keyNombre, keyPrefix, entorno, chatbotNombre string
		_ = r.db.QueryRowContext(ctx,
			`SELECT k.nombre, k.key_prefix, k.entorno, c.nombre
			 FROM chatbot_api_keys k
			 LEFT JOIN chatbots c ON c.tenant_id = k.tenant_id AND c.id = k.chatbot_id
			 WHERE k.tenant_id = $1 AND k.id = $2`,
			tenantID, apiKeyID,
		).Scan(&keyNombre, &keyPrefix, &entorno, &chatbotNombre)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		extra["chatbot_id"] = chatbotID.String()
		if chatbotNombre != "" {
			extra["chatbot_nombre"] = chatbotNombre
		}
		if keyNombre != "" {
			extra["api_key_nombre"] = keyNombre
		}
		if keyPrefix != "" {
			extra["api_key_prefix"] = keyPrefix
		}
		if entorno != "" {
			extra["api_key_entorno"] = entorno
		}
		r.insertSync(tenantID, usuarioID, accion, "API_KEY", apiKeyID.String(), extra, ipAddress)
	}()
}

// insertSync hace el INSERT bloqueando — usado desde dentro de las goroutines
// de los helpers enriquecedores. NO llama a otra goroutine, evita doble go.
func (r *AuditoriaRepo) insertSync(
	tenantID, usuarioID uuid.UUID,
	accion, entidad, entidadID string,
	detalles map[string]interface{},
	ipAddress string,
) {
	var detallesJSON []byte
	if len(detalles) > 0 {
		b, err := json.Marshal(detalles)
		if err == nil {
			detallesJSON = b
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO auditoria_admin (tenant_id, usuario_id, accion, entidad, entidad_id, detalles, ip_address)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		tenantID, usuarioID, accion, entidad, nullStr(entidadID), nullJSON(detallesJSON), nullStr(ipAddress),
	)
	if err != nil {
		log.Printf("[audit] error registrando %s/%s para tenant=%s usuario=%s: %v",
			accion, entidad, tenantID, usuarioID, err)
	}
}

func (r *AuditoriaRepo) GetByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]model.Auditoria, error) {
	query := `
		SELECT tenant_id, id, usuario_id, accion, entidad, entidad_id, detalles, ip_address, fecha
		FROM auditoria_admin
		WHERE tenant_id = $1
		ORDER BY fecha DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("auditoria_repo.GetByTenant: %w", err)
	}
	defer rows.Close()

	var auditorias []model.Auditoria
	for rows.Next() {
		var a model.Auditoria
		if err := rows.Scan(
			&a.TenantID, &a.ID, &a.UsuarioID, &a.Accion, &a.Entidad,
			&a.EntidadID, &a.Detalles, &a.IPAddress, &a.Fecha,
		); err != nil {
			return nil, fmt.Errorf("auditoria_repo.scan: %w", err)
		}
		auditorias = append(auditorias, a)
	}
	return auditorias, rows.Err()
}
