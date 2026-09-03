package middleware

import (
	"net/http"
	"sync"
	"time"

	"libro-reclamaciones/internal/model/dto"

	"github.com/gin-gonic/gin"
)

// registroAccesoPorIP almacena la cantidad de solicitudes
// y el momento en que se registró la primera solicitud de esa ventana.
type registroAccesoPorIP struct {
	cantidadSolicitudes int
	inicioVentana       time.Time
}

// LimitadorConsultaPublicaPorIP restringe la cantidad de solicitudes
// por dirección IP en una ventana de 1 minuto.
// No depende de base de datos: usa memoria para máxima velocidad.
func LimitadorConsultaPublicaPorIP(maxSolicitudesPorMinuto int) gin.HandlerFunc {
	var registros sync.Map

	// Goroutine de limpieza: elimina entradas expiradas cada 5 minutos
	// para evitar que la memoria crezca indefinidamente.
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			ahora := time.Now()
			registros.Range(func(clave, valor interface{}) bool {
				registro := valor.(*registroAccesoPorIP)
				if ahora.Sub(registro.inicioVentana) > time.Minute {
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

		registro := valor.(*registroAccesoPorIP)

		// Si la ventana de 1 minuto expiró, reiniciar el contador.
		if ahora.Sub(registro.inicioVentana) > time.Minute {
			registro.cantidadSolicitudes = 1
			registro.inicioVentana = ahora
			c.Next()
			return
		}

		// Si excede el límite, rechazar la solicitud.
		if registro.cantidadSolicitudes >= maxSolicitudesPorMinuto {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, dto.APIResponse{
				Success: false,
				Error: &dto.APIError{
					Code:    "RATE_LIMIT_EXCEEDED",
					Message: "Demasiadas consultas. Intenta de nuevo en un momento.",
				},
			})
			return
		}

		registro.cantidadSolicitudes++
		c.Next()
	}
}
