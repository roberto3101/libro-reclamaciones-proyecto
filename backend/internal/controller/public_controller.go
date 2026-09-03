package controller

import (
    "log"
    "regexp"

    "libro-reclamaciones/internal/apperror"
    "libro-reclamaciones/internal/helper"
    "libro-reclamaciones/internal/model"
    "libro-reclamaciones/internal/model/dto"
    "libro-reclamaciones/internal/service"

    "github.com/gin-gonic/gin"
)

var regexDocumentoSoloAlfanumerico = regexp.MustCompile(`^[a-zA-Z0-9]+$`)

type PublicController struct {
    reclamoService   *service.ReclamoService
    tenantService    *service.TenantService
    sedeService      *service.SedeService
    mensajeService   *service.MensajeService
    respuestaService *service.RespuestaService
    turnstileSecret  string
    turnstileEnabled bool
}

func NewPublicController(
    reclamoService *service.ReclamoService,
    tenantService *service.TenantService,
    sedeService *service.SedeService,
    mensajeService *service.MensajeService,
    respuestaService *service.RespuestaService,
    turnstileSecret string,
    turnstileEnabled bool,
) *PublicController {
    return &PublicController{
        reclamoService:   reclamoService,
        tenantService:    tenantService,
        sedeService:      sedeService,
        mensajeService:   mensajeService,
        respuestaService: respuestaService,
        turnstileSecret:  turnstileSecret,
        turnstileEnabled: turnstileEnabled,
    }
}

// GetTenant GET /libro/:slug/tenant
func (ctrl *PublicController) GetTenant(c *gin.Context) {
	slug := c.Param("slug")
	tenant, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
	if err != nil {
		helper.Error(c, err)
		return
	}

	response := dto.TenantPublicResponse{
		RazonSocial:     tenant.RazonSocial,
		RUC:             tenant.RUC,
		NombreComercial: tenant.NombreComercial.String,
		DireccionLegal:  tenant.DireccionLegal.String,
		LogoURL:         tenant.LogoURL.String,
		ColorPrimario:   tenant.ColorPrimario,
		Slug:            tenant.Slug,
	}

	helper.Success(c, response)
}

// GetSedes GET /libro/:slug/sedes
func (ctrl *PublicController) GetSedes(c *gin.Context) {
	slug := c.Param("slug")
	
	tenant, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
	if err != nil {
		helper.Error(c, err)
		return
	}

	sedes, err := ctrl.sedeService.GetByTenant(c.Request.Context(), tenant.TenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}

	// Asegurar que siempre devuelva un array (nunca null)
	if sedes == nil {
		sedes = []model.Sede{}
	}

	helper.Success(c, sedes)
}

// CrearReclamo POST /libro/:slug/reclamos
func (ctrl *PublicController) CrearReclamo(c *gin.Context) {
    slug := c.Param("slug")

    var req dto.CreateReclamoRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        helper.ValidationError(c, "Completa todos los campos obligatorios del formulario")
        return
    }

    // Validar CAPTCHA Turnstile
    if ctrl.turnstileEnabled {
        if err := helper.VerifyTurnstile(ctrl.turnstileSecret, req.TurnstileToken, helper.GetClientIP(c)); err != nil {
            helper.ValidationError(c, "Verificación de seguridad fallida. Intenta de nuevo.")
            return
        }
    }

    reclamo, err := ctrl.reclamoService.CrearPublico(
        c.Request.Context(),
        slug,
        req,
        helper.GetClientIP(c),
        c.GetHeader("User-Agent"),
    )
    if err != nil {
        helper.Error(c, err)
        return
    }

    helper.Created(c, gin.H{
        "codigo_reclamo":         reclamo.CodigoReclamo,
        "fecha_registro":         reclamo.FechaRegistro,
        "fecha_limite_respuesta": reclamo.FechaLimiteRespuesta,
        "mensaje":                "Tu reclamo ha sido registrado exitosamente.",
    })
}

// ConsultarSeguimiento GET /libro/:slug/seguimiento/:codigo
func (ctrl *PublicController) ConsultarSeguimiento(c *gin.Context) {
    slug := c.Param("slug")
    codigo := c.Param("codigo")

    tenant, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
    if err != nil {
        helper.Error(c, err)
        return
    }

    reclamo, err := ctrl.reclamoService.GetByCodigoPublico(c.Request.Context(), tenant.TenantID, codigo)
    if err != nil {
        helper.Error(c, err)
        return
    }
   if reclamo == nil {
		helper.Error(c, apperror.New(404, "NOT_FOUND", "Reclamo no encontrado"))
		return
	}

    // Buscar respuesta oficial
    respuestas, _ := ctrl.respuestaService.GetByReclamo(c.Request.Context(), tenant.TenantID, reclamo.ID)
    var respuestaOficial string
    if len(respuestas) > 0 {
        respuestaOficial = respuestas[len(respuestas)-1].RespuestaEmpresa
    }

    response := dto.ReclamoTrackingResponse{
        CodigoReclamo:        reclamo.CodigoReclamo,
        Estado:               reclamo.Estado,
        FechaRegistro:        reclamo.FechaRegistro,
        FechaLimiteRespuesta: &reclamo.FechaLimiteRespuesta.Time,
        SedeNombre:           &reclamo.SedeNombre.String,
        TipoSolicitud:        reclamo.TipoSolicitud,
        DescripcionBien:      reclamo.DescripcionBien,
        RespuestaEmpresa:     respuestaOficial,
    }
    if reclamo.FechaRespuesta.Valid {
        response.FechaRespuesta = &reclamo.FechaRespuesta.Time
    }

    helper.Success(c, response)
}

