package repo

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type ErrorLogRepo struct {
	db *sql.DB
}

func NewErrorLogRepo(db *sql.DB) *ErrorLogRepo {
	return &ErrorLogRepo{db: db}
}

type ErrorLogEntry struct {
	ID          uuid.UUID  `json:"id"`
	Nivel       string     `json:"nivel"`
	Origen      string     `json:"origen"`
	TenantID    *uuid.UUID `json:"tenant_id"`
	UsuarioID   *uuid.UUID `json:"usuario_id"`
	Metodo      *string    `json:"metodo"`
	Ruta        *string    `json:"ruta"`
	StatusCode  *int       `json:"status_code"`
	Mensaje     string     `json:"mensaje"`
	StackTrace  *string    `json:"stack_trace"`
	RequestBody *string    `json:"request_body"`
	IPAddress   *string    `json:"ip_address"`
	UserAgent   *string    `json:"user_agent"`
	Fingerprint *string    `json:"fingerprint"`
	Breadcrumbs *string    `json:"breadcrumbs"`
	Fecha       string     `json:"fecha"`
}

type ErrorLogAgrupado struct {
	Fingerprint string `json:"fingerprint"`
	Mensaje     string `json:"mensaje"`
	Ruta        string `json:"ruta"`
	Nivel       string `json:"nivel"`
	Origen      string `json:"origen"`
	Ocurrencias int    `json:"ocurrencias"`
	PrimeraVez  string `json:"primera_vez"`
	UltimaVez   string `json:"ultima_vez"`
}

type PuntoTimeline struct {
	Periodo string `json:"periodo"`
	Conteo  int    `json:"conteo"`
}

type ErrorLogFiltros struct {
	Nivel       string
	Origen      string
	TenantID    *uuid.UUID
	CuentaID    *uuid.UUID
	Desde       string
	Hasta       string
	Fingerprint string
}

