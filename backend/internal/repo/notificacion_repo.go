package repo

import (
	"database/sql"
	"encoding/json"
	"log"
	"strconv"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type NotificacionRepo struct {
	db *sql.DB
}

func NewNotificacionRepo(db *sql.DB) *NotificacionRepo {
	return &NotificacionRepo{db: db}
}

// Crear inserta una nueva notificación.
func (r *NotificacionRepo) Crear(n *model.Notificacion) error {
	_, err := r.db.Exec(`
		INSERT INTO notificaciones (tenant_id, id, usuario_destino_id, tipo, titulo, contenido, datos_extra, fecha_creacion)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		n.TenantID, n.ID, n.UsuarioDestinoID, n.Tipo, n.Titulo, n.Contenido, n.DatosExtra, n.FechaCreacion,
	)
	return err
}

// CrearMultiples inserta varias notificaciones en batch.
func (r *NotificacionRepo) CrearMultiples(notificaciones []*model.Notificacion) error {
	log.Printf("[REPO-DEBUG] CrearMultiples: insertando %d notificaciones", len(notificaciones))

	tx, err := r.db.Begin()
	if err != nil {
		log.Printf("[REPO-DEBUG] Error iniciando transacción: %v", err)
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO notificaciones (tenant_id, id, usuario_destino_id, tipo, titulo, contenido, datos_extra, fecha_creacion)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`)
	if err != nil {
		log.Printf("[REPO-DEBUG] Error preparando statement: %v", err)
		return err
	}
	defer stmt.Close()

	for i, n := range notificaciones {
		_, err := stmt.Exec(n.TenantID, n.ID, n.UsuarioDestinoID, n.Tipo, n.Titulo, n.Contenido, n.DatosExtra, n.FechaCreacion)
		if err != nil {
			log.Printf("[REPO-DEBUG] Error insertando notificación[%d] (id=%s, tipo=%s, dest=%s): %v",
				i, n.ID, n.Tipo, n.UsuarioDestinoID, err)
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("[REPO-DEBUG] Error en commit: %v", err)
		return err
	}
	log.Printf("[REPO-DEBUG] ✅ Commit exitoso: %d notificaciones insertadas", len(notificaciones))
	return nil
}

// ListarPorUsuarioPaginado retorna notificaciones con paginación cursor-based.
// Pide limite+1 filas desde el controller para determinar tiene_mas sin COUNT(*).
func (r *NotificacionRepo) ListarPorUsuarioPaginado(tenantID, usuarioID uuid.UUID, limite int, cursor *time.Time, soloNoLeidas bool, tipo string) ([]model.Notificacion, error) {
	baseWhere := `WHERE n.tenant_id = $1 AND n.usuario_destino_id = $2`
	args := []interface{}{tenantID, usuarioID}
	argIdx := 3

	if soloNoLeidas {
		baseWhere += ` AND n.leida = false`
	}
	if tipo != "" {
		baseWhere += ` AND n.tipo = $` + pidx(argIdx)
		args = append(args, tipo)
		argIdx++
	}
	if cursor != nil {
		baseWhere += ` AND n.fecha_creacion < $` + pidx(argIdx)
		args = append(args, *cursor)
		argIdx++
	}

	query := `SELECT n.tenant_id, n.id, n.usuario_destino_id, n.tipo, n.titulo, n.contenido,
	           n.datos_extra, n.leida, n.fecha_lectura, n.fecha_creacion
	           FROM notificaciones n ` + baseWhere + `
	           ORDER BY n.fecha_creacion DESC LIMIT $` + pidx(argIdx)
	args = append(args, limite)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resultado []model.Notificacion
	for rows.Next() {
		var n model.Notificacion
		var datosExtra []byte
		err := rows.Scan(&n.TenantID, &n.ID, &n.UsuarioDestinoID, &n.Tipo, &n.Titulo, &n.Contenido,
			&datosExtra, &n.Leida, &n.FechaLectura, &n.FechaCreacion)
		if err != nil {
			return nil, err
		}
		if datosExtra != nil {
			n.DatosExtra = json.RawMessage(datosExtra)
		}
		resultado = append(resultado, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return resultado, nil
}

// ContarNoLeidasPorUsuario retorna el total de notificaciones sin leer.
// Usa el índice parcial idx_notif_usuario_no_leidas para máximo rendimiento.
func (r *NotificacionRepo) ContarNoLeidasPorUsuario(tenantID, usuarioID uuid.UUID) (int, error) {
	var total int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM notificaciones
		WHERE tenant_id = $1 AND usuario_destino_id = $2 AND leida = false`,
		tenantID, usuarioID,
	).Scan(&total)
	return total, err
}

// MarcarComoLeida marca una notificación como leída (solo si pertenece al usuario).
func (r *NotificacionRepo) MarcarComoLeida(tenantID, usuarioID, notificacionID uuid.UUID) error {
	_, err := r.db.Exec(`
		UPDATE notificaciones SET leida = true, fecha_lectura = $4
		WHERE tenant_id = $1 AND id = $2 AND usuario_destino_id = $3 AND leida = false`,
		tenantID, notificacionID, usuarioID, time.Now(),
	)
	return err
}

// MarcarTodasComoLeidas marca todas las notificaciones de un usuario como leídas.
func (r *NotificacionRepo) MarcarTodasComoLeidas(tenantID, usuarioID uuid.UUID) (int64, error) {
	result, err := r.db.Exec(`
		UPDATE notificaciones SET leida = true, fecha_lectura = $3
		WHERE tenant_id = $1 AND usuario_destino_id = $2 AND leida = false`,
		tenantID, usuarioID, time.Now(),
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func pidx(i int) string {
	return strconv.Itoa(i)
}
