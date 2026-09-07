package controller

import (
	"net/http"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
)

type DemoController struct {
	demoService *service.DemoService
}

func NewDemoController(demoService *service.DemoService) *DemoController {
	return &DemoController{demoService: demoService}
}

/*
Crear levanta una empresa de demostración y devuelve la sesión ya iniciada.

Sin autenticación, a propósito: la gracia es que quien llega desde un
anuncio entre sin escribir nada. La protección es el límite por IP que
monta la ruta, porque esto escribe en la base de datos y una dirección
pública que escribe sin freno se llena sola.

POST /api/v1/demo
*/
func (c *DemoController) Crear(ctx *gin.Context) {
	res, err := c.demoService.Crear(ctx.Request.Context())
	if err != nil {
		// El detalle va al registro, no al visitante: aquí un error técnico
		// no le sirve de nada y además revela cómo está montado por dentro.
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "DEMO_NO_DISPONIBLE",
				"message": "No pudimos preparar la demostración. Intenta de nuevo en un momento.",
			},
		})
		_ = ctx.Error(err)
		return
	}

	helper.Success(ctx, res)
}
