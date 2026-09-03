package websocket

import (
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	gorilla "github.com/gorilla/websocket"
)

// OpcionConexion permite configurar opciones adicionales al crear una conexión.
type OpcionConexion func(*ConexionWebSocket)

// ConAutoDesconexion configura un timer que cierra la conexión automáticamente tras la duración dada.
// La goroutine se cancela inmediatamente si la conexión se cierra antes del timeout.
func ConAutoDesconexion(duracion time.Duration, concentrador *ConcentradorConexiones) OpcionConexion {
	return func(c *ConexionWebSocket) {
		go func() {
			timer := time.NewTimer(duracion)
			defer timer.Stop()
			select {
			case <-timer.C:
				if !c.EstaCerrada() {
					log.Printf("[WS] Auto-desconexión por timeout (%s): %s", duracion, c.ID)
					concentrador.Desregistrar <- c
					c.Cerrar()
				}
			case <-c.done:
				// Conexión cerrada antes del timeout, goroutine termina limpiamente
			}
		}()
	}
}

const (
	tiempoEscritura     = 10 * time.Second
	tiempoPong          = 60 * time.Second
	intervaloPing       = (tiempoPong * 9) / 10
	tamanioMaximoLectura = 4096
)

// ConexionWebSocket envuelve una conexión gorilla/websocket con metadata.
type ConexionWebSocket struct {
	ID        string
	TenantID  string
	UsuarioID string
	Salas     map[string]bool
	Conn      *gorilla.Conn
	Enviar    chan []byte
	done      chan struct{}
	mu        sync.RWMutex
	cerrada   bool
}

// NuevaConexionWebSocket crea una conexión WebSocket con su metadata.
func NuevaConexionWebSocket(conn *gorilla.Conn, tenantID, usuarioID string, opciones ...OpcionConexion) *ConexionWebSocket {
	c := &ConexionWebSocket{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		UsuarioID: usuarioID,
		Salas:     make(map[string]bool),
		Conn:      conn,
		Enviar:    make(chan []byte, 256),
		done:      make(chan struct{}),
	}
	for _, opt := range opciones {
		opt(c)
	}
	return c
}

// BombaEscritura envía mensajes pendientes al cliente WebSocket.
func (c *ConexionWebSocket) BombaEscritura() {
	ticker := time.NewTicker(intervaloPing)
	defer func() {
		ticker.Stop()
		c.Cerrar()
	}()

	for {
		select {
		case mensaje, ok := <-c.Enviar:
			c.Conn.SetWriteDeadline(time.Now().Add(tiempoEscritura))
			if !ok {
				c.Conn.WriteMessage(gorilla.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(gorilla.TextMessage)
			if err != nil {
				return
			}
			w.Write(mensaje)

			// Drenar mensajes encolados en el mismo frame
			n := len(c.Enviar)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.Enviar)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(tiempoEscritura))
			if err := c.Conn.WriteMessage(gorilla.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// BombaLectura lee mensajes del cliente (principalmente para detectar cierre).
func (c *ConexionWebSocket) BombaLectura(concentrador *ConcentradorConexiones) {
	defer func() {
		concentrador.Desregistrar <- c
		c.Cerrar()
	}()

	c.Conn.SetReadLimit(tamanioMaximoLectura)
	c.Conn.SetReadDeadline(time.Now().Add(tiempoPong))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(tiempoPong))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if gorilla.IsUnexpectedCloseError(err, gorilla.CloseGoingAway, gorilla.CloseAbnormalClosure) {
				log.Printf("[WS] Cierre inesperado conexión %s: %v", c.ID, err)
			}
			break
		}
	}
}

// Cerrar cierra la conexión de forma segura.
func (c *ConexionWebSocket) Cerrar() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.cerrada {
		c.cerrada = true
		c.Conn.Close()
		close(c.Enviar)
		close(c.done)
	}
}

// EstaCerrada indica si la conexión ya fue cerrada.
func (c *ConexionWebSocket) EstaCerrada() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.cerrada
}
