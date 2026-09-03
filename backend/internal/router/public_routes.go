package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterPublicRoutes(r *gin.Engine, ctrl *controller.PublicController, limitadorConsultaDocumento gin.HandlerFunc) {
	// Rate limiters para endpoints públicos de escritura
	limitadorMensajes := middleware.LimitadorIP(middleware.LimitadorIPConfig{
		MaxPorMinuto: 5,
		Mensaje:      "Has enviado demasiados mensajes. Espera un momento antes de intentar de nuevo.",
	})
	limitadorReclamos := middleware.LimitadorIP(middleware.LimitadorIPConfig{
		MaxPorMinuto: 3,
		Mensaje:      "Has enviado demasiados reclamos. Espera un momento antes de intentar de nuevo.",
	})
	limitadorLectura := middleware.LimitadorIP(middleware.LimitadorIPConfig{
		MaxPorMinuto: 30,
		Mensaje:      "Demasiadas consultas. Intenta de nuevo en un momento.",
	})

	libro := r.Group("/libro/:slug")
	{
		libro.GET("/tenant", limitadorLectura, ctrl.GetTenant)
		libro.GET("/sedes", limitadorLectura, ctrl.GetSedes)
		libro.POST("/reclamos", limitadorReclamos, ctrl.CrearReclamo)
		libro.GET("/seguimiento/:codigo", limitadorLectura, ctrl.ConsultarSeguimiento)
		libro.GET("/seguimiento/:codigo/mensajes", limitadorLectura, ctrl.ListarMensajesPublico)
		libro.POST("/seguimiento/:codigo/mensajes", limitadorMensajes, ctrl.EnviarMensajePublico)

		// Consulta de documento con rate limiting por IP
		libro.GET("/consulta-documento/:numero", limitadorConsultaDocumento, ctrl.ConsultarDocumentoIdentidad)

		// Validar empresa por RUC (SQL Server)
		libro.GET("/validar-empresa/:ruc", limitadorLectura, ctrl.ValidarEmpresaRUC)
	}
}