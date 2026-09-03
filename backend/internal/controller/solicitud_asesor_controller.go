package controller

import (
	"strconv"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SolicitudAsesorController endpoints admin para gestionar solicitudes de atención en vivo.
type SolicitudAsesorController struct {
	solicitudService *service.SolicitudAsesorService
}

func NewSolicitudAsesorController(solicitudService *service.SolicitudAsesorService) *SolicitudAsesorController {
	return &SolicitudAsesorController{solicitudService: solicitudService}
}

// GetAbiertas GET /api/v1/solicitudes-asesor
// Retorna solicitudes PENDIENTES y EN_ATENCION ordenadas por prioridad.
func (ctrl *SolicitudAsesorController) GetAbiertas(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudes, err := ctrl.solicitudService.ListarAbiertas(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, solicitudes)
}

// GetByEstado GET /api/v1/solicitudes-asesor/estado/:estado
// Filtra solicitudes por estado (PENDIENTE, EN_ATENCION, RESUELTO, CANCELADO).
func (ctrl *SolicitudAsesorController) GetByEstado(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	estado := c.Param("estado")
	limite := 50

	solicitudes, err := ctrl.solicitudService.ListarPorEstado(c.Request.Context(), tenantID, estado, limite)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, solicitudes)
}















// GetMisSolicitudes GET /api/v1/solicitudes-asesor/mis-solicitudes
// Retorna solicitudes abiertas asignadas al usuario autenticado.
func (ctrl *SolicitudAsesorController) GetMisSolicitudes(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)

	solicitudes, err := ctrl.solicitudService.ListarPorAsesor(c.Request.Context(), tenantID, userID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, solicitudes)
}

// ListarPaginado GET /api/v1/solicitudes-asesor/paginado
// Retorna solicitudes con paginación, filtros y orden.
func (ctrl *SolicitudAsesorController) ListarPaginado(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	pagina, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	porPagina, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	var filtros repo.FiltrosSolicitudAsesor
	filtros.Orden = c.DefaultQuery("orden", "recientes")

	if asignado := c.Query("asignado_a"); asignado != "" {
		if parsed, err := uuid.Parse(asignado); err == nil {
			filtros.AsignadoA = &parsed
		}
	}
	if estado := c.Query("estado"); estado != "" {
		filtros.Estado = &estado
	}

	solicitudes, total, err := ctrl.solicitudService.ListarPaginado(c.Request.Context(), tenantID, pagina, porPagina, filtros)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, dto.NewPaginatedResponse(solicitudes, total, pagina, porPagina))
}

// ContarPendientes GET /api/v1/solicitudes-asesor/pendientes/count
// Retorna el total de solicitudes pendientes (para badge del sidebar).
func (ctrl *SolicitudAsesorController) ContarPendientes(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	count, err := ctrl.solicitudService.ContarPendientes(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"pendientes": count})
}

// GetByID GET /api/v1/solicitudes-asesor/:id
func (ctrl *SolicitudAsesorController) GetByID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	solicitud, err := ctrl.solicitudService.GetByID(c.Request.Context(), tenantID, solicitudID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, solicitud)
}

// Crear POST /api/v1/solicitudes-asesor
// Crea una solicitud manualmente desde el panel admin.
func (ctrl *SolicitudAsesorController) Crear(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var req dto.CrearSolicitudAsesorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre, telefono y motivo son obligatorios")
		return
	}

	params := service.CrearSolicitudParams{
		Nombre:              req.Nombre,
		Telefono:            req.Telefono,
		Motivo:              req.Motivo,
		CanalOrigen:         req.CanalOrigen,
		Prioridad:           req.Prioridad,
		ResumenConversacion: req.ResumenConversacion,
	}

	if req.CanalWhatsAppID != nil && *req.CanalWhatsAppID != "" {
		parsed, err := uuid.Parse(*req.CanalWhatsAppID)
		if err == nil {
			params.CanalWhatsAppID = &parsed
		}
	}

	solicitud, err := ctrl.solicitudService.Crear(c.Request.Context(), tenantID, params)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Created(c, solicitud)
}

// Asignar POST /api/v1/solicitudes-asesor/:id/asignar
// Asigna un asesor a la solicitud.
func (ctrl *SolicitudAsesorController) Asignar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	var req dto.AsignarSolicitudRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "asignado_a es obligatorio")
		return
	}

	if err := ctrl.solicitudService.Asignar(c.Request.Context(), tenantID, solicitudID, req.AsignadoA); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Solicitud asignada"})
}

// Tomar POST /api/v1/solicitudes-asesor/:id/tomar
// El asesor autenticado se asigna a sí mismo la solicitud.
func (ctrl *SolicitudAsesorController) Tomar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	if err := ctrl.solicitudService.Asignar(c.Request.Context(), tenantID, solicitudID, userID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Solicitud tomada"})
}

// Resolver POST /api/v1/solicitudes-asesor/:id/resolver
func (ctrl *SolicitudAsesorController) Resolver(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	var req dto.ResolverSolicitudRequest
	// nota_interna es opcional, no requerimos binding estricto
	_ = c.ShouldBindJSON(&req)

	if err := ctrl.solicitudService.Resolver(c.Request.Context(), tenantID, solicitudID, req.NotaInterna); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Solicitud resuelta"})
}

// Cancelar POST /api/v1/solicitudes-asesor/:id/cancelar
func (ctrl *SolicitudAsesorController) Cancelar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	if err := ctrl.solicitudService.Cancelar(c.Request.Context(), tenantID, solicitudID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Solicitud cancelada"})
}

// ActualizarPrioridad PATCH /api/v1/solicitudes-asesor/:id/prioridad
func (ctrl *SolicitudAsesorController) ActualizarPrioridad(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	var req dto.ActualizarPrioridadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "prioridad es obligatorio (BAJA, NORMAL, ALTA, URGENTE)")
		return
	}

	if err := ctrl.solicitudService.ActualizarPrioridad(c.Request.Context(), tenantID, solicitudID, req.Prioridad); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Prioridad actualizada"})
}

// ActualizarNotaInterna PATCH /api/v1/solicitudes-asesor/:id/nota
func (ctrl *SolicitudAsesorController) ActualizarNotaInterna(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	solicitudID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de solicitud inválido")
		return
	}

	var req dto.ActualizarNotaInternaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nota_interna es obligatorio")
		return
	}

	if err := ctrl.solicitudService.ActualizarNotaInterna(c.Request.Context(), tenantID, solicitudID, req.NotaInterna); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Nota interna actualizada"})
}