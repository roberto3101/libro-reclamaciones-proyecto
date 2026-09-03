package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

// RegistrarRutasRoles configura los endpoints de gestión de roles.
func RegistrarRutasRoles(r *gin.Engine, ctrl *controller.RolController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	roles := r.Group("/api/v1/roles")
	roles.Use(authMw, tenantMw)
	{
		// Accesible a TODOS los usuarios autenticados (para sidebar + formularios)
		roles.GET("/mis-permisos", ctrl.MisPermisos)
		roles.GET("/definicion", ctrl.ObtenerDefinicion)

		// CRUD de roles (requiere permisos granulares)
		roles.GET("", permisoMw, middleware.RequierePermiso(model.ModuloRoles, model.AccionVer), ctrl.Listar)
		roles.GET("/:id", permisoMw, middleware.RequierePermiso(model.ModuloRoles, model.AccionVer), ctrl.ObtenerPorID)
		roles.POST("", permisoMw, middleware.RequierePermiso(model.ModuloRoles, model.AccionCrear), ctrl.Crear)
		roles.PUT("/:id", permisoMw, middleware.RequierePermiso(model.ModuloRoles, model.AccionEditar), ctrl.Actualizar)
		roles.DELETE("/:id", permisoMw, middleware.RequierePermiso(model.ModuloRoles, model.AccionEliminar), ctrl.Eliminar)
	}
}
