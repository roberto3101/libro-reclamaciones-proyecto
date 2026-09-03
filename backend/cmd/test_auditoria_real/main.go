// Test de integración REAL para el sistema de auditoría.
//
// Este programa NO inserta datos falsos. Hace llamadas HTTP de verdad contra
// el backend corriendo en localhost:8060 y al final consulta la tabla
// auditoria_admin de CockroachDB para verificar que cada acción quedó
// registrada por el flujo normal de los controllers.
//
// Requisitos previos:
//   1. Backend corriendo en http://localhost:8060 (start-ms-libro-reclamaciones-local.bat)
//   2. CockroachDB en localhost:26257 con la base libroreclamaciones
//   3. Existe al menos un tenant activo con un usuario ADMIN activo
//
// Uso:
//   cd backend
//   go run ./cmd/test_auditoria_real
//
// Flujo del test:
//   1. Login del SuperAdmin (credenciales hardcodeadas para dev)
//   2. Lista las empresas reales del SA y elige la primera con ≥1 admin activo
//   3. Impersona ese admin → obtiene un JWT real del tenant
//   4. Con ese JWT crea un USUARIO ADMIN TEMPORAL con password conocido (CREAR_USUARIO)
//   5. Login real con ese usuario temporal (LOGIN)
//   6. Operaciones reales con un reclamo existente del tenant:
//        - CAMBIAR_ESTADO  (POST /reclamos/:id/estado)
//        - ASIGNAR         (POST /reclamos/:id/asignar)
//        - RESPONDER       (POST /reclamos/:id/respuestas)
//   7. EXPORTAR Excel real (GET /reclamos/exportar/excel)
//   8. CREAR_CHATBOT, GENERAR_API_KEY, REVOCAR_API_KEY
//   9. CONFIGURAR (PUT /tenant) — preserva los valores actuales y solo bumpea version
//  10. LOGOUT
//  11. Re-impersona admin original y desactiva el usuario temporal (DESACTIVAR_USUARIO)
//  12. Consulta auditoria_admin filtrada por (tenant, fecha >= inicio_test) y reporta:
//        - filas insertadas por cada acción esperada
//        - acciones faltantes (si las hay)
//        - código de salida 0 si todo OK, 1 si falta alguna
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

const (
	defaultAPIBase = "http://localhost:8080/api/v1"
	defaultDBDSN   = "postgres://root@localhost:26257/libroreclamaciones?sslmode=disable"
	tempPass       = "AuditTestRun2026!"
)

// Credenciales del SuperAdmin con las que corre la auditoria. No se
// escriben en el codigo: se pasan por entorno al lanzarla.
//   TEST_SA_EMAIL=... TEST_SA_PASSWORD=... go run ./cmd/test_auditoria_real
var (
	saEmail    = envOr("TEST_SA_EMAIL", "")
	saPassword = envOr("TEST_SA_PASSWORD", "")
)

// apiBase y dbDSN se pueden sobrescribir con TEST_API_URL y TEST_DB_DSN.
var (
	apiBase = envOr("TEST_API_URL", defaultAPIBase)
	dbDSN   = envOr("TEST_DB_DSN", defaultDBDSN)
)

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Acciones que el test ESPERA encontrar registradas en auditoria_admin tras
// el flujo del tenant. Si alguna falta al final, el test falla.
var accionesEsperadasTenant = []string{
	"CREAR_USUARIO",
	"LOGIN",
	"CAMBIAR_ESTADO",
	"ASIGNAR",
	"RESPONDER",
	"EXPORTAR",
	"CREAR_CHATBOT",
	"GENERAR_API_KEY",
	"REVOCAR_API_KEY",
	"CONFIGURAR",
	"LOGOUT",
	"DESACTIVAR_USUARIO",
}

// Acciones que el test ESPERA encontrar registradas en auditoria_superadmin
// tras el flujo del SA. Cubre las 16 del dropdown del frontend.
var accionesEsperadasSA = []string{
	"LOGIN",
	"CREAR_CUENTA",
	"EDITAR_CUENTA",
	"DESACTIVAR_CUENTA",
	"CREAR_EMPRESA",
	"ACTIVAR_EMPRESA",
	"DESACTIVAR_EMPRESA",
	"CAMBIAR_PLAN",
	"EDITAR_USUARIO",
	"DESACTIVAR_USUARIO",
	"RESETEAR_PASSWORD",
	"IMPERSONAR",
	"CREAR_PLAN",
	"EDITAR_PLAN",
	"CREAR_STAFF",
	"BUSCAR",
}

