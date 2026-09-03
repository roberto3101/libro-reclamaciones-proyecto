package router

import (
	"libro-reclamaciones/internal/controller"
	"libro-reclamaciones/internal/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterSuperAdminRoutes(r *gin.Engine, ctrl *controller.SuperAdminController, saAuthMw gin.HandlerFunc) {
	// Rate limiter: máximo 5 intentos por minuto por IP (más estricto que login normal)
	limitadorSALogin := middleware.LimitadorIP(middleware.LimitadorIPConfig{
		MaxPorMinuto: 5,
		Mensaje:      "Demasiados intentos. Espera antes de reintentar.",
	})

	// ── Rutas públicas (login/logout) ──
	saPublic := r.Group("/api/v1/superadmin/auth")
	{
		saPublic.POST("/login", limitadorSALogin, ctrl.Login)
		saPublic.POST("/logout", ctrl.Logout)
	}

	// ── Endpoint público para reportar errores del frontend (no requiere auth SA) ──
	r.POST("/api/v1/error-report", ctrl.ReportarErrorFrontend)

	// ── Rutas protegidas (requieren JWT de SuperAdmin) ──
	sa := r.Group("/api/v1/superadmin")
	sa.Use(saAuthMw)
	{
		// Dashboard
		sa.GET("/estadisticas", ctrl.GetEstadisticas)

		// Cuentas (clientes)
		sa.GET("/cuentas", ctrl.ListarCuentas)
		sa.POST("/cuentas", ctrl.CrearCuenta)
		sa.GET("/cuentas/:id", ctrl.ObtenerCuenta)
		sa.PUT("/cuentas/:id", ctrl.ActualizarCuenta)
		sa.PATCH("/cuentas/:id/estado", ctrl.CambiarEstadoCuenta)
		sa.POST("/cuentas/:id/empresas", ctrl.CrearEmpresaBajoCuenta)
		sa.GET("/cuentas/:id/notas", ctrl.ListarNotasCuenta)
		sa.POST("/cuentas/:id/notas", ctrl.CrearNotaCuenta)
		sa.GET("/cuentas/:id/facturacion", ctrl.ObtenerFacturacionCuenta)
		sa.GET("/cuentas/:id/health-score", ctrl.ObtenerHealthScore)

		// Empresas (tenants)
		sa.GET("/empresas", ctrl.ListarEmpresas)
		sa.GET("/empresas/:id", ctrl.ObtenerEmpresa)
		sa.GET("/empresas/:id/sedes", ctrl.ObtenerSedesDeEmpresa)
		sa.GET("/empresas/:id/usuarios", ctrl.ObtenerUsuariosDeEmpresa)
		sa.GET("/empresas/:id/reclamos", ctrl.ObtenerReclamosDeEmpresa)
		sa.PATCH("/empresas/:id/estado", ctrl.CambiarEstadoEmpresa)
		sa.PATCH("/empresas/:id/sedes/:sedeId/estado", ctrl.ActivarDesactivarSede)
		sa.PATCH("/empresas/:id/plan", ctrl.CambiarPlanEmpresa)
		sa.PATCH("/empresas/:id/usuarios/:userId/estado", ctrl.ActivarDesactivarUsuario)
		sa.PUT("/empresas/:id/usuarios/:userId", ctrl.EditarUsuarioDeEmpresa)
		sa.POST("/empresas/:id/usuarios/:userId/resetear-password", ctrl.ResetearPasswordUsuario)
		// Agregar usuario existente: busca por email en la cuenta y vincula al tenant
		sa.GET("/empresas/:id/usuarios/buscar-en-cuenta", ctrl.BuscarUsuarioEnCuentaDeEmpresa)
		sa.GET("/empresas/:id/usuarios/candidatos-cuenta", ctrl.ListarCandidatosAgregarAEmpresa)
		sa.POST("/empresas/:id/usuarios/agregar-existente", ctrl.AgregarUsuarioExistenteAEmpresa)

		// Impersonar empresa
		sa.POST("/empresas/:id/impersonar", ctrl.Impersonar)
		sa.GET("/empresas/:id/suscripcion", ctrl.ObtenerSuscripcionEmpresa)

		// Planes
		sa.GET("/planes", ctrl.ListarPlanes)
		sa.GET("/planes/:planId", ctrl.ObtenerPlan)
		sa.POST("/planes", ctrl.CrearPlan)
		sa.PUT("/planes/:planId", ctrl.ActualizarPlan)

		// Staff (otros SuperAdmins)
		sa.GET("/staff", ctrl.ListarStaff)
		sa.POST("/staff", ctrl.CrearStaff)

		// Búsqueda global
		sa.GET("/buscar", ctrl.BuscarGlobal)

		// Revenue metrics
		sa.GET("/revenue", ctrl.GetRevenueMetrics)

		// Auditoría
		sa.GET("/auditoria", ctrl.ListarAuditoria)
		sa.GET("/actividad-empresas", ctrl.ListarActividadEmpresas)
		sa.GET("/actividad-empresas/export", ctrl.ExportarActividadEmpresas)

		// Error log
		sa.GET("/errores", ctrl.ListarErrores)
		sa.GET("/errores/resumen", ctrl.ResumenErrores)
		sa.GET("/errores/agrupados", ctrl.ListarErroresAgrupados)
		sa.GET("/errores/timeline", ctrl.ObtenerTimelineErrores)

		// Alertas de errores
		sa.GET("/alertas", ctrl.ListarAlertasErrores)
		sa.PATCH("/alertas/:id/visto", ctrl.MarcarAlertaComoVista)
		sa.PATCH("/alertas/marcar-todas", ctrl.MarcarTodasAlertasComoVistas)
		sa.GET("/alertas/count", ctrl.ContarAlertasSinVer)

		// Rendimiento API
		sa.GET("/metricas/rendimiento", ctrl.ObtenerRendimientoAPI)
	}
}
