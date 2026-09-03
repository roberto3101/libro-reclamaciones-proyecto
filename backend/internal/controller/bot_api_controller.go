package controller

import (
	"time"
"database/sql"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type BotAPIController struct {
	reclamoService   *service.ReclamoService
	respuestaService *service.RespuestaService
	mensajeService   *service.MensajeService
	logRepo          *repo.ChatbotLogRepo
}

func NewBotAPIController(
	reclamoService *service.ReclamoService,
	respuestaService *service.RespuestaService,
	mensajeService *service.MensajeService,
	logRepo *repo.ChatbotLogRepo,
) *BotAPIController {
	return &BotAPIController{
		reclamoService:   reclamoService,
		respuestaService: respuestaService,
		mensajeService:   mensajeService,
		logRepo:          logRepo,
	}
}

// GetReclamos GET /api/bot/v1/reclamos
func (ctrl *BotAPIController) GetReclamos(c *gin.Context) {
	start := time.Now()
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		ctrl.logRequest(c, start, 400, err.Error())
		helper.Error(c, err)
		return
	}

	pag := helper.ParsePagination(c)
	reclamos, total, err := ctrl.reclamoService.GetByTenant(c.Request.Context(), tenantID, pag, repo.FiltrosListado{})
	if err != nil {
		ctrl.logRequest(c, start, 500, err.Error())
		helper.Error(c, err)
		return
	}

	ctrl.logRequest(c, start, 200, "")
	helper.Success(c, dto.NewPaginatedResponse(reclamos, total, pag.Page, pag.PerPage))
}

// GetReclamo GET /api/bot/v1/reclamos/:id
func (ctrl *BotAPIController) GetReclamo(c *gin.Context) {
	start := time.Now()
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		ctrl.logRequest(c, start, 400, err.Error())
		helper.Error(c, err)
		return
	}

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		ctrl.logRequest(c, start, 400, "ID invÃ¡lido")
		helper.ValidationError(c, "ID de reclamo invÃ¡lido")
		return
	}

	reclamo, err := ctrl.reclamoService.GetByID(c.Request.Context(), tenantID, reclamoID)
	if err != nil {
		ctrl.logRequest(c, start, 404, err.Error())
		helper.Error(c, err)
		return
	}

	ctrl.logRequest(c, start, 200, "")
	helper.Success(c, reclamo)
}

// CreateMensaje POST /api/bot/v1/reclamos/:id/mensajes
func (ctrl *BotAPIController) CreateMensaje(c *gin.Context) {
	start := time.Now()
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		ctrl.logRequest(c, start, 400, err.Error())
		helper.Error(c, err)
		return
	}

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		ctrl.logRequest(c, start, 400, "ID invÃ¡lido")
		helper.ValidationError(c, "ID de reclamo invÃ¡lido")
		return
	}

	var req dto.BotMensajeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ctrl.logRequest(c, start, 400, err.Error())
		helper.ValidationError(c, "mensaje y tipo_mensaje son obligatorios")
		return
	}

	msg, err := ctrl.mensajeService.Crear(
		c.Request.Context(), tenantID, reclamoID,
		req.TipoMensaje, req.Mensaje, req.ArchivoURL, req.ArchivoNombre,
	)
	if err != nil {
		ctrl.logRequest(c, start, 500, err.Error())
		helper.Error(c, err)
		return
	}

	ctrl.logRequest(c, start, 201, "")
	helper.Created(c, msg)
}

// CambiarEstado PATCH /api/bot/v1/reclamos/:id/estado
func (ctrl *BotAPIController) CambiarEstado(c *gin.Context) {
	start := time.Now()
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		ctrl.logRequest(c, start, 400, err.Error())
		helper.Error(c, err)
		return
	}

	chatbotID, _ := helper.GetChatbotID(c)

	reclamoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		ctrl.logRequest(c, start, 400, "ID invÃ¡lido")
		helper.ValidationError(c, "ID de reclamo invÃ¡lido")
		return
	}

	var req dto.BotCambiarEstadoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ctrl.logRequest(c, start, 400, err.Error())
		helper.ValidationError(c, "estado es obligatorio")
		return
	}

	if err := ctrl.reclamoService.CambiarEstado(
		c.Request.Context(), tenantID, reclamoID, chatbotID,
		req.Estado, req.Comentario, helper.GetClientIP(c),
	); err != nil {
		ctrl.logRequest(c, start, 500, err.Error())
		helper.Error(c, err)
		return
	}

	ctrl.logRequest(c, start, 200, "")
	helper.Success(c, gin.H{"message": "Estado actualizado"})
}

// logRequest registra cada llamada en chatbot_logs.
func (ctrl *BotAPIController) logRequest(c *gin.Context, start time.Time, statusCode int, errorDetalle string) {
	tenantID, _ := helper.GetTenantID(c)
	chatbotID, _ := helper.GetChatbotID(c)
	apiKeyID, _ := helper.GetUUIDFromContext(c, helper.CtxAPIKeyID)

	duracion := time.Since(start).Milliseconds()

	log := &model.ChatbotLog{
		TenantModel: model.TenantModel{TenantID: tenantID},
		ChatbotID:   chatbotID,
		APIKeyID:    apiKeyID,
		Endpoint:    c.FullPath(),
		Metodo:      c.Request.Method,
		StatusCode:  statusCode,
		IPAddress:   model.NullString{NullString: sql.NullString{String: helper.GetClientIP(c), Valid: true}},
		DuracionMS:  model.NullInt64{NullInt64: sql.NullInt64{Int64: duracion, Valid: duracion > 0}},
		Accion:      model.NullString{NullString: sql.NullString{String: errorDetalle, Valid: errorDetalle != ""}},
	}

	go func() {
		_ = ctrl.logRepo.Create(c.Request.Context(), log)
	}()
}

