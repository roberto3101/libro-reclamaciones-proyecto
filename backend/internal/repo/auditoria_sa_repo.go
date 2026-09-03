package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AuditoriaSARepo struct {
	db *sql.DB
}

func NewAuditoriaSARepo(db *sql.DB) *AuditoriaSARepo {
	return &AuditoriaSARepo{db: db}
}

// ── Límites de seguridad (protegen el backend a escala) ──
const (
	// MaxLimiteListado es el cap duro de filas por página. Aunque el cliente
	// pida más, el backend nunca retorna más de esto en un solo SELECT.
	MaxLimiteListado = 200

	// MaxOffsetListado protege contra paginación profunda (OFFSET degradado
	// linealmente a partir de ciertos miles de filas en CockroachDB).
	MaxOffsetListado = 50000

	// MaxRangoListadoDias acota el rango de fechas del listado. El SA no puede
	// pedir "toda la historia" — siempre debe acotar por fecha.
	MaxRangoListadoDias = 365

	// MaxRangoExportDias acota el rango de fechas para exportaciones.
	// 90 días cubre cualquier requerimiento de auditoría normal.
	MaxRangoExportDias = 90

	// MaxFilasExport es el tope absoluto de filas que un export puede
	// escribir al writer. Garantiza que un export nunca pueda colgar
	// recursos del servidor por error de filtrado.
	MaxFilasExport = 500000
)

type AuditoriaSAEntry struct {
	ID           uuid.UUID `json:"id"`
	SuperAdminID uuid.UUID `json:"superadmin_id"`
	Accion       string    `json:"accion"`
	Entidad      string    `json:"entidad"`
	EntidadID    *string   `json:"entidad_id"`
	Detalles     *string   `json:"detalles"`
	IPAddress    *string   `json:"ip_address"`
	Fecha        string    `json:"fecha"`
}

