package websocket

import (
	"encoding/json"
	"log"
	"runtime"
	"sync"
	"time"
)

// ConcentradorConexiones gestiona todas las conexiones WebSocket activas.
type ConcentradorConexiones struct {
	conexionesPorTenant map[string]map[*ConexionWebSocket]bool
	conexionesPorSala   map[string]map[*ConexionWebSocket]bool
	Registrar           chan *ConexionWebSocket
	Desregistrar        chan *ConexionWebSocket
	UnirseASala         chan *SolicitudSala
	SalirDeSala         chan *SolicitudSala
	DifundirATenant     chan *MensajeDifusion
	DifundirASala       chan *MensajeDifusionSala
	DifundirAUsuario    chan *MensajeDifusionUsuario
	mu                  sync.RWMutex
	cerrar              chan struct{}
}

// SolicitudSala se usa para unir/sacar una conexión de una sala.
type SolicitudSala struct {
	Conexion *ConexionWebSocket
	NombreSala string
}

// MensajeDifusion difunde un mensaje a todas las conexiones de un tenant.
type MensajeDifusion struct {
	TenantID string
	Mensaje  MensajeWebSocket
}

// MensajeDifusionSala difunde un mensaje a todas las conexiones de una sala.
type MensajeDifusionSala struct {
	NombreSala string
	Mensaje    MensajeWebSocket
}

// MensajeDifusionUsuario envía un mensaje a un usuario específico de un tenant.
type MensajeDifusionUsuario struct {
	TenantID  string
	UsuarioID string
	Mensaje   MensajeWebSocket
}

// NuevoConcentradorConexiones crea e inicializa el hub central.
func NuevoConcentradorConexiones() *ConcentradorConexiones {
	return &ConcentradorConexiones{
		conexionesPorTenant: make(map[string]map[*ConexionWebSocket]bool),
		conexionesPorSala:   make(map[string]map[*ConexionWebSocket]bool),
		Registrar:           make(chan *ConexionWebSocket, 64),
		Desregistrar:        make(chan *ConexionWebSocket, 64),
		UnirseASala:         make(chan *SolicitudSala, 64),
		SalirDeSala:         make(chan *SolicitudSala, 64),
		DifundirATenant:     make(chan *MensajeDifusion, 256),
		DifundirASala:       make(chan *MensajeDifusionSala, 256),
		DifundirAUsuario:    make(chan *MensajeDifusionUsuario, 256),
		cerrar:              make(chan struct{}),
	}
}

// Ejecutar inicia el loop principal del concentrador (debe correr en goroutine).
func (h *ConcentradorConexiones) Ejecutar() {
	for {
		select {
		case <-h.cerrar:
			h.cerrarTodasLasConexiones()
			return

		case conexion := <-h.Registrar:
			h.registrarConexion(conexion)

		case conexion := <-h.Desregistrar:
			h.desregistrarConexion(conexion)

		case solicitud := <-h.UnirseASala:
			h.unirASala(solicitud)

		case solicitud := <-h.SalirDeSala:
			h.salirDeSala(solicitud)

		case difusion := <-h.DifundirATenant:
			h.difundirATenant(difusion)

		case difusion := <-h.DifundirASala:
			h.difundirASala(difusion)

		case difusion := <-h.DifundirAUsuario:
			h.difundirAUsuario(difusion)
		}
	}
}

// Detener cierra el concentrador y todas las conexiones activas de forma limpia.
func (h *ConcentradorConexiones) Detener() {
	close(h.cerrar)
}

func (h *ConcentradorConexiones) cerrarTodasLasConexiones() {
	h.mu.Lock()
	defer h.mu.Unlock()

	total := 0
	for tenantID, conns := range h.conexionesPorTenant {
		for c := range conns {
			c.Cerrar()
			total++
		}
		delete(h.conexionesPorTenant, tenantID)
	}
	for sala := range h.conexionesPorSala {
		delete(h.conexionesPorSala, sala)
	}
	log.Printf("[WS] Graceful shutdown: %d conexiones cerradas", total)
}

func (h *ConcentradorConexiones) registrarConexion(c *ConexionWebSocket) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.conexionesPorTenant[c.TenantID] == nil {
		h.conexionesPorTenant[c.TenantID] = make(map[*ConexionWebSocket]bool)
	}
	h.conexionesPorTenant[c.TenantID][c] = true
	log.Printf("[WS] Conexión registrada: %s (tenant: %s, usuario: %s)", c.ID, c.TenantID, c.UsuarioID)
}

func (h *ConcentradorConexiones) desregistrarConexion(c *ConexionWebSocket) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if conns, ok := h.conexionesPorTenant[c.TenantID]; ok {
		delete(conns, c)
		if len(conns) == 0 {
			delete(h.conexionesPorTenant, c.TenantID)
		}
	}

	for sala := range c.Salas {
		if conns, ok := h.conexionesPorSala[sala]; ok {
			delete(conns, c)
			if len(conns) == 0 {
				delete(h.conexionesPorSala, sala)
			}
		}
	}

	log.Printf("[WS] Conexión desregistrada: %s", c.ID)
}

func (h *ConcentradorConexiones) unirASala(s *SolicitudSala) {
	h.mu.Lock()
	defer h.mu.Unlock()

	s.Conexion.Salas[s.NombreSala] = true
	if h.conexionesPorSala[s.NombreSala] == nil {
		h.conexionesPorSala[s.NombreSala] = make(map[*ConexionWebSocket]bool)
	}
	h.conexionesPorSala[s.NombreSala][s.Conexion] = true
}

