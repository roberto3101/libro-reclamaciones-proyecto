package router

import (
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/ai"
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, cfg *config.Config, db *sql.DB, concentradorWS *ws.ConcentradorConexiones) {
	// --- Repos ---
	planRepo := repo.NewPlanRepo(db)
	suscripcionRepo := repo.NewSuscripcionRepo(db)
	pagoRepo := repo.NewPagoRepo(db)
	tenantRepo := repo.NewTenantRepo(db)
	sedeRepo := repo.NewSedeRepo(db)
	usuarioRepo := repo.NewUsuarioRepo(db)
	reclamoRepo := repo.NewReclamoRepo(db)
	respuestaRepo := repo.NewRespuestaRepo(db)
	historialRepo := repo.NewHistorialRepo(db)
	mensajeRepo := repo.NewMensajeRepo(db)
	sesionRepo := repo.NewSesionRepo(db)
	dashboardRepo := repo.NewDashboardRepo(db)
	chatbotRepo := repo.NewChatbotRepo(db)
	apiKeyRepo := repo.NewChatbotAPIKeyRepo(db)
	logRepo := repo.NewChatbotLogRepo(db)
	canalWARepo := repo.NewCanalWhatsAppRepo(db)
	solicitudAsesorRepo := repo.NewSolicitudAsesorRepo(db)
	mensajeAtencionRepo := repo.NewMensajeAtencionRepo(db)
	rolRepo := repo.NewRolRepo(db)
	usuarioSedeRepo := repo.NewUsuarioSedeRepo(db)
	cuentaRepo := repo.NewCuentaRepo(db)
	plantillaEmailRepo := repo.NewPlantillaEmailRepo(db)
	notificacionRepo := repo.NewNotificacionRepo(db)
	configNotifRepo := repo.NewConfiguracionNotificacionRepo(db)
	auditRepo := repo.NewAuditoriaRepo(db) // auditoria_admin: registra acciones de usuarios del tenant

	// --- Services ---
	notifService := service.NewNotificacionService(cfg.SMTP, cfg.App, plantillaEmailRepo)
	notifTiempoRealService := service.NewNotificacionTiempoRealService(notificacionRepo, configNotifRepo, concentradorWS)

	planService := service.NewPlanService(planRepo)
	suscripcionService := service.NewSuscripcionService(suscripcionRepo, planRepo)
	culqiClient := service.NewCulqiClient(cfg.Culqi)
	mpClient := service.NewMercadoPagoClient(cfg.MP)
	pagoService := service.NewPagoService(culqiClient, mpClient, pagoRepo, planService, suscripcionService)
	tenantService := service.NewTenantService(tenantRepo)
	sedeService := service.NewSedeService(sedeRepo, dashboardRepo)
	usuarioService := service.NewUsuarioService(usuarioRepo, usuarioSedeRepo, dashboardRepo, tenantRepo, rolRepo)
	authService := service.NewAuthService(usuarioRepo, sesionRepo, tenantRepo, usuarioSedeRepo, cfg.JWT)
	reclamoService := service.NewReclamoService(reclamoRepo, historialRepo, tenantRepo, sedeRepo, dashboardRepo, notifService)
	respuestaService := service.NewRespuestaService(respuestaRepo, reclamoRepo, historialRepo, notifService, tenantRepo)
	mensajeService := service.NewMensajeService(mensajeRepo, reclamoRepo, tenantRepo, notifService)
	chatbotService := service.NewChatbotService(chatbotRepo, apiKeyRepo, dashboardRepo, cfg.APIKey.Prefix)
	mensajeAtencionService := service.NewMensajeAtencionService(mensajeAtencionRepo, solicitudAsesorRepo, canalWARepo)
	solicitudAsesorService := service.NewSolicitudAsesorService(solicitudAsesorRepo, mensajeAtencionService, canalWARepo, usuarioRepo)
	rolService := service.NewRolService(rolRepo, usuarioRepo)
	plantillaEmailService := service.NewPlantillaEmailService(plantillaEmailRepo)

	// --- Controllers ---
	planCtrl := controller.NewPlanController(planService)
	limitesRepo := repo.NewLimitesRepo(db)
	limitesService := service.NewLimitesService(limitesRepo, cfg.Server.Env)
	suscripcionCtrl := controller.NewSuscripcionController(suscripcionService, limitesService, auditRepo)
	pagoCtrl := controller.NewPagoController(pagoService, culqiClient)
	tenantCtrl := controller.NewTenantController(tenantService, auditRepo)
	sedeCtrl := controller.NewSedeController(sedeService)
	usuarioCtrl := controller.NewUsuarioController(usuarioService, auditRepo, rolRepo)
	authCtrl := controller.NewAuthController(authService, auditRepo)
	reclamoCtrl := controller.NewReclamoController(reclamoService, auditRepo)
	exportarPDFServicio := service.NuevoExportarPDFServicio()
	exportarExcelServicio := service.NuevoExportarExcelServicio()
	exportarCtrl := controller.NuevoExportarControlador(reclamoService, tenantService, exportarPDFServicio, exportarExcelServicio, auditRepo)

	respuestaCtrl := controller.NewRespuestaController(respuestaService, auditRepo)
	mensajeCtrl := controller.NewMensajeController(mensajeService)
	publicCtrl := controller.NewPublicController(reclamoService, tenantService, sedeService, mensajeService, respuestaService, cfg.Turnstile.SecretKey, cfg.Turnstile.Enabled)
	dashboardCtrl := controller.NewDashboardController(dashboardRepo)
	chatbotCtrl := controller.NewChatbotController(chatbotService, cfg.AI, auditRepo)
	botAPICtrl := controller.NewBotAPIController(reclamoService, respuestaService, mensajeService, logRepo)
	solicitudAsesorCtrl := controller.NewSolicitudAsesorController(solicitudAsesorService)
	mensajeAtencionCtrl := controller.NewMensajeAtencionController(mensajeAtencionService)
	rolCtrl := controller.NewRolController(rolService)
	plantillaEmailCtrl := controller.NewPlantillaEmailController(plantillaEmailService)
	notifCtrl := controller.NewNotificacionController(notificacionRepo, configNotifRepo)
	contactoCtrl := controller.NewContactoController(cfg.SMTP, cfg.App)

	reclamoService.SetNotificacionTiempoReal(notifTiempoRealService)
	respuestaService.SetNotificacionTiempoReal(notifTiempoRealService)
	mensajeService.SetNotificacionTiempoReal(notifTiempoRealService)
	solicitudAsesorService.SetNotificacionTiempoReal(notifTiempoRealService)
	mensajeAtencionService.SetNotificacionTiempoReal(notifTiempoRealService)

	onboardingService := service.NewOnboardingService(db, planRepo, tenantRepo, sedeRepo, usuarioRepo, suscripcionRepo, rolRepo)
	_ = controller.NewOnboardingController(onboardingService) // onboarding público eliminado, SA usa el servicio internamente

	// --- SuperAdmin ---
	saRepo := repo.NewSuperAdminRepo(db)
	auditSARepo := repo.NewAuditoriaSARepo(db)
	errorLogRepo := repo.NewErrorLogRepo(db)
	alertaRepo := repo.NuevoErrorAlertaRepo(db)
	metricasAPIRepo := repo.NuevoAPIMetricasRepo(db)
	cuentaNotasRepo := repo.NuevoCuentaNotasRepo(db)

	evaluadorAlertas := repo.NuevoEvaluadorAlertas(alertaRepo, concentradorWS)
	middleware.SetEvaluadorAlertas(evaluadorAlertas)

	saSvc := service.NewSuperAdminService(saRepo, cuentaRepo, tenantRepo, planRepo, sedeRepo, usuarioRepo, reclamoRepo, usuarioSedeRepo, auditSARepo, errorLogRepo, alertaRepo, metricasAPIRepo, cuentaNotasRepo, onboardingService, db, cfg.JWT)
	saCtrl := controller.NewSuperAdminController(saSvc, usuarioService)
	saAuthMw := middleware.SuperAdminAuthMiddleware(cfg.JWT)

	// --- Middleware global: error logger + métricas de rendimiento ---
	r.Use(middleware.ErrorLoggerMiddleware(db, concentradorWS))
	r.Use(middleware.MetricasRendimientoMiddleware(db))

	// --- Middlewares ---
	authMw := middleware.AuthMiddleware(cfg.JWT)
	tenantMwBase := middleware.TenantMiddleware(db)
	sedesMw := middleware.SedesMiddleware(usuarioSedeRepo)
	// tenantMw combina TenantMiddleware + SedesMiddleware para no tocar cada archivo de rutas
	tenantMw := func(c *gin.Context) {
		tenantMwBase(c)
		if !c.IsAborted() {
			sedesMw(c)
		}
	}
	permisoMw := middleware.PermisoMiddleware(db)
	adminMw := middleware.RoleMiddleware("ADMIN")

	// --- Proxy de almacenamiento (público — lo usa el libro público) ---
	if cfg.Storage.APIURL != "" {
		storageProxy := controller.NewStorageProxyController(cfg.Storage.APIURL, cfg.Storage.APIKey)
		r.Any("/storage-api/*proxyPath", storageProxy.Proxy)
		fmt.Printf("[INFO] Storage proxy activo en /storage-api -> %s\n", cfg.Storage.APIURL)
	}

	// --- Rutas públicas ---
	limitadorConsultaDocumento := middleware.LimitadorConsultaPublicaPorIP(30)
	RegisterPublicRoutes(r, publicCtrl, limitadorConsultaDocumento)
	// Onboarding público ELIMINADO — solo el SA crea empresas bajo cuentas
	// RegisterOnboardingRoutes(r, onboardingCtrl)

	// --- Rutas SuperAdmin (JWT de SA, sin tenant) ---
	RegisterSuperAdminRoutes(r, saCtrl, saAuthMw)

	// --- Rutas admin (JWT + permisos granulares) ---
	RegisterAuthRoutes(r, authCtrl, authMw, tenantMw)
	RegisterPlanRoutes(r, planCtrl, authMw, tenantMw)
	RegisterSuscripcionRoutes(r, suscripcionCtrl, authMw, tenantMw)
	RegisterPagoRoutes(r, pagoCtrl, authMw, tenantMw)
	RegisterPagoWebhookRoutes(r, pagoCtrl)
	RegisterTenantRoutes(r, tenantCtrl, authMw, tenantMw, permisoMw)
	RegisterSedeRoutes(r, sedeCtrl, authMw, tenantMw, permisoMw)
	RegisterUsuarioRoutes(r, usuarioCtrl, authMw, tenantMw, permisoMw)
	RegistrarRutasExportacion(r, exportarCtrl, authMw, tenantMw, permisoMw)
	RegisterReclamoRoutes(r, reclamoCtrl, authMw, tenantMw, permisoMw)
	RegisterRespuestaRoutes(r, respuestaCtrl, authMw, tenantMw, permisoMw)
	RegisterMensajeRoutes(r, mensajeCtrl, authMw, tenantMw, permisoMw)
	RegisterDashboardRoutes(r, dashboardCtrl, authMw, tenantMw, permisoMw)
	RegisterChatbotRoutes(r, chatbotCtrl, authMw, tenantMw, permisoMw)
	RegisterPlanAdminRoutes(r, planCtrl, authMw, tenantMw, adminMw)
	RegisterPagoAdminRoutes(r, pagoCtrl, authMw, tenantMw, adminMw)
	RegisterSolicitudAsesorRoutes(r, solicitudAsesorCtrl, mensajeAtencionCtrl, authMw, tenantMw, permisoMw)
	RegistrarRutasRoles(r, rolCtrl, authMw, tenantMw, permisoMw)
	RegistrarRutasPlantillasEmail(r, plantillaEmailCtrl, authMw, tenantMw, permisoMw)
	RegistrarRutasNotificaciones(r, notifCtrl, authMw, tenantMw, permisoMw)
	RegisterContactoRoutes(r, contactoCtrl, authMw, tenantMw)

	// --- API externa para chatbots (API Key) ---
	RegisterBotAPIRoutes(r, botAPICtrl, apiKeyRepo, chatbotRepo, logRepo, cfg.RateLimit)

	// --- Proveedor de IA (compartido entre asistente interno y WhatsApp) ---
	var aiProvider ai.Provider
	primaryCfg := ai.GatewayConfig{
		Provider: cfg.AI.Provider,
		APIKey:   cfg.AI.APIKey,
		Model:    cfg.AI.Model,
		BaseURL:  cfg.AI.BaseURL,
	}
	var fallbackCfg *ai.GatewayConfig
	if cfg.AI.FallbackProvider != "" {
		fallbackCfg = &ai.GatewayConfig{
			Provider: cfg.AI.FallbackProvider,
			APIKey:   cfg.AI.FallbackAPIKey,
			Model:    cfg.AI.FallbackModel,
			BaseURL:  cfg.AI.FallbackBaseURL,
		}
	}
	if cfg.AI.Provider != "" {
		// Convertir extras de config a ai.GatewayConfig para la cadena de fallback
		var extraCfgs []ai.GatewayConfig
		for _, ep := range cfg.AI.ExtraProviders {
			extraCfgs = append(extraCfgs, ai.GatewayConfig{
				Provider: ep.Provider,
				APIKey:   ep.APIKey,
				Model:    ep.Model,
				BaseURL:  ep.BaseURL,
			})
		}

		var err error
		aiProvider, err = ai.NewProviderWithFallback(primaryCfg, fallbackCfg, extraCfgs)
		if err != nil {
			fmt.Printf("[WARN] Proveedor IA no disponible: %v\n", err)
		}
	}

	// --- WhatsApp: Webhook + Config Admin ---
	if cfg.WhatsApp.Enabled {
		whatsappService := service.NewWhatsAppService(
			reclamoService,
			solicitudAsesorService,
			mensajeAtencionService,
			tenantRepo,
			canalWARepo,
			chatbotRepo,
			aiProvider,
		)

		whatsappCtrl := controller.NewWhatsAppController(cfg.WhatsApp, whatsappService)
		RegistrarRutasWebhookWhatsApp(r, whatsappCtrl)

		// ← CAMBIO: ahora recibe limitesService para validar límite de canales
		whatsappConfigCtrl := controller.NewWhatsAppConfigController(canalWARepo, chatbotRepo, limitesService)
		RegisterWhatsAppConfigRoutes(r, whatsappConfigCtrl, authMw, tenantMw, permisoMw)

		iaStatus := "sin IA (respuestas fijas)"
		if aiProvider != nil {
			iaStatus = aiProvider.Name()
		}
		fmt.Printf("[INFO] WhatsApp webhook activo en /webhook/whatsapp (multi-tenant + IA: %s)\n", iaStatus)
		fmt.Println("[INFO] WhatsApp config admin en /api/v1/canales/whatsapp")
	}

	// --- Asistente IA interno (panel admin) ---
	if aiProvider != nil {
		// Mapa de providers individuales para selección manual del usuario
		providerMap := make(map[string]ai.Provider)
		if primarySingle, err := ai.NewProvider(primaryCfg); err == nil {
			providerMap["primary"] = primarySingle
		}
		if fallbackCfg != nil && fallbackCfg.Provider != "" {
			if fbSingle, err := ai.NewProvider(*fallbackCfg); err == nil {
				providerMap["fallback"] = fbSingle
			}
		}
		// Registrar extras en providerMap con su ID
		var extraGwCfgs []ai.ExtraGatewayConfig
		for _, ep := range cfg.AI.ExtraProviders {
			gwCfg := ai.GatewayConfig{
				Provider: ep.Provider,
				APIKey:   ep.APIKey,
				Model:    ep.Model,
				BaseURL:  ep.BaseURL,
			}
			extraGwCfgs = append(extraGwCfgs, ai.ExtraGatewayConfig{ID: ep.ID, GatewayConfig: gwCfg})
			if epSingle, err := ai.NewProvider(gwCfg); err == nil {
				providerMap[ep.ID] = epSingle
			}
		}

		assistantRepo := repo.NewAssistantRepo(db)
		historialAsistenteRepo := repo.NewAsistenteHistorialRepo(db)
		assistantService := service.NewAssistantService(aiProvider, providerMap, assistantRepo, historialAsistenteRepo, tenantRepo)
		assistantService.SetReclamoService(reclamoService)
		assistantService.SetMensajeRepo(mensajeRepo)
		assistantService.SetUsuarioRepo(usuarioRepo)
		assistantCtrl := controller.NewAssistantController(assistantService, primaryCfg, fallbackCfg, extraGwCfgs)
		RegisterAssistantRoutes(r, assistantCtrl, authMw, tenantMw, permisoMw)
		fmt.Printf("[INFO] Asistente IA activo (proveedor: %s)\n", aiProvider.Name())
	} else {
		fmt.Println("[INFO] Asistente IA desactivado (AI_PROVIDER no configurado)")
	}
}