type runner struct {
	db                *sql.DB
	http              *http.Client
	saToken           string
	tenantID          string
	razonSocial       string
	adminUserID       string // admin original (impersonado para setup/teardown)
	adminToken        string // token del admin impersonado
	tempUserID        string // usuario admin temporal creado por el test
	tempEmail         string
	tempToken         string // token del usuario temporal (login real)
	userYaDesactivado bool   // marcado cuando el step normal desactiva al usuario, para que el cleanup no lo intente de nuevo
	reclamoID         string
	chatbotID         string
	apiKeyID          string
	tStart            time.Time

	// ── recursos creados por el flujo SA (todos limpiados al final) ──
	saCuentaID       string // cuenta temporal creada por el SA
	saEmpresaTID     string // tenant_id de la empresa creada bajo esa cuenta
	saEmpresaUserID  string // admin de la empresa creada
	saPlanID         string // plan temporal creado
	saStaffID        string // staff (otro SA) temporal creado
}

func main() {
	log.SetFlags(log.Ltime)

	r := &runner{
		http:   &http.Client{Timeout: 30 * time.Second},
		tStart: time.Now().UTC(),
	}

	db, err := sql.Open("postgres", dbDSN)
	if err != nil {
		log.Fatalf("[setup] no pude abrir DB: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("[setup] DB ping falló: %v (¿CockroachDB corriendo en :26257?)", err)
	}
	r.db = db

	if err := healthCheck(); err != nil {
		log.Fatalf("[setup] backend no responde en %s: %v", apiBase, err)
	}
	fmt.Println("✓ Backend OK, DB OK")
	fmt.Println()

	steps := []struct {
		name string
		fn   func() error
	}{
		// ── PARTE 1: Auditoría del tenant (auditoria_admin) ──
		{"[TENANT] Login SuperAdmin (auditará LOGIN del SA)", r.loginSA},
		{"[TENANT] Buscar empresa con admin activo", r.buscarEmpresa},
		{"[TENANT] Impersonar admin original (setup)", r.impersonarAdmin},
		{"[TENANT] Crear usuario temporal (auditará CREAR_USUARIO)", r.crearUsuarioTemp},
		{"[TENANT] Login real con usuario temporal (auditará LOGIN)", r.loginUsuarioTemp},
		{"[TENANT] Buscar reclamo existente del tenant", r.buscarReclamo},
		{"[TENANT] POST /reclamos/:id/estado (auditará CAMBIAR_ESTADO)", r.cambiarEstado},
		{"[TENANT] POST /reclamos/:id/asignar (auditará ASIGNAR)", r.asignarReclamo},
		{"[TENANT] POST /reclamos/:id/respuestas (auditará RESPONDER)", r.responder},
		{"[TENANT] GET /reclamos/exportar/excel (auditará EXPORTAR)", r.exportarExcel},
		{"[TENANT] POST /chatbots (auditará CREAR_CHATBOT)", r.crearChatbot},
		{"[TENANT] POST /chatbots/:id/api-keys (auditará GENERAR_API_KEY)", r.generarAPIKey},
		{"[TENANT] DELETE /chatbots/:id/api-keys/:keyId (auditará REVOCAR_API_KEY)", r.revocarAPIKey},
		{"[TENANT] PUT /tenant (auditará CONFIGURAR)", r.configurarTenant},
		{"[TENANT] POST /auth/logout (auditará LOGOUT)", r.logoutTemp},
		{"[TENANT] Re-impersonar admin y desactivar usuario temporal (auditará DESACTIVAR_USUARIO)", r.desactivarUsuarioTemp},

		// ── PARTE 2: Auditoría del SuperAdmin (auditoria_superadmin) ──
		{"[SA] BUSCAR — GET /superadmin/buscar?q=...", r.saBuscar},
		{"[SA] CREAR_PLAN — POST /superadmin/planes", r.saCrearPlan},
		{"[SA] EDITAR_PLAN — PUT /superadmin/planes/:planId", r.saEditarPlan},
		{"[SA] CREAR_CUENTA — POST /superadmin/cuentas", r.saCrearCuenta},
		{"[SA] EDITAR_CUENTA — PUT /superadmin/cuentas/:id", r.saEditarCuenta},
		{"[SA] CREAR_EMPRESA — POST /superadmin/cuentas/:id/empresas", r.saCrearEmpresa},
		{"[SA] DESACTIVAR_EMPRESA — PATCH /superadmin/empresas/:id/estado (false)", r.saDesactivarEmpresa},
		{"[SA] ACTIVAR_EMPRESA — PATCH /superadmin/empresas/:id/estado (true)", r.saActivarEmpresa},
		{"[SA] CAMBIAR_PLAN — PATCH /superadmin/empresas/:id/plan", r.saCambiarPlanEmpresa},
		{"[SA] EDITAR_USUARIO — PUT /superadmin/empresas/:id/usuarios/:userId", r.saEditarUsuarioEmpresa},
		{"[SA] RESETEAR_PASSWORD — POST /superadmin/empresas/:id/usuarios/:userId/resetear-password", r.saResetearPassword},
		// IMPERSONAR va ANTES de DESACTIVAR_USUARIO porque impersonar requiere
		// que haya un admin activo en el tenant. Si lo hacemos después, falla.
		{"[SA] IMPERSONAR — POST /superadmin/empresas/:id/impersonar (la empresa creada)", r.saImpersonarEmpresaCreada},
		{"[SA] DESACTIVAR_USUARIO — PATCH /superadmin/empresas/:id/usuarios/:userId/estado", r.saDesactivarUsuarioEmpresa},
		{"[SA] CREAR_STAFF — POST /superadmin/staff", r.saCrearStaff},
		{"[SA] DESACTIVAR_CUENTA — PATCH /superadmin/cuentas/:id/estado (cleanup)", r.saDesactivarCuenta},
	}

	var stepErr error
	for i, s := range steps {
		fmt.Printf("[%2d/%d] %s\n", i+1, len(steps), s.name)
		if err := s.fn(); err != nil {
			fmt.Printf("       ✗ %v\n", err)
			stepErr = err
			break
		}
		fmt.Printf("       ✓\n")
	}

	// Cleanup garantizado: si quedó un usuario temporal sin desactivar (porque
	// algún paso intermedio falló), lo bajamos ahora con un reimpersonate.
	// Best-effort: si esto también falla, lo logueamos y seguimos.
	if r.tempUserID != "" {
		if !r.userYaDesactivado {
			fmt.Println()
			fmt.Println("[cleanup] desactivando usuario temporal huérfano…")
			if err := r.cleanupUsuarioTemp(); err != nil {
				fmt.Printf("[cleanup] ⚠  no pude desactivar %s: %v (hazlo a mano si vuelve a pasar)\n", r.tempUserID, err)
			} else {
				fmt.Printf("[cleanup] ✓ usuario %s desactivado\n", r.tempUserID)
			}
		}
	}

	if stepErr != nil {
		fmt.Println()
		fmt.Printf("❌ Test abortado: %v\n", stepErr)
		os.Exit(1)
	}

	fmt.Println()
	// Damos un par de segundos para que las goroutines de auditoría flush al disco.
	time.Sleep(2 * time.Second)
	r.verificarAuditoria()
}

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

func healthCheck() error {
	// /health vive en la raíz, no bajo /api/v1. Derivamos la base.
	healthURL := strings.TrimSuffix(apiBase, "/api/v1") + "/health"
	resp, err := http.Get(healthURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("health devolvió %d", resp.StatusCode)
	}
	return nil
}

// doJSON ejecuta una petición HTTP con cuerpo JSON y devuelve el cuerpo como bytes.
// Si el status no es 2xx devuelve error con el body para diagnóstico.
func (r *runner) doJSON(method, path, token string, body any) ([]byte, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal: %w", err)
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, apiBase+path, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-Audit", "1")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d %s %s: %s", res.StatusCode, method, path, truncate(string(out), 300))
	}
	return out, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ─── Steps ────────────────────────────────────────────────────────────────────

