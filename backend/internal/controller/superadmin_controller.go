package controller

import (
	"context"
	sqlPkg "database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SuperAdminController struct {
	svc        *service.SuperAdminService
	usuarioSvc *service.UsuarioService
}

func NewSuperAdminController(svc *service.SuperAdminService, usuarioSvc *service.UsuarioService) *SuperAdminController {
	return &SuperAdminController{svc: svc, usuarioSvc: usuarioSvc}
}

// ── Auth ────────────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) Login(c *gin.Context) {
	var req dto.SuperAdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "email y password son obligatorios")
		return
	}

	resultado, err := ctrl.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		helper.Error(c, err)
		return
	}

	// Cookie httpOnly para el SuperAdmin (separada de lr_session)
	secure := os.Getenv("SERVER_ENV") == "production"
	sameSite := http.SameSiteLaxMode
	if secure { sameSite = http.SameSiteNoneMode }
	c.SetSameSite(sameSite)
	c.SetCookie("lr_sa_session", resultado.Token, resultado.ExpiresIn, "/", "", secure, true)

	// Auditoría: el login NO pasa por el middleware (es público), así que no
	// podemos usar ctrl.auditar(c, ...). Llamamos directo al service con el ID
	// que acabamos de obtener del resultado del login.
	ctrl.svc.RegistrarAuditoria(c.Request.Context(), resultado.SA.ID, "LOGIN", "STAFF", resultado.SA.ID.String(),
		map[string]interface{}{"email": resultado.SA.Email, "nombre": resultado.SA.Nombre},
		helper.GetClientIP(c))

	helper.Success(c, resultado)
}

func (ctrl *SuperAdminController) Logout(c *gin.Context) {
	secure := os.Getenv("SERVER_ENV") == "production"
	c.SetCookie("lr_sa_session", "", -1, "/", "", secure, true)
	helper.Success(c, gin.H{"message": "Sesión cerrada"})
}

// auditar es el helper centralizado para registrar acciones del SA. Lee el
// saID del contexto (poblado por SuperAdminAuthMiddleware), serializa los
// detalles a JSON via service y dispara fire-and-forget al repo.
//
// Llamarlo SOLO después de operaciones exitosas, justo antes de helper.Success.
// Si el contexto no tiene saID (caso de Login que es público) usa la otra
// vía: ctrl.svc.RegistrarAuditoria directamente.
func (ctrl *SuperAdminController) auditar(c *gin.Context, accion, entidad, entidadID string, detalles interface{}) {
	saID, err := helper.GetUUIDFromContext(c, helper.CtxSuperAdminID)
	if err != nil {
		return
	}
	ctrl.svc.RegistrarAuditoria(c.Request.Context(), saID, accion, entidad, entidadID, detalles, helper.GetClientIP(c))
}

// saID extrae el SA actor del contexto, o uuid.Nil si no existe.
// Helper interno para los métodos auditar*.
func (ctrl *SuperAdminController) saID(c *gin.Context) uuid.UUID {
	saID, err := helper.GetUUIDFromContext(c, helper.CtxSuperAdminID)
	if err != nil {
		return uuid.Nil
	}
	return saID
}

// Wrappers que delegan al repo de auditoría con enriquecimiento.
// Estos llaman al service que internamente usa el repo. Mantengo la fachada
// del service como punto único de auditoría para no acoplar el controller al
// repo directamente.

func (ctrl *SuperAdminController) auditarCuenta(c *gin.Context, cuentaID uuid.UUID, accion string, extra map[string]interface{}) {
	if id := ctrl.saID(c); id != uuid.Nil {
		ctrl.svc.AuditarAccionCuenta(id, cuentaID, accion, extra, helper.GetClientIP(c))
	}
}

func (ctrl *SuperAdminController) auditarEmpresa(c *gin.Context, tenantID uuid.UUID, accion string, extra map[string]interface{}) {
	if id := ctrl.saID(c); id != uuid.Nil {
		ctrl.svc.AuditarAccionEmpresa(id, tenantID, accion, extra, helper.GetClientIP(c))
	}
}

func (ctrl *SuperAdminController) auditarUsuarioTenant(c *gin.Context, tenantID, userID uuid.UUID, accion string, extra map[string]interface{}) {
	if id := ctrl.saID(c); id != uuid.Nil {
		ctrl.svc.AuditarAccionUsuarioTenant(id, tenantID, userID, accion, extra, helper.GetClientIP(c))
	}
}

func (ctrl *SuperAdminController) auditarPlan(c *gin.Context, planID uuid.UUID, accion string, extra map[string]interface{}) {
	if id := ctrl.saID(c); id != uuid.Nil {
		ctrl.svc.AuditarAccionPlan(id, planID, accion, extra, helper.GetClientIP(c))
	}
}

func (ctrl *SuperAdminController) auditarStaff(c *gin.Context, targetSAID uuid.UUID, accion string, extra map[string]interface{}) {
	if id := ctrl.saID(c); id != uuid.Nil {
		ctrl.svc.AuditarAccionStaff(id, targetSAID, accion, extra, helper.GetClientIP(c))
	}
}

// ── Estadísticas ────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) GetEstadisticas(c *gin.Context) {
	stats, err := ctrl.svc.ObtenerEstadisticas(c.Request.Context())
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, stats)
}

// ── Cuentas ─────────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) ListarCuentas(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "20"))
	busqueda := c.Query("q")

	cuentas, total, err := ctrl.svc.ListarCuentas(c.Request.Context(), offset, limite, busqueda)
	if err != nil {
		helper.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": cuentas, "total": total})
}

