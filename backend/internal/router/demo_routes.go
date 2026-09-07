package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"

	"github.com/gin-gonic/gin"
)

/*
RegisterDemoRoutes monta la demostración pública.

POST /api/v1/demo → crea una empresa desechable con datos dentro y
                    devuelve la sesión ya iniciada

Sin autenticación: la gracia es que quien llega desde un anuncio entre sin
escribir nada. Pero esto ESCRIBE en la base —crea empresa, sede, usuario,
roles y cuatro reclamos—, así que el límite por IP no es opcional: sin él,
cualquiera puede dejar el disco lleno con un bucle de tres líneas.

Tres por minuto es holgado para una persona (que pulsará una vez) y
estrecho para un script.
*/
func RegisterDemoRoutes(r *gin.Engine, ctrl *controller.DemoController) {
	limitador := middleware.LimitadorIP(middleware.LimitadorIPConfig{
		MaxPorMinuto: 3,
		Mensaje:      "Ya creaste varias demostraciones. Espera un minuto antes de pedir otra.",
	})

	r.POST("/api/v1/demo", limitador, ctrl.Crear)
}
