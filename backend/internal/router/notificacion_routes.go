package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegistrarRutasNotificaciones(
	r *gin.Engine,
	ctrl *controller.NotificacionController,
	authMw gin.HandlerFunc,
	tenantMw gin.HandlerFunc,
	permisoMw gin.HandlerFunc,
) {
	grupo := r.Group("/api/v1/notificaciones", authMw, tenantMw)
	{
		grupo.GET("", ctrl.ListarNotificaciones)
		grupo.GET("/sin-leer/total", ctrl.ContarNoLeidas)
		grupo.PUT("/:id/leida", ctrl.MarcarComoLeida)
		grupo.PUT("/marcar-todas-leidas", ctrl.MarcarTodasComoLeidas)
		grupo.GET("/definicion-tipos", ctrl.ObtenerDefinicionTiposNotificacion)
	}

	grupoConfig := r.Group("/api/v1/notificaciones/configuracion", authMw, tenantMw, permisoMw)
	{
		grupoConfig.GET("/rol/:rolId", middleware.RequierePermiso(model.ModuloRoles, model.AccionVer), ctrl.ObtenerConfiguracionPorRol)
		grupoConfig.PUT("/rol/:rolId", middleware.RequierePermiso(model.ModuloRoles, model.AccionEditar), ctrl.ActualizarConfiguracionPorRol)
	}
}