func (ctrl *SuperAdminController) ObtenerCuenta(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de cuenta inválido")
		return
	}

	cuenta, err := ctrl.svc.ObtenerCuenta(c.Request.Context(), id)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, cuenta)
}

func (ctrl *SuperAdminController) CrearCuenta(c *gin.Context) {
	var req dto.CrearCuentaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre y email_contacto son obligatorios")
		return
	}

	cuenta, err := ctrl.svc.CrearCuenta(c.Request.Context(), req)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if cuenta != nil {
		ctrl.auditarCuenta(c, cuenta.ID, "CREAR_CUENTA", nil)
	}
	helper.Created(c, cuenta)
}

func (ctrl *SuperAdminController) ActualizarCuenta(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de cuenta inválido")
		return
	}

	var req dto.ActualizarCuentaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "Datos inválidos")
		return
	}

	if err := ctrl.svc.ActualizarCuenta(c.Request.Context(), id, req); err != nil {
		helper.Error(c, err)
		return
	}
	// El detalles incluye solo los campos que el request quiso cambiar (los
	// punteros no nulos del request).
	cambios := map[string]interface{}{}
	if req.Nombre != nil {
		cambios["nombre_nuevo"] = *req.Nombre
	}
	if req.EmailContacto != nil {
		cambios["email_nuevo"] = *req.EmailContacto
	}
	if req.Telefono != nil {
		cambios["telefono_nuevo"] = *req.Telefono
	}
	if req.RUC != nil {
		cambios["ruc_nuevo"] = *req.RUC
	}
	if req.Activo != nil {
		cambios["activo_nuevo"] = *req.Activo
	}
	ctrl.auditarCuenta(c, id, "EDITAR_CUENTA", cambios)
	helper.Success(c, gin.H{"message": "Cuenta actualizada"})
}

func (ctrl *SuperAdminController) CambiarEstadoCuenta(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de cuenta inválido")
		return
	}

	var body struct {
		Activo bool `json:"activo"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "Campo activo es obligatorio")
		return
	}

	if err := ctrl.svc.CambiarEstadoCuenta(c.Request.Context(), id, body.Activo); err != nil {
		helper.Error(c, err)
		return
	}
	accion := "DESACTIVAR_CUENTA"
	if body.Activo {
		// El dropdown del frontend solo lista DESACTIVAR_CUENTA — la activación
		// se considera "EDITAR_CUENTA" para mantener la lista del SA limpia.
		accion = "EDITAR_CUENTA"
	}
	ctrl.auditarCuenta(c, id, accion, map[string]interface{}{"activo": body.Activo})
	helper.Success(c, gin.H{"message": "Estado actualizado"})
}

// ── Empresas ────────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) CrearEmpresaBajoCuenta(c *gin.Context) {
	cuentaID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de cuenta inválido")
		return
	}

	var req dto.CrearTenantBajoCuentaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "razon_social, ruc, email, password y nombre_admin son obligatorios")
		return
	}

	resultado, err := ctrl.svc.CrearEmpresaBajoCuenta(c.Request.Context(), cuentaID, req)
	if err != nil {
		helper.Error(c, err)
		return
	}
	// resultado.TenantID es lo que enriquece. Si está disponible usamos
	// auditarEmpresa (lookup automático). Si no, fallback al método base.
	if resultado != nil && resultado.TenantID != uuid.Nil {
		ctrl.auditarEmpresa(c, resultado.TenantID, "CREAR_EMPRESA",
			map[string]interface{}{"cuenta_id": cuentaID.String(), "email_admin": req.Email})
	} else {
		ctrl.auditar(c, "CREAR_EMPRESA", "EMPRESA", cuentaID.String(),
			map[string]interface{}{"razon_social": req.RazonSocial, "ruc": req.RUC, "email_admin": req.Email})
	}
	helper.Created(c, resultado)
}

func (ctrl *SuperAdminController) ListarEmpresas(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "20"))

	empresas, total, err := ctrl.svc.ListarEmpresas(c.Request.Context(), offset, limite)
	if err != nil {
		helper.Error(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": empresas, "total": total})
}

func (ctrl *SuperAdminController) CambiarEstadoEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de empresa inválido")
		return
	}

	var body struct {
		Activo bool `json:"activo"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "Campo activo es obligatorio")
		return
	}

	if err := ctrl.svc.CambiarEstadoEmpresa(c.Request.Context(), tenantID, body.Activo); err != nil {
		helper.Error(c, err)
		return
	}
	accion := "DESACTIVAR_EMPRESA"
	if body.Activo {
		accion = "ACTIVAR_EMPRESA"
	}
	ctrl.auditarEmpresa(c, tenantID, accion, map[string]interface{}{"activo": body.Activo})
	helper.Success(c, gin.H{"message": "Estado actualizado"})
}

// ── Detalle de Empresa ──────────────────────────────────────────────────

func (ctrl *SuperAdminController) ObtenerEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de empresa invalido")
		return
	}
	empresa, err := ctrl.svc.ObtenerEmpresa(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, empresa)
}

func (ctrl *SuperAdminController) ObtenerSedesDeEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID invalido")
		return
	}
	sedes, err := ctrl.svc.ObtenerSedesDeEmpresa(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, sedes)
}