func (r *AuditoriaSARepo) Create(ctx context.Context, saID uuid.UUID, accion, entidad string, entidadID, detalles, ip *string) error {
	query := `INSERT INTO auditoria_superadmin (superadmin_id, accion, entidad, entidad_id, detalles, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.ExecContext(ctx, query, saID, accion, entidad, entidadID, detalles, ip)
	if err != nil {
		return fmt.Errorf("auditoria_sa_repo.Create: %w", err)
	}
	return nil
}

// ── Helpers enriquecedores para auditoria_superadmin ──
//
// Los siguientes métodos hacen un lookup adicional para que el campo `detalles`
// lleve información legible (nombre de cuenta, razón social, email del usuario,
// etc.) y no solo IDs. Todos son fire-and-forget — un fallo de auditoría
// nunca rompe la respuesta del usuario.

// insertSyncSA hace el INSERT bloqueando dentro de la goroutine del helper.
func (r *AuditoriaSARepo) insertSyncSA(saID uuid.UUID, accion, entidad, entidadID string, detalles map[string]interface{}, ipAddress string) {
	var detPtr *string
	if len(detalles) > 0 {
		b, err := json.Marshal(detalles)
		if err == nil {
			s := string(b)
			detPtr = &s
		}
	}
	var entIDPtr *string
	if entidadID != "" {
		entIDPtr = &entidadID
	}
	var ipPtr *string
	if ipAddress != "" {
		ipPtr = &ipAddress
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := r.Create(ctx, saID, accion, entidad, entIDPtr, detPtr, ipPtr); err != nil {
		// Solo loguear; nunca propagar
		fmt.Printf("[audit_sa] error registrando %s/%s: %v\n", accion, entidad, err)
	}
}

// RegistrarAccionCuenta audita acciones sobre una cuenta agregando su nombre.
func (r *AuditoriaSARepo) RegistrarAccionCuenta(saID, cuentaID uuid.UUID, accion string, extra map[string]interface{}, ipAddress string) {
	if saID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var nombre, email string
		_ = r.db.QueryRowContext(ctx,
			`SELECT nombre, email_contacto FROM cuentas WHERE id = $1`, cuentaID,
		).Scan(&nombre, &email)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if nombre != "" {
			extra["cuenta_nombre"] = nombre
		}
		if email != "" {
			extra["cuenta_email"] = email
		}
		r.insertSyncSA(saID, accion, "CUENTA", cuentaID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionEmpresa audita acciones sobre una empresa (tenant) del SA,
// agregando razón social y RUC.
func (r *AuditoriaSARepo) RegistrarAccionEmpresa(saID, tenantID uuid.UUID, accion string, extra map[string]interface{}, ipAddress string) {
	if saID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var razon, ruc string
		_ = r.db.QueryRowContext(ctx,
			`SELECT razon_social, ruc FROM configuracion_tenant WHERE tenant_id = $1`, tenantID,
		).Scan(&razon, &ruc)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if razon != "" {
			extra["razon_social"] = razon
		}
		if ruc != "" {
			extra["ruc"] = ruc
		}
		r.insertSyncSA(saID, accion, "EMPRESA", tenantID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionUsuarioTenant audita acciones del SA sobre un usuario de un
// tenant cliente, agregando email y nombre del usuario objetivo.
func (r *AuditoriaSARepo) RegistrarAccionUsuarioTenant(saID, tenantID, userID uuid.UUID, accion string, extra map[string]interface{}, ipAddress string) {
	if saID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var email, nombre, rol, razon string
		_ = r.db.QueryRowContext(ctx,
			`SELECT u.email, u.nombre_completo, u.rol, COALESCE(t.razon_social, '')
			 FROM usuarios_admin u
			 LEFT JOIN configuracion_tenant t ON t.tenant_id = u.tenant_id
			 WHERE u.tenant_id = $1 AND u.id = $2`,
			tenantID, userID,
		).Scan(&email, &nombre, &rol, &razon)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		extra["tenant_id"] = tenantID.String()
		if razon != "" {
			extra["razon_social"] = razon
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
		r.insertSyncSA(saID, accion, "USUARIO", userID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionPlanSA audita acciones sobre un plan, agregando código y
// nombre del plan al detalles.
func (r *AuditoriaSARepo) RegistrarAccionPlanSA(saID, planID uuid.UUID, accion string, extra map[string]interface{}, ipAddress string) {
	if saID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var codigo, nombre string
		var precio float64
		_ = r.db.QueryRowContext(ctx,
			`SELECT codigo, nombre, precio_mensual FROM planes WHERE id = $1`, planID,
		).Scan(&codigo, &nombre, &precio)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if codigo != "" {
			extra["plan_codigo"] = codigo
		}
		if nombre != "" {
			extra["plan_nombre"] = nombre
		}
		if precio > 0 {
			extra["plan_precio_mensual"] = precio
		}
		r.insertSyncSA(saID, accion, "PLAN", planID.String(), extra, ipAddress)
	}()
}

// RegistrarAccionStaff audita la creación de otro SA, agregando email y nombre.
func (r *AuditoriaSARepo) RegistrarAccionStaff(saID, targetSAID uuid.UUID, accion string, extra map[string]interface{}, ipAddress string) {
	if saID == uuid.Nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var email, nombre string
		_ = r.db.QueryRowContext(ctx,
			`SELECT email, nombre FROM superadmins WHERE id = $1`, targetSAID,
		).Scan(&email, &nombre)
		if extra == nil {
			extra = map[string]interface{}{}
		}
		if email != "" {
			extra["staff_email"] = email
		}
		if nombre != "" {
			extra["staff_nombre"] = nombre
		}
		r.insertSyncSA(saID, accion, "STAFF", targetSAID.String(), extra, ipAddress)
	}()
}

func (r *AuditoriaSARepo) Listar(ctx context.Context, limite, offset int) ([]AuditoriaSAEntry, int, error) {
	if limite <= 0 || limite > MaxLimiteListado {
		limite = MaxLimiteListado
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM auditoria_superadmin").Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.Listar count: %w", err)
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT id, superadmin_id, accion, entidad, entidad_id, detalles, ip_address, fecha
		FROM auditoria_superadmin ORDER BY fecha DESC LIMIT $1 OFFSET $2`, limite, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.Listar: %w", err)
	}
	defer rows.Close()

	var entries []AuditoriaSAEntry
	for rows.Next() {
		var e AuditoriaSAEntry
		if err := rows.Scan(&e.ID, &e.SuperAdminID, &e.Accion, &e.Entidad, &e.EntidadID, &e.Detalles, &e.IPAddress, &e.Fecha); err != nil {
			return nil, 0, fmt.Errorf("auditoria_sa_repo.scan: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, total, rows.Err()
}

// ── Actividad de empresas (lee auditoria_admin por tenant) ──

type ActividadEmpresaEntry struct {
	ID            uuid.UUID `json:"id"`
	TenantID      uuid.UUID `json:"tenant_id"`
	UsuarioID     uuid.UUID `json:"usuario_id"`
	UsuarioNombre string    `json:"usuario_nombre"`
	EmpresaNombre string    `json:"empresa_nombre"`
	Accion        string    `json:"accion"`
	Entidad       string    `json:"entidad"`
	EntidadID     *string   `json:"entidad_id"`
	Detalles      *string   `json:"detalles"` // JSONB serializado; puede ser nil
	IPAddress     *string   `json:"ip_address"`
	Fecha         time.Time `json:"fecha"`
}

type FiltrosActividad struct {
	TenantID   *uuid.UUID
	CuentaID   *uuid.UUID
	Accion     string
	FechaDesde time.Time // obligatorio en listado y export
	FechaHasta time.Time // obligatorio en listado y export
}

// diasCalendario retorna la diferencia en días calendario entre Hasta y
// Desde, ignorando la hora. Evita rechazos por el offset de "fin de día"
// que el controller aplica cuando parsea YYYY-MM-DD (23:59:59.999).
func (f FiltrosActividad) diasCalendario() int {
	d := time.Date(f.FechaDesde.Year(), f.FechaDesde.Month(), f.FechaDesde.Day(), 0, 0, 0, 0, time.UTC)
	h := time.Date(f.FechaHasta.Year(), f.FechaHasta.Month(), f.FechaHasta.Day(), 0, 0, 0, 0, time.UTC)
	return int(h.Sub(d).Hours() / 24)
}

// construirWhere arma la cláusula WHERE y sus argumentos. Siempre fuerza
// rango de fechas para garantizar que el índice global (fecha DESC) sea usado.
func (f FiltrosActividad) construirWhere(startIdx int) (string, []interface{}, int) {
	where := "a.fecha >= $1 AND a.fecha < $2"
	args := []interface{}{f.FechaDesde, f.FechaHasta}
	idx := startIdx + 2

	if f.CuentaID != nil {
		where += fmt.Sprintf(" AND a.tenant_id IN (SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $%d)", idx)
		args = append(args, *f.CuentaID)
		idx++
	}
	if f.TenantID != nil {
		where += fmt.Sprintf(" AND a.tenant_id = $%d", idx)
		args = append(args, *f.TenantID)
		idx++
	}
	if f.Accion != "" {
		where += fmt.Sprintf(" AND a.accion = $%d", idx)
		args = append(args, f.Accion)
		idx++
	}
	return where, args, idx
}

// ListarActividadEmpresas retorna una página acotada del listado.
// Aplica caps duros de limite y offset, y exige rango de fecha.
func (r *AuditoriaSARepo) ListarActividadEmpresas(ctx context.Context, limite, offset int, filtros FiltrosActividad) ([]ActividadEmpresaEntry, int, error) {
	if filtros.FechaDesde.IsZero() || filtros.FechaHasta.IsZero() {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad: fecha_desde y fecha_hasta son obligatorios")
	}
	if !filtros.FechaHasta.After(filtros.FechaDesde) {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad: fecha_hasta debe ser mayor que fecha_desde")
	}
	if filtros.diasCalendario() > MaxRangoListadoDias {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad: rango maximo %d dias", MaxRangoListadoDias)
	}
	if limite <= 0 || limite > MaxLimiteListado {
		limite = MaxLimiteListado
	}
	if offset < 0 {
		offset = 0
	}
	if offset > MaxOffsetListado {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad: offset maximo %d — usa filtros mas especificos o exporta", MaxOffsetListado)
	}

	where, args, nextIdx := filtros.construirWhere(1)

	// COUNT con los mismos filtros (sirve para el paginador del frontend).
	// Con el rango de fecha obligatorio, el índice global acota el scan.
	var total int
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM auditoria_admin a WHERE %s", where)
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad count: %w", err)
	}

	// Incluimos `detalles` (JSONB) en el SELECT para que el frontend pueda
	// mostrar el modal "Ver detalle" sin una query extra. El costo adicional
	// es un lookup al pkey por cada fila (limite=30 por defecto), lo cual
	// sigue siendo negligible frente a un round-trip HTTP extra por click.
	query := fmt.Sprintf(`SELECT a.id, a.tenant_id, a.usuario_id,
		COALESCE(ua.nombre_completo, 'Desconocido') AS usuario_nombre,
		COALESCE(ct.razon_social, 'Desconocida') AS empresa_nombre,
		a.accion, a.entidad, a.entidad_id, a.detalles::TEXT, a.ip_address, a.fecha
		FROM auditoria_admin a
		LEFT JOIN usuarios_admin ua ON a.tenant_id = ua.tenant_id AND a.usuario_id = ua.id
		LEFT JOIN configuracion_tenant ct ON a.tenant_id = ct.tenant_id
		WHERE %s ORDER BY a.fecha DESC LIMIT $%d OFFSET $%d`, where, nextIdx, nextIdx+1)
	args = append(args, limite, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad: %w", err)
	}
	defer rows.Close()

	entries := make([]ActividadEmpresaEntry, 0, limite)
	for rows.Next() {
		var e ActividadEmpresaEntry
		if err := rows.Scan(&e.ID, &e.TenantID, &e.UsuarioID, &e.UsuarioNombre, &e.EmpresaNombre, &e.Accion, &e.Entidad, &e.EntidadID, &e.Detalles, &e.IPAddress, &e.Fecha); err != nil {
			return nil, 0, fmt.Errorf("auditoria_sa_repo.ListarActividad scan: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, total, rows.Err()
}

// StreamActividadEmpresas ejecuta la query y llama `yield` por cada fila.
// Nunca carga todas las filas en memoria — el caller debe escribirlas
// directamente al writer HTTP (CSV/JSON streaming). Si yield devuelve error,
// la iteración se detiene.
//
// Aplica:
//   - rango de fechas obligatorio (max MaxRangoExportDias días)
//   - tope absoluto MaxFilasExport (cap duro, el cliente no puede superarlo)
//   - `limite`: si > 0, limita a los últimos N registros del rango. Si <= 0
//     o excede MaxFilasExport, se usa MaxFilasExport.
//   - misma proyección que el listado (sin detalles)
func (r *AuditoriaSARepo) StreamActividadEmpresas(
	ctx context.Context,
	filtros FiltrosActividad,
	limite int,
	yield func(e ActividadEmpresaEntry) error,
) (int, error) {
	if filtros.FechaDesde.IsZero() || filtros.FechaHasta.IsZero() {
		return 0, fmt.Errorf("auditoria_sa_repo.Stream: fecha_desde y fecha_hasta son obligatorios")
	}
	if !filtros.FechaHasta.After(filtros.FechaDesde) {
		return 0, fmt.Errorf("auditoria_sa_repo.Stream: fecha_hasta debe ser mayor que fecha_desde")
	}
	if filtros.diasCalendario() > MaxRangoExportDias {
		return 0, fmt.Errorf("auditoria_sa_repo.Stream: rango maximo de exportacion %d dias", MaxRangoExportDias)
	}

	if limite <= 0 || limite > MaxFilasExport {
		limite = MaxFilasExport
	}

	where, args, nextIdx := filtros.construirWhere(1)
	query := fmt.Sprintf(`SELECT a.id, a.tenant_id, a.usuario_id,
		COALESCE(ua.nombre_completo, 'Desconocido') AS usuario_nombre,
		COALESCE(ct.razon_social, 'Desconocida') AS empresa_nombre,
		a.accion, a.entidad, a.entidad_id, a.ip_address, a.fecha
		FROM auditoria_admin a
		LEFT JOIN usuarios_admin ua ON a.tenant_id = ua.tenant_id AND a.usuario_id = ua.id
		LEFT JOIN configuracion_tenant ct ON a.tenant_id = ct.tenant_id
		WHERE %s ORDER BY a.fecha DESC LIMIT $%d`, where, nextIdx)
	args = append(args, limite)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("auditoria_sa_repo.Stream: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return count, err
		}
		var e ActividadEmpresaEntry
		if err := rows.Scan(&e.ID, &e.TenantID, &e.UsuarioID, &e.UsuarioNombre, &e.EmpresaNombre, &e.Accion, &e.Entidad, &e.EntidadID, &e.IPAddress, &e.Fecha); err != nil {
			return count, fmt.Errorf("auditoria_sa_repo.Stream scan: %w", err)
		}
		if err := yield(e); err != nil {
			return count, err
		}
		count++
	}
	return count, rows.Err()
}
