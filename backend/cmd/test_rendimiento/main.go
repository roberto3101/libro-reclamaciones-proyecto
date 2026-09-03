package main

import (
	"database/sql"
	"fmt"
	"math/rand"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var rutas = []struct {
	ruta   string
	metodo string
	minMs  int
	maxMs  int
}{
	{"/api/v1/auth/login", "POST", 80, 400},
	{"/api/v1/auth/logout", "POST", 5, 20},
	{"/api/v1/auth/seleccionar-tenant", "POST", 30, 150},
	{"/api/v1/auth/cambiar-empresa", "POST", 20, 100},
	{"/api/v1/reclamos", "GET", 15, 120},
	{"/api/v1/reclamos", "POST", 50, 300},
	{"/api/v1/reclamos/:id", "GET", 10, 80},
	{"/api/v1/reclamos/:id/respuestas", "POST", 30, 200},
	{"/api/v1/reclamos/:id/mensajes", "GET", 10, 70},
	{"/api/v1/reclamos/:id/mensajes", "POST", 15, 90},
	{"/api/v1/dashboard/metricas", "GET", 100, 800},
	{"/api/v1/dashboard/uso", "GET", 50, 300},
	{"/api/v1/usuarios", "GET", 8, 60},
	{"/api/v1/usuarios", "POST", 30, 150},
	{"/api/v1/sedes", "GET", 5, 40},
	{"/api/v1/sedes", "POST", 20, 100},
	{"/api/v1/configuracion", "GET", 10, 50},
	{"/api/v1/configuracion", "PUT", 20, 120},
	{"/api/v1/chatbots", "GET", 5, 30},
	{"/api/v1/chatbots", "POST", 20, 80},
	{"/api/v1/chatbots/:id/api-keys", "POST", 15, 60},
	{"/api/v1/canales/whatsapp", "GET", 8, 45},
	{"/api/v1/canales/whatsapp", "POST", 20, 100},
	{"/api/v1/exportar/pdf", "GET", 200, 2000},
	{"/api/v1/exportar/excel", "GET", 150, 1500},
	{"/api/v1/suscripcion", "GET", 20, 100},
	{"/api/v1/planes", "GET", 5, 25},
	{"/api/v1/notificaciones", "GET", 10, 60},
	{"/api/v1/notificaciones/sin-leer/total", "GET", 3, 15},
	{"/api/v1/roles", "GET", 5, 30},
	{"/api/v1/roles", "POST", 15, 60},
	{"/api/v1/plantillas-email", "GET", 8, 40},
	{"/api/v1/asistente/chat", "POST", 300, 3000},
	{"/api/v1/asistente/conversations", "GET", 10, 50},
	{"/api/v1/atencion-vivo", "GET", 10, 60},
	{"/api/v1/atencion-vivo/:id/mensajes", "GET", 8, 40},
	{"/api/v1/contacto/solicitud-whatsapp", "POST", 50, 300},
	{"/api/v1/onboarding", "POST", 200, 1000},
	{"/libro/:slug/tenant", "GET", 5, 30},
	{"/libro/:slug/reclamos", "POST", 40, 200},
	{"/libro/:slug/seguimiento/:codigo", "GET", 10, 60},
	{"/api/v1/superadmin/estadisticas", "GET", 50, 400},
	{"/api/v1/superadmin/cuentas", "GET", 15, 80},
	{"/api/v1/superadmin/empresas", "GET", 15, 80},
	{"/api/v1/superadmin/errores", "GET", 20, 100},
	{"/api/v1/superadmin/planes", "GET", 5, 25},
	{"/api/v1/superadmin/buscar", "GET", 30, 200},
}

var tenantIDs = []string{
	"a0000000-0000-0000-0000-000000000001",
}

func main() {
	fmt.Println("╔═══════════════════════════════════════════════════════════╗")
	fmt.Println("║  TEST DE RENDIMIENTO — Genera métricas API simuladas     ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════╝")
	fmt.Println()

	db, err := sql.Open("postgres", "postgresql://root@localhost:26257/libroreclamaciones?sslmode=disable")
	if err != nil {
		fmt.Printf("Error conectando a DB: %v\n", err)
		return
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Printf("Error ping DB: %v\n", err)
		return
	}
	fmt.Println("Conectado a CockroachDB")

	total := 500
	batchSize := 50
	insertados := 0

	fmt.Printf("Insertando %d métricas simuladas...\n\n", total)

	for insertados < total {
		count := batchSize
		if insertados+count > total {
			count = total - insertados
		}

		vals := make([]string, 0, count)
		args := make([]interface{}, 0, count*5)

		for i := 0; i < count; i++ {
			r := rutas[rand.Intn(len(rutas))]

			duracion := r.minMs + rand.Intn(r.maxMs-r.minMs)
			if rand.Float64() < 0.05 {
				duracion = r.maxMs + rand.Intn(r.maxMs)
			}

			status := 200
			roll := rand.Float64()
			if roll < 0.03 {
				status = 500
				duracion = duracion * 3
			} else if roll < 0.08 {
				status = 400
			} else if roll < 0.10 {
				status = 404
			}

			tid := tenantIDs[rand.Intn(len(tenantIDs))]

			horasAtras := rand.Intn(24)
			fecha := time.Now().Add(-time.Duration(horasAtras) * time.Hour).Add(-time.Duration(rand.Intn(3600)) * time.Second)

			idx := len(args)
			vals = append(vals, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d)",
				idx+1, idx+2, idx+3, idx+4, idx+5, idx+6))
			args = append(args, r.ruta, r.metodo, duracion, status, tid, fecha)
		}

		query := fmt.Sprintf(
			"INSERT INTO api_metricas (ruta, metodo, duracion_ms, status_code, tenant_id, fecha) VALUES %s",
			strings.Join(vals, ", "),
		)

		_, err := db.Exec(query, args...)
		if err != nil {
			fmt.Printf("Error insertando batch: %v\n", err)
			return
		}

		insertados += count
		fmt.Printf("  [%d/%d] insertados\n", insertados, total)
	}

	fmt.Println()
	fmt.Println(strings.Repeat("─", 58))

	rows, err := db.Query(`
		SELECT ruta, metodo, COUNT(*) as n,
			AVG(duracion_ms)::INT as avg_ms,
			MAX(duracion_ms) as max_ms
		FROM api_metricas
		WHERE fecha >= now() - INTERVAL '24 hours'
		GROUP BY ruta, metodo
		ORDER BY avg_ms DESC
		LIMIT 10
	`)
	if err == nil {
		defer rows.Close()
		fmt.Println("\nTop 10 rutas más lentas (últimas 24h):")
		fmt.Printf("%-40s %-6s %6s %6s %6s\n", "RUTA", "MÉTODO", "REQS", "AVG", "MAX")
		fmt.Println(strings.Repeat("─", 70))
		for rows.Next() {
			var ruta, metodo string
			var n, avg, max int
			rows.Scan(&ruta, &metodo, &n, &avg, &max)
			fmt.Printf("%-40s %-6s %6d %5dms %5dms\n", ruta, metodo, n, avg, max)
		}
	}

	fmt.Println()
	fmt.Println("→ Abre /superadmin/errores → tab 'Rendimiento' para ver los datos.")
}