func (ctrl *SuperAdminController) ObtenerUsuariosDeEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID invalido")
		return
	}
	usuarios, err := ctrl.svc.ObtenerUsuariosDeEmpresa(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, usuarios)
}

func (ctrl *SuperAdminController) ObtenerReclamosDeEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID invalido")
		return
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "20"))

	var sedeID *uuid.UUID
	if sedeStr := c.Query("sede_id"); sedeStr != "" {
		if parsed, err := uuid.Parse(sedeStr); err == nil {
			sedeID = &parsed
		}
	}

	busqueda := strings.TrimSpace(c.Query("q"))

	reclamos, total, err := ctrl.svc.ObtenerReclamosDeEmpresa(c.Request.Context(), tenantID, offset, limite, sedeID, busqueda)
	if err != nil {
		helper.Error(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "data": reclamos, "total": total})
}

func (ctrl *SuperAdminController) ActivarDesactivarSede(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	sedeID, err := uuid.Parse(c.Param("sedeId"))
	if err != nil {
		helper.ValidationError(c, "ID sede invalido")
		return
	}
	var body struct{ Activo bool `json:"activo"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "Campo activo obligatorio")
		return
	}
	if err := ctrl.svc.ActivarDesactivarSede(c.Request.Context(), tenantID, sedeID, body.Activo); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Estado de sede actualizado"})
}

func (ctrl *SuperAdminController) CambiarPlanEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	var body struct{ PlanID string `json:"plan_id" binding:"required"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "plan_id es obligatorio")
		return
	}
	planID, err := uuid.Parse(body.PlanID)
	if err != nil {
		helper.ValidationError(c, "plan_id invalido")
		return
	}
	if err := ctrl.svc.CambiarPlanEmpresa(c.Request.Context(), tenantID, planID); err != nil {
		helper.Error(c, err)
		return
	}
	// Trae nombre/código del plan para que el detalle no sea solo un UUID.
	var planCodigo, planNombre string
	_ = ctrl.svc.QueryPlanResumen(c.Request.Context(), planID, &planCodigo, &planNombre)
	ctrl.auditarEmpresa(c, tenantID, "CAMBIAR_PLAN",
		map[string]interface{}{
			"plan_id":     planID.String(),
			"plan_codigo": planCodigo,
			"plan_nombre": planNombre,
		})
	helper.Success(c, gin.H{"message": "Plan actualizado"})
}

func (ctrl *SuperAdminController) ActivarDesactivarUsuario(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		helper.ValidationError(c, "ID usuario invalido")
		return
	}
	var body struct{ Activo bool `json:"activo"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "Campo activo obligatorio")
		return
	}
	// Snapshot ANTES si vamos a desactivar (para que el lookup encuentre datos vivos)
	if !body.Activo {
		ctrl.auditarUsuarioTenant(c, tenantID, userID, "DESACTIVAR_USUARIO",
			map[string]interface{}{"activo_nuevo": false})
	}
	if err := ctrl.svc.ActualizarUsuarioDeEmpresa(c.Request.Context(), tenantID, userID, body.Activo); err != nil {
		helper.Error(c, err)
		return
	}
	if body.Activo {
		ctrl.auditarUsuarioTenant(c, tenantID, userID, "EDITAR_USUARIO",
			map[string]interface{}{"activo_nuevo": true})
	}
	helper.Success(c, gin.H{"message": "Estado de usuario actualizado"})
}

// ── Editar usuario de empresa ──────────────────────────────────────────

func (ctrl *SuperAdminController) EditarUsuarioDeEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		helper.ValidationError(c, "ID usuario invalido")
		return
	}
	var body struct {
		Nombre  string   `json:"nombre_completo" binding:"required"`
		Email   string   `json:"email" binding:"required,email"`
		Rol     string   `json:"rol" binding:"required"`
		SedeIDs []string `json:"sede_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "nombre_completo, email y rol son obligatorios")
		return
	}
	var sedeUUIDs []uuid.UUID
	for _, s := range body.SedeIDs {
		if uid, err := uuid.Parse(s); err == nil {
			sedeUUIDs = append(sedeUUIDs, uid)
		}
	}
	if err := ctrl.svc.EditarUsuarioDeEmpresa(c.Request.Context(), tenantID, userID, body.Nombre, body.Email, body.Rol, sedeUUIDs); err != nil {
		helper.Error(c, err)
		return
	}
	ctrl.auditarUsuarioTenant(c, tenantID, userID, "EDITAR_USUARIO",
		map[string]interface{}{
			"nombre_nuevo": body.Nombre,
			"email_nuevo":  body.Email,
			"rol_nuevo":    body.Rol,
		})
	helper.Success(c, gin.H{"message": "Usuario actualizado"})
}

func (ctrl *SuperAdminController) ResetearPasswordUsuario(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		helper.ValidationError(c, "ID usuario invalido")
		return
	}
	var body struct {
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "password es obligatorio (min 8 caracteres)")
		return
	}
	if err := ctrl.svc.ResetearPasswordUsuario(c.Request.Context(), tenantID, userID, body.Password); err != nil {
		helper.Error(c, err)
		return
	}
	// IMPORTANTE: NUNCA registrar el password (ni en plain ni hash) en detalles.
	ctrl.auditarUsuarioTenant(c, tenantID, userID, "RESETEAR_PASSWORD", nil)
	helper.Success(c, gin.H{"message": "Contraseña reseteada"})
}

