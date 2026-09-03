package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegisterUsuarioRoutes(r *gin.Engine, ctrl *controller.UsuarioController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	usuarios := r.Group("/api/v1/usuarios")
	usuarios.Use(authMw, tenantMw, permisoMw)
	{
		usuarios.GET("", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionVer), ctrl.GetAll)
		usuarios.GET("/:id", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionVer), ctrl.GetByID)
		usuarios.PUT("/password", ctrl.ChangePassword) // Cambiar propia contraseña — sin permiso especial

		// Búsqueda de usuarios por email dentro de la cuenta (para "Agregar existente")
		usuarios.GET("/buscar-en-cuenta", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionCrear), ctrl.BuscarEnCuenta)
		// Vincular un usuario existente (de otra empresa de la misma cuenta) al tenant actual
		usuarios.POST("/agregar-existente", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionCrear), ctrl.AgregarUsuarioExistente)

		usuarios.POST("", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionCrear), ctrl.Create)
		usuarios.PUT("/:id", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionEditar), ctrl.Update)
		usuarios.PATCH("/:id/password", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionEditar), ctrl.AdminResetPassword)
		usuarios.DELETE("/:id", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionEliminar), ctrl.Deactivate)
		usuarios.POST("/:id/reactivar", middleware.RequierePermiso(model.ModuloUsuarios, model.AccionEditar), ctrl.Reactivate)
	}
}
