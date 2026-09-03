package controller

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)
type ExportarControlador struct {
	reclamoService        *service.ReclamoService
	tenantService         *service.TenantService
	exportarPDFServicio   *service.ExportarPDFServicio
	exportarExcelServicio *service.ExportarExcelServicio
	auditRepo             *repo.AuditoriaRepo
}

func NuevoExportarControlador(
	reclamoService *service.ReclamoService,
	tenantService *service.TenantService,
	exportarPDFServicio *service.ExportarPDFServicio,
	exportarExcelServicio *service.ExportarExcelServicio,
	auditRepo *repo.AuditoriaRepo,
) *ExportarControlador {
	return &ExportarControlador{
		reclamoService:        reclamoService,
		tenantService:         tenantService,
		exportarPDFServicio:   exportarPDFServicio,
		exportarExcelServicio: exportarExcelServicio,
		auditRepo:             auditRepo,
	}
}

// ExportarPDF GET /api/v1/reclamos/exportar/pdf
func (ctrl *ExportarControlador) ExportarPDF(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	reclamos, empresa, ruc, err := ctrl.obtenerDatosExportacion(c, tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}

	// Construir filtros para mostrar en el PDF
	filtrosPDF := construirFiltrosPDF(c, reclamos)

	pdfBytes, err := ctrl.exportarPDFServicio.GenerarReporteReclamos(reclamos, empresa, ruc, filtrosPDF)
	if err != nil {
		helper.Error(c, err)
		return
	}

	nombreArchivo := fmt.Sprintf("reclamos_%s.pdf", time.Now().Format("20060102_150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", nombreArchivo))
	userID, _ := helper.GetUserID(c)
	ctrl.auditRepo.RegistrarAsync(
		tenantID, userID,
		repo.AccionAuditExportar,
		"RECLAMO",
		"",
		map[string]interface{}{
			"formato":      "pdf",
			"registros":    len(reclamos),
			"nombre_archivo": nombreArchivo,
			"empresa":      empresa,
		},
		helper.GetClientIP(c),
	)
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// ExportarExcel GET /api/v1/reclamos/exportar/excel
func (ctrl *ExportarControlador) ExportarExcel(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	reclamos, empresa, _, err := ctrl.obtenerDatosExportacion(c, tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}

	excelBytes, err := ctrl.exportarExcelServicio.GenerarReporteReclamos(reclamos, empresa)
	if err != nil {
		helper.Error(c, err)
		return
	}

	nombreArchivo := fmt.Sprintf("reclamos_%s.xlsx", time.Now().Format("20060102_150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", nombreArchivo))
	userID, _ := helper.GetUserID(c)
	ctrl.auditRepo.RegistrarAsync(
		tenantID, userID,
		repo.AccionAuditExportar,
		"RECLAMO",
		"",
		map[string]interface{}{
			"formato":        "excel",
			"registros":      len(reclamos),
			"nombre_archivo": nombreArchivo,
			"empresa":        empresa,
		},
		helper.GetClientIP(c),
	)
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelBytes)
}

// obtenerDatosExportacion obtiene reclamos filtrados y datos del tenant.
func (ctrl *ExportarControlador) obtenerDatosExportacion(c *gin.Context, tenantID uuid.UUID) ([]model.Reclamo, string, string, error) {
	filtros := repo.FiltrosExportacion{TenantID: tenantID}

	if sedeParam := c.Query("sede_id"); sedeParam != "" {
		if parsed, err := uuid.Parse(sedeParam); err == nil {
			filtros.SedeIDs = []uuid.UUID{parsed}
		}
	}
	// Usuario con sedes asignadas: restringir a sus sedes
	if userSedes := helper.GetUserSedesIDs(c); len(userSedes) > 0 {
		filtros.SedeIDs = userSedes
	}
	if usuarioParam := c.Query("usuario_id"); usuarioParam != "" {
		if parsed, err := uuid.Parse(usuarioParam); err == nil {
			filtros.AtendidoPor = &parsed
		}
	}

	// Periodos predefinidos: hoy, semana, mes, anio
	switch c.Query("periodo") {
	case "hoy":
		hoy := inicioDelDia(time.Now())
		filtros.FechaDesde = &hoy
	case "semana":
		inicio := inicioDelDia(time.Now().AddDate(0, 0, -int(time.Now().Weekday())+1))
		filtros.FechaDesde = &inicio
	case "mes":
		inicio := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Local)
		filtros.FechaDesde = &inicio
	case "anio":
		inicio := time.Date(time.Now().Year(), 1, 1, 0, 0, 0, 0, time.Local)
		filtros.FechaDesde = &inicio
	}

	// Fechas personalizadas (sobreescriben periodo)
	if desde := c.Query("fecha_desde"); desde != "" {
		if t, err := time.Parse("2006-01-02", desde); err == nil {
			filtros.FechaDesde = &t
		}
	}
	if hasta := c.Query("fecha_hasta"); hasta != "" {
		if t, err := time.Parse("2006-01-02", hasta); err == nil {
			fin := t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			filtros.FechaHasta = &fin
		}
	}
	if e := c.Query("estado"); e != "" {
		filtros.Estado = &e
	}
	if busqueda := c.Query("busqueda"); busqueda != "" {
		log.Printf("[EXPORTAR] Filtro busqueda recibido: '%s'", busqueda)
		filtros.Busqueda = &busqueda
	}
	if c.Query("proximos_a_vencer") == "true" {
		filtros.ProximosAVencer = true
	}

	reclamos, err := ctrl.reclamoService.ObtenerParaExportacion(c.Request.Context(), filtros)
	if err != nil {
		return nil, "", "", err
	}

	empresa := "Empresa"
	ruc := ""
	tenant, err := ctrl.tenantService.GetByTenantID(c.Request.Context(), tenantID)
	if err == nil && tenant != nil {
		empresa = tenant.RazonSocial
		ruc = tenant.RUC
	}

	return reclamos, empresa, ruc, nil
}

func construirFiltrosPDF(c *gin.Context, reclamos []model.Reclamo) *service.FiltrosReportePDF {
	f := &service.FiltrosReportePDF{
		Periodo:  c.Query("periodo"),
		Busqueda: c.Query("busqueda"),
		Estado:   c.Query("estado"),
	}

	// Fechas personalizadas
	if desde := c.Query("fecha_desde"); desde != "" {
		if t, err := time.Parse("2006-01-02", desde); err == nil {
			f.FechaDesde = t.Format("02/01/2006")
		}
	}
	if hasta := c.Query("fecha_hasta"); hasta != "" {
		if t, err := time.Parse("2006-01-02", hasta); err == nil {
			f.FechaHasta = t.Format("02/01/2006")
		}
	}

	// Nombre de la sede: lo sacamos del primer reclamo que tenga sede
	if c.Query("sede_id") != "" && len(reclamos) > 0 {
		for _, r := range reclamos {
			if r.SedeNombre.Valid && r.SedeNombre.String != "" {
				f.Sede = r.SedeNombre.String
				break
			}
		}
	}

	return f
}

func inicioDelDia(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}