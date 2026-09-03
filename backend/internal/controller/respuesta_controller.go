package controller

import (
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RespuestaController struct {
	respuestaService *service.RespuestaService
	auditRepo        *repo.AuditoriaRepo
}

func NewRespuestaController(respuestaService *service.RespuestaService, auditRepo *repo.AuditoriaRepo) *RespuestaController {
	return &RespuestaController{respuestaService: respuestaService, auditRepo: auditRepo}
}

// GetByReclamo GET /api/v1/reclamos/:id/respuestas
func (ctrl *RespuestaController) GetByReclamo(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de reclamo inválido")
		return
	}

	respuestas, err := ctrl.respuestaService.GetByReclamo(c.Request.Context(), tenantID, reclamoID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, respuestas)
}

// Create POST /api/v1/reclamos/:id/respuestas
func (ctrl *RespuestaController) Create(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de reclamo inválido")
		return
	}

	var req dto.CreateRespuestaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "respuesta_empresa es obligatorio")
		return
	}

	resp, err := ctrl.respuestaService.Crear(
		c.Request.Context(), tenantID, reclamoID, userID,
		req.RespuestaEmpresa, req.AccionTomada, req.CompensacionOfrecida,
		req.CargoResponsable, helper.GetClientIP(c),
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	ctrl.auditRepo.RegistrarAccionReclamo(
		tenantID, userID, reclamoID,
		repo.AccionAuditResponder,
		map[string]interface{}{
			"cargo_responsable":     req.CargoResponsable,
			"respuesta_preview":     truncateRespuesta(req.RespuestaEmpresa, 120),
			"compensacion_ofrecida": req.CompensacionOfrecida,
		},
		helper.GetClientIP(c),
	)
	helper.Created(c, resp)
}

// truncateRespuesta acorta la respuesta para que el detalle no se vuelva enorme.
// La respuesta completa siempre queda en `respuestas.respuesta_empresa`.
func truncateRespuesta(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}