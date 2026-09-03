package controller

import (
	"database/sql"
	"fmt"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var (
	reDigitos11  = regexp.MustCompile(`^\d{11}$`)
	reEmail      = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$`)
	reURL        = regexp.MustCompile(`^https?://[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(/.*)?$`)
	reTelefono   = regexp.MustCompile(`^[+\d\s\-()]+$`)
	reNombreCom  = regexp.MustCompile(`^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.\-&]+$`)
	reLetrasEsp  = regexp.MustCompile(`^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$`)
)

type TenantController struct {
	tenantService *service.TenantService
	auditRepo     *repo.AuditoriaRepo
}

func NewTenantController(tenantService *service.TenantService, auditRepo *repo.AuditoriaRepo) *TenantController {
	return &TenantController{tenantService: tenantService, auditRepo: auditRepo}
}

// Get GET /api/v1/tenant
func (ctrl *TenantController) Get(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	tenant, err := ctrl.tenantService.GetByTenantID(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, tenant)
}

// updateTenantRequest define la estructura JSON esperada del frontend
type updateTenantRequest struct {
	RazonSocial         string `json:"razon_social" binding:"required"`
	RUC                 string `json:"ruc" binding:"required"`
	NombreComercial     string `json:"nombre_comercial"`
	DireccionLegal      string `json:"direccion_legal"`
	Departamento        string `json:"departamento"`
	Provincia           string `json:"provincia"`
	Distrito            string `json:"distrito"`
	Telefono            string `json:"telefono"`
	EmailContacto       string `json:"email_contacto"`
	SitioWeb            string `json:"sitio_web"`
	ColorPrimario       string `json:"color_primario"`
	PlazoRespuestaDias  int    `json:"plazo_respuesta_dias"`
	NotificarWhatsapp        bool   `json:"notificar_whatsapp"`
	NotificarEmail           bool   `json:"notificar_email"`
	NotificarEmailEstado     bool   `json:"notificar_email_estado"`
	NotificarEmailMensaje    bool   `json:"notificar_email_mensaje"`
	NotificarEmailResolucion bool   `json:"notificar_email_resolucion"`
	LogoURL                  string `json:"logo_url"`
	MensajeConfirmacion      string `json:"mensaje_confirmacion"`
	FirmaRepresentante       string `json:"firma_representante"`
	TemaPorDefecto           string `json:"tema_por_defecto"`
	Version                  int    `json:"version" binding:"required"`
}

// Update PUT /api/v1/tenant
func (ctrl *TenantController) Update(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var req updateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "razon_social, ruc y version son obligatorios")
		return
	}

	// Validaciones de campo
	req.RazonSocial = strings.TrimSpace(req.RazonSocial)
	req.RUC = strings.TrimSpace(req.RUC)
	req.NombreComercial = strings.TrimSpace(req.NombreComercial)
	req.EmailContacto = strings.TrimSpace(req.EmailContacto)
	req.SitioWeb = strings.TrimSpace(req.SitioWeb)
	req.Telefono = strings.TrimSpace(req.Telefono)
	req.DireccionLegal = strings.TrimSpace(req.DireccionLegal)
	req.Departamento = strings.TrimSpace(req.Departamento)
	req.Provincia = strings.TrimSpace(req.Provincia)
	req.Distrito = strings.TrimSpace(req.Distrito)
	req.MensajeConfirmacion = strings.TrimSpace(req.MensajeConfirmacion)

	if len(req.RazonSocial) > 200 {
		helper.ValidationError(c, "La razón social no puede exceder 200 caracteres")
		return
	}
	if !reDigitos11.MatchString(req.RUC) {
		helper.ValidationError(c, "El RUC debe tener exactamente 11 dígitos")
		return
	}
	if req.NombreComercial != "" {
		if len(req.NombreComercial) > 100 {
			helper.ValidationError(c, "El nombre comercial no puede exceder 100 caracteres")
			return
		}
		if !reNombreCom.MatchString(req.NombreComercial) {
			helper.ValidationError(c, "El nombre comercial solo admite letras, números y espacios")
			return
		}
	}
	if req.EmailContacto != "" {
		if len(req.EmailContacto) > 150 || !reEmail.MatchString(req.EmailContacto) {
			helper.ValidationError(c, "Formato de email inválido")
			return
		}
	}
	if req.SitioWeb != "" {
		if len(req.SitioWeb) > 255 || !reURL.MatchString(req.SitioWeb) {
			helper.ValidationError(c, "El sitio web debe iniciar con http:// o https://")
			return
		}
	}
	if req.Telefono != "" {
		if len(req.Telefono) > 20 || !reTelefono.MatchString(req.Telefono) {
			helper.ValidationError(c, "Formato de teléfono inválido")
			return
		}
	}
	if len(req.DireccionLegal) > 300 {
		helper.ValidationError(c, "La dirección legal no puede exceder 300 caracteres")
		return
	}
	for _, pair := range [][2]string{
		{req.Departamento, "departamento"}, {req.Provincia, "provincia"}, {req.Distrito, "distrito"},
	} {
		if pair[0] != "" && (len(pair[0]) > 100 || !reLetrasEsp.MatchString(pair[0])) {
			helper.ValidationError(c, fmt.Sprintf("El campo %s solo admite letras y espacios (máx. 100)", pair[1]))
			return
		}
	}
	if len(req.MensajeConfirmacion) > 500 {
		helper.ValidationError(c, "El mensaje de confirmación no puede exceder 500 caracteres")
		return
	}
	if req.PlazoRespuestaDias < 1 || req.PlazoRespuestaDias > 90 {
		req.PlazoRespuestaDias = 15 // Default INDECOPI: 15 días hábiles
	}

	// Validar logo obligatorio y formato seguro
	if req.LogoURL == "" {
		helper.ValidationError(c, "El logo de la empresa es obligatorio")
		return
	}
	if !strings.HasPrefix(req.LogoURL, "data:image/jpeg;base64,") &&
		!strings.HasPrefix(req.LogoURL, "data:image/png;base64,") &&
		!strings.HasPrefix(req.LogoURL, "data:image/webp;base64,") {
		helper.ValidationError(c, "El logo debe ser una imagen válida (JPEG, PNG o WEBP)")
		return
	}
	if len(req.LogoURL) > 500_000 {
		helper.ValidationError(c, "El logo es demasiado grande. Máximo 500KB")
		return
	}

	// Validar firma si se proporciona
	if req.FirmaRepresentante != "" {
		if !strings.HasPrefix(req.FirmaRepresentante, "data:image/png;base64,") {
			helper.ValidationError(c, "La firma debe ser una imagen PNG en formato base64")
			return
		}
		if len(req.FirmaRepresentante) > 200_000 {
			helper.ValidationError(c, "La firma es demasiado grande. Maximo 200KB")
			return
		}
	}

	// Validar tema por defecto
	if req.TemaPorDefecto == "" {
		req.TemaPorDefecto = "light"
	}
	if req.TemaPorDefecto != "light" && req.TemaPorDefecto != "dark" {
		helper.ValidationError(c, "tema_por_defecto debe ser 'light' o 'dark'")
		return
	}

	tenant := &model.Tenant{
		TenantModel:        model.TenantModel{TenantID: tenantID},
		RazonSocial:        req.RazonSocial,
		RUC:                req.RUC,
		NombreComercial:    model.NullString{NullString: sql.NullString{String: req.NombreComercial, Valid: req.NombreComercial != ""}},
		DireccionLegal:     model.NullString{NullString: sql.NullString{String: req.DireccionLegal, Valid: req.DireccionLegal != ""}},
		Departamento:       model.NullString{NullString: sql.NullString{String: req.Departamento, Valid: req.Departamento != ""}},
		Provincia:          model.NullString{NullString: sql.NullString{String: req.Provincia, Valid: req.Provincia != ""}},
		Distrito:           model.NullString{NullString: sql.NullString{String: req.Distrito, Valid: req.Distrito != ""}},
		Telefono:           model.NullString{NullString: sql.NullString{String: req.Telefono, Valid: req.Telefono != ""}},
		EmailContacto:      model.NullString{NullString: sql.NullString{String: req.EmailContacto, Valid: req.EmailContacto != ""}},
		SitioWeb:           model.NullString{NullString: sql.NullString{String: req.SitioWeb, Valid: req.SitioWeb != ""}},
		LogoURL:            model.NullString{NullString: sql.NullString{String: req.LogoURL, Valid: req.LogoURL != ""}},
		ColorPrimario:      req.ColorPrimario,
		PlazoRespuestaDias: req.PlazoRespuestaDias,
		MensajeConfirmacion:  model.NullString{NullString: sql.NullString{String: req.MensajeConfirmacion, Valid: req.MensajeConfirmacion != ""}},
		FirmaRepresentante:  model.NullString{NullString: sql.NullString{String: req.FirmaRepresentante, Valid: req.FirmaRepresentante != ""}},
		TemaPorDefecto:      req.TemaPorDefecto,
		NotificarWhatsapp:        req.NotificarWhatsapp,
		NotificarEmail:           req.NotificarEmail,
		NotificarEmailEstado:     req.NotificarEmailEstado,
		NotificarEmailMensaje:    req.NotificarEmailMensaje,
		NotificarEmailResolucion: req.NotificarEmailResolucion,
		Version:                  req.Version,
	}

	if err := ctrl.tenantService.Update(c.Request.Context(), tenant); err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)
	ctrl.auditRepo.RegistrarAsync(
		tenantID, userID,
		repo.AccionAuditConfigurar,
		"CONFIG",
		tenantID.String(),
		map[string]interface{}{
			"razon_social":         req.RazonSocial,
			"ruc":                  req.RUC,
			"nombre_comercial":     req.NombreComercial,
			"email_contacto":       req.EmailContacto,
			"telefono":             req.Telefono,
			"plazo_respuesta_dias": req.PlazoRespuestaDias,
			"tema_por_defecto":     req.TemaPorDefecto,
			"version":              req.Version,
		},
		helper.GetClientIP(c),
	)
	helper.Success(c, gin.H{"message": "Configuración actualizada"})
}