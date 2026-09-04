package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type SolicitudAsesorRepo struct {
	db *sql.DB
}

func NewSolicitudAsesorRepo(db *sql.DB) *SolicitudAsesorRepo {
	return &SolicitudAsesorRepo{db: db}
}

const solicitudAsesorSelect = `
	s.tenant_id, s.id, s.nombre, s.telefono, s.motivo,
	s.canal_origen, s.canal_whatsapp_id, s.estado, s.prioridad,
	s.asignado_a, s.fecha_asignacion, s.fecha_resolucion,
	s.nota_interna, s.resumen_conversacion,
	s.fecha_creacion, s.fecha_actualizacion,
	COALESCE(ua.nombre_completo, '')`

const solicitudAsesorFrom = `
	FROM solicitudes_asesor s
	LEFT JOIN usuarios_admin ua ON s.tenant_id = ua.tenant_id AND s.asignado_a = ua.id`

func scanSolicitudAsesor(scanner interface{ Scan(...interface{}) error }) (*model.SolicitudAsesor, error) {
	s := &model.SolicitudAsesor{}
	err := scanner.Scan(
		&s.TenantID, &s.ID, &s.Nombre, &s.Telefono, &s.Motivo,
		&s.CanalOrigen, &s.CanalWhatsAppID, &s.Estado, &s.Prioridad,
		&s.AsignadoA, &s.FechaAsignacion, &s.FechaResolucion,
		&s.NotaInterna, &s.ResumenConversacion,
		&s.FechaCreacion, &s.FechaActualizacion,
		&s.NombreAsesor,
	)
	return s, err
}

// ListarPendientesYEnAtencion retorna solicitudes abiertas del tenant,
// ordenadas por prioridad (URGENTE primero) y antigüedad.
// Es la query principal del panel de atención en vivo.
func (r *SolicitudAsesorRepo) ListarPendientesYEnAtencion(ctx context.Context, tenantID uuid.UUID) ([]model.SolicitudAsesor, error) {
	query := `SELECT ` + solicitudAsesorSelect + solicitudAsesorFrom + `
		WHERE s.tenant_id = $1 AND s.estado IN ('PENDIENTE', 'EN_ATENCION')
		ORDER BY
			CASE s.prioridad
				WHEN 'URGENTE' THEN 0
				WHEN 'ALTA' THEN 1
				WHEN 'NORMAL' THEN 2
				WHEN 'BAJA' THEN 3
			END,
			s.fecha_creacion ASC
		LIMIT 200`

	return r.scanMultiples(ctx, query, tenantID)
}

// ContarAbiertasPorTelefono cuenta solicitudes abiertas de un teléfono.
func (r *SolicitudAsesorRepo) ContarAbiertasPorTelefono(ctx context.Context, tenantID uuid.UUID, telefono string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM solicitudes_asesor
		 WHERE tenant_id = $1 AND telefono = $2 AND estado IN ('PENDIENTE', 'EN_ATENCION')`,
		tenantID, telefono,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("solicitud_asesor_repo.ContarAbiertasPorTelefono: %w", err)
	}
	return count, nil
}

// ListarPorEstado retorna solicitudes filtradas por estado.
func (r *SolicitudAsesorRepo) ListarPorEstado(ctx context.Context, tenantID uuid.UUID, estado string, limite int) ([]model.SolicitudAsesor, error) {
	query := `SELECT ` + solicitudAsesorSelect + solicitudAsesorFrom + `
		WHERE s.tenant_id = $1 AND s.estado = $2
		ORDER BY s.fecha_creacion DESC
		LIMIT $3`

	rows, err := r.db.QueryContext(ctx, query, tenantID, estado, limite)
	if err != nil {
		return nil, fmt.Errorf("solicitud_asesor_repo.ListarPorEstado: %w", err)
	}
	defer rows.Close()
	return r.scanRows(rows)
}

// ListarPorAsesor retorna solicitudes asignadas a un asesor específico.
func (r *SolicitudAsesorRepo) ListarPorAsesor(ctx context.Context, tenantID, asesorID uuid.UUID) ([]model.SolicitudAsesor, error) {
	query := `SELECT ` + solicitudAsesorSelect + solicitudAsesorFrom + `
		WHERE s.tenant_id = $1 AND s.asignado_a = $2 AND s.estado IN ('PENDIENTE', 'EN_ATENCION')
		ORDER BY s.fecha_creacion ASC`

	return r.scanMultiples(ctx, query, tenantID, asesorID)
}

// FiltrosSolicitudAsesor agrupa filtros opcionales para el listado paginado de solicitudes.
type FiltrosSolicitudAsesor struct {
	AsignadoA *uuid.UUID
	Estado    *string
	Orden     string // "recientes" | "antiguos" | "prioridad"
}

// ListarPaginado retorna solicitudes con paginación y filtros.
func (r *SolicitudAsesorRepo) ListarPaginado(ctx context.Context, tenantID uuid.UUID, pagina, porPagina int, f FiltrosSolicitudAsesor) ([]model.SolicitudAsesor, int, error) {
	where := "s.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if f.AsignadoA != nil {
		where += fmt.Sprintf(" AND s.asignado_a = $%d", argIdx)
		args = append(args, *f.AsignadoA)
		argIdx++
	}
	if f.Estado != nil && *f.Estado != "" {
		where += fmt.Sprintf(" AND s.estado = $%d", argIdx)
		args = append(args, *f.Estado)
		argIdx++
	}

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM solicitudes_asesor s WHERE %s", where)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("solicitud_asesor_repo.ListarPaginado count: %w", err)
	}

	orderBy := "s.fecha_creacion DESC"
	switch f.Orden {
	case "antiguos":
		orderBy = "s.fecha_creacion ASC"
	case "prioridad":
		orderBy = `CASE s.prioridad WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'NORMAL' THEN 2 WHEN 'BAJA' THEN 3 END, s.fecha_creacion DESC`
	}

	offset := (pagina - 1) * porPagina
	args = append(args, porPagina, offset)

	query := fmt.Sprintf(`SELECT %s %s WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d`,
		solicitudAsesorSelect, solicitudAsesorFrom, where, orderBy, argIdx, argIdx+1)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("solicitud_asesor_repo.ListarPaginado: %w", err)
	}
	defer rows.Close()

	solicitudes, err := r.scanRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return solicitudes, total, nil
}

// ContarPendientes retorna el total de solicitudes pendientes (para badge del sidebar).
func (r *SolicitudAsesorRepo) ContarPendientes(ctx context.Context, tenantID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM solicitudes_asesor WHERE tenant_id = $1 AND estado = 'PENDIENTE'`,
		tenantID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("solicitud_asesor_repo.ContarPendientes: %w", err)
	}
	return count, nil
}

