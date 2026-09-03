package middleware

import (
	"net/http"
	"sync"
	"time"

	"libro-reclamaciones/internal/model/dto"

	"github.com/gin-gonic/gin"
)

// LimitadorIPConfig configura un rate limiter por IP.
type LimitadorIPConfig struct {
	MaxPorMinuto int
	Mensaje      string
}

// LimitadorIP crea un middleware de rate limiting por IP reutilizable.
// Cada instancia tiene su propio mapa de contadores independiente.
func LimitadorIP(config LimitadorIPConfig) gin.HandlerFunc {
	var registros sync.Map

	if config.Mensaje == "" {
		config.Mensaje = "Demasiadas solicitudes. Intenta de nuevo en un momento."
	}

	// Limpieza periódica cada 5 minutos
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			ahora := time.Now()
			registros.Range(func(clave, valor interface{}) bool {
				reg := valor.(*registroAccesoPorIP)
				if ahora.Sub(reg.inicioVentana) > time.Minute {
					registros.Delete(clave)
				}
				return true
			})
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		ahora := time.Now()

		valor, existe := registros.Load(ip)
		if !existe {
			registros.Store(ip, &registroAccesoPorIP{
				cantidadSolicitudes: 1,
				inicioVentana:       ahora,
			})
			c.Next()
			return
		}

		reg := valor.(*registroAccesoPorIP)

		if ahora.Sub(reg.inicioVentana) > time.Minute {
			reg.cantidadSolicitudes = 1
			reg.inicioVentana = ahora
			c.Next()
			return
		}

		if reg.cantidadSolicitudes >= config.MaxPorMinuto {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, dto.APIResponse{
				Success: false,
				Error: &dto.APIError{
					Code:    "RATE_LIMIT_EXCEEDED",
					Message: config.Mensaje,
				},
			})
			return
		}

		reg.cantidadSolicitudes++
		c.Next()
	}
}
