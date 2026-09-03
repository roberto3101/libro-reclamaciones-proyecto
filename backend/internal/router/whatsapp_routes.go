package router

import (
	"libro-reclamaciones/internal/controller"

	"github.com/gin-gonic/gin"
)

func RegistrarRutasWebhookWhatsApp(r *gin.Engine, ctrl *controller.WhatsAppController) {
	webhook := r.Group("/webhook")
	{
		webhook.GET("/whatsapp", ctrl.VerificarWebhook)
		webhook.POST("/whatsapp", ctrl.RecibirMensajeEntrante)
	}
}