// ExisteSolicitudAbiertaPorTelefono verifica si ya hay una solicitud abierta
// para el mismo teléfono (evita duplicados desde WhatsApp).
func (r *SolicitudAsesorRepo) ExisteSolicitudAbiertaPorTelefono(ctx context.Context, tenantID uuid.UUID, telefono string) (bool, error) {
	var existe bool
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM solicitudes_asesor
			WHERE tenant_id = $1 AND telefono = $2 AND estado IN ('PENDIENTE', 'EN_ATENCION')
		)`, tenantID, telefono,
	).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("solicitud_asesor_repo.ExisteSolicitudAbiertaPorTelefono: %w", err)
	}
	return existe, nil
}

// GetByID retorna una solicitud específica.
func (r *SolicitudAsesorRepo) GetByID(ctx context.Context, tenantID, solicitudID uuid.UUID) (*model.SolicitudAsesor, error) {
	query := `SELECT ` + solicitudAsesorSelect + solicitudAsesorFrom + `
		WHERE s.tenant_id = $1 AND s.id = $2`

	s, err := scanSolicitudAsesor(r.db.QueryRowContext(ctx, query, tenantID, solicitudID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("solicitud_asesor_repo.GetByID: %w", err)
	}
	return s, nil
}

// Crear inserta una nueva solicitud de asesor.
func (r *SolicitudAsesorRepo) Crear(ctx context.Context, s *model.SolicitudAsesor) error {
	query := `
		INSERT INTO solicitudes_asesor (
			tenant_id, nombre, telefono, motivo,
			canal_origen, canal_whatsapp_id, prioridad, resumen_conversacion
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, estado, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		s.TenantID, s.Nombre, s.Telefono, s.Motivo,
		s.CanalOrigen, s.CanalWhatsAppID, s.Prioridad, s.ResumenConversacion,
	).Scan(&s.ID, &s.Estado, &s.FechaCreacion, &s.FechaActualizacion)
}

// AsignarAsesor asigna un asesor y cambia el estado a EN_ATENCION.
func (r *SolicitudAsesorRepo) AsignarAsesor(ctx context.Context, tenantID, solicitudID, asesorID uuid.UUID) error {
	query := `
		UPDATE solicitudes_asesor SET
			asignado_a = $1, estado = 'EN_ATENCION',
			fecha_asignacion = $2, fecha_actualizacion = $2
		WHERE tenant_id = $3 AND id = $4 AND estado IN ('PENDIENTE', 'EN_ATENCION')`

	result, err := r.db.ExecContext(ctx, query, asesorID, time.Now(), tenantID, solicitudID)
	if err != nil {
		return fmt.Errorf("solicitud_asesor_repo.AsignarAsesor: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not_found_or_closed")
	}
	return nil
}

