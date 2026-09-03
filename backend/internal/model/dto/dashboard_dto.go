package dto

type DashboardMetricas struct {
	Total                   int     `json:"total"`
	Pendientes              int     `json:"pendientes"`
	EnProceso               int     `json:"en_proceso"`
	Resueltos               int     `json:"resueltos"`
	Cerrados                int     `json:"cerrados"`
	TotalReclamos           int     `json:"total_reclamos"`
	TotalQuejas             int     `json:"total_quejas"`
	Vencidos                int     `json:"vencidos"`
	Ultimos7Dias            int     `json:"ultimos_7_dias"`
	EsteMes                 int     `json:"este_mes"`
	PromedioDiasResolucion  float64 `json:"promedio_dias_resolucion"`
}

type DashboardFilters struct {
	SedeID string `form:"sede_id"`
}