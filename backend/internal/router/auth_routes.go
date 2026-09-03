package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterAuthRoutes(r *gin.Engine, ctrl *controller.AuthController, authMw, tenantMw gin.HandlerFunc) {
	// Rate limiter: máximo 10 intentos de login por minuto por IP
	limitadorLogin := middleware.LimitadorIP(middleware.LimitadorIPConfig{
		MaxPorMinuto: 10,
		Mensaje:      "Demasiados intentos de inicio de sesión. Espera un momento antes de reintentar.",
	})

	// Login NO necesita tenant middleware (el tenant se resuelve por email)
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/login", limitadorLogin, ctrl.Login)
		auth.POST("/seleccionar-tenant", limitadorLogin, ctrl.SeleccionarEmpresa)
	}

	authProtected := r.Group("/api/v1/auth")
	authProtected.Use(authMw, tenantMw)
	{
		authProtected.POST("/logout", ctrl.Logout)
		authProtected.POST("/verify-password", ctrl.VerifyPassword)
		authProtected.POST("/cambiar-empresa", ctrl.CambiarEmpresa)
	}
}
