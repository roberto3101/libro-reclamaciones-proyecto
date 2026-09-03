package middleware

import (
	"net/http"
	"sync"
	"time"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"

	"github.com/gin-gonic/gin"
)

// LimitadorAsistentePorUsuario restringe el número de mensajes al asistente IA
// por usuario autenticado en una ventana deslizante de 1 minuto.
// Usa sync.Map en memoria — no requiere base de datos ni Redis.
func LimitadorAsistentePorUsuario(maxPorMinuto int) gin.HandlerFunc {
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
		userID, err := helper.GetUserID(c)
		if err != nil {
			// Si no hay userID en contexto, el auth middleware ya debería haber rechazado.
			c.Next()
			return
		}

		clave := userID.String()
		ahora := time.Now()

		valor, existe := registros.Load(clave)

		if !existe {
			registros.Store(clave, &registroAccesoPorIP{
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
		if registro.cantidadSolicitudes >= maxPorMinuto {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, dto.APIResponse{
				Success: false,
				Error: &dto.APIError{
					Code:    "RATE_LIMIT_EXCEEDED",
					Message: "Has enviado demasiados mensajes al asistente. Espera un momento antes de continuar.",
				},
			})
			return
		}

		registro.cantidadSolicitudes++
		c.Next()
	}
}
