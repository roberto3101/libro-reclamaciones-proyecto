package websocket
import (

"encoding/json"
"log"
"sync"
)
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
