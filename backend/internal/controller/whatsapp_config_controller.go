package controller

import (
	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// WhatsAppConfigController endpoints admin para gestionar canales WhatsApp del tenant.
type WhatsAppConfigController struct {
	canalRepo      *repo.CanalWhatsAppRepo
	chatbotRepo    *repo.ChatbotRepo
	limitesService *service.LimitesService
}

func NewWhatsAppConfigController(canalRepo *repo.CanalWhatsAppRepo, chatbotRepo *repo.ChatbotRepo, limitesService *service.LimitesService) *WhatsAppConfigController {
	return &WhatsAppConfigController{
		canalRepo:      canalRepo,
		chatbotRepo:    chatbotRepo,
		limitesService: limitesService,
	}
}

// ── DTOs ────────────────────────────────────────────────────────────────────

type crearCanalWARequest struct {
	PhoneNumberID string  `json:"phone_number_id" binding:"required"`
	DisplayPhone  string  `json:"display_phone"`
	AccessToken   string  `json:"access_token" binding:"required"`
	VerifyToken   string  `json:"verify_token"`
	NombreCanal   string  `json:"nombre_canal"`
	ChatbotID     *string `json:"chatbot_id"` // UUID string o null
}

type actualizarCanalWARequest struct {
	PhoneNumberID string  `json:"phone_number_id" binding:"required"`
	DisplayPhone  string  `json:"display_phone"`
	AccessToken   string  `json:"access_token"`
	VerifyToken   string  `json:"verify_token"`
	NombreCanal   string  `json:"nombre_canal"`
	ChatbotID     *string `json:"chatbot_id"` // UUID string o null
	Activo        bool    `json:"activo"`
}

// canalWAResponse respuesta segura (sin tokens).
type canalWAResponse struct {
	ID            uuid.UUID  `json:"id"`
	PhoneNumberID string     `json:"phone_number_id"`
	DisplayPhone  string     `json:"display_phone"`
	NombreCanal   string     `json:"nombre_canal"`
	ChatbotID     *uuid.UUID `json:"chatbot_id"` // null si no tiene chatbot vinculado
	Activo        bool       `json:"activo"`
	// Indicamos si tiene token configurado sin exponer el valor
	TieneAccessToken bool   `json:"tiene_access_token"`
	TieneVerifyToken bool   `json:"tiene_verify_token"`
	FechaCreacion    string `json:"fecha_creacion"`
}

func mapCanalToResponse(c model.CanalWhatsApp) canalWAResponse {
	resp := canalWAResponse{
		ID:               c.ID,
		PhoneNumberID:    c.PhoneNumberID,
		DisplayPhone:     c.DisplayPhone,
		NombreCanal:      c.NombreCanal,
		Activo:           c.Activo,
		TieneAccessToken: c.AccessToken != "",
		TieneVerifyToken: c.VerifyToken != "",
		FechaCreacion:    c.FechaCreacion.Format("2006-01-02T15:04:05Z07:00"),
	}
	if c.ChatbotID.Valid {
		resp.ChatbotID = &c.ChatbotID.UUID
	}
	return resp
}

// parseChatbotID convierte el string del request a NullUUID.
func parseChatbotID(raw *string) model.NullUUID {
	if raw == nil || *raw == "" {
		return model.NullUUID{}
	}
	parsed, err := uuid.Parse(*raw)
	if err != nil {
		return model.NullUUID{}
	}
	return model.NullUUID{UUID: parsed, Valid: true}
}

// ── GET /api/v1/canales/whatsapp ────────────────────────────────────────────

func (ctrl *WhatsAppConfigController) GetAll(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	canales, err := ctrl.canalRepo.GetByTenant(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var response []canalWAResponse
	for _, canal := range canales {
		response = append(response, mapCanalToResponse(canal))
	}

	// Siempre retornar array, nunca null
	if response == nil {
		response = []canalWAResponse{}
	}

	helper.Success(c, response)
}

// ── GET /api/v1/canales/whatsapp/:id ────────────────────────────────────────

func (ctrl *WhatsAppConfigController) GetByID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	canalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de canal inválido")
		return
	}

	canal, err := ctrl.canalRepo.GetByID(c.Request.Context(), tenantID, canalID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if canal == nil {
		helper.Error(c, apperror.ErrNotFound)
		return
	}

	helper.Success(c, mapCanalToResponse(*canal))
}

// ── POST /api/v1/canales/whatsapp ───────────────────────────────────────────

func (ctrl *WhatsAppConfigController) Create(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	// ── Validar límite del plan ──
	if err := ctrl.limitesService.ValidarCreacion(c.Request.Context(), tenantID, model.RecursoCanalWhatsApp); err != nil {
		helper.Error(c, err)
		return
	}

	var req crearCanalWARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "phone_number_id y access_token son obligatorios")
		return
	}

	nombreCanal := req.NombreCanal
	if nombreCanal == "" {
		nombreCanal = "WhatsApp Principal"
	}

	chatbotID := parseChatbotID(req.ChatbotID)

	// Validar que el chatbot exista y pertenezca al tenant
	if chatbotID.Valid {
		cb, err := ctrl.chatbotRepo.GetByID(c.Request.Context(), tenantID, chatbotID.UUID)
		if err != nil || cb == nil {
			helper.ValidationError(c, "El chatbot_id proporcionado no existe o no pertenece a este tenant")
			return
		}
	}

	canal := &model.CanalWhatsApp{
		TenantModel:   model.TenantModel{TenantID: tenantID},
		PhoneNumberID: req.PhoneNumberID,
		DisplayPhone:  req.DisplayPhone,
		AccessToken:   req.AccessToken,
		VerifyToken:   req.VerifyToken,
		NombreCanal:   nombreCanal,
		ChatbotID:     chatbotID,
	}

	if err := ctrl.canalRepo.Create(c.Request.Context(), canal); err != nil {
		helper.Error(c, err)
		return
	}

	helper.Created(c, mapCanalToResponse(*canal))
}

