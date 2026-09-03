package router

import (
	"libro-reclamaciones/internal/controller"

	"github.com/gin-gonic/gin"
)

// RegisterPlanRoutes rutas de planes para tenants (solo lectura).
// GET /api/v1/planes        → Planes activos
// GET /api/v1/planes/:id    → Detalle de un plan
func RegisterPlanRoutes(r *gin.Engine, ctrl *controller.PlanController, authMw, tenantMw gin.HandlerFunc) {
	planes := r.Group("/api/v1/planes")
	planes.Use(authMw, tenantMw)
	{
		planes.GET("", ctrl.GetAll)
		planes.GET("/:id", ctrl.GetByID)
	}
}

// RegisterPlanAdminRoutes rutas CRUD de planes para superadmin.
// Solo ADMIN puede acceder. En el futuro, restringir a SUPERADMIN.
// GET    /api/v1/admin/planes              → Todos (incluyendo inactivos)
// POST   /api/v1/admin/planes              → Crear plan
// PUT    /api/v1/admin/planes/:id          → Actualizar plan
// PATCH  /api/v1/admin/planes/:id/activar  → Activar
// PATCH  /api/v1/admin/planes/:id/desactivar → Desactivar
func RegisterPlanAdminRoutes(r *gin.Engine, ctrl *controller.PlanController, authMw, tenantMw, adminMw gin.HandlerFunc) {
	admin := r.Group("/api/v1/admin/planes")
	admin.Use(authMw, tenantMw, adminMw)
	{
		admin.GET("", ctrl.GetAllAdmin)
		admin.POST("", ctrl.Crear)
		admin.PUT("/:id", ctrl.Actualizar)
		admin.PATCH("/:id/activar", ctrl.Activar)
		admin.PATCH("/:id/desactivar", ctrl.Desactivar)
	}
}

// RegisterSuscripcionRoutes rutas de suscripción del tenant.
// GET  /api/v1/suscripcion             → Suscripción activa + plan
// GET  /api/v1/suscripcion/uso         → Uso actual vs límites
// GET  /api/v1/suscripcion/historial   → Historial de suscripciones
// POST /api/v1/suscripcion/cambiar-plan → Cambiar de plan
func RegisterSuscripcionRoutes(r *gin.Engine, ctrl *controller.SuscripcionController, authMw, tenantMw gin.HandlerFunc) {
	sus := r.Group("/api/v1/suscripcion")
	sus.Use(authMw, tenantMw)
	{
		sus.GET("", ctrl.GetActiva)
		sus.GET("/uso", ctrl.GetUso)
		sus.GET("/historial", ctrl.GetHistorial)
		sus.POST("/cambiar-plan", ctrl.CambiarPlan)
	}
}
