package controller

import (
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
)

type OnboardingController struct {
	onboardingService *service.OnboardingService
}

func NewOnboardingController(onboardingService *service.OnboardingService) *OnboardingController {
	return &OnboardingController{onboardingService: onboardingService}
}

// Registrar — POST /api/v1/onboarding
// Crea un tenant completo: config + sede + usuario admin + suscripción trial.
// Ruta pública (sin JWT ni tenant middleware).
func (ctrl *OnboardingController) Registrar(c *gin.Context) {
	var req service.OnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "Datos incompletos. Se requiere: razon_social, ruc, email, password, nombre_admin")
		return
	}

	resultado, err := ctrl.onboardingService.Registrar(c.Request.Context(), req)
	if err != nil {
		helper.Error(c, err)
		return
	}

	helper.Created(c, resultado)
}