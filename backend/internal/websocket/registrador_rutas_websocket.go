package websocket

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"libro-reclamaciones/internal/config"

	"github.com/gin-gonic/gin"
	gorilla "github.com/gorilla/websocket"
)

var upgrader = gorilla.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS se maneja a nivel de middleware Gin
	},
}

// limitadorConexionesPublicasPorIP controla conexiones WS públicas por IP.
type limitadorConexionesPublicasPorIP struct {
	conexiones map[string]int
	mu         sync.Mutex
	maximo     int
}

var limitadorPublico = &limitadorConexionesPublicasPorIP{
	conexiones: make(map[string]int),
	maximo:     5,
}

func (l *limitadorConexionesPublicasPorIP) incrementar(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.conexiones[ip] >= l.maximo {
		return false
	}
	l.conexiones[ip]++
	return true
}

func (l *limitadorConexionesPublicasPorIP) decrementar(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.conexiones[ip]--
	if l.conexiones[ip] <= 0 {
		delete(l.conexiones, ip)
	}
}

// RegistrarRutasWebSocket registra los endpoints WebSocket en el router Gin.
func RegistrarRutasWebSocket(r *gin.Engine, concentrador *ConcentradorConexiones, cfg *config.Config, db *sql.DB) {
	autenticador := NuevoAutenticadorConexionWebSocket(cfg.JWT, db)

	// --- WS Admin: Notificaciones generales ---
	r.GET("/ws/notificaciones", func(c *gin.Context) {
		token := c.Query("token")
		credenciales, err := autenticador.AutenticarConexionAdmin(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado: " + err.Error()})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] Error upgrade notificaciones: %v", err)
			return
		}

		conexion := NuevaConexionWebSocket(conn, credenciales.TenantID, credenciales.UsuarioID)
		concentrador.Registrar <- conexion

		salaNotificaciones := fmt.Sprintf("notificaciones:%s:%s", credenciales.TenantID, credenciales.UsuarioID)
		concentrador.UnirseASala <- &SolicitudSala{Conexion: conexion, NombreSala: salaNotificaciones}

		salaTenant := fmt.Sprintf("tenant:%s", credenciales.TenantID)
		concentrador.UnirseASala <- &SolicitudSala{Conexion: conexion, NombreSala: salaTenant}

		go conexion.BombaEscritura()
		go conexion.BombaLectura(concentrador)
	})

	// --- WS Admin: Atención en Vivo (sala por solicitud) ---
	r.GET("/ws/atencion-vivo/:solicitudId", func(c *gin.Context) {
		token := c.Query("token")
		credenciales, err := autenticador.AutenticarConexionAdmin(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado: " + err.Error()})
			return
		}

		solicitudID := c.Param("solicitudId")
		if solicitudID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "solicitudId requerido"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] Error upgrade atención-vivo: %v", err)
			return
		}

		conexion := NuevaConexionWebSocket(conn, credenciales.TenantID, credenciales.UsuarioID)
		concentrador.Registrar <- conexion

		salaSolicitud := fmt.Sprintf("atencion-vivo:%s:%s", credenciales.TenantID, solicitudID)
		concentrador.UnirseASala <- &SolicitudSala{Conexion: conexion, NombreSala: salaSolicitud}

		go conexion.BombaEscritura()
		go conexion.BombaLectura(concentrador)
	})

	// --- WS Admin: Mensajería de Reclamo ---
	r.GET("/ws/reclamos/:reclamoId/mensajes", func(c *gin.Context) {
		token := c.Query("token")
		credenciales, err := autenticador.AutenticarConexionAdmin(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado: " + err.Error()})
			return
		}

		reclamoID := c.Param("reclamoId")
		if reclamoID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reclamoId requerido"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] Error upgrade reclamo-mensajes: %v", err)
			return
		}

		conexion := NuevaConexionWebSocket(conn, credenciales.TenantID, credenciales.UsuarioID)
		concentrador.Registrar <- conexion

		salaReclamo := fmt.Sprintf("reclamo-mensajes:%s:%s", credenciales.TenantID, reclamoID)
		concentrador.UnirseASala <- &SolicitudSala{Conexion: conexion, NombreSala: salaReclamo}

		go conexion.BombaEscritura()
		go conexion.BombaLectura(concentrador)
	})

	// --- WS Público: Seguimiento de Reclamo (sin JWT, rate-limited) ---
	r.GET("/ws/publico/seguimiento/:slug/:codigoReclamo", func(c *gin.Context) {
		ip := c.ClientIP()
		if !limitadorPublico.incrementar(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Demasiadas conexiones desde esta IP"})
			return
		}

		slug := c.Param("slug")
		codigoReclamo := c.Param("codigoReclamo")

		credenciales, err := autenticador.AutenticarConexionPublicaSeguimiento(slug, codigoReclamo)
		if err != nil {
			limitadorPublico.decrementar(ip)
			c.JSON(http.StatusNotFound, gin.H{"error": "Reclamo no encontrado"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			limitadorPublico.decrementar(ip)
			log.Printf("[WS] Error upgrade seguimiento público: %v", err)
			return
		}

		conexion := NuevaConexionWebSocket(conn, credenciales.TenantID, "publico:"+codigoReclamo,
			ConAutoDesconexion(30*time.Minute, concentrador),
		)
		concentrador.Registrar <- conexion

		salaSeguimiento := fmt.Sprintf("seguimiento:%s:%s", credenciales.TenantID, codigoReclamo)
		concentrador.UnirseASala <- &SolicitudSala{Conexion: conexion, NombreSala: salaSeguimiento}

		go conexion.BombaEscritura()
		go func() {
			conexion.BombaLectura(concentrador)
			limitadorPublico.decrementar(ip)
		}()
	})

	// --- Métricas WebSocket (protegido por JWT) ---
	r.GET("/ws/metricas", func(c *gin.Context) {
		token := c.Query("token")
		_, err := autenticador.AutenticarConexionAdmin(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado"})
			return
		}
		c.JSON(http.StatusOK, concentrador.ObtenerEstadisticas())
	})

	// --- WS SuperAdmin: Error stream en tiempo real ---
	r.GET("/ws/superadmin/errores", func(c *gin.Context) {
		token := c.Query("token")
		creds, err := autenticador.AutenticarConexionSuperAdmin(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado: " + err.Error()})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] Error upgrade SA errores: %v", err)
			return
		}

		// SA connections use "sa" as tenant and their ID as user
		conexion := NuevaConexionWebSocket(conn, "superadmin", creds.SuperAdminID)
		concentrador.Registrar <- conexion

		concentrador.UnirseASala <- &SolicitudSala{Conexion: conexion, NombreSala: NombreSalaSAErrores()}

		go conexion.BombaEscritura()
		go conexion.BombaLectura(concentrador)
	})

	log.Println("[INFO] WebSocket endpoints registrados: /ws/notificaciones, /ws/atencion-vivo/:id, /ws/reclamos/:id/mensajes, /ws/publico/seguimiento/:slug/:codigo, /ws/metricas, /ws/superadmin/errores")
}

// NombreSalaAtencionVivo genera el nombre de sala para una solicitud de atención.
func NombreSalaAtencionVivo(tenantID, solicitudID string) string {
	return fmt.Sprintf("atencion-vivo:%s:%s", tenantID, solicitudID)
}

// NombreSalaReclamoMensajes genera el nombre de sala para mensajes de un reclamo.
func NombreSalaReclamoMensajes(tenantID, reclamoID string) string {
	return fmt.Sprintf("reclamo-mensajes:%s:%s", tenantID, reclamoID)
}

// NombreSalaSeguimientoPublico genera el nombre de sala para tracking público.
func NombreSalaSeguimientoPublico(tenantID, codigoReclamo string) string {
	return fmt.Sprintf("seguimiento:%s:%s", tenantID, codigoReclamo)
}

// NombreSalaTenant genera el nombre de sala general del tenant.
func NombreSalaTenant(tenantID string) string {
	return fmt.Sprintf("tenant:%s", tenantID)
}

// NombreSalaSAErrores genera el nombre de sala para el stream de errores del SA.
func NombreSalaSAErrores() string {
	return "superadmin:errores"
}
