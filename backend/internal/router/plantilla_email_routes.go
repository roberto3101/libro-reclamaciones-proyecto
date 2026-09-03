package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

// RegistrarRutasPlantillasEmail configura los endpoints de gestión de plantillas de email.
func RegistrarRutasPlantillasEmail(r *gin.Engine, ctrl *controller.PlantillaEmailController, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	plantillas := r.Group("/api/v1/plantillas-email")
	plantillas.Use(authMw, tenantMw, permisoMw)
	{
		// Definiciones (para el frontend)
		plantillas.GET("/definicion", middleware.RequierePermiso(model.ModuloPlantillasEmail, model.AccionVer), ctrl.ObtenerDefinicion)

		// CRUD
		plantillas.GET("", middleware.RequierePermiso(model.ModuloPlantillasEmail, model.AccionVer), ctrl.Listar)
		plantillas.GET("/:id", middleware.RequierePermiso(model.ModuloPlantillasEmail, model.AccionVer), ctrl.ObtenerPorID)
		plantillas.PUT("/:id", middleware.RequierePermiso(model.ModuloPlantillasEmail, model.AccionEditar), ctrl.Actualizar)
		plantillas.POST("/:id/restaurar", middleware.RequierePermiso(model.ModuloPlantillasEmail, model.AccionEditar), ctrl.RestaurarDefecto)
	}
}