// BuscarUsuarioEnCuentaDeEmpresa GET /superadmin/empresas/:id/usuarios/buscar-en-cuenta?email=X
// Busca si un email ya existe en alguna empresa de la misma cuenta a la que
// pertenece el tenant indicado. Alimenta el modal "Agregar usuario existente"
// del panel SA.
func (ctrl *SuperAdminController) BuscarUsuarioEnCuentaDeEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" {
		helper.ValidationError(c, "Email requerido")
		return
	}
	accesos, err := ctrl.usuarioSvc.BuscarUsuarioEnCuenta(c.Request.Context(), tenantID, email)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, accesos)
}

// ListarCandidatosAgregarAEmpresa GET /superadmin/empresas/:id/usuarios/candidatos-cuenta
// Devuelve los usuarios (agrupados por email) que existen activos en otras
// empresas de la misma cuenta y que aún no tienen acceso al tenant indicado.
// Alimenta el selector del modal "Agregar usuario existente" del panel SA.
func (ctrl *SuperAdminController) ListarCandidatosAgregarAEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	candidatos, err := ctrl.usuarioSvc.ListarCandidatosAgregarAEmpresa(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, candidatos)
}

// AgregarUsuarioExistenteAEmpresa POST /superadmin/empresas/:id/usuarios/agregar-existente
// Vincula un usuario ya existente en otra empresa de la misma cuenta al
// tenant indicado. Reutiliza el hash del usuario para mantener sincronizado
// el login multi-empresa.
func (ctrl *SuperAdminController) AgregarUsuarioExistenteAEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	var req dto.AgregarUsuarioExistenteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "email, rol y sede_ids son obligatorios")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	sedeUUIDs := make([]uuid.UUID, 0, len(req.SedeIDs))
	for _, s := range req.SedeIDs {
		if id, err := uuid.Parse(s); err == nil {
			sedeUUIDs = append(sedeUUIDs, id)
		}
	}

	// SA no tiene un user_id propio de tenant — usamos uuid.Nil como creadoPor
	// (la auditoría SA se registra por separado vía auditarUsuarioTenant).
	user, err := ctrl.usuarioSvc.AgregarUsuarioExistente(
		c.Request.Context(), tenantID, req.Email, req.Rol, sedeUUIDs, uuid.Nil,
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if user != nil {
		ctrl.auditarUsuarioTenant(c, tenantID, user.ID, "AGREGAR_USUARIO_EXISTENTE",
			map[string]interface{}{
				"email": req.Email,
				"rol":   req.Rol,
			})
	}
	helper.Created(c, user)
}

// ── Planes ──────────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) ListarPlanes(c *gin.Context) {
	planes, err := ctrl.svc.ListarPlanes(c.Request.Context())
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, planes)
}

func (ctrl *SuperAdminController) ObtenerPlan(c *gin.Context) {
	id, err := uuid.Parse(c.Param("planId"))
	if err != nil {
		helper.ValidationError(c, "ID de plan invalido")
		return
	}
	plan, err := ctrl.svc.ObtenerPlan(c.Request.Context(), id)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, plan)
}

func (ctrl *SuperAdminController) CrearPlan(c *gin.Context) {
	var plan model.Plan
	if err := c.ShouldBindJSON(&plan); err != nil {
		helper.ValidationError(c, "Datos del plan inválidos")
		return
	}
	if err := ctrl.svc.CrearPlan(c.Request.Context(), &plan); err != nil {
		helper.Error(c, err)
		return
	}
	ctrl.auditarPlan(c, plan.ID, "CREAR_PLAN", nil)
	helper.Created(c, plan)
}

