package middleware

import (
	"bytes"
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"libro-reclamaciones/internal/helper"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var concentradorGlobal *ws.ConcentradorConexiones
var evaluadorAlertasGlobal EvaluadorAlertas

type EvaluadorAlertas interface {
	EvaluarError(fingerprint, mensaje string)
}

func SetEvaluadorAlertas(e EvaluadorAlertas) {
	evaluadorAlertasGlobal = e
}

func ErrorLoggerMiddleware(db *sql.DB, concentrador ...*ws.ConcentradorConexiones) gin.HandlerFunc {
	if len(concentrador) > 0 && concentrador[0] != nil {
		concentradorGlobal = concentrador[0]
	}
	return func(c *gin.Context) {
		var bodyStr string
		if c.Request.Body != nil && c.Request.Method != "GET" {
			// Leer TODO el body (con un cap defensivo de 10MB para evitar
			// que un cliente malicioso meta requests gigantes en memoria).
			// El body capturado se devuelve íntegro al request para que el
			// handler downstream pueda hacer ShouldBindJSON correctamente.
			// Para el log de errores, recortamos SOLO la copia que se persiste
			// para no inflar la tabla error_log con bodies enormes.
			const maxRequestBody = 10 * 1024 * 1024 // 10 MB
			const maxLogBody = 2048
			bodyBytes, _ := io.ReadAll(io.LimitReader(c.Request.Body, maxRequestBody))
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			snippet := bodyBytes
			if len(snippet) > maxLogBody {
				snippet = snippet[:maxLogBody]
			}
			bodyStr = sanitizarBody(string(snippet))
		}

		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				mensaje := fmt.Sprintf("PANIC: %v", r)
				tenantID, _ := obtenerTenantID(c)
				usuarioID, _ := obtenerUsuarioID(c)

				insertarErrorConFingerprint(db, "PANIC", "BACKEND", tenantID, usuarioID,
					c.Request.Method, c.Request.URL.Path, 500,
					mensaje, stack, bodyStr,
					helper.GetClientIP(c), c.Request.UserAgent())

				c.AbortWithStatusJSON(500, gin.H{"success": false, "message": "Error interno del servidor"})
			}
		}()

		c.Next()

		status := c.Writer.Status()
		if status >= 400 {
			mensaje := extraerMensajeError(c, status)

			nivel := "WARN"
			if status >= 500 {
				nivel = "ERROR"
			}

			if status == 401 && strings.Contains(c.Request.URL.Path, "/auth/login") {
				return
			}
			if strings.HasPrefix(c.Request.URL.Path, "/ws/") {
				return
			}

			tenantID, _ := obtenerTenantID(c)
			usuarioID, _ := obtenerUsuarioID(c)

			insertarErrorConFingerprint(db, nivel, "BACKEND", tenantID, usuarioID,
				c.Request.Method, c.Request.URL.Path, status,
				mensaje, "", bodyStr,
				helper.GetClientIP(c), c.Request.UserAgent())
		}
	}
}

func generarFingerprint(mensaje, ruta string, statusCode int) string {
	raw := mensaje + "::" + ruta + "::" + strconv.Itoa(statusCode)
	return fmt.Sprintf("%x", md5.Sum([]byte(raw)))
}

func insertarErrorConFingerprint(db *sql.DB, nivel, origen string, tenantID, usuarioID *uuid.UUID,
	metodo, ruta string, statusCode int, mensaje, stackTrace, requestBody, ip, userAgent string) {

	fingerprint := generarFingerprint(mensaje, ruta, statusCode)

	query := `INSERT INTO error_log (nivel, origen, tenant_id, usuario_id, metodo, ruta, status_code, mensaje, stack_trace, request_body, ip_address, user_agent, fingerprint)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`

	go func() {
		var id uuid.UUID
		err := db.QueryRow(query, nivel, origen, tenantID, usuarioID, metodo, ruta, statusCode, mensaje, nullStr(stackTrace), nullStr(requestBody), ip, userAgent, fingerprint).Scan(&id)
		if err != nil {
			log.Printf("[ERROR_LOGGER] No se pudo guardar error: %v", err)
			return
		}

		if concentradorGlobal != nil {
			var tidStr *string
			if tenantID != nil {
				s := tenantID.String()
				tidStr = &s
			}
			concentradorGlobal.DifundirASala <- &ws.MensajeDifusionSala{
				NombreSala: ws.NombreSalaSAErrores(),
				Mensaje: ws.MensajeWebSocket{
					Tipo: ws.EventoErrorLogNuevo,
					Datos: ws.DatosErrorLogNuevo{
						ID:          id.String(),
						Nivel:       nivel,
						Origen:      origen,
						TenantID:    tidStr,
						Metodo:      metodo,
						Ruta:        ruta,
						StatusCode:  statusCode,
						Mensaje:     mensaje,
						IPAddress:   ip,
						Fingerprint: fingerprint,
						Fecha:       time.Now().Format(time.RFC3339),
					},
					FechaEvento: time.Now(),
				},
			}
		}

		if evaluadorAlertasGlobal != nil {
			evaluadorAlertasGlobal.EvaluarError(fingerprint, mensaje)
		}
	}()
}

func obtenerTenantID(c *gin.Context) (*uuid.UUID, bool) {
	val, exists := c.Get(helper.CtxTenantID)
	if !exists {
		return nil, false
	}
	uid, ok := val.(uuid.UUID)
	if !ok {
		return nil, false
	}
	return &uid, true
}

func obtenerUsuarioID(c *gin.Context) (*uuid.UUID, bool) {
	val, exists := c.Get(helper.CtxUserID)
	if !exists {
		return nil, false
	}
	uid, ok := val.(uuid.UUID)
	if !ok {
		return nil, false
	}
	return &uid, true
}

func extraerMensajeError(c *gin.Context, status int) string {
	if len(c.Errors) > 0 {
		mensajes := make([]string, len(c.Errors))
		for i, e := range c.Errors {
			mensajes[i] = e.Error()
		}
		return strings.Join(mensajes, " | ")
	}
	switch status {
	case 400:
		return "Bad Request"
	case 401:
		return "Unauthorized"
	case 403:
		return "Forbidden"
	case 404:
		return "Not Found"
	case 409:
		return "Conflict"
	case 429:
		return "Too Many Requests"
	case 500:
		return "Internal Server Error"
	default:
		return fmt.Sprintf("HTTP %d", status)
	}
}

func sanitizarBody(body string) string {
	if body == "" {
		return ""
	}
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return "[binary/non-json]"
	}
	for _, key := range []string{"password", "password_hash", "token", "secret", "access_token", "api_key"} {
		if _, ok := data[key]; ok {
			data[key] = "[REDACTED]"
		}
	}
	sanitized, _ := json.Marshal(data)
	return string(sanitized)
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
