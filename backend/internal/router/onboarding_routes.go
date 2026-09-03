package router

import (
	"libro-reclamaciones/internal/controller"

	"github.com/gin-gonic/gin"
)

// RegisterOnboardingRoutes ruta pública de registro de tenants.
// POST /api/v1/onboarding → Crear tenant completo (config + sede + usuario + suscripción)
func RegisterOnboardingRoutes(r *gin.Engine, ctrl *controller.OnboardingController) {
	r.POST("/api/v1/onboarding", ctrl.Registrar)
}