func (ctrl *SuperAdminController) ActualizarPlan(c *gin.Context) {
	id, err := uuid.Parse(c.Param("planId"))
	if err != nil {
		helper.ValidationError(c, "ID de plan invalido")
		return
	}

	var datos map[string]interface{}
	if err := c.ShouldBindJSON(&datos); err != nil {
		helper.ValidationError(c, "Datos del plan inválidos")
		return
	}

	plan, err := ctrl.svc.ObtenerPlan(c.Request.Context(), id)
	if err != nil {
		helper.Error(c, err)
		return
	}

	if v, ok := datos["nombre"].(string); ok { plan.Nombre = v }
	if v, ok := datos["descripcion"]; ok {
		if s, ok := v.(string); ok && s != "" {
			plan.Descripcion = model.NullString{NullString: sqlPkg.NullString{String: s, Valid: true}}
		} else {
			plan.Descripcion = model.NullString{}
		}
	}
	if v, ok := datos["precio_mensual"].(float64); ok { plan.PrecioMensual = v }
	if v, ok := datos["precio_anual"]; ok {
		if f, ok := v.(float64); ok {
			plan.PrecioAnual = model.NullFloat64{NullFloat64: sqlPkg.NullFloat64{Float64: f, Valid: true}}
		} else {
			plan.PrecioAnual = model.NullFloat64{}
		}
	}
	if v, ok := datos["precio_sede_extra"].(float64); ok { plan.PrecioSedeExtra = v }
	if v, ok := datos["precio_usuario_extra"].(float64); ok { plan.PrecioUsuarioExtra = v }
	if v, ok := datos["max_sedes"].(float64); ok { plan.MaxSedes = int(v) }
	if v, ok := datos["max_usuarios"].(float64); ok { plan.MaxUsuarios = int(v) }
	if v, ok := datos["max_reclamos_mes"].(float64); ok { plan.MaxReclamosMes = int(v) }
	if v, ok := datos["max_chatbots"].(float64); ok { plan.MaxChatbots = int(v) }
	if v, ok := datos["max_canales_whatsapp"].(float64); ok { plan.MaxCanalesWhatsApp = int(v) }
	if v, ok := datos["max_storage_mb"].(float64); ok { plan.MaxStorageMB = int(v) }
	if v, ok := datos["permite_chatbot"].(bool); ok { plan.PermiteChatbot = v }
	if v, ok := datos["permite_whatsapp"].(bool); ok { plan.PermiteWhatsapp = v }
	if v, ok := datos["permite_email"].(bool); ok { plan.PermiteEmail = v }
	if v, ok := datos["permite_reportes_pdf"].(bool); ok { plan.PermiteReportesPDF = v }
	if v, ok := datos["permite_exportar_excel"].(bool); ok { plan.PermiteExportarExcel = v }
	if v, ok := datos["permite_api"].(bool); ok { plan.PermiteAPI = v }
	if v, ok := datos["permite_marca_blanca"].(bool); ok { plan.PermiteMarcaBlanca = v }
	if v, ok := datos["permite_multi_idioma"].(bool); ok { plan.PermiteMultiIdioma = v }
	if v, ok := datos["permite_asistente_ia"].(bool); ok { plan.PermiteAsistenteIA = v }
	if v, ok := datos["permite_atencion_vivo"].(bool); ok { plan.PermiteAtencionVivo = v }
	if v, ok := datos["orden"].(float64); ok { plan.Orden = int(v) }
	if v, ok := datos["activo"].(bool); ok { plan.Activo = v }
	if v, ok := datos["destacado"].(bool); ok { plan.Destacado = v }

	if err := ctrl.svc.ActualizarPlan(c.Request.Context(), id, plan); err != nil {
		helper.Error(c, err)
		return
	}
	// Reportamos qué claves intentó cambiar el request (no comparamos con
	// estado anterior — eso sería muy invasivo).
	cambios := map[string]interface{}{}
	for k := range datos {
		cambios[k] = datos[k]
	}
	ctrl.auditarPlan(c, id, "EDITAR_PLAN", cambios)
	helper.Success(c, gin.H{"message": "Plan actualizado"})
}

// ── Staff ───────────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) ListarStaff(c *gin.Context) {
	staff, err := ctrl.svc.ListarStaff(c.Request.Context())
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, staff)
}