// MarcarComoResuelta cierra la solicitud como resuelta.
func (r *SolicitudAsesorRepo) MarcarComoResuelta(ctx context.Context, tenantID, solicitudID uuid.UUID, notaInterna string) error {
	query := `
		UPDATE solicitudes_asesor SET
			estado = 'RESUELTO', nota_interna = $1,
			fecha_resolucion = $2, fecha_actualizacion = $2
		WHERE tenant_id = $3 AND id = $4 AND estado IN ('PENDIENTE', 'EN_ATENCION')`

	result, err := r.db.ExecContext(ctx, query, notaInterna, time.Now(), tenantID, solicitudID)
	if err != nil {
		return fmt.Errorf("solicitud_asesor_repo.MarcarComoResuelta: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not_found_or_closed")
	}
	return nil
}

// Cancelar cierra la solicitud como cancelada.
func (r *SolicitudAsesorRepo) Cancelar(ctx context.Context, tenantID, solicitudID uuid.UUID) error {
	query := `
		UPDATE solicitudes_asesor SET
			estado = 'CANCELADO', fecha_resolucion = $1, fecha_actualizacion = $1
		WHERE tenant_id = $2 AND id = $3 AND estado IN ('PENDIENTE', 'EN_ATENCION')`

	result, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, solicitudID)
	if err != nil {
		return fmt.Errorf("solicitud_asesor_repo.Cancelar: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not_found_or_closed")
	}
	return nil
}

// ActualizarPrioridad cambia la prioridad de una solicitud abierta.
func (r *SolicitudAsesorRepo) ActualizarPrioridad(ctx context.Context, tenantID, solicitudID uuid.UUID, prioridad string) error {
	query := `
		UPDATE solicitudes_asesor SET
			prioridad = $1, fecha_actualizacion = $2
		WHERE tenant_id = $3 AND id = $4 AND estado IN ('PENDIENTE', 'EN_ATENCION')`

	result, err := r.db.ExecContext(ctx, query, prioridad, time.Now(), tenantID, solicitudID)
	if err != nil {
		return fmt.Errorf("solicitud_asesor_repo.ActualizarPrioridad: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not_found_or_closed")
	}
	return nil
}

// ActualizarNotaInterna edita la nota interna de una solicitud.
func (r *SolicitudAsesorRepo) ActualizarNotaInterna(ctx context.Context, tenantID, solicitudID uuid.UUID, nota string) error {
	query := `
		UPDATE solicitudes_asesor SET
			nota_interna = $1, fecha_actualizacion = $2
		WHERE tenant_id = $3 AND id = $4`

	_, err := r.db.ExecContext(ctx, query, nota, time.Now(), tenantID, solicitudID)
	if err != nil {
		return fmt.Errorf("solicitud_asesor_repo.ActualizarNotaInterna: %w", err)
	}
	return nil
}

// ── Helpers de scan ─────────────────────────────────────────────────────────

func (r *SolicitudAsesorRepo) scanMultiples(ctx context.Context, query string, args ...interface{}) ([]model.SolicitudAsesor, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("solicitud_asesor_repo.query: %w", err)
	}
	defer rows.Close()
	return r.scanRows(rows)
}

func (r *SolicitudAsesorRepo) scanRows(rows *sql.Rows) ([]model.SolicitudAsesor, error) {
	solicitudes := []model.SolicitudAsesor{}
	for rows.Next() {
		s, err := scanSolicitudAsesor(rows)
		if err != nil {
			return nil, fmt.Errorf("solicitud_asesor_repo.scan: %w", err)
		}
		solicitudes = append(solicitudes, *s)
	}
	return solicitudes, rows.Err()
}

// scanUnica ejecuta una query y retorna una única solicitud o nil.
func (r *SolicitudAsesorRepo) scanUnica(ctx context.Context, query string, args ...interface{}) (*model.SolicitudAsesor, error) {
	s, err := scanSolicitudAsesor(r.db.QueryRowContext(ctx, query, args...))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

// BuscarActivaPorTelefono retorna la solicitud EN_ATENCION de un teléfono.
func (r *SolicitudAsesorRepo) BuscarActivaPorTelefono(ctx context.Context, tenantID uuid.UUID, telefono string) (*model.SolicitudAsesor, error) {
	query := `SELECT ` + solicitudAsesorSelect + `
		` + solicitudAsesorFrom + `
		WHERE s.tenant_id = $1 AND s.telefono = $2 AND s.estado = 'EN_ATENCION'
		ORDER BY s.fecha_creacion DESC
		LIMIT 1`

	sol, err := r.scanUnica(ctx, query, tenantID, telefono)
	if err != nil {
		return nil, fmt.Errorf("solicitud_asesor_repo.BuscarActivaPorTelefono: %w", err)
	}
	return sol, nil
}