func (h *ConcentradorConexiones) salirDeSala(s *SolicitudSala) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(s.Conexion.Salas, s.NombreSala)
	if conns, ok := h.conexionesPorSala[s.NombreSala]; ok {
		delete(conns, s.Conexion)
		if len(conns) == 0 {
			delete(h.conexionesPorSala, s.NombreSala)
		}
	}
}

func (h *ConcentradorConexiones) difundirATenant(d *MensajeDifusion) {
	datos, err := json.Marshal(d.Mensaje)
	if err != nil {
		log.Printf("[WS] Error serializando mensaje: %v", err)
		return
	}

	h.mu.RLock()
	snapshot := make([]*ConexionWebSocket, 0, len(h.conexionesPorTenant[d.TenantID]))
	for c := range h.conexionesPorTenant[d.TenantID] {
		snapshot = append(snapshot, c)
	}
	h.mu.RUnlock()

	for _, c := range snapshot {
		if !c.EstaCerrada() {
			select {
			case c.Enviar <- datos:
			default:
				go func(conn *ConexionWebSocket) { h.Desregistrar <- conn }(c)
			}
		}
	}
}

func (h *ConcentradorConexiones) difundirASala(d *MensajeDifusionSala) {
	datos, err := json.Marshal(d.Mensaje)
	if err != nil {
		log.Printf("[WS] Error serializando mensaje sala: %v", err)
		return
	}

	h.mu.RLock()
	snapshot := make([]*ConexionWebSocket, 0, len(h.conexionesPorSala[d.NombreSala]))
	for c := range h.conexionesPorSala[d.NombreSala] {
		snapshot = append(snapshot, c)
	}
	h.mu.RUnlock()

	for _, c := range snapshot {
		if !c.EstaCerrada() {
			select {
			case c.Enviar <- datos:
			default:
				go func(conn *ConexionWebSocket) { h.Desregistrar <- conn }(c)
			}
		}
	}
}

func (h *ConcentradorConexiones) difundirAUsuario(d *MensajeDifusionUsuario) {
	datos, err := json.Marshal(d.Mensaje)
	if err != nil {
		log.Printf("[WS] Error serializando mensaje usuario: %v", err)
		return
	}

	h.mu.RLock()
	snapshot := make([]*ConexionWebSocket, 0)
	for c := range h.conexionesPorTenant[d.TenantID] {
		if c.UsuarioID == d.UsuarioID {
			snapshot = append(snapshot, c)
		}
	}
	h.mu.RUnlock()

	for _, c := range snapshot {
		if !c.EstaCerrada() {
			select {
			case c.Enviar <- datos:
			default:
				go func(conn *ConexionWebSocket) { h.Desregistrar <- conn }(c)
			}
		}
	}
}

// PublicarEventoATenant publica un evento a todas las conexiones de un tenant.
func (h *ConcentradorConexiones) PublicarEventoATenant(tenantID string, tipo TipoEvento, datos interface{}) {
	h.DifundirATenant <- &MensajeDifusion{
		TenantID: tenantID,
		Mensaje: MensajeWebSocket{
			Tipo:        tipo,
			Datos:       datos,
			FechaEvento: time.Now(),
		},
	}
}

// PublicarEventoASala publica un evento a todas las conexiones de una sala.
func (h *ConcentradorConexiones) PublicarEventoASala(nombreSala string, tipo TipoEvento, datos interface{}) {
	h.DifundirASala <- &MensajeDifusionSala{
		NombreSala: nombreSala,
		Mensaje: MensajeWebSocket{
			Tipo:        tipo,
			Datos:       datos,
			FechaEvento: time.Now(),
		},
	}
}

// PublicarEventoAUsuario envía un evento a un usuario específico de un tenant.
func (h *ConcentradorConexiones) PublicarEventoAUsuario(tenantID, usuarioID string, tipo TipoEvento, datos interface{}) {
	h.DifundirAUsuario <- &MensajeDifusionUsuario{
		TenantID:  tenantID,
		UsuarioID: usuarioID,
		Mensaje: MensajeWebSocket{
			Tipo:        tipo,
			Datos:       datos,
			FechaEvento: time.Now(),
		},
	}
}

// EstadisticasWebSocket contiene métricas del sistema WebSocket.
type EstadisticasWebSocket struct {
	TotalConexiones    int            `json:"total_conexiones"`
	TotalSalas         int            `json:"total_salas"`
	ConexionesPorTenant map[string]int `json:"conexiones_por_tenant"`
	GoroutinesTotal    int            `json:"goroutines_total"`
	MemoriaAllocMB     float64        `json:"memoria_alloc_mb"`
	MemoriaSysMB       float64        `json:"memoria_sys_mb"`
}

// TotalConexionesActivas retorna el total de conexiones activas (para métricas).
func (h *ConcentradorConexiones) TotalConexionesActivas() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	total := 0
	for _, conns := range h.conexionesPorTenant {
		total += len(conns)
	}
	return total
}

// ObtenerEstadisticas retorna métricas detalladas del sistema WebSocket.
func (h *ConcentradorConexiones) ObtenerEstadisticas() EstadisticasWebSocket {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	porTenant := make(map[string]int, len(h.conexionesPorTenant))
	totalConexiones := 0
	for tenant, conns := range h.conexionesPorTenant {
		porTenant[tenant] = len(conns)
		totalConexiones += len(conns)
	}

	return EstadisticasWebSocket{
		TotalConexiones:    totalConexiones,
		TotalSalas:         len(h.conexionesPorSala),
		ConexionesPorTenant: porTenant,
		GoroutinesTotal:    runtime.NumGoroutine(),
		MemoriaAllocMB:     float64(m.Alloc) / 1024 / 1024,
		MemoriaSysMB:       float64(m.Sys) / 1024 / 1024,
	}
}
