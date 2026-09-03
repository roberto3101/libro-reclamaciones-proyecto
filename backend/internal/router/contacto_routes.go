package router

import (
	"libro-reclamaciones/internal/controller"

	"github.com/gin-gonic/gin"
)

// RegisterContactoRoutes rutas de contacto/solicitudes.
// POST /api/v1/contacto/solicitud-whatsapp → Enviar solicitud de activación WhatsApp
func RegisterContactoRoutes(r *gin.Engine, ctrl *controller.ContactoController, authMw, tenantMw gin.HandlerFunc) {
	contacto := r.Group("/api/v1/contacto")
	contacto.Use(authMw, tenantMw)
	{
		contacto.POST("/solicitud-whatsapp", ctrl.EnviarSolicitudWhatsApp)
	}
}
