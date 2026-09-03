package router

import (
	"libro-reclamaciones/internal/controller"

	"github.com/gin-gonic/gin"
)

// RegisterPagoRoutes rutas de pago del tenant.
// GET  /api/v1/pagos/config   → Llave pública de Culqi para el checkout
// GET  /api/v1/pagos          → Historial de pagos del tenant
// POST /api/v1/pagos/tarjeta  → Cobra con la tarjeta ya tokenizada
func RegisterPagoRoutes(r *gin.Engine, ctrl *controller.PagoController, authMw, tenantMw gin.HandlerFunc) {
	pagos := r.Group("/api/v1/pagos")
	pagos.Use(authMw, tenantMw)
	{
		pagos.GET("/config", ctrl.GetConfig)
		pagos.GET("", ctrl.Historial)
		pagos.POST("/tarjeta", ctrl.CobrarTarjeta)
		pagos.POST("/suscripcion", ctrl.SuscribirMercadoPago)
	}
}

// RegisterPagoAdminRoutes registro manual de pagos (Yape, transferencia).
// Solo ADMIN: activa la suscripción sin pasar por la pasarela.
// POST /api/v1/admin/pagos/manual
func RegisterPagoAdminRoutes(r *gin.Engine, ctrl *controller.PagoController, authMw, tenantMw, adminMw gin.HandlerFunc) {
	admin := r.Group("/api/v1/admin/pagos")
	admin.Use(authMw, tenantMw, adminMw)
	{
		admin.POST("/manual", ctrl.RegistrarManual)
	}
}

// RegisterPagoWebhookRoutes webhooks públicos de las pasarelas.
// Sin auth: la seguridad viene de la firma que manda cada una.
// POST /webhook/culqi
// POST /webhook/mercadopago
func RegisterPagoWebhookRoutes(r *gin.Engine, ctrl *controller.PagoController) {
	r.POST("/webhook/culqi", ctrl.Webhook)
	r.POST("/webhook/mercadopago", ctrl.WebhookMercadoPago)
}