// ListarMensajesPublico GET /libro/:slug/seguimiento/:codigo/mensajes
func (ctrl *PublicController) ListarMensajesPublico(c *gin.Context) {
    slug := c.Param("slug")
    codigo := c.Param("codigo")

    tenant, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
    if err != nil {
        helper.Error(c, err)
        return
    }

    reclamo, err := ctrl.reclamoService.GetByCodigoPublico(c.Request.Context(), tenant.TenantID, codigo)
    if err != nil || reclamo == nil {
        helper.Error(c, apperror.ErrNotFound)
        return
    }

    mensajes, err := ctrl.mensajeService.GetByReclamo(c.Request.Context(), tenant.TenantID, reclamo.ID)
    if err != nil {
        helper.Error(c, err)
        return
    }

    helper.Success(c, mensajes)
}

// EnviarMensajePublico POST /libro/:slug/seguimiento/:codigo/mensajes
func (ctrl *PublicController) EnviarMensajePublico(c *gin.Context) {
    slug := c.Param("slug")
    codigo := c.Param("codigo")
    var req dto.PublicMessageRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        helper.ValidationError(c, "Mensaje requerido")
        return
    }

    tenant, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
    if err != nil {
        helper.Error(c, err)
        return
    }

    reclamo, err := ctrl.reclamoService.GetByCodigoPublico(c.Request.Context(), tenant.TenantID, codigo)
    if err != nil || reclamo == nil {
        helper.Error(c, apperror.ErrNotFound)
        return
    }

    msg, err := ctrl.mensajeService.CrearPublico(c.Request.Context(), tenant.TenantID, reclamo.ID, req.Mensaje, req.ArchivoURL, req.ArchivoNombre)
    if err != nil {
        helper.Error(c, err)
        return
    }

    helper.Created(c, msg)
}

// ConsultarDocumentoIdentidad GET /libro/:slug/consulta-documento/:numero
// Proxy al servicio externo PSE Perú para obtener datos de una persona o empresa.
// Valida que el tenant (slug) exista y que el número de documento tenga formato válido.
func (ctrl *PublicController) ConsultarDocumentoIdentidad(c *gin.Context) {
    slug := c.Param("slug")
    numeroDocumento := c.Param("numero")

    // Validar que el tenant existe (protección por slug)
    _, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
    if err != nil {
        helper.Error(c, err)
        return
    }

    // Validar formato: solo alfanuméricos, entre 6 y 11 caracteres
    longitudDocumento := len(numeroDocumento)
    if longitudDocumento < 6 || longitudDocumento > 11 || !regexDocumentoSoloAlfanumerico.MatchString(numeroDocumento) {
        helper.ValidationError(c, "Número de documento inválido. Debe tener entre 6 y 11 caracteres alfanuméricos.")
        return
    }

    datosPSE, err := helper.ConsultarDocumentoEnPSE(numeroDocumento)
    if err != nil {
        helper.Error(c, apperror.New(502, "EXTERNAL_SERVICE_ERROR", "No se pudo consultar el documento. Intenta de nuevo."))
        return
    }

    if datosPSE == nil {
        helper.Error(c, apperror.New(404, "DOCUMENTO_NO_ENCONTRADO", "No se encontraron datos para este documento."))
        return
    }

    respuesta := dto.ConsultaDocumentoResponse{
        NumeroDocumento: datosPSE.RucDni,
        Nombres:         datosPSE.Nombres,
        Apellidos:       datosPSE.Apellidos,
        NombreRazon:     datosPSE.NombreRazon,
        Direccion:       datosPSE.Direccion,
    }

    helper.Success(c, respuesta)
}

// ValidarEmpresaRUC GET /libro/:slug/validar-empresa/:ruc
// Consulta si una empresa esta registrada en el SQL Server externo.
func (ctrl *PublicController) ValidarEmpresaRUC(c *gin.Context) {
    slug := c.Param("slug")
    ruc := c.Param("ruc")

    log.Printf("[SQL Server] ValidarEmpresaRUC - slug=%s ruc=%s", slug, ruc)

    // Validar que el tenant existe
    _, err := ctrl.tenantService.GetBySlug(c.Request.Context(), slug)
    if err != nil {
        log.Printf("[SQL Server] ERROR: tenant no encontrado para slug=%s: %v", slug, err)
        helper.Error(c, err)
        return
    }

    // Validar formato RUC: 11 digitos, empieza con 10 o 20
    if len(ruc) != 11 || !regexDocumentoSoloAlfanumerico.MatchString(ruc) {
        log.Printf("[SQL Server] ERROR: RUC invalido: %s", ruc)
        helper.ValidationError(c, "RUC invalido. Debe tener 11 digitos.")
        return
    }

    log.Printf("[SQL Server] Consultando empresa con RUC %s...", ruc)
    empresa, err := helper.ConsultarEmpresaPorRUC(ruc)
    if err != nil {
        log.Printf("[SQL Server] ERROR consultando empresa: %v", err)
        helper.Error(c, apperror.New(502, "EXTERNAL_SERVICE_ERROR", "Error al consultar empresa. Intente de nuevo."))
        return
    }

    if empresa == nil {
        log.Printf("[SQL Server] Empresa no encontrada para RUC %s", ruc)
        helper.Error(c, apperror.New(404, "EMPRESA_NO_REGISTRADA", "Esta empresa no se encuentra registrada en nuestro sistema."))
        return
    }

    log.Printf("[SQL Server] Empresa encontrada: %s (%s)", empresa.RazonSocial, empresa.NombreComercial)
    helper.Success(c, empresa)
}