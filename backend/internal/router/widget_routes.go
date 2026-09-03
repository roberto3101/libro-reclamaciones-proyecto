package router

import (
	"libro-reclamaciones/internal/controller"

	"github.com/gin-gonic/gin"
)

func RegisterWidgetRoutes(r *gin.Engine, ctrl *controller.WidgetController) {
	// Serve the widget JS file (public, no auth)
	r.GET("/widget/chat.js", ctrl.ServeWidgetJS)

	// Widget API (authenticated via X-API-Key, same as bot)
	widget := r.Group("/api/widget/v1")
	{
		widget.GET("/config", ctrl.WidgetConfig)
		widget.POST("/auth", ctrl.WidgetAuth)
		widget.GET("/reclamos/:id/mensajes", ctrl.WidgetGetMensajes)
		widget.POST("/reclamos/:id/mensajes", ctrl.WidgetEnviarMensaje)
	}
}