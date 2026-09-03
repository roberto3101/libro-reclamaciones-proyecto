package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const baseURL = "http://localhost:8080/api/v1"

// Tenant: UNIVERSIDAD DE PIURA
const udepTenantID = "a0000000-0000-0000-0000-000000000001"

func main() {
	fmt.Println("╔═══════════════════════════════════════════════════════════╗")
	fmt.Println("║  TEST DE ERRORES — Universidad de Piura (tenant UDEP)    ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════╝")
	fmt.Println()

	tests := []struct {
		nombre string
		metodo string
		ruta   string
		body   string
		token  string // si no está vacío, se usa como Bearer token
		expect int
	}{
		// ── Errores sin auth (globales) ──
		{"400 JSON inválido", "POST", "/auth/login", `{broken`, "", 400},
		{"404 Ruta inexistente", "GET", "/esto-no-existe-nunca", "", "", 404},
		{"400 Login sin datos", "POST", "/auth/login", `{"email":"","password":""}`, "", 400},

		// ── Errores con token falso (simula tenant UDEP) ──
		{"401 Token expirado", "GET", "/reclamos", "", "eyJhbGciOiJIUzI1NiJ9.eyJ0ZW5hbnRfaWQiOiJhMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJ1c2VyX2lkIjoiZmFrZSIsInJvbGUiOiJBRE1JTiJ9.fake", 401},
		{"401 Token corrupto", "GET", "/dashboard/metricas", "", "token-totalmente-invalido", 401},

		// ── Errores de validación (simulados) ──
		{"401 Crear reclamo sin auth", "POST", "/reclamos", `{"tipo_solicitud":"RECLAMO"}`, "", 401},
		{"401 Ver usuarios sin auth", "GET", "/usuarios", "", "", 401},
		{"401 Ver sedes sin auth", "GET", "/sedes", "", "", 401},
		{"401 Ver dashboard sin auth", "GET", "/dashboard/metricas", "", "", 401},
		{"401 Exportar sin auth", "GET", "/exportar/pdf", "", "", 401},

		// ── SuperAdmin errores ──
		{"401 SA login incorrecto", "POST", "/superadmin/auth/login", `{"email":"hacker@evil.com","password":"password123"}`, "", 401},
		{"401 SA estadísticas sin auth", "GET", "/superadmin/estadisticas", "", "", 401},
		{"401 SA planes sin auth", "GET", "/superadmin/planes", "", "", 401},

		// ── Frontend error reports (estos sí se guardan con tenant de UDEP) ──
		{"FE: TypeError null", "POST", "/error-report", fmt.Sprintf(`{"mensaje":"TypeError: Cannot read properties of null (reading 'map')","stack":"at PaginaReclamos.tsx:42\n    at renderWithHooks\n    at mountIndeterminateComponent","ruta":"/reclamos","tenant_id":"%s"}`, udepTenantID), "", 200},
		{"FE: ChunkLoadError", "POST", "/error-report", fmt.Sprintf(`{"mensaje":"ChunkLoadError: Loading chunk dashboard-DDUxIppR.js failed","stack":"at __vitePreload (index-ECEpiNtd.js:1:234)\n    at async loadRoute","ruta":"/dashboard","tenant_id":"%s"}`, udepTenantID), "", 200},
		{"FE: Network Error", "POST", "/error-report", fmt.Sprintf(`{"mensaje":"AxiosError: Network Error - ERR_CONNECTION_REFUSED","stack":"at XMLHttpRequest.handleError (xhr.js:195)\n    at XMLHttpRequest.send","ruta":"/suscripcion","tenant_id":"%s"}`, udepTenantID), "", 200},
		{"FE: Unhandled rejection", "POST", "/error-report", fmt.Sprintf(`{"mensaje":"Unhandled Promise Rejection: Request failed with status code 500","stack":"at createError (createError.js:16)\n    at settle (settle.js:17)","ruta":"/configuracion","tenant_id":"%s"}`, udepTenantID), "", 200},
		{"FE: ResizeObserver", "POST", "/error-report", fmt.Sprintf(`{"mensaje":"ResizeObserver loop completed with undelivered notifications","ruta":"/chatbots","tenant_id":"%s"}`, udepTenantID), "", 200},
	}

	client := &http.Client{Timeout: 5 * time.Second}
	ok, fail := 0, 0

	for i, t := range tests {
		fmt.Printf("[%02d] %-45s → ", i+1, t.nombre)

		var body io.Reader
		if t.body != "" {
			body = bytes.NewBufferString(t.body)
		}

		req, err := http.NewRequest(t.metodo, baseURL+t.ruta, body)
		if err != nil {
			fmt.Printf("ERROR: %v\n", err)
			fail++
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		if t.token != "" {
			req.Header.Set("Authorization", "Bearer "+t.token)
		}

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("RED ERROR: %v\n", err)
			fail++
			continue
		}
		resp.Body.Close()

		if resp.StatusCode == t.expect {
			fmt.Printf("✓ %d\n", resp.StatusCode)
			ok++
		} else {
			fmt.Printf("✗ %d (esperaba %d)\n", resp.StatusCode, t.expect)
			fail++
		}
		time.Sleep(150 * time.Millisecond)
	}

	fmt.Println()
	fmt.Println(strings.Repeat("─", 58))
	fmt.Printf("Resultado: %d ✓  %d ✗  de %d tests\n", ok, fail, len(tests))
	fmt.Println()
	fmt.Println("→ Abre /superadmin/errores y filtra por 'Grupo Quma SAC'")
	fmt.Println("  → luego por 'UNIVERSIDAD DE PIURA' para ver los errores.")
	fmt.Println("→ Los errores FRONTEND aparecerán con origen FRONTEND")
	fmt.Println("  y tenant_id de UDEP.")
	fmt.Println("→ Los errores BACKEND aparecerán con origen BACKEND")
	fmt.Println("  sin tenant (son pre-auth).")
}
