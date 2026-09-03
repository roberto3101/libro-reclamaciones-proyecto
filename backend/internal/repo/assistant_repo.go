package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AssistantRepo queries dedicadas para el contexto del asistente IA.
// No modifica ningún repo existente.
type AssistantRepo struct {
	db *sql.DB
}

func NewAssistantRepo(db *sql.DB) *AssistantRepo {
	return &AssistantRepo{db: db}
}

// EstadisticasReclamos resumen de reclamos por estado.
type EstadisticasReclamos struct {
	Total      int `json:"total"`
	Pendientes int `json:"pendientes"`
	EnProceso  int `json:"en_proceso"`
	Resueltos  int `json:"resueltos"`
	Cerrados   int `json:"cerrados"`
	Rechazados int `json:"rechazados"`
	Vencidos   int `json:"vencidos"`
}

// GetEstadisticas retorna conteos reales por estado para un tenant.
func (r *AssistantRepo) GetEstadisticas(ctx context.Context, tenantID uuid.UUID) (*EstadisticasReclamos, error) {
	query := `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE estado = 'PENDIENTE') AS pendientes,
			COUNT(*) FILTER (WHERE estado = 'EN_PROCESO') AS en_proceso,
			COUNT(*) FILTER (WHERE estado = 'RESUELTO') AS resueltos,
			COUNT(*) FILTER (WHERE estado = 'CERRADO') AS cerrados,
			COUNT(*) FILTER (WHERE estado = 'RECHAZADO') AS rechazados,
			COUNT(*) FILTER (WHERE estado IN ('PENDIENTE','EN_PROCESO') AND fecha_limite_respuesta < CURRENT_DATE) AS vencidos
		FROM reclamos
		WHERE tenant_id = $1 AND deleted_at IS NULL`

	e := &EstadisticasReclamos{}
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(
		&e.Total, &e.Pendientes, &e.EnProceso, &e.Resueltos,
		&e.Cerrados, &e.Rechazados, &e.Vencidos,
	)
	if err != nil {
		return nil, fmt.Errorf("assistant_repo.GetEstadisticas: %w", err)
	}
	return e, nil
}

// ReclamoResumen versión ligera de un reclamo para el contexto de IA.
type ReclamoResumen struct {
	CodigoReclamo  string
	Estado         string
	TipoSolicitud string
	NombreCompleto string
	Email          string
	Telefono       string
	FechaRegistro  time.Time
	FechaLimite    sql.NullTime
	DiasRestantes  int
	DetalleBien    string // descripcion_bien
	DetalleCorto   string // primeros 200 chars del detalle_reclamo
	PedidoConsumidor string
	SedeNombre     sql.NullString
}

// GetReclamosPorEstado retorna todos los reclamos de un estado específico con detalle suficiente.
func (r *AssistantRepo) GetReclamosPorEstado(ctx context.Context, tenantID uuid.UUID, estado string, limite int) ([]ReclamoResumen, error) {
	query := `
		SELECT
			codigo_reclamo, estado, COALESCE(tipo_solicitud, 'RECLAMO'),
			LEFT(nombre_completo, 60), email, COALESCE(LEFT(telefono, 15), ''),
			fecha_registro, fecha_limite_respuesta,
			COALESCE((fecha_limite_respuesta - CURRENT_DATE)::int, 0) AS dias_restantes,
			COALESCE(LEFT(descripcion_bien, 100), ''),
			LEFT(detalle_reclamo, 200) AS detalle_corto,
			COALESCE(LEFT(pedido_consumidor, 150), ''),
			sede_nombre
		FROM reclamos
		WHERE tenant_id = $1 AND deleted_at IS NULL AND estado = $2
		ORDER BY
			CASE WHEN fecha_limite_respuesta < CURRENT_DATE THEN 0 ELSE 1 END,
			fecha_limite_respuesta ASC NULLS LAST
		LIMIT $3`

	rows, err := r.db.QueryContext(ctx, query, tenantID, estado, limite)
	if err != nil {
		return nil, fmt.Errorf("assistant_repo.GetReclamosPorEstado: %w", err)
	}
	defer rows.Close()

	var reclamos []ReclamoResumen
	for rows.Next() {
		var rec ReclamoResumen
		if err := rows.Scan(
			&rec.CodigoReclamo, &rec.Estado, &rec.TipoSolicitud,
			&rec.NombreCompleto, &rec.Email, &rec.Telefono,
			&rec.FechaRegistro, &rec.FechaLimite,
			&rec.DiasRestantes,
			&rec.DetalleBien, &rec.DetalleCorto,
			&rec.PedidoConsumidor, &rec.SedeNombre,
		); err != nil {
			return nil, fmt.Errorf("assistant_repo.GetReclamosPorEstado.scan: %w", err)
		}
		reclamos = append(reclamos, rec)
	}
	return reclamos, rows.Err()
}

