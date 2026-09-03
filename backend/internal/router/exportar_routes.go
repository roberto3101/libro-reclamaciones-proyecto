package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
)

func RegistrarRutasExportacion(r *gin.Engine, ctrl *controller.ExportarControlador, authMw, tenantMw, permisoMw gin.HandlerFunc) {
	exportar := r.Group("/api/v1/reclamos/exportar")
	exportar.Use(authMw, tenantMw, permisoMw)
	{
		exportar.GET("/pdf", middleware.RequierePermiso(model.ModuloReclamos, model.AccionExportar), ctrl.ExportarPDF)
		exportar.GET("/excel", middleware.RequierePermiso(model.ModuloReclamos, model.AccionExportar), ctrl.ExportarExcel)
	}
}