func (ctrl *SuperAdminController) CrearStaff(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=8"`
		Nombre   string `json:"nombre" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "email, password y nombre son obligatorios")
		return
	}

	sa, err := ctrl.svc.CrearStaff(c.Request.Context(), req.Email, req.Password, req.Nombre)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if sa != nil {
		ctrl.auditarStaff(c, sa.ID, "CREAR_STAFF", nil)
	}
	helper.Created(c, sa)
}

// ── Búsqueda Global ────────────────────────────────────────────────────

func (ctrl *SuperAdminController) BuscarGlobal(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		helper.ValidationError(c, "Parámetro q es obligatorio")
		return
	}
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "5"))
	resultado, err := ctrl.svc.BuscarGlobal(c.Request.Context(), q, limite)
	if err != nil {
		helper.Error(c, err)
		return
	}
	ctrl.auditar(c, "BUSCAR", "STAFF", "", map[string]interface{}{"query": q, "limite": limite})
	helper.Success(c, resultado)
}

// ── Revenue Metrics ────────────────────────────────────────────────────

func (ctrl *SuperAdminController) GetRevenueMetrics(c *gin.Context) {
	metrics, err := ctrl.svc.ObtenerRevenueMetrics(c.Request.Context())
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, metrics)
}

// ── Impersonar ─────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) Impersonar(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID empresa invalido")
		return
	}
	var body struct {
		UsuarioID string `json:"usuario_id"`
	}
	_ = c.ShouldBindJSON(&body)

	var userIDPtr *uuid.UUID
	if body.UsuarioID != "" {
		if uid, err := uuid.Parse(body.UsuarioID); err == nil {
			userIDPtr = &uid
		}
	}

	resultado, err := ctrl.svc.Impersonar(c.Request.Context(), tenantID, userIDPtr)
	if err != nil {
		helper.Error(c, err)
		return
	}

	// Audit log (corregido: el helper auditar lee saID como uuid.UUID del context,
	// no como string vacío que era el bug previo)
	ctrl.auditarEmpresa(c, tenantID, "IMPERSONAR",
		map[string]interface{}{"usuario_target": resultado.UserID, "rol_target": resultado.Role})

	helper.Success(c, resultado)
}

// ── Auditoría ──────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) ListarAuditoria(c *gin.Context) {
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	entries, total, err := ctrl.svc.ListarAuditoria(c.Request.Context(), limite, offset)
	if err != nil {
		helper.Error(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "data": entries, "total": total})
}

// parseFiltrosActividad extrae los filtros comunes (tenant, cuenta, accion,
// rango de fechas) del query string. Si fecha_desde/fecha_hasta no llegan,
// aplica el default `defaultDias` hacia atrás desde ahora.
//
// Formato aceptado: ISO 8601 completo ("2026-04-01T00:00:00Z") o fecha corta
// ("2026-04-01"). Las fechas cortas se interpretan como inicio de día UTC.
func parseFiltrosActividad(c *gin.Context, defaultDias int) repo.FiltrosActividad {
	filtros := repo.FiltrosActividad{Accion: c.Query("accion")}

	if cid := c.Query("cuenta_id"); cid != "" {
		if uid, err := uuid.Parse(cid); err == nil {
			filtros.CuentaID = &uid
		}
	}
	if tid := c.Query("tenant_id"); tid != "" {
		if uid, err := uuid.Parse(tid); err == nil {
			filtros.TenantID = &uid
		}
	}

	ahora := time.Now().UTC()
	filtros.FechaHasta = ahora
	filtros.FechaDesde = ahora.AddDate(0, 0, -defaultDias)

	if fd := c.Query("fecha_desde"); fd != "" {
		if t, err := parseFechaFlexible(fd); err == nil {
			filtros.FechaDesde = t
		}
	}
	if fh := c.Query("fecha_hasta"); fh != "" {
		if t, err := parseFechaFlexible(fh); err == nil {
			// Si llega solo la fecha (sin hora) la tratamos como fin de día
			// para que el rango sea inclusivo visualmente.
			if len(fh) == 10 {
				t = t.Add(24 * time.Hour).Add(-time.Nanosecond)
			}
			filtros.FechaHasta = t
		}
	}
	return filtros
}

func parseFechaFlexible(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t.UTC(), nil
	}
	return time.Time{}, fmt.Errorf("fecha invalida: %s", s)
}

func (ctrl *SuperAdminController) ListarActividadEmpresas(c *gin.Context) {
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	// Default: últimos 7 días (cubre el uso típico sin escanear historia completa).
	filtros := parseFiltrosActividad(c, 7)

	entries, total, err := ctrl.svc.ListarActividadEmpresas(c.Request.Context(), limite, offset, filtros)
	if err != nil {
		helper.Error(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "data": entries, "total": total})
}

// ExportarActividadEmpresas escribe el resultado directamente al ResponseWriter
// en formato CSV o JSON, SIN cargar todas las filas en memoria. La query
// streamea del repo fila por fila usando el índice global por fecha.
//
// Protecciones aplicadas:
//   - rango de fechas obligatorio, máximo 90 días (validado en el repo)
//   - tope absoluto de 500k filas por export
//   - escritura directa al writer con flush periódico para que el browser
//     reciba la descarga sin timeout
//
// Formatos soportados: ?formato=csv (default) | ?formato=json
func (ctrl *SuperAdminController) ExportarActividadEmpresas(c *gin.Context) {
	formato := c.DefaultQuery("formato", "csv")
	if formato != "csv" && formato != "json" {
		helper.ValidationError(c, "Formato no soportado. Usa csv o json.")
		return
	}

	// Para exportar exigimos que el usuario acote el rango. Si no lo envía,
	// usamos 30 días por default (dentro del máximo de 90 que impone el repo).
	filtros := parseFiltrosActividad(c, 30)

	// Validación temprana ANTES de escribir headers. Si fallara en medio del
	// stream el browser recibiría un archivo corrupto.
	if filtros.FechaDesde.IsZero() || filtros.FechaHasta.IsZero() {
		helper.ValidationError(c, "fecha_desde y fecha_hasta son obligatorios")
		return
	}
	if !filtros.FechaHasta.After(filtros.FechaDesde) {
		helper.ValidationError(c, "fecha_hasta debe ser mayor que fecha_desde")
		return
	}
	// Comparación en días calendario (no en duración) para que no rechace
	// rangos donde fecha_hasta lleva el offset de fin de día (23:59:59).
	desdeFecha := time.Date(filtros.FechaDesde.Year(), filtros.FechaDesde.Month(), filtros.FechaDesde.Day(), 0, 0, 0, 0, time.UTC)
	hastaFecha := time.Date(filtros.FechaHasta.Year(), filtros.FechaHasta.Month(), filtros.FechaHasta.Day(), 0, 0, 0, 0, time.UTC)
	diasRango := int(hastaFecha.Sub(desdeFecha).Hours() / 24)
	if diasRango > repo.MaxRangoExportDias {
		helper.ValidationError(c, fmt.Sprintf("Rango máximo de exportación: %d días", repo.MaxRangoExportDias))
		return
	}

	// Opcional: limite de filas a exportar. Cap duro en el repo
	// (repo.MaxFilasExport). Valores <= 0 => usa el máximo del repo.
	limite := 0
	if v := c.Query("limite"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limite = n
		}
	}

	fecha := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("actividad_%s.%s", fecha, formato)

	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "no-store")

	ctx := c.Request.Context()

	switch formato {
	case "csv":
		ctrl.streamCSV(c, ctx, filtros, limite)
	case "json":
		ctrl.streamJSON(c, ctx, filtros, limite)
	}
}

func (ctrl *SuperAdminController) streamCSV(c *gin.Context, ctx context.Context, filtros repo.FiltrosActividad, limite int) {
	c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Writer.WriteHeader(http.StatusOK)

	// BOM UTF-8 para que Excel abra tildes correctamente en Windows.
	_, _ = c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"Fecha", "Usuario", "Empresa", "Accion", "Entidad", "Entidad ID", "IP"})

	flushEach := 500
	_, err := ctrl.svc.StreamActividadEmpresas(ctx, filtros, limite, func(e repo.ActividadEmpresaEntry) error {
		entidadID := ""
		if e.EntidadID != nil {
			entidadID = *e.EntidadID
		}
		ip := ""
		if e.IPAddress != nil {
			ip = *e.IPAddress
		}
		if err := w.Write([]string{
			e.Fecha.Format(time.RFC3339),
			e.UsuarioNombre,
			e.EmpresaNombre,
			e.Accion,
			e.Entidad,
			entidadID,
			ip,
		}); err != nil {
			return err
		}
		if w.Error() != nil {
			return w.Error()
		}
		// Flush por bloque para que el browser reciba bytes de forma progresiva.
		if flushEach > 0 {
			flushEach--
			if flushEach == 0 {
				w.Flush()
				if f, ok := c.Writer.(http.Flusher); ok {
					f.Flush()
				}
				flushEach = 500
			}
		}
		return nil
	})
	w.Flush()
	if f, ok := c.Writer.(http.Flusher); ok {
		f.Flush()
	}
	if err != nil {
		// Header ya fue enviado — solo logueamos al body como comentario.
		_, _ = c.Writer.WriteString(fmt.Sprintf("\n# Error: %s\n", err.Error()))
	}
}

func (ctrl *SuperAdminController) streamJSON(c *gin.Context, ctx context.Context, filtros repo.FiltrosActividad, limite int) {
	c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	c.Writer.WriteHeader(http.StatusOK)

	bw := c.Writer
	_, _ = bw.WriteString(`{"data":[`)

	first := true
	flushEach := 500

	_, err := ctrl.svc.StreamActividadEmpresas(ctx, filtros, limite, func(e repo.ActividadEmpresaEntry) error {
		if !first {
			_, _ = bw.WriteString(",")
		}
		first = false
		// json.Encoder.Encode añade un '\n' al final que no queremos dentro del array.
		// Usamos json.Marshal y escribimos crudo.
		b, err := json.Marshal(map[string]interface{}{
			"id":             e.ID,
			"tenant_id":      e.TenantID,
			"usuario_id":     e.UsuarioID,
			"usuario_nombre": e.UsuarioNombre,
			"empresa_nombre": e.EmpresaNombre,
			"accion":         e.Accion,
			"entidad":        e.Entidad,
			"entidad_id":     e.EntidadID,
			"ip_address":     e.IPAddress,
			"fecha":          e.Fecha.Format(time.RFC3339),
		})
		if err != nil {
			return err
		}
		_, _ = bw.Write(b)

		if flushEach > 0 {
			flushEach--
			if flushEach == 0 {
				if f, ok := bw.(http.Flusher); ok {
					f.Flush()
				}
				flushEach = 500
			}
		}
		return nil
	})
	_, _ = bw.WriteString("]")
	if err != nil {
		_, _ = bw.WriteString(fmt.Sprintf(`,"error":%q`, err.Error()))
	}
	_, _ = bw.WriteString("}")
	if f, ok := bw.(http.Flusher); ok {
		f.Flush()
	}
}

// ── Error Log ──────────────────────────────────────────────────────────

func (ctrl *SuperAdminController) ListarErrores(c *gin.Context) {
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	filtros := repo.ErrorLogFiltros{
		Nivel:       c.Query("nivel"),
		Origen:      c.Query("origen"),
		Desde:       c.Query("desde"),
		Hasta:       c.Query("hasta"),
		Fingerprint: c.Query("fingerprint"),
	}
	if cid := c.Query("cuenta_id"); cid != "" {
		if uid, err := uuid.Parse(cid); err == nil {
			filtros.CuentaID = &uid
		}
	}
	if tid := c.Query("tenant_id"); tid != "" {
		if uid, err := uuid.Parse(tid); err == nil {
			filtros.TenantID = &uid
		}
	}

	entries, total, err := ctrl.svc.ListarErrores(c.Request.Context(), limite, offset, filtros)
	if err != nil {
		helper.Error(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "data": entries, "total": total})
}

func (ctrl *SuperAdminController) ResumenErrores(c *gin.Context) {
	filtros := parseFiltrosErrorLog(c)
	filtros.Desde = c.Query("desde")
	filtros.Hasta = c.Query("hasta")
	resumen, err := ctrl.svc.ResumenErrores(c.Request.Context(), filtros)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, resumen)
}

// parseFiltrosErrorLog extrae los filtros comunes de la query string que
// comparten los endpoints de errores (listar, resumen, timeline, agrupados).
// Mantiene en un solo sitio el parseo de nivel, origen, cuenta_id y tenant_id
// para evitar divergencias entre handlers.
func parseFiltrosErrorLog(c *gin.Context) repo.ErrorLogFiltros {
	f := repo.ErrorLogFiltros{
		Nivel:  c.Query("nivel"),
		Origen: c.Query("origen"),
	}
	if cid := c.Query("cuenta_id"); cid != "" {
		if uid, err := uuid.Parse(cid); err == nil {
			f.CuentaID = &uid
		}
	}
	if tid := c.Query("tenant_id"); tid != "" {
		if uid, err := uuid.Parse(tid); err == nil {
			f.TenantID = &uid
		}
	}
	return f
}

func (ctrl *SuperAdminController) ReportarErrorFrontend(c *gin.Context) {
	var body struct {
		Mensaje     string  `json:"mensaje" binding:"required"`
		Stack       string  `json:"stack"`
		Ruta        string  `json:"ruta"`
		TenantID    *string `json:"tenant_id"`
		UsuarioID   *string `json:"usuario_id"`
		Breadcrumbs string  `json:"breadcrumbs"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		helper.ValidationError(c, "mensaje es obligatorio")
		return
	}

	var tenantID, usuarioID *uuid.UUID
	if body.TenantID != nil {
		if uid, err := uuid.Parse(*body.TenantID); err == nil {
			tenantID = &uid
		}
	}
	if body.UsuarioID != nil {
		if uid, err := uuid.Parse(*body.UsuarioID); err == nil {
			usuarioID = &uid
		}
	}

	_ = ctrl.svc.ReportarErrorFrontend(c.Request.Context(), tenantID, usuarioID,
		body.Mensaje, body.Stack, body.Ruta, helper.GetClientIP(c), c.Request.UserAgent(), body.Breadcrumbs)

	helper.Success(c, gin.H{"message": "Error reportado"})
}

func (ctrl *SuperAdminController) ListarErroresAgrupados(c *gin.Context) {
	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	filtros := repo.ErrorLogFiltros{Nivel: c.Query("nivel"), Origen: c.Query("origen"), Desde: c.Query("desde")}
	if cid := c.Query("cuenta_id"); cid != "" {
		if uid, err := uuid.Parse(cid); err == nil { filtros.CuentaID = &uid }
	}
	if tid := c.Query("tenant_id"); tid != "" {
		if uid, err := uuid.Parse(tid); err == nil { filtros.TenantID = &uid }
	}

	agrupados, total, err := ctrl.svc.ListarErroresAgrupados(c.Request.Context(), limite, offset, filtros)
	if err != nil { helper.Error(c, err); return }
	c.JSON(200, gin.H{"success": true, "data": agrupados, "total": total})
}

func (ctrl *SuperAdminController) ObtenerTimelineErrores(c *gin.Context) {
	intervalo := c.DefaultQuery("intervalo", "hora")
	dias, _ := strconv.Atoi(c.DefaultQuery("dias", "1"))
	if dias < 1 { dias = 1 }
	if dias > 30 { dias = 30 }

	filtros := parseFiltrosErrorLog(c)
	puntos, err := ctrl.svc.ObtenerTimelineErrores(c.Request.Context(), intervalo, dias, filtros)
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, puntos)
}

