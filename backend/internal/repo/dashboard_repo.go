package repo

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"

	"github.com/google/uuid"
)

type DashboardRepo struct {
	db *sql.DB
}

func NewDashboardRepo(db *sql.DB) *DashboardRepo {
	return &DashboardRepo{db: db}
}

// GetUsoTenant consulta la vista v_uso_tenant para validar límites del plan.
func (r *DashboardRepo) GetUsoTenant(ctx context.Context, tenantID uuid.UUID) (*model.UsoTenant, error) {
	query := `
		SELECT tenant_id,
			plan_id, plan_codigo, plan_nombre,
			suscripcion_id, suscripcion_estado, suscripcion_ciclo, suscripcion_es_trial,
			limite_sedes, limite_usuarios, limite_reclamos_mes, limite_chatbots,
			limite_canales_whatsapp, limite_storage_mb,
			permite_chatbot, permite_whatsapp, permite_email,
			permite_reportes_pdf, permite_exportar_excel, permite_api,
			permite_marca_blanca, permite_multi_idioma,
			permite_asistente_ia, permite_atencion_vivo,
			uso_sedes, uso_usuarios, uso_reclamos_mes, uso_chatbots, uso_canales_whatsapp
		FROM v_uso_tenant
		WHERE tenant_id = $1`

	u := &model.UsoTenant{}
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(
		&u.TenantID,
		&u.PlanID, &u.PlanCodigo, &u.PlanNombre,
		&u.SuscripcionID, &u.SuscripcionEstado, &u.SuscripcionCiclo, &u.EsTrial,
		&u.LimiteSedes, &u.LimiteUsuarios, &u.LimiteReclamosMes, &u.LimiteChatbots,
		&u.LimiteCanalesWhatsApp, &u.LimiteStorageMB,
		&u.PermiteChatbot, &u.PermiteWhatsapp, &u.PermiteEmail,
		&u.PermiteReportesPDF, &u.PermiteExportarExcel, &u.PermiteAPI,
		&u.PermiteMarcaBlanca, &u.PermiteMultiIdioma,
		&u.PermiteAsistenteIA, &u.PermiteAtencionVivo,
		&u.UsoSedes, &u.UsoUsuarios, &u.UsoReclamosMes, &u.UsoChatbots, &u.UsoCanalesWhatsApp,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("dashboard_repo.GetUsoTenant: %w", err)
	}
	return u, nil
}