func (r *ErrorLogRepo) Listar(ctx context.Context, limite, offset int, filtros ErrorLogFiltros) ([]ErrorLogEntry, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if filtros.Nivel != "" {
		where = append(where, fmt.Sprintf("nivel = $%d", idx))
		args = append(args, filtros.Nivel)
		idx++
	}
	if filtros.Origen != "" {
		where = append(where, fmt.Sprintf("origen = $%d", idx))
		args = append(args, filtros.Origen)
		idx++
	}
	if filtros.CuentaID != nil {
		where = append(where, fmt.Sprintf("tenant_id IN (SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $%d)", idx))
		args = append(args, filtros.CuentaID)
		idx++
	}
	if filtros.TenantID != nil {
		where = append(where, fmt.Sprintf("tenant_id = $%d", idx))
		args = append(args, filtros.TenantID)
		idx++
	}
	if filtros.Desde != "" {
		where = append(where, fmt.Sprintf("fecha >= $%d", idx))
		args = append(args, filtros.Desde)
		idx++
	}
	if filtros.Hasta != "" {
		where = append(where, fmt.Sprintf("fecha < $%d", idx))
		args = append(args, filtros.Hasta)
		idx++
	}
	if filtros.Fingerprint != "" {
		where = append(where, fmt.Sprintf("fingerprint = $%d", idx))
		args = append(args, filtros.Fingerprint)
		idx++
	}

	whereStr := strings.Join(where, " AND ")

	// Count
	var total int
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM error_log WHERE %s", whereStr)
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error_log_repo.Listar count: %w", err)
	}

	// Data
	query := fmt.Sprintf(`SELECT id, nivel, origen, tenant_id, usuario_id, metodo, ruta, status_code,
		mensaje, stack_trace, request_body, ip_address, user_agent, fingerprint, breadcrumbs, fecha
		FROM error_log WHERE %s ORDER BY fecha DESC LIMIT $%d OFFSET $%d`, whereStr, idx, idx+1)
	args = append(args, limite, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error_log_repo.Listar: %w", err)
	}
	defer rows.Close()

	entries := []ErrorLogEntry{}
	for rows.Next() {
		var e ErrorLogEntry
		if err := rows.Scan(&e.ID, &e.Nivel, &e.Origen, &e.TenantID, &e.UsuarioID,
			&e.Metodo, &e.Ruta, &e.StatusCode, &e.Mensaje, &e.StackTrace,
			&e.RequestBody, &e.IPAddress, &e.UserAgent, &e.Fingerprint, &e.Breadcrumbs, &e.Fecha); err != nil {
			return nil, 0, fmt.Errorf("error_log_repo.scan: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, total, rows.Err()
}

type ErrorResumen struct {
	Errores24h  int              `json:"errores_24h"`
	Errores7d   int              `json:"errores_7d"`
	Errores30d  int              `json:"errores_30d"`
	TopRutas    []TopRutaError   `json:"top_rutas"`
	TopEmpresas []TopEmpresaError `json:"top_empresas"`
}

type TopRutaError struct {
	Ruta  string `json:"ruta"`
	Count int    `json:"count"`
}

type TopEmpresaError struct {
	TenantID string `json:"tenant_id"`
	Count    int    `json:"count"`
}

// construirWhereErrores arma la cláusula WHERE común para las queries del
// error log: nivel, origen, tenant, cuenta, fingerprint y rango de fecha
// opcional. Retorna el SQL del where (sin la palabra "WHERE"), los argumentos
// en orden y el próximo índice libre para que el caller pueda seguir añadiendo.
//
// IMPORTANTE: todos los valores se pasan como parámetros posicionales ($1...)
// para evitar SQL injection. Los intervalos de fecha por default (1/7/30 días)
// se dejan como literales SQL porque son constantes controladas.
func (filtros ErrorLogFiltros) construirWhereErrores(startIdx int) (string, []interface{}, int) {
	clauses := []string{"1=1"}
	args := []interface{}{}
	idx := startIdx

	if filtros.Nivel != "" {
		clauses = append(clauses, fmt.Sprintf("nivel = $%d", idx))
		args = append(args, filtros.Nivel)
		idx++
	}
	if filtros.Origen != "" {
		clauses = append(clauses, fmt.Sprintf("origen = $%d", idx))
		args = append(args, filtros.Origen)
		idx++
	}
	if filtros.CuentaID != nil {
		clauses = append(clauses, fmt.Sprintf("tenant_id IN (SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $%d)", idx))
		args = append(args, filtros.CuentaID)
		idx++
	}
	if filtros.TenantID != nil {
		clauses = append(clauses, fmt.Sprintf("tenant_id = $%d", idx))
		args = append(args, filtros.TenantID)
		idx++
	}
	if filtros.Fingerprint != "" {
		clauses = append(clauses, fmt.Sprintf("fingerprint = $%d", idx))
		args = append(args, filtros.Fingerprint)
		idx++
	}
	return strings.Join(clauses, " AND "), args, idx
}

// Resumen retorna el resumen agregado del error_log respetando los filtros
// comunes (nivel, origen, cuenta, tenant) y el rango de fechas (Desde/Hasta
// del struct ErrorLogFiltros). Si Desde y Hasta están vacíos, usa los
// intervalos default: últimas 24h, 7 días, 30 días. Si vienen con valor,
// se usa ese rango en los tres contadores.
func (r *ErrorLogRepo) Resumen(ctx context.Context, filtros ErrorLogFiltros) (*ErrorResumen, error) {
	res := &ErrorResumen{}

	baseWhere, baseArgs, nextIdx := filtros.construirWhereErrores(1)

	// Los 3 contadores comparten los mismos filtros, pero cada uno tiene su
	// propio rango de fechas:
	//   - default: 1d, 7d, 30d respectivamente
	//   - con filtros.Desde/Hasta: los tres usan ese rango
	type contador struct {
		rango string
		dest  *int
	}
	contadores := []contador{}
	var extraArgs []interface{}
	usarDesdeHasta := filtros.Desde != "" && filtros.Hasta != ""

	if usarDesdeHasta {
		// Los tres contadores usan el mismo rango custom (se pasan como params).
		// Índices: $nextIdx = desde, $nextIdx+1 = hasta
		rangoCustom := fmt.Sprintf("fecha >= $%d AND fecha < $%d", nextIdx, nextIdx+1)
		extraArgs = []interface{}{filtros.Desde, filtros.Hasta}
		contadores = []contador{
			{rangoCustom, &res.Errores24h},
			{rangoCustom, &res.Errores7d},
			{rangoCustom, &res.Errores30d},
		}
	} else {
		contadores = []contador{
			{"fecha >= now() - INTERVAL '1 day'", &res.Errores24h},
			{"fecha >= now() - INTERVAL '7 days'", &res.Errores7d},
			{"fecha >= now() - INTERVAL '30 days'", &res.Errores30d},
		}
	}

	argsCombined := append([]interface{}{}, baseArgs...)
	argsCombined = append(argsCombined, extraArgs...)

	for _, c := range contadores {
		q := fmt.Sprintf("SELECT COUNT(*) FROM error_log WHERE %s AND %s", baseWhere, c.rango)
		if err := r.db.QueryRowContext(ctx, q, argsCombined...).Scan(c.dest); err != nil {
			return nil, fmt.Errorf("error_log_repo.Resumen: %w", err)
		}
	}

	// Top rutas y top empresas usan siempre la "ventana de contexto" — la del
	// rango custom si se pidió, o los últimos 7 días por default. Eso permite
	// ver qué rutas/empresas son problemáticas en el periodo que estás mirando.
	var rangoContexto string
	if usarDesdeHasta {
		rangoContexto = fmt.Sprintf("fecha >= $%d AND fecha < $%d", nextIdx, nextIdx+1)
	} else {
		rangoContexto = "fecha >= now() - INTERVAL '7 days'"
	}

	rows, err := r.db.QueryContext(ctx,
		fmt.Sprintf(`SELECT ruta, COUNT(*) as c FROM error_log WHERE %s AND %s AND ruta IS NOT NULL GROUP BY ruta ORDER BY c DESC LIMIT 5`, baseWhere, rangoContexto),
		argsCombined...)
	if err != nil {
		return nil, fmt.Errorf("error_log_repo.Resumen top_rutas: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var t TopRutaError
		if err := rows.Scan(&t.Ruta, &t.Count); err != nil {
			return nil, err
		}
		res.TopRutas = append(res.TopRutas, t)
	}

	rows2, err := r.db.QueryContext(ctx,
		fmt.Sprintf(`SELECT tenant_id::STRING, COUNT(*) as c FROM error_log WHERE %s AND %s AND tenant_id IS NOT NULL GROUP BY tenant_id ORDER BY c DESC LIMIT 5`, baseWhere, rangoContexto),
		argsCombined...)
	if err != nil {
		return nil, fmt.Errorf("error_log_repo.Resumen top_empresas: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var t TopEmpresaError
		if err := rows2.Scan(&t.TenantID, &t.Count); err != nil {
			return nil, err
		}
		res.TopEmpresas = append(res.TopEmpresas, t)
	}

	return res, nil
}

// InsertFrontendError inserta un error reportado por el frontend de un cliente.
func (r *ErrorLogRepo) InsertarErrorFrontend(ctx context.Context, tenantID, usuarioID *uuid.UUID, mensaje, stack, ruta, ip, userAgent, breadcrumbs, fingerprint string) error {
	query := `INSERT INTO error_log (nivel, origen, tenant_id, usuario_id, ruta, mensaje, stack_trace, ip_address, user_agent, breadcrumbs, fingerprint)
		VALUES ('ERROR', 'FRONTEND', $1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.ExecContext(ctx, query, tenantID, usuarioID, ruta, mensaje, nullStrRepo(stack), ip, userAgent, nullStrRepo(breadcrumbs), fingerprint)
	return err
}

func (r *ErrorLogRepo) ListarAgrupados(ctx context.Context, limite, offset int, filtros ErrorLogFiltros) ([]ErrorLogAgrupado, int, error) {
	where := []string{"fingerprint IS NOT NULL"}
	args := []interface{}{}
	idx := 1

	if filtros.Nivel != "" {
		where = append(where, fmt.Sprintf("nivel = $%d", idx))
		args = append(args, filtros.Nivel)
		idx++
	}
	if filtros.Origen != "" {
		where = append(where, fmt.Sprintf("origen = $%d", idx))
		args = append(args, filtros.Origen)
		idx++
	}
	if filtros.CuentaID != nil {
		where = append(where, fmt.Sprintf("tenant_id IN (SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $%d)", idx))
		args = append(args, filtros.CuentaID)
		idx++
	}
	if filtros.TenantID != nil {
		where = append(where, fmt.Sprintf("tenant_id = $%d", idx))
		args = append(args, filtros.TenantID)
		idx++
	}
	if filtros.Desde != "" {
		where = append(where, fmt.Sprintf("fecha >= $%d", idx))
		args = append(args, filtros.Desde)
		idx++
	}

	whereStr := strings.Join(where, " AND ")

	var total int
	countQ := fmt.Sprintf("SELECT COUNT(DISTINCT fingerprint) FROM error_log WHERE %s", whereStr)
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error_log_repo.ListarAgrupados count: %w", err)
	}

	query := fmt.Sprintf(`SELECT fingerprint, MIN(mensaje) as mensaje, MIN(ruta) as ruta,
		MIN(nivel) as nivel, MIN(origen) as origen,
		COUNT(*) as ocurrencias, MIN(fecha) as primera_vez, MAX(fecha) as ultima_vez
		FROM error_log WHERE %s
		GROUP BY fingerprint ORDER BY ultima_vez DESC LIMIT $%d OFFSET $%d`, whereStr, idx, idx+1)
	args = append(args, limite, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error_log_repo.ListarAgrupados: %w", err)
	}
	defer rows.Close()

	resultado := []ErrorLogAgrupado{}
	for rows.Next() {
		var e ErrorLogAgrupado
		var ruta *string
		if err := rows.Scan(&e.Fingerprint, &e.Mensaje, &ruta, &e.Nivel, &e.Origen, &e.Ocurrencias, &e.PrimeraVez, &e.UltimaVez); err != nil {
			return nil, 0, err
		}
		if ruta != nil {
			e.Ruta = *ruta
		}
		resultado = append(resultado, e)
	}
	return resultado, total, rows.Err()
}

// ObtenerTimeline retorna el histograma de errores agrupado por hora o día
// en los últimos `dias` días, respetando los filtros comunes (nivel, origen,
// cuenta, tenant). Cada punto tiene `periodo` (timestamp truncado) y `conteo`.
//
// Nota: `truncar` y `dias` son literales SQL controlados por el servidor
// (validados en el controller a valores seguros), por eso se pueden embeber
// directo. Todos los filtros del usuario viajan como parámetros posicionales.
func (r *ErrorLogRepo) ObtenerTimeline(ctx context.Context, intervalo string, dias int, filtros ErrorLogFiltros) ([]PuntoTimeline, error) {
	truncar := "hour"
	if intervalo == "dia" {
		truncar = "day"
	}
	if dias < 1 {
		dias = 1
	}
	if dias > 30 {
		dias = 30
	}

	baseWhere, args, _ := filtros.construirWhereErrores(1)

	query := fmt.Sprintf(`SELECT date_trunc('%s', fecha) as periodo, COUNT(*) as conteo
		FROM error_log
		WHERE %s AND fecha >= now() - INTERVAL '%d days'
		GROUP BY periodo ORDER BY periodo ASC`, truncar, baseWhere, dias)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("error_log_repo.ObtenerTimeline: %w", err)
	}
	defer rows.Close()

	puntos := []PuntoTimeline{}
	for rows.Next() {
		var p PuntoTimeline
		if err := rows.Scan(&p.Periodo, &p.Conteo); err != nil {
			return nil, err
		}
		puntos = append(puntos, p)
	}
	return puntos, rows.Err()
}

func nullStrRepo(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