func (ctrl *SuperAdminController) ListarAlertasErrores(c *gin.Context) {
	alertas, err := ctrl.svc.ListarAlertasErrores(c.Request.Context())
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, alertas)
}

func (ctrl *SuperAdminController) MarcarAlertaComoVista(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil { helper.ValidationError(c, "ID invalido"); return }
	if err := ctrl.svc.MarcarAlertaComoVista(c.Request.Context(), id); err != nil { helper.Error(c, err); return }
	helper.Success(c, gin.H{"message": "Alerta marcada como vista"})
}

func (ctrl *SuperAdminController) MarcarTodasAlertasComoVistas(c *gin.Context) {
	if err := ctrl.svc.MarcarTodasAlertasComoVistas(c.Request.Context()); err != nil { helper.Error(c, err); return }
	helper.Success(c, gin.H{"message": "Todas las alertas marcadas como vistas"})
}

func (ctrl *SuperAdminController) ContarAlertasSinVer(c *gin.Context) {
	count, err := ctrl.svc.ContarAlertasSinVer(c.Request.Context())
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, gin.H{"count": count})
}

func (ctrl *SuperAdminController) ObtenerSuscripcionEmpresa(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil { helper.ValidationError(c, "ID empresa invalido"); return }
	sus, err := ctrl.svc.ObtenerSuscripcionEmpresa(c.Request.Context(), tenantID)
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, sus)
}

