package repo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

type APIMetricasRepo struct {
	db *sql.DB
}

func NuevoAPIMetricasRepo(db *sql.DB) *APIMetricasRepo {
	return &APIMetricasRepo{db: db}
}

type MetricaAPI struct {
	Ruta       string
	Metodo     string
	DuracionMs int
	StatusCode int
	TenantID   *uuid.UUID
}

type RendimientoRuta struct {
	Ruta       string  `json:"ruta"`
	Metodo     string  `json:"metodo"`
	Peticiones int     `json:"peticiones"`
	PromedioMs float64 `json:"promedio_ms"`
	P95Ms      float64 `json:"p95_ms"`
	P99Ms      float64 `json:"p99_ms"`
}

func (r *APIMetricasRepo) ObtenerRendimientoPorRuta(ctx context.Context) ([]RendimientoRuta, error) {
	query := `
		WITH metricas AS (
			SELECT ruta, metodo, duracion_ms
			FROM api_metricas
			WHERE fecha >= now() - INTERVAL '24 hours'
		),
		agrupadas AS (
			SELECT ruta, metodo,
				COUNT(*)::INT as peticiones,
				AVG(duracion_ms)::INT as promedio_ms,
				MAX(duracion_ms)::INT as max_ms
			FROM metricas
			GROUP BY ruta, metodo
			HAVING COUNT(*) >= 3
		),
		sorted AS (
			SELECT m.ruta, m.metodo, m.duracion_ms,
				ROW_NUMBER() OVER (PARTITION BY m.ruta, m.metodo ORDER BY m.duracion_ms ASC) as rn,
				a.peticiones
			FROM metricas m
			JOIN agrupadas a ON m.ruta = a.ruta AND m.metodo = a.metodo
		),
		percentiles AS (
			SELECT ruta, metodo,
				MAX(CASE WHEN rn = GREATEST(1, (peticiones * 95 / 100)::INT) THEN duracion_ms END) as p95_ms,
				MAX(CASE WHEN rn = GREATEST(1, (peticiones * 99 / 100)::INT) THEN duracion_ms END) as p99_ms
			FROM sorted
			GROUP BY ruta, metodo
		)
		SELECT a.ruta, a.metodo, a.peticiones, a.promedio_ms,
			COALESCE(p.p95_ms, a.max_ms) as p95_ms,
			COALESCE(p.p99_ms, a.max_ms) as p99_ms
		FROM agrupadas a
		LEFT JOIN percentiles p ON a.ruta = p.ruta AND a.metodo = p.metodo
		ORDER BY COALESCE(p.p95_ms, a.max_ms) DESC
		LIMIT 30`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("api_metricas_repo.ObtenerRendimiento: %w", err)
	}
	defer rows.Close()

	resultado := []RendimientoRuta{}
	for rows.Next() {
		var rr RendimientoRuta
		if err := rows.Scan(&rr.Ruta, &rr.Metodo, &rr.Peticiones, &rr.PromedioMs, &rr.P95Ms, &rr.P99Ms); err != nil {
			return nil, err
		}
		resultado = append(resultado, rr)
	}
	return resultado, rows.Err()
}