// ── PUT /api/v1/canales/whatsapp/:id ────────────────────────────────────────

func (ctrl *WhatsAppConfigController) Update(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	canalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de canal inválido")
		return
	}

	// Verificar que existe y pertenece al tenant
	existing, err := ctrl.canalRepo.GetByID(c.Request.Context(), tenantID, canalID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if existing == nil {
		helper.Error(c, apperror.ErrNotFound)
		return
	}

	var req actualizarCanalWARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "phone_number_id y access_token son obligatorios")
		return
	}

	nombreCanal := req.NombreCanal
	if nombreCanal == "" {
		nombreCanal = existing.NombreCanal
	}

	chatbotID := parseChatbotID(req.ChatbotID)

	// Validar que el chatbot exista y pertenezca al tenant
	if chatbotID.Valid {
		cb, err := ctrl.chatbotRepo.GetByID(c.Request.Context(), tenantID, chatbotID.UUID)
		if err != nil || cb == nil {
			helper.ValidationError(c, "El chatbot_id proporcionado no existe o no pertenece a este tenant")
			return
		}
	}

	// Si se está reactivando un canal desactivado, validar límite del plan
	estaReactivando := !existing.Activo && req.Activo
	if estaReactivando {
		if err := ctrl.limitesService.ValidarCreacion(c.Request.Context(), tenantID, model.RecursoCanalWhatsApp); err != nil {
			helper.Error(c, err)
			return
		}
	}

	existing.PhoneNumberID = req.PhoneNumberID
	existing.DisplayPhone = req.DisplayPhone
	if req.AccessToken != "" {
		existing.AccessToken = req.AccessToken
	}
	if req.VerifyToken != "" {
		existing.VerifyToken = req.VerifyToken
	}
	existing.NombreCanal = nombreCanal
	existing.ChatbotID = chatbotID
	existing.Activo = req.Activo

	if err := ctrl.canalRepo.Update(c.Request.Context(), existing); err != nil {
		helper.Error(c, err)
		return
	}

	helper.Success(c, mapCanalToResponse(*existing))
}

// ── DELETE /api/v1/canales/whatsapp/:id ─────────────────────────────────────

func (ctrl *WhatsAppConfigController) Deactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	canalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de canal inválido")
		return
	}

	if err := ctrl.canalRepo.Deactivate(c.Request.Context(), tenantID, canalID); err != nil {
		helper.Error(c, err)
		return
	}

	helper.NoContent(c)
}