// GetReclamosUrgentes retorna los reclamos más urgentes (próximos a vencer o ya vencidos).
func (r *AssistantRepo) GetReclamosUrgentes(ctx context.Context, tenantID uuid.UUID, limite int) ([]ReclamoResumen, error) {
	query := `
		SELECT
			codigo_reclamo, estado, COALESCE(tipo_solicitud, 'RECLAMO'),
			LEFT(nombre_completo, 60), email, COALESCE(LEFT(telefono, 15), ''),
			fecha_registro, fecha_limite_respuesta,
			COALESCE((fecha_limite_respuesta - CURRENT_DATE)::int, 0) AS dias_restantes,
			COALESCE(LEFT(descripcion_bien, 100), ''),
			LEFT(detalle_reclamo, 200) AS detalle_corto,
			COALESCE(LEFT(pedido_consumidor, 150), ''),
			sede_nombre
		FROM reclamos
		WHERE tenant_id = $1
			AND deleted_at IS NULL
			AND estado IN ('PENDIENTE', 'EN_PROCESO')
		ORDER BY
			CASE WHEN fecha_limite_respuesta < CURRENT_DATE THEN 0 ELSE 1 END,
			fecha_limite_respuesta ASC NULLS LAST
		LIMIT $2`

	return r.scanReclamos(ctx, query, tenantID, limite)
}

// GetReclamosRecientes retorna los últimos N reclamos de cualquier estado.
func (r *AssistantRepo) GetReclamosRecientes(ctx context.Context, tenantID uuid.UUID, limite int) ([]ReclamoResumen, error) {
	query := `
		SELECT
			codigo_reclamo, estado, COALESCE(tipo_solicitud, 'RECLAMO'),
			LEFT(nombre_completo, 60), email, COALESCE(LEFT(telefono, 15), ''),
			fecha_registro, fecha_limite_respuesta,
			COALESCE((fecha_limite_respuesta - CURRENT_DATE)::int, 0) AS dias_restantes,
			COALESCE(LEFT(descripcion_bien, 100), ''),
			LEFT(detalle_reclamo, 200) AS detalle_corto,
			COALESCE(LEFT(pedido_consumidor, 150), ''),
			sede_nombre
		FROM reclamos
		WHERE tenant_id = $1 AND deleted_at IS NULL
		ORDER BY fecha_registro DESC
		LIMIT $2`

	return r.scanReclamos(ctx, query, tenantID, limite)
}

// ReclamoBasico contiene datos minimos de un reclamo para confirmacion de acciones.
type ReclamoBasico struct {
	ID             uuid.UUID
	CodigoReclamo  string
	Estado         string
	NombreCompleto string
	Email          string
	Telefono       string
}

// GetReclamoIDPorCodigo resuelve un codigo_reclamo a su UUID.
func (r *AssistantRepo) GetReclamoIDPorCodigo(ctx context.Context, tenantID uuid.UUID, codigo string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRowContext(ctx,
		`SELECT id FROM reclamos WHERE tenant_id = $1 AND codigo_reclamo = $2 AND deleted_at IS NULL`,
		tenantID, codigo,
	).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("assistant_repo.GetReclamoIDPorCodigo: %w", err)
	}
	return id, nil
}

// GetReclamoBasicoPorCodigo retorna datos basicos de un reclamo para incluir en confirmaciones.
func (r *AssistantRepo) GetReclamoBasicoPorCodigo(ctx context.Context, tenantID uuid.UUID, codigo string) (*ReclamoBasico, error) {
	var rb ReclamoBasico
	err := r.db.QueryRowContext(ctx,
		`SELECT id, codigo_reclamo, estado, nombre_completo, email, COALESCE(telefono, '')
		FROM reclamos WHERE tenant_id = $1 AND codigo_reclamo = $2 AND deleted_at IS NULL`,
		tenantID, codigo,
	).Scan(&rb.ID, &rb.CodigoReclamo, &rb.Estado, &rb.NombreCompleto, &rb.Email, &rb.Telefono)
	if err != nil {
		return nil, fmt.Errorf("assistant_repo.GetReclamoBasicoPorCodigo: %w", err)
	}
	return &rb, nil
}

