package repo

import (
	"database/sql"
	"log"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type ConfiguracionNotificacionRepo struct {
	db *sql.DB
}

func NewConfiguracionNotificacionRepo(db *sql.DB) *ConfiguracionNotificacionRepo {
	return &ConfiguracionNotificacionRepo{db: db}
}

// ObtenerPorRol retorna la configuración de notificaciones de un rol.
func (r *ConfiguracionNotificacionRepo) ObtenerPorRol(tenantID, rolID uuid.UUID) ([]model.ConfiguracionNotificacionRol, error) {
	rows, err := r.db.Query(`
		SELECT tenant_id, id, rol_id, tipo_notificacion, habilitado
		FROM configuracion_notificaciones_rol
		WHERE tenant_id = $1 AND rol_id = $2
		ORDER BY tipo_notificacion`,
		tenantID, rolID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	configs := []model.ConfiguracionNotificacionRol{}
	for rows.Next() {
		var c model.ConfiguracionNotificacionRol
		if err := rows.Scan(&c.TenantID, &c.ID, &c.RolID, &c.TipoNotificacion, &c.Habilitado); err != nil {
			return nil, err
		}
		configs = append(configs, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return configs, nil
}

// UpsertConfiguracion inserta o actualiza la configuración de un tipo de notificación para un rol.
func (r *ConfiguracionNotificacionRepo) UpsertConfiguracion(tenantID, rolID uuid.UUID, tipo model.TipoNotificacion, habilitado bool) error {
	_, err := r.db.Exec(`
		INSERT INTO configuracion_notificaciones_rol (tenant_id, id, rol_id, tipo_notificacion, habilitado)
		VALUES ($1, gen_random_uuid(), $2, $3, $4)
		ON CONFLICT (tenant_id, rol_id, tipo_notificacion)
		DO UPDATE SET habilitado = $4`,
		tenantID, rolID, tipo, habilitado,
	)
	return err
}

// UpsertMultiplesConfiguraciones actualiza varias configuraciones a la vez.
func (r *ConfiguracionNotificacionRepo) UpsertMultiplesConfiguraciones(tenantID, rolID uuid.UUID, configs map[model.TipoNotificacion]bool) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO configuracion_notificaciones_rol (tenant_id, id, rol_id, tipo_notificacion, habilitado)
		VALUES ($1, gen_random_uuid(), $2, $3, $4)
		ON CONFLICT (tenant_id, rol_id, tipo_notificacion)
		DO UPDATE SET habilitado = $4`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for tipo, habilitado := range configs {
		if _, err := stmt.Exec(tenantID, rolID, tipo, habilitado); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// TipoHabilitadoParaRol verifica si un tipo de notificación está habilitado para un rol.
// Si no hay configuración explícita, retorna true (habilitado por defecto).
func (r *ConfiguracionNotificacionRepo) TipoHabilitadoParaRol(tenantID, rolID uuid.UUID, tipo model.TipoNotificacion) (bool, error) {
	var habilitado bool
	err := r.db.QueryRow(`
		SELECT habilitado FROM configuracion_notificaciones_rol
		WHERE tenant_id = $1 AND rol_id = $2 AND tipo_notificacion = $3`,
		tenantID, rolID, tipo,
	).Scan(&habilitado)
	if err == sql.ErrNoRows {
		return true, nil // Habilitado por defecto
	}
	return habilitado, err
}

// ObtenerUsuariosDestinatariosPorTipoNotificacion retorna los IDs de usuarios que deben recibir
// un tipo de notificación según la configuración de su rol.
func (r *ConfiguracionNotificacionRepo) ObtenerUsuariosDestinatariosPorTipoNotificacion(tenantID uuid.UUID, tipo model.TipoNotificacion) ([]uuid.UUID, error) {
	moduloRequerido := model.ModuloRequeridoPorTipoNotificacion[tipo]
	log.Printf("[DEST-DEBUG] Buscando destinatarios: tenant=%s, tipo=%s, modulo_requerido=%s", tenantID, tipo, moduloRequerido)

	rows, err := r.db.Query(`
		SELECT u.id FROM usuarios_admin u
		JOIN roles_tenant rt ON rt.tenant_id = u.tenant_id AND LOWER(rt.slug) = LOWER(u.rol)
		WHERE u.tenant_id = $1
		  AND u.activo = true
		  AND (
		    LOWER(u.rol) = 'admin'
		    OR (rt.permisos->$2->>'ver')::boolean = true
		  )
		  AND NOT EXISTS (
		    SELECT 1 FROM configuracion_notificaciones_rol cnr
		    WHERE cnr.tenant_id = $1 AND cnr.rol_id = rt.id AND cnr.tipo_notificacion = $3
		      AND cnr.habilitado = false
		  )`,
		tenantID, moduloRequerido, tipo,
	)
	if err != nil {
		log.Printf("[DEST-DEBUG] Error en query destinatarios: %v", err)
		return nil, err
	}
	defer rows.Close()

	usuarios := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		usuarios = append(usuarios, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	log.Printf("[DEST-DEBUG] Resultado: %d usuarios encontrados para tipo=%s", len(usuarios), tipo)
	return usuarios, nil
}
