package controller

import (
	"fmt"
	"net/http"
	"strings"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
)

type WidgetController struct {
	reclamoService *service.ReclamoService
	mensajeService *service.MensajeService
	tenantRepo     *repo.TenantRepo
	apiKeyRepo     *repo.ChatbotAPIKeyRepo
}

func NewWidgetController(
	reclamoService *service.ReclamoService,
	mensajeService *service.MensajeService,
	tenantRepo *repo.TenantRepo,
	apiKeyRepo *repo.ChatbotAPIKeyRepo,
) *WidgetController {
	return &WidgetController{
		reclamoService: reclamoService,
		mensajeService: mensajeService,
		tenantRepo:     tenantRepo,
		apiKeyRepo:     apiKeyRepo,
	}
}

// ServeWidgetJS GET /widget/chat.js
// Sirve el archivo JavaScript del widget embebible.
func (ctrl *WidgetController) ServeWidgetJS(c *gin.Context) {
	c.Header("Content-Type", "application/javascript; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=3600")
	c.Header("Access-Control-Allow-Origin", "*")
	c.File("static/widget/chat.js")
}

// resolveAPIKey extrae y valida la API key del header X-API-Key para widget.
// Retorna tenantID o error HTTP.
func (ctrl *WidgetController) resolveAPIKey(c *gin.Context) (*model.APIKey, bool) {
	apiKeyStr := strings.TrimSpace(c.GetHeader("X-API-Key"))
	if apiKeyStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "API Key requerida"})
		return nil, false
	}

	keyHash := helper.SHA256Hash(apiKeyStr)
	key, err := ctrl.apiKeyRepo.GetByHash(c.Request.Context(), keyHash)
	if err != nil || key == nil || !key.Activa {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "API Key inválida"})
		return nil, false
	}
	return key, true
}

// WidgetConfig GET /api/widget/v1/config
// Retorna la configuración pública del tenant (nombre, color, logo) para personalizar el widget.
func (ctrl *WidgetController) WidgetConfig(c *gin.Context) {
	key, ok := ctrl.resolveAPIKey(c)
	if !ok {
		return
	}

	tenant, err := ctrl.tenantRepo.GetByTenantID(c.Request.Context(), key.TenantID)
	if err != nil || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Empresa no encontrada"})
		return
	}

	logoURL := ""
	if tenant.LogoURL.Valid {
		logoURL = tenant.LogoURL.String
	}

	c.JSON(http.StatusOK, gin.H{
		"razon_social":   tenant.RazonSocial,
		"color_primario": tenant.ColorPrimario,
		"logo_url":       logoURL,
	})
}

// WidgetAuth POST /api/widget/v1/auth
// Autentica al cliente con código de reclamo + email.
// No retorna token JWT — solo valida y retorna datos del reclamo.
func (ctrl *WidgetController) WidgetAuth(c *gin.Context) {
	key, ok := ctrl.resolveAPIKey(c)
	if !ok {
		return
	}

	var req struct {
		Codigo string `json:"codigo" binding:"required"`
		Email  string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Código y email son obligatorios"})
		return
	}

	// Buscar reclamo por código público dentro del tenant
	reclamo, err := ctrl.reclamoService.GetByCodigoPublico(c.Request.Context(), key.TenantID, strings.TrimSpace(req.Codigo))
	if err != nil || reclamo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No se encontró un caso con ese código"})
		return
	}

	// Verificar que el email coincida (case insensitive)
	if !strings.EqualFold(strings.TrimSpace(reclamo.Email), strings.TrimSpace(req.Email)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "El email no coincide con el caso"})
		return
	}

	// Retornar datos del reclamo (sin datos sensibles)
	c.JSON(http.StatusOK, gin.H{
		"reclamo": gin.H{
			"id":               reclamo.ID,
			"codigo":           reclamo.CodigoReclamo,
			"estado":           reclamo.Estado,
			"tipo_solicitud":   reclamo.TipoSolicitud,
			"fecha_registro":   reclamo.FechaRegistro,
			"nombre_completo":  reclamo.NombreCompleto,
			"detalle_reclamo":  reclamo.DetalleReclamo,
			"fecha_limite":     reclamo.FechaLimiteRespuesta,
		},
	})
}

// WidgetGetMensajes GET /api/widget/v1/reclamos/:id/mensajes
// Retorna los mensajes de un reclamo. Valida que el email coincida.
func (ctrl *WidgetController) WidgetGetMensajes(c *gin.Context) {
	key, ok := ctrl.resolveAPIKey(c)
	if !ok {
		return
	}

	reclamoID, err := helper.ParseUUID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	// Validar email del query param
	email := strings.TrimSpace(c.Query("email"))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email requerido"})
		return
	}

	// Verificar que el reclamo pertenece al tenant y el email coincide
	reclamo, err := ctrl.reclamoService.GetByID(c.Request.Context(), key.TenantID, reclamoID)
	if err != nil || reclamo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
		return
	}
	if !strings.EqualFold(reclamo.Email, email) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email no coincide"})
		return
	}

	mensajes, err := ctrl.mensajeService.GetByReclamo(c.Request.Context(), key.TenantID, reclamoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener mensajes"})
		return
	}

	// Formatear mensajes para el widget
	var result []gin.H
	for _, m := range mensajes {
		result = append(result, gin.H{
			"id":    m.ID,
			"tipo":  m.TipoMensaje,
			"texto": m.MensajeTexto,
			"fecha": m.FechaMensaje,
			"leido": m.Leido,
		})
	}
	if result == nil {
		result = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{"mensajes": result})
}

// WidgetEnviarMensaje POST /api/widget/v1/reclamos/:id/mensajes
// El cliente envía un mensaje desde el widget.
func (ctrl *WidgetController) WidgetEnviarMensaje(c *gin.Context) {
	key, ok := ctrl.resolveAPIKey(c)
	if !ok {
		return
	}

	reclamoID, err := helper.ParseUUID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var req struct {
		Email   string `json:"email" binding:"required"`
		Mensaje string `json:"mensaje" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email y mensaje son obligatorios"})
		return
	}

	// Verificar reclamo + email
	reclamo, err := ctrl.reclamoService.GetByID(c.Request.Context(), key.TenantID, reclamoID)
	if err != nil || reclamo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
		return
	}
	if !strings.EqualFold(reclamo.Email, strings.TrimSpace(req.Email)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email no coincide"})
		return
	}

	// Crear mensaje como CLIENTE
	msg, err := ctrl.mensajeService.CrearPublico(
		c.Request.Context(), key.TenantID, reclamoID,
		strings.TrimSpace(req.Mensaje), "", "",
	)
	if err != nil {
		fmt.Printf("[ERROR Widget Mensaje] %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al enviar mensaje"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"mensaje": gin.H{
			"id":    msg.ID,
			"tipo":  msg.TipoMensaje,
			"texto": msg.MensajeTexto,
			"fecha": msg.FechaMensaje,
		},
	})
}