// GetReclamoResumenPorCodigo retorna el detalle compacto de un reclamo específico por su código.
func (r *AssistantRepo) GetReclamoResumenPorCodigo(ctx context.Context, tenantID uuid.UUID, codigoReclamo string) (*ReclamoResumen, error) {
	query := `
		SELECT
			codigo_reclamo, estado, COALESCE(tipo_solicitud, 'RECLAMO'),
			LEFT(nombre_completo, 60), email, COALESCE(LEFT(telefono, 15), ''),
			fecha_registro, fecha_limite_respuesta,
			COALESCE((fecha_limite_respuesta - CURRENT_DATE)::int, 0) AS dias_restantes,
			COALESCE(LEFT(descripcion_bien, 100), ''),
			LEFT(detalle_reclamo, 200) AS detalle_corto,
			COALESCE(LEFT(pedido_consumidor, 150), ''),
			sede_nombre
		FROM reclamos
		WHERE tenant_id = $1 AND codigo_reclamo = $2 AND deleted_at IS NULL`

	var rec ReclamoResumen
	err := r.db.QueryRowContext(ctx, query, tenantID, codigoReclamo).Scan(
		&rec.CodigoReclamo, &rec.Estado, &rec.TipoSolicitud,
		&rec.NombreCompleto, &rec.Email, &rec.Telefono,
		&rec.FechaRegistro, &rec.FechaLimite,
		&rec.DiasRestantes,
		&rec.DetalleBien, &rec.DetalleCorto,
		&rec.PedidoConsumidor, &rec.SedeNombre,
	)
	if err != nil {
		return nil, fmt.Errorf("assistant_repo.GetReclamoResumenPorCodigo: %w", err)
	}
	return &rec, nil
}

// UsuarioActivo dato mínimo de un asesor para el contexto del asistente IA.
type UsuarioActivo struct {
	ID             uuid.UUID
	NombreCompleto string
	Email          string
	Rol            string
}

// GetUsuariosActivos retorna los usuarios activos del tenant (asesores disponibles).
func (r *AssistantRepo) GetUsuariosActivos(ctx context.Context, tenantID uuid.UUID) ([]UsuarioActivo, error) {
	query := `
		SELECT id, nombre_completo, email, rol
		FROM usuarios_admin
		WHERE tenant_id = $1 AND activo = true
		ORDER BY nombre_completo ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("assistant_repo.GetUsuariosActivos: %w", err)
	}
	defer rows.Close()

	var usuarios []UsuarioActivo
	for rows.Next() {
		var u UsuarioActivo
		if err := rows.Scan(&u.ID, &u.NombreCompleto, &u.Email, &u.Rol); err != nil {
			return nil, fmt.Errorf("assistant_repo.GetUsuariosActivos.scan: %w", err)
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}

// scanReclamos helper compartido para evitar duplicar el scan.
func (r *AssistantRepo) scanReclamos(ctx context.Context, query string, tenantID uuid.UUID, limite int) ([]ReclamoResumen, error) {
	rows, err := r.db.QueryContext(ctx, query, tenantID, limite)
	if err != nil {
		return nil, fmt.Errorf("assistant_repo.scanReclamos: %w", err)
	}
	defer rows.Close()

	var reclamos []ReclamoResumen
	for rows.Next() {
		var rec ReclamoResumen
		if err := rows.Scan(
			&rec.CodigoReclamo, &rec.Estado, &rec.TipoSolicitud,
			&rec.NombreCompleto, &rec.Email, &rec.Telefono,
			&rec.FechaRegistro, &rec.FechaLimite,
			&rec.DiasRestantes,
			&rec.DetalleBien, &rec.DetalleCorto,
			&rec.PedidoConsumidor, &rec.SedeNombre,
		); err != nil {
			return nil, fmt.Errorf("assistant_repo.scan: %w", err)
		}
		reclamos = append(reclamos, rec)
	}
	return reclamos, rows.Err()
}