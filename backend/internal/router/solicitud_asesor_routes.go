package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

// RegisterSolicitudAsesorRoutes registra las rutas de atención en vivo (solicitudes de asesor).
func RegisterSolicitudAsesorRoutes(
	r *gin.Engine,
	ctrl *controller.SolicitudAsesorController,
	msgCtrl *controller.MensajeAtencionController,
	authMw gin.HandlerFunc,
	tenantMw gin.HandlerFunc,
	permisoMw gin.HandlerFunc,
) {
	solicitudes := r.Group("/api/v1/solicitudes-asesor").Use(authMw, tenantMw, permisoMw)
	{
		solicitudes.GET("", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.GetAbiertas)
		solicitudes.GET("/paginado", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.ListarPaginado)
		solicitudes.GET("/pendientes/count", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.ContarPendientes)
		solicitudes.GET("/mis-solicitudes", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.GetMisSolicitudes)
		solicitudes.GET("/estado/:estado", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.GetByEstado)
		solicitudes.GET("/:id", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.GetByID)

		solicitudes.POST("", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.Crear)
		solicitudes.POST("/:id/asignar", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionAsignar), ctrl.Asignar)
		solicitudes.POST("/:id/tomar", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionAsignar), ctrl.Tomar)
		solicitudes.POST("/:id/resolver", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionCambiarEstado), ctrl.Resolver)
		solicitudes.POST("/:id/cancelar", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionCambiarEstado), ctrl.Cancelar)
		solicitudes.PATCH("/:id/prioridad", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionCambiarEstado), ctrl.ActualizarPrioridad)
		solicitudes.PATCH("/:id/nota", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), ctrl.ActualizarNotaInterna)

		// Chat en vivo
		solicitudes.GET("/:id/mensajes", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), msgCtrl.ListarMensajes)
		solicitudes.POST("/:id/mensajes", middleware.RequierePermiso(model.ModuloAtencionVivo, model.AccionVer), msgCtrl.EnviarMensaje)
	}
}