func (r *runner) loginSA() error {
	body, err := r.doJSON("POST", "/superadmin/auth/login", "", map[string]string{
		"email":    saEmail,
		"password": saPassword,
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.Token == "" {
		return fmt.Errorf("login SA sin token: %s", truncate(string(body), 200))
	}
	r.saToken = resp.Data.Token
	return nil
}

// buscarEmpresa elige una empresa activa que cumpla todos los requisitos del
// test:
//   - activa
//   - con un admin activo (para impersonar)
//   - con suscripción ACTIVA o TRIAL
//   - con margen en max_usuarios (para crear el usuario temporal)
//   - con al menos un reclamo existente (para operar CAMBIAR_ESTADO/ASIGNAR/RESPONDER)
//
// Si más de una cumple, elige la que tenga más reclamos (más representativa).
func (r *runner) buscarEmpresa() error {
	row := r.db.QueryRow(`
		SELECT t.tenant_id, t.razon_social, u.id
		FROM configuracion_tenant t
		JOIN usuarios_admin u ON u.tenant_id = t.tenant_id AND u.activo = true AND u.rol = 'ADMIN'
		JOIN suscripciones s ON s.tenant_id = t.tenant_id AND s.estado IN ('ACTIVA','TRIAL')
		JOIN planes p ON p.id = s.plan_id
		WHERE t.activo = true
		  AND p.max_usuarios > (SELECT count(*) FROM usuarios_admin u2 WHERE u2.tenant_id = t.tenant_id AND u2.activo = true)
		  AND (SELECT count(*) FROM reclamos r WHERE r.tenant_id = t.tenant_id) > 0
		ORDER BY (SELECT count(*) FROM reclamos r WHERE r.tenant_id = t.tenant_id) DESC
		LIMIT 1`)
	if err := row.Scan(&r.tenantID, &r.razonSocial, &r.adminUserID); err != nil {
		return fmt.Errorf("no hay empresa que cumpla los requisitos del test (admin activo + plan con margen + reclamos existentes): %w", err)
	}
	fmt.Printf("       tenant=%s usuario_admin=%s razon=%q\n", r.tenantID, r.adminUserID, r.razonSocial)
	return nil
}

func (r *runner) impersonarAdmin() error {
	body, err := r.doJSON("POST", "/superadmin/empresas/"+r.tenantID+"/impersonar", r.saToken,
		map[string]string{"usuario_id": r.adminUserID})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Token  string `json:"token"`
			UserID string `json:"user_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.Token == "" {
		return fmt.Errorf("impersonar sin token")
	}
	r.adminToken = resp.Data.Token
	return nil
}

func (r *runner) crearUsuarioTemp() error {
	rnd := make([]byte, 4)
	_, _ = rand.Read(rnd)
	r.tempEmail = "audit.test+" + hex.EncodeToString(rnd) + "@ejemplo.test"

	body, err := r.doJSON("POST", "/usuarios", r.adminToken, map[string]any{
		"email":           r.tempEmail,
		"nombre_completo": "Audit Tester",
		"password":        tempPass,
		"rol":             "ADMIN",
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.ID == "" {
		// El service devuelve directamente el usuario en data, intentemos otro shape
		var alt struct {
			Success bool `json:"success"`
			Data    struct {
				User struct{ ID string `json:"id"` } `json:"user"`
			} `json:"data"`
		}
		_ = json.Unmarshal(body, &alt)
		if alt.Data.User.ID != "" {
			r.tempUserID = alt.Data.User.ID
		} else {
			// Fallback: lo buscamos por email en la DB.
			if err := r.db.QueryRow(
				`SELECT id FROM usuarios_admin WHERE tenant_id = $1 AND email = $2`,
				r.tenantID, r.tempEmail,
			).Scan(&r.tempUserID); err != nil {
				return fmt.Errorf("usuario creado pero sin id en respuesta ni en DB: %w", err)
			}
		}
	} else {
		r.tempUserID = resp.Data.ID
	}
	fmt.Printf("       usuario_temp_id=%s email=%s\n", r.tempUserID, r.tempEmail)
	return nil
}

func (r *runner) loginUsuarioTemp() error {
	body, err := r.doJSON("POST", "/auth/login", "", map[string]string{
		"email":    r.tempEmail,
		"password": tempPass,
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Token              string `json:"token"`
			EmpresasAccesibles []any  `json:"empresas_accesibles"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	// Si el usuario tiene varias empresas, viene token temporal y hay que
	// llamar a /auth/seleccionar-tenant. Como acabo de crearlo en un solo
	// tenant, debe llegar con token completo y la auditoría debió disparar.
	if resp.Data.Token == "" {
		return fmt.Errorf("login sin token")
	}
	r.tempToken = resp.Data.Token
	return nil
}

func (r *runner) buscarReclamo() error {
	row := r.db.QueryRow(
		`SELECT id FROM reclamos WHERE tenant_id = $1 ORDER BY fecha_registro DESC LIMIT 1`,
		r.tenantID)
	if err := row.Scan(&r.reclamoID); err != nil {
		return fmt.Errorf("el tenant %s no tiene reclamos para operar: %w", r.tenantID, err)
	}
	fmt.Printf("       reclamo_id=%s\n", r.reclamoID)
	return nil
}

func (r *runner) cambiarEstado() error {
	_, err := r.doJSON("POST", "/reclamos/"+r.reclamoID+"/estado", r.tempToken, map[string]string{
		"estado":     "EN_PROCESO",
		"comentario": "Cambio realizado por el test de auditoría",
	})
	return err
}

func (r *runner) asignarReclamo() error {
	// Asigno al admin original (que sabemos existe).
	_, err := r.doJSON("POST", "/reclamos/"+r.reclamoID+"/asignar", r.tempToken, map[string]string{
		"admin_id": r.adminUserID,
	})
	return err
}

func (r *runner) responder() error {
	_, err := r.doJSON("POST", "/reclamos/"+r.reclamoID+"/respuestas", r.tempToken, map[string]string{
		"respuesta_empresa":     "Respuesta automatizada del test de auditoría — verificar registros.",
		"accion_tomada":         "Test ejecutado",
		"compensacion_ofrecida": "Ninguna (test)",
		"cargo_responsable":     "Audit Tester",
	})
	return err
}

func (r *runner) exportarExcel() error {
	req, _ := http.NewRequest("GET", apiBase+"/reclamos/exportar/excel", nil)
	req.Header.Set("Authorization", "Bearer "+r.tempToken)
	res, err := r.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode != 200 {
		return fmt.Errorf("exportar excel devolvió %d", res.StatusCode)
	}
	return nil
}

func (r *runner) crearChatbot() error {
	body, err := r.doJSON("POST", "/chatbots", r.tempToken, map[string]any{
		"nombre":      "Audit Test Bot",
		"tipo":        "ASISTENTE_IA",
		"descripcion": "Chatbot creado por el test de auditoría",
		"temperatura": 0.5,
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.ID == "" {
		return fmt.Errorf("crear chatbot sin id: %s", truncate(string(body), 200))
	}
	r.chatbotID = resp.Data.ID
	return nil
}

func (r *runner) generarAPIKey() error {
	body, err := r.doJSON("POST", "/chatbots/"+r.chatbotID+"/api-keys", r.tempToken, map[string]string{
		"nombre":  "audit-test-key",
		"entorno": "TEST",
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.ID == "" {
		return fmt.Errorf("generar api key sin id: %s", truncate(string(body), 200))
	}
	r.apiKeyID = resp.Data.ID
	return nil
}

func (r *runner) revocarAPIKey() error {
	_, err := r.doJSON("DELETE", "/chatbots/"+r.chatbotID+"/api-keys/"+r.apiKeyID, r.tempToken, nil)
	return err
}

// configurarTenant lee la config actual del tenant y la re-envía con el mismo
// contenido (solo bumpea version). Esto dispara CONFIGURAR sin alterar datos
// del tenant elegido.
func (r *runner) configurarTenant() error {
	body, err := r.doJSON("GET", "/tenant", r.tempToken, nil)
	if err != nil {
		return err
	}
	var resp struct {
		Success bool                   `json:"success"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	d := resp.Data
	if d == nil {
		return fmt.Errorf("GET /tenant sin data")
	}
	// Construye payload mínimo respetando los valores actuales.
	payload := map[string]interface{}{
		"razon_social":         d["razon_social"],
		"ruc":                  d["ruc"],
		"nombre_comercial":     stringOrEmpty(d["nombre_comercial"]),
		"direccion_legal":      stringOrEmpty(d["direccion_legal"]),
		"departamento":         stringOrEmpty(d["departamento"]),
		"provincia":            stringOrEmpty(d["provincia"]),
		"distrito":             stringOrEmpty(d["distrito"]),
		"telefono":             stringOrEmpty(d["telefono"]),
		"email_contacto":       stringOrEmpty(d["email_contacto"]),
		"sitio_web":            stringOrEmpty(d["sitio_web"]),
		"color_primario":       stringOrEmpty(d["color_primario"]),
		"plazo_respuesta_dias": numOrDefault(d["plazo_respuesta_dias"], 15),
		"notificar_whatsapp":          boolOr(d["notificar_whatsapp"]),
		"notificar_email":             boolOr(d["notificar_email"]),
		"notificar_email_estado":      boolOr(d["notificar_email_estado"]),
		"notificar_email_mensaje":     boolOr(d["notificar_email_mensaje"]),
		"notificar_email_resolucion":  boolOr(d["notificar_email_resolucion"]),
		"logo_url":             stringOrEmpty(d["logo_url"]),
		"mensaje_confirmacion": stringOrEmpty(d["mensaje_confirmacion"]),
		"firma_representante":  stringOrEmpty(d["firma_representante"]),
		"tema_por_defecto":     stringOrDefault(d["tema_por_defecto"], "light"),
		"version":              numOrDefault(d["version"], 1),
	}
	if _, err := r.doJSON("PUT", "/tenant", r.tempToken, payload); err != nil {
		return err
	}
	return nil
}

func (r *runner) logoutTemp() error {
	_, err := r.doJSON("POST", "/auth/logout", r.tempToken, nil)
	return err
}

func (r *runner) desactivarUsuarioTemp() error {
	// El usuario temporal ya hizo logout, su token podría seguir siendo válido
	// pero el usuario admin original es quien debe hacer la baja para ser
	// auditado como un actor distinto. Re-impersonamos.
	if err := r.impersonarAdmin(); err != nil {
		return err
	}
	if _, err := r.doJSON("DELETE", "/usuarios/"+r.tempUserID, r.adminToken, nil); err != nil {
		return err
	}
	r.userYaDesactivado = true
	return nil
}

// cleanupUsuarioTemp es el plan B cuando algún paso falló y el flujo normal
// no llegó a desactivarUsuarioTemp. Vuelve a hacer login del SA + impersonate
// + DELETE para no dejar huérfanos consumiendo el max_usuarios del plan.
// NO debe contar como una acción auditada del test (de hecho, sí registra
// DESACTIVAR_USUARIO en auditoría — eso está bien, es real).
func (r *runner) cleanupUsuarioTemp() error {
	if r.saToken == "" {
		if err := r.loginSA(); err != nil {
			return err
		}
	}
	if err := r.impersonarAdmin(); err != nil {
		return err
	}
	_, err := r.doJSON("DELETE", "/usuarios/"+r.tempUserID, r.adminToken, nil)
	return err
}

// ─── Verificación final ───────────────────────────────────────────────────────

type entradaAudit struct {
	accion, entidad, entidadID, detalles, fecha string
}

// fetchAuditoria devuelve las filas insertadas en una tabla de auditoría
// dentro del rango temporal del test, junto con un map de conteo por acción.
func (r *runner) fetchAuditoria(query string, args ...interface{}) ([]entradaAudit, map[string]int) {
	rows, err := r.db.QueryContext(context.Background(), query, args...)
	if err != nil {
		log.Fatalf("[verificación] error consultando auditoría: %v", err)
	}
	defer rows.Close()
	var encontradas []entradaAudit
	conteo := map[string]int{}
	for rows.Next() {
		var e entradaAudit
		if err := rows.Scan(&e.accion, &e.entidad, &e.entidadID, &e.detalles, &e.fecha); err != nil {
			log.Fatalf("[verificación] scan: %v", err)
		}
		encontradas = append(encontradas, e)
		conteo[e.accion]++
	}
	return encontradas, conteo
}

func imprimirReporte(titulo string, encontradas []entradaAudit, conteo map[string]int, esperadas []string) (faltantes []string) {
	fmt.Println("───────────────────────────────────────────────────────────────")
	fmt.Printf(" %s — %d filas\n", titulo, len(encontradas))
	fmt.Println("───────────────────────────────────────────────────────────────")
	for i, e := range encontradas {
		det := truncate(e.detalles, 70)
		if det == "" {
			det = "—"
		}
		ent := e.entidad
		if e.entidadID != "" {
			ent += "/" + truncate(e.entidadID, 12)
		}
		fmt.Printf("  %2d. %-19s  %-26s  %s\n", i+1, e.accion, ent, det)
	}
	fmt.Println()
	var ok []string
	for _, esperada := range esperadas {
		if conteo[esperada] > 0 {
			ok = append(ok, fmt.Sprintf("%s (%d)", esperada, conteo[esperada]))
		} else {
			faltantes = append(faltantes, esperada)
		}
	}
	sort.Strings(ok)
	fmt.Println(" Cobertura:")
	for _, a := range ok {
		fmt.Printf("   ✓ %s\n", a)
	}
	for _, a := range faltantes {
		fmt.Printf("   ✗ %s  (NO REGISTRADA)\n", a)
	}
	fmt.Println()
	return faltantes
}

func (r *runner) verificarAuditoria() {
	tenantRows, tenantCount := r.fetchAuditoria(
		`SELECT accion, entidad, COALESCE(entidad_id, ''), COALESCE(detalles::TEXT, ''), fecha::TEXT
		 FROM auditoria_admin
		 WHERE tenant_id = $1 AND fecha >= $2
		 ORDER BY fecha ASC`,
		r.tenantID, r.tStart)

	saRows, saCount := r.fetchAuditoria(
		`SELECT accion, entidad, COALESCE(entidad_id, ''), COALESCE(detalles::TEXT, ''), fecha::TEXT
		 FROM auditoria_superadmin
		 WHERE fecha >= $1
		 ORDER BY fecha ASC`,
		r.tStart)

	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Printf(" RESULTADO DEL TEST  ·  tenant=%s\n", r.razonSocial)
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println()

	missingTenant := imprimirReporte("auditoria_admin (acciones del tenant)", tenantRows, tenantCount, accionesEsperadasTenant)
	missingSA := imprimirReporte("auditoria_superadmin (acciones del SA)", saRows, saCount, accionesEsperadasSA)

	fmt.Println("═══════════════════════════════════════════════════════════════")
	if len(missingTenant) == 0 && len(missingSA) == 0 {
		fmt.Printf(" ✅  TODAS las acciones esperadas quedaron auditadas (%d tenant + %d SA).\n",
			len(accionesEsperadasTenant), len(accionesEsperadasSA))
		fmt.Println("═══════════════════════════════════════════════════════════════")
		os.Exit(0)
	}
	if len(missingTenant) > 0 {
		fmt.Printf(" ❌  Faltan %d acciones del tenant: %s\n", len(missingTenant), strings.Join(missingTenant, ", "))
	}
	if len(missingSA) > 0 {
		fmt.Printf(" ❌  Faltan %d acciones del SA: %s\n", len(missingSA), strings.Join(missingSA, ", "))
	}
	fmt.Println("═══════════════════════════════════════════════════════════════")
	os.Exit(1)
}

// ─── Steps del flujo SA (auditan en auditoria_superadmin) ────────────────────

// saBuscar dispara BUSCAR (la búsqueda global del SA).
func (r *runner) saBuscar() error {
	_, err := r.doJSON("GET", "/superadmin/buscar?q=test", r.saToken, nil)
	return err
}

// saCrearPlan crea un plan temporal con código único, dispara CREAR_PLAN.
func (r *runner) saCrearPlan() error {
	codigo := "TEST_" + letrasRandom(6)
	body, err := r.doJSON("POST", "/superadmin/planes", r.saToken, map[string]interface{}{
		"codigo":           codigo,
		"nombre":           "Test Audit Plan " + letrasRandom(4),
		"precio_mensual":   1.0,
		"max_sedes":        1,
		"max_usuarios":     2,
		"max_reclamos_mes": 100,
		"max_chatbots":     1,
		"max_storage_mb":   100,
		"orden":            999,
		"activo":           false, // no se ofrece a clientes reales
		"destacado":        false,
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.ID == "" {
		return fmt.Errorf("crear plan sin id en respuesta: %s", truncate(string(body), 200))
	}
	r.saPlanID = resp.Data.ID
	return nil
}

func (r *runner) saEditarPlan() error {
	_, err := r.doJSON("PUT", "/superadmin/planes/"+r.saPlanID, r.saToken, map[string]interface{}{
		"nombre":         "Test Audit Plan EDITADO",
		"precio_mensual": 2.0,
	})
	return err
}

func (r *runner) saCrearCuenta() error {
	rnd := make([]byte, 4)
	_, _ = rand.Read(rnd)
	// El validador del backend rechaza números en `nombre`, así que uso un
	// sufijo de letras (base32 sin dígitos).
	sufijoLetras := letrasRandom(6)
	body, err := r.doJSON("POST", "/superadmin/cuentas", r.saToken, map[string]interface{}{
		"nombre":         "Audit Test Cuenta " + sufijoLetras,
		"email_contacto": "audit.cuenta+" + hex.EncodeToString(rnd) + "@ejemplo.test",
		"telefono":       "+51 999999999",
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Data.ID == "" {
		return fmt.Errorf("crear cuenta sin id: %s", truncate(string(body), 200))
	}
	r.saCuentaID = resp.Data.ID
	return nil
}

func (r *runner) saEditarCuenta() error {
	nuevoNombre := "Audit Test Cuenta EDITADA"
	_, err := r.doJSON("PUT", "/superadmin/cuentas/"+r.saCuentaID, r.saToken, map[string]interface{}{
		"nombre": nuevoNombre,
	})
	return err
}

// letrasRandom genera una cadena de N letras ASCII mayúsculas aleatorias.
// Útil para nombres cuando el validador rechaza dígitos.
func letrasRandom(n int) string {
	const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	out := make([]byte, n)
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := 0; i < n; i++ {
		out[i] = alfabeto[int(b[i])%len(alfabeto)]
	}
	return string(out)
}

// saCrearEmpresa crea una empresa bajo la cuenta nueva. El backend usa el
// onboarding service que monta tenant + sede + usuario admin + suscripción.
func (r *runner) saCrearEmpresa() error {
	rnd := make([]byte, 4)
	_, _ = rand.Read(rnd)
	rndStr := hex.EncodeToString(rnd)
	sufijoLetras := letrasRandom(6)
	// RUC válido peruano de 11 dígitos (los primeros 2 deben ser 10/15/17/20).
	ruc := "20" + fmt.Sprintf("%09d", time.Now().UnixNano()%1_000_000_000)
	body, err := r.doJSON("POST", "/superadmin/cuentas/"+r.saCuentaID+"/empresas", r.saToken, map[string]interface{}{
		"razon_social":    "Audit Test Empresa SAC " + sufijoLetras,
		"ruc":             ruc,
		"email":           "audit.empresa+" + rndStr + "@ejemplo.test",
		"password":        tempPass,
		"nombre_admin":    "Admin Audit Tester",
		"telefono":        "+51 999000111",
		"direccion_legal": "Av. Test Principal",
	})
	if err != nil {
		return err
	}
	// Buscamos el tenant_id y el admin user_id en la DB para no depender del shape.
	if err := r.db.QueryRow(
		`SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $1 ORDER BY fecha_creacion DESC LIMIT 1`,
		r.saCuentaID,
	).Scan(&r.saEmpresaTID); err != nil {
		return fmt.Errorf("empresa creada pero no encuentro tenant_id en DB: %w (body=%s)", err, truncate(string(body), 200))
	}
	if err := r.db.QueryRow(
		`SELECT id FROM usuarios_admin WHERE tenant_id = $1 AND rol = 'ADMIN' ORDER BY fecha_creacion DESC LIMIT 1`,
		r.saEmpresaTID,
	).Scan(&r.saEmpresaUserID); err != nil {
		return fmt.Errorf("empresa creada pero no encuentro admin user: %w", err)
	}
	fmt.Printf("       saEmpresaTID=%s saEmpresaUserID=%s\n", r.saEmpresaTID, r.saEmpresaUserID)
	return nil
}

func (r *runner) saDesactivarEmpresa() error {
	_, err := r.doJSON("PATCH", "/superadmin/empresas/"+r.saEmpresaTID+"/estado", r.saToken,
		map[string]interface{}{"activo": false})
	return err
}

func (r *runner) saActivarEmpresa() error {
	_, err := r.doJSON("PATCH", "/superadmin/empresas/"+r.saEmpresaTID+"/estado", r.saToken,
		map[string]interface{}{"activo": true})
	return err
}

// saCambiarPlanEmpresa cambia el plan de la empresa creada al plan temporal.
func (r *runner) saCambiarPlanEmpresa() error {
	_, err := r.doJSON("PATCH", "/superadmin/empresas/"+r.saEmpresaTID+"/plan", r.saToken,
		map[string]interface{}{"plan_id": r.saPlanID})
	return err
}

func (r *runner) saEditarUsuarioEmpresa() error {
	_, err := r.doJSON("PUT", "/superadmin/empresas/"+r.saEmpresaTID+"/usuarios/"+r.saEmpresaUserID, r.saToken,
		map[string]interface{}{
			"nombre_completo": "Admin Audit Test EDITADO",
			"email":           "audit.empresa.edited@ejemplo.test",
			"rol":             "ADMIN",
		})
	return err
}

func (r *runner) saResetearPassword() error {
	_, err := r.doJSON("POST", "/superadmin/empresas/"+r.saEmpresaTID+"/usuarios/"+r.saEmpresaUserID+"/resetear-password", r.saToken,
		map[string]interface{}{"password": "NewPassAuditTest2026!"})
	return err
}

func (r *runner) saDesactivarUsuarioEmpresa() error {
	_, err := r.doJSON("PATCH", "/superadmin/empresas/"+r.saEmpresaTID+"/usuarios/"+r.saEmpresaUserID+"/estado", r.saToken,
		map[string]interface{}{"activo": false})
	return err
}

func (r *runner) saImpersonarEmpresaCreada() error {
	_, err := r.doJSON("POST", "/superadmin/empresas/"+r.saEmpresaTID+"/impersonar", r.saToken, map[string]string{})
	return err
}

func (r *runner) saCrearStaff() error {
	rnd := make([]byte, 4)
	_, _ = rand.Read(rnd)
	rndStr := hex.EncodeToString(rnd)
	body, err := r.doJSON("POST", "/superadmin/staff", r.saToken, map[string]interface{}{
		"email":    "audit.staff+" + rndStr + "@ejemplo.test",
		"password": "AuditStaff2026!",
		"nombre":   "Audit Staff " + letrasRandom(5),
	})
	if err != nil {
		return err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	r.saStaffID = resp.Data.ID
	return nil
}

func (r *runner) saDesactivarCuenta() error {
	_, err := r.doJSON("PATCH", "/superadmin/cuentas/"+r.saCuentaID+"/estado", r.saToken,
		map[string]interface{}{"activo": false})
	return err
}

// ─── Helpers de tipo ──────────────────────────────────────────────────────────

func stringOrEmpty(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func stringOrDefault(v interface{}, def string) string {
	s := stringOrEmpty(v)
	if s == "" {
		return def
	}
	return s
}

func numOrDefault(v interface{}, def int) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	}
	return def
}

func boolOr(v interface{}) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}