func (ctrl *SuperAdminController) CrearNotaCuenta(c *gin.Context) {
	cuentaID, err := uuid.Parse(c.Param("id"))
	if err != nil { helper.ValidationError(c, "ID de cuenta invalido"); return }
	var body struct { Contenido string `json:"contenido" binding:"required"` }
	if err := c.ShouldBindJSON(&body); err != nil { helper.ValidationError(c, "contenido es obligatorio"); return }
	saID, _ := uuid.Parse(c.GetString("superadmin_id"))
	saEmail := c.GetString("superadmin_email")
	nota, err := ctrl.svc.CrearNotaCuenta(c.Request.Context(), cuentaID, saID, saEmail, body.Contenido)
	if err != nil { helper.Error(c, err); return }
	helper.Created(c, nota)
}

func (ctrl *SuperAdminController) ListarNotasCuenta(c *gin.Context) {
	cuentaID, err := uuid.Parse(c.Param("id"))
	if err != nil { helper.ValidationError(c, "ID de cuenta invalido"); return }
	notas, err := ctrl.svc.ListarNotasCuenta(c.Request.Context(), cuentaID)
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, notas)
}

func (ctrl *SuperAdminController) ObtenerFacturacionCuenta(c *gin.Context) {
	cuentaID, err := uuid.Parse(c.Param("id"))
	if err != nil { helper.ValidationError(c, "ID de cuenta invalido"); return }
	fac, err := ctrl.svc.ObtenerFacturacionCuenta(c.Request.Context(), cuentaID)
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, fac)
}

func (ctrl *SuperAdminController) ObtenerHealthScore(c *gin.Context) {
	cuentaID, err := uuid.Parse(c.Param("id"))
	if err != nil { helper.ValidationError(c, "ID de cuenta invalido"); return }
	hs, err := ctrl.svc.CalcularHealthScore(c.Request.Context(), cuentaID)
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, hs)
}

func (ctrl *SuperAdminController) ObtenerRendimientoAPI(c *gin.Context) {
	rutas, err := ctrl.svc.ObtenerRendimientoAPI(c.Request.Context())
	if err != nil { helper.Error(c, err); return }
	helper.Success(c, rutas)
}