// GetMetricas consulta métricas de reclamos con filtro opcional por sede y periodo.
// El filtro de periodo se aplica en el WHERE principal para que CockroachDB use
// el índice idx_reclamo_conteo_mes (tenant_id, fecha_registro) y evite full scans
// en tenants con alto volumen de datos.
func (r *DashboardRepo) GetMetricas(ctx context.Context, tenantID uuid.UUID, sedeIDs []uuid.UUID, periodo string) (*dto.DashboardMetricas, error) {
	var m dto.DashboardMetricas

	baseWhere := "tenant_id = $1 AND deleted_at IS NULL"
	args := []interface{}{tenantID}
	argIdx := 2

	if len(sedeIDs) > 0 {
		placeholders := make([]string, len(sedeIDs))
		for i, sid := range sedeIDs {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, sid)
			argIdx++
		}
		baseWhere += " AND sede_id IN (" + strings.Join(placeholders, ",") + ")"
	}

	// Filtro de periodo: se agrega al WHERE principal para limitar el scan.
	if desde := calcularInicioPeriodo(periodo); desde != nil {
		baseWhere += fmt.Sprintf(" AND fecha_registro >= $%d", argIdx)
		args = append(args, *desde)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE estado = 'PENDIENTE'),
			COUNT(*) FILTER (WHERE estado = 'EN_PROCESO'),
			COUNT(*) FILTER (WHERE estado = 'RESUELTO'),
			COUNT(*) FILTER (WHERE estado = 'CERRADO'),
			COUNT(*) FILTER (WHERE tipo_solicitud = 'RECLAMO'),
			COUNT(*) FILTER (WHERE tipo_solicitud = 'QUEJA'),
			COUNT(*) FILTER (WHERE fecha_limite_respuesta < CURRENT_DATE AND estado IN ('PENDIENTE', 'EN_PROCESO')),
			COUNT(*) FILTER (WHERE fecha_registro >= CURRENT_DATE - INTERVAL '7 days'),
			COUNT(*) FILTER (WHERE fecha_registro >= DATE_TRUNC('month', CURRENT_DATE)),
			COALESCE(ROUND(AVG(
				CASE WHEN estado IN ('RESUELTO', 'CERRADO') AND fecha_respuesta IS NOT NULL
				THEN EXTRACT(EPOCH FROM (fecha_respuesta - fecha_registro)) / 86400.0 END
			)::NUMERIC, 1), 0)
		FROM reclamos
		WHERE %s`, baseWhere)

	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&m.Total, &m.Pendientes, &m.EnProceso, &m.Resueltos, &m.Cerrados,
		&m.TotalReclamos, &m.TotalQuejas, &m.Vencidos, &m.Ultimos7Dias, &m.EsteMes,
		&m.PromedioDiasResolucion,
	)
	if err != nil {
		return nil, fmt.Errorf("dashboard_repo.GetMetricas: %w", err)
	}
	return &m, nil
}

// GetMetricasRango consulta métricas filtradas por rango de fechas personalizado.
// Usa parámetros preparados ($N) para prevenir inyección SQL.
func (r *DashboardRepo) GetMetricasRango(ctx context.Context, tenantID uuid.UUID, sedeIDs []uuid.UUID, desde *time.Time, hasta *time.Time) (*dto.DashboardMetricas, error) {
	var m dto.DashboardMetricas

	baseWhere := "tenant_id = $1 AND deleted_at IS NULL"
	args := []interface{}{tenantID}
	argIdx := 2

	if len(sedeIDs) > 0 {
		placeholders := make([]string, len(sedeIDs))
		for i, sid := range sedeIDs {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, sid)
			argIdx++
		}
		baseWhere += " AND sede_id IN (" + strings.Join(placeholders, ",") + ")"
	}

	if desde != nil {
		baseWhere += fmt.Sprintf(" AND fecha_registro >= $%d", argIdx)
		args = append(args, *desde)
		argIdx++
	}
	if hasta != nil {
		// fecha_hasta es inclusiva: registros hasta el final del día
		hastaFin := hasta.Add(24*time.Hour - time.Nanosecond)
		baseWhere += fmt.Sprintf(" AND fecha_registro <= $%d", argIdx)
		args = append(args, hastaFin)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE estado = 'PENDIENTE'),
			COUNT(*) FILTER (WHERE estado = 'EN_PROCESO'),
			COUNT(*) FILTER (WHERE estado = 'RESUELTO'),
			COUNT(*) FILTER (WHERE estado = 'CERRADO'),
			COUNT(*) FILTER (WHERE tipo_solicitud = 'RECLAMO'),
			COUNT(*) FILTER (WHERE tipo_solicitud = 'QUEJA'),
			COUNT(*) FILTER (WHERE fecha_limite_respuesta < CURRENT_DATE AND estado IN ('PENDIENTE', 'EN_PROCESO')),
			COUNT(*) FILTER (WHERE fecha_registro >= CURRENT_DATE - INTERVAL '7 days'),
			COUNT(*) FILTER (WHERE fecha_registro >= DATE_TRUNC('month', CURRENT_DATE)),
			COALESCE(ROUND(AVG(
				CASE WHEN estado IN ('RESUELTO', 'CERRADO') AND fecha_respuesta IS NOT NULL
				THEN EXTRACT(EPOCH FROM (fecha_respuesta - fecha_registro)) / 86400.0 END
			)::NUMERIC, 1), 0)
		FROM reclamos
		WHERE %s`, baseWhere)

	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&m.Total, &m.Pendientes, &m.EnProceso, &m.Resueltos, &m.Cerrados,
		&m.TotalReclamos, &m.TotalQuejas, &m.Vencidos, &m.Ultimos7Dias, &m.EsteMes,
		&m.PromedioDiasResolucion,
	)
	if err != nil {
		return nil, fmt.Errorf("dashboard_repo.GetMetricasRango: %w", err)
	}
	return &m, nil
}

// calcularInicioPeriodo devuelve la fecha de inicio según el periodo seleccionado.
// Retorna nil para "todo" (sin filtro de fecha = todo el historial).
func calcularInicioPeriodo(periodo string) *time.Time {
	now := time.Now()
	var desde time.Time

	switch periodo {
	case "esta_semana":
		// Lunes de la semana actual
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7 // Domingo = 7
		}
		desde = time.Date(now.Year(), now.Month(), now.Day()-(weekday-1), 0, 0, 0, 0, now.Location())
	case "este_mes":
		desde = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	case "este_anio":
		desde = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	default:
		// "todo" o vacío: sin filtro de fecha
		return nil
	}

	return &desde
}