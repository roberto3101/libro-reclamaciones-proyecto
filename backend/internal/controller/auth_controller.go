package controller

import (
	"net/http"
	"os"
	"strings"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const cookieName = "lr_session"

type AuthController struct {
	authService *service.AuthService
	auditRepo   *repo.AuditoriaRepo
}

func NewAuthController(authService *service.AuthService, auditRepo *repo.AuditoriaRepo) *AuthController {
	return &AuthController{authService: authService, auditRepo: auditRepo}
}

func (ctrl *AuthController) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "email y password son obligatorios")
		return
	}

	resultado, err := ctrl.authService.Login(
		c.Request.Context(),
		req.Email, req.Password,
		helper.GetClientIP(c), c.GetHeader("User-Agent"),
	)
	if err != nil {
		helper.Error(c, err)
		return
	}

	if loginCompleto, ok := resultado.(*service.LoginResult); ok {
		ctrl.establecerCookieSesion(c, loginCompleto.Token, loginCompleto.ExpiresIn)
		ctrl.auditRepo.RegistrarAsync(
			loginCompleto.User.TenantID,
			loginCompleto.User.ID,
			repo.AccionAuditLogin,
			"SESION",
			"",
			map[string]interface{}{"email": loginCompleto.User.Email, "rol": loginCompleto.User.Rol},
			helper.GetClientIP(c),
		)
		helper.Success(c, loginCompleto)
		return
	}

	helper.Success(c, resultado)
}

func (ctrl *AuthController) SeleccionarEmpresa(c *gin.Context) {
	var req dto.SelectTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "tenant_id es obligatorio")
		return
	}

	tokenTemporal := extraerBearerDeHeader(c)
	if tokenTemporal == "" {
		helper.ValidationError(c, "Token temporal requerido en Authorization header")
		return
	}

	resultado, err := ctrl.authService.SeleccionarEmpresa(
		c.Request.Context(),
		tokenTemporal, req.TenantID,
		helper.GetClientIP(c), c.GetHeader("User-Agent"),
	)
	if err != nil {
		helper.Error(c, err)
		return
	}

	ctrl.establecerCookieSesion(c, resultado.Token, resultado.ExpiresIn)
	ctrl.auditRepo.RegistrarAsync(
		resultado.User.TenantID,
		resultado.User.ID,
		repo.AccionAuditLogin,
		"SESION",
		"",
		map[string]interface{}{"email": resultado.User.Email, "tenant_slug": resultado.User.TenantSlug, "via": "seleccionar_empresa"},
		helper.GetClientIP(c),
	)
	helper.Success(c, resultado)
}

func (ctrl *AuthController) CambiarEmpresa(c *gin.Context) {
	var req dto.SwitchTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "tenant_id es obligatorio")
		return
	}

	tenantIDActual, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userIDActual, err := helper.GetUserID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	tenantIDDestino, err := uuid.Parse(req.TenantID)
	if err != nil {
		helper.ValidationError(c, "tenant_id no es un UUID valido")
		return
	}

	resultado, err := ctrl.authService.CambiarEmpresa(
		c.Request.Context(),
		tenantIDActual, userIDActual, tenantIDDestino,
		helper.GetClientIP(c), c.GetHeader("User-Agent"),
	)
	if err != nil {
		helper.Error(c, err)
		return
	}

	ctrl.establecerCookieSesion(c, resultado.Token, resultado.ExpiresIn)
	ctrl.auditRepo.RegistrarAsync(
		resultado.User.TenantID,
		resultado.User.ID,
		repo.AccionAuditLogin,
		"SESION",
		"",
		map[string]interface{}{"email": resultado.User.Email, "tenant_anterior": tenantIDActual.String(), "via": "cambiar_empresa"},
		helper.GetClientIP(c),
	)
	helper.Success(c, resultado)
}

func (ctrl *AuthController) VerifyPassword(c *gin.Context) {
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "La contrasena es obligatoria")
		return
	}

	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, err := helper.GetUserID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	if err := ctrl.authService.VerifyPassword(c.Request.Context(), tenantID, userID, req.Password); err != nil {
		helper.Error(c, err)
		return
	}

	helper.Success(c, map[string]bool{"verified": true})
}

func (ctrl *AuthController) Logout(c *gin.Context) {
	token := extractToken(c)
	if token != "" {
		tokenHash := helper.SHA256Hash(token)
		_ = ctrl.authService.Logout(c.Request.Context(), tokenHash)
	}

	// El logout puede llegar sin haber pasado por AuthMiddleware (el cliente
	// ya borró su sesión local). Solo audita si el contexto está poblado.
	if tID, err := helper.GetTenantID(c); err == nil {
		if uID, err2 := helper.GetUserID(c); err2 == nil {
			// Usa el helper enriquecido sobre USUARIO para que el detalle traiga
			// email/nombre del usuario que cerró sesión.
			ctrl.auditRepo.RegistrarAccionUsuario(
				tID, uID, uID,
				repo.AccionAuditLogout,
				nil,
				helper.GetClientIP(c),
			)
		}
	}

	c.SetCookie(cookieName, "", -1, "/", "", false, true)
	helper.NoContent(c)
}

func (ctrl *AuthController) establecerCookieSesion(c *gin.Context, token string, maxAge int) {
	secure := os.Getenv("SERVER_ENV") == "production"
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	c.SetSameSite(sameSite)
	c.SetCookie(cookieName, token, maxAge, "/", "", secure, true)
}

func extraerBearerDeHeader(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if header != "" {
		parts := strings.SplitN(header, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return strings.TrimSpace(parts[1])
		}
	}
	return ""
}

func extractToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if len(header) > 7 && header[:7] == "Bearer " {
		return header[7:]
	}
	if cookie, err := c.Cookie(cookieName); err == nil && cookie != "" {
		return cookie
	}
	return ""
}
