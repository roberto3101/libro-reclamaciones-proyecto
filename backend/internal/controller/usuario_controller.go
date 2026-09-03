package controller

import (
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"
	"libro-reclamaciones/internal/service"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var (
	reNombreUsuario = regexp.MustCompile(`^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$`)
	reEmailUsuario  = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$`)
)

type UsuarioController struct {
	usuarioService *service.UsuarioService
	auditRepo      *repo.AuditoriaRepo
	rolRepo        *repo.RolRepo
}

func NewUsuarioController(usuarioService *service.UsuarioService, auditRepo *repo.AuditoriaRepo, rolRepo *repo.RolRepo) *UsuarioController {
	return &UsuarioController{usuarioService: usuarioService, auditRepo: auditRepo, rolRepo: rolRepo}
}

// esRolAdmin verifica si un rol tiene el flag es_admin.
func (ctrl *UsuarioController) esRolAdmin(c *gin.Context, tenantID uuid.UUID, rolSlug string) bool {
	rol, err := ctrl.rolRepo.GetBySlug(c.Request.Context(), tenantID, strings.ToLower(rolSlug))
	if err != nil || rol == nil {
		return false
	}
	return rol.EsAdmin
}

// GetAll GET /api/v1/usuarios
func (ctrl *UsuarioController) GetAll(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	usuarios, err := ctrl.usuarioService.GetByTenant(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, usuarios)
}

// GetByID GET /api/v1/usuarios/:id
func (ctrl *UsuarioController) GetByID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de usuario inválido")
		return
	}

	user, err := ctrl.usuarioService.GetByID(c.Request.Context(), tenantID, userID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, user)
}

// Create POST /api/v1/usuarios
func (ctrl *UsuarioController) Create(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	creadorID, _ := helper.GetUserID(c)

	var req dto.CreateUsuarioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "email, nombre_completo, password y rol son obligatorios")
		return
	}

	req.NombreCompleto = strings.TrimSpace(req.NombreCompleto)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if !reNombreUsuario.MatchString(req.NombreCompleto) {
		helper.ValidationError(c, "El nombre solo admite letras y espacios")
		return
	}
	if !reEmailUsuario.MatchString(req.Email) {
		helper.ValidationError(c, "Formato de email inválido")
		return
	}

	sedeUUIDs := parsearSedeIDs(req.SedeIDs)
	user, err := ctrl.usuarioService.Create(
		c.Request.Context(), tenantID,
		req.Email, req.NombreCompleto, req.Password, req.Rol, sedeUUIDs, creadorID,
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if user != nil {
		// Usa el helper enriquecido aunque ya tenemos email/nombre del response,
		// para mantener consistencia con DESACTIVAR_USUARIO y futuros cambios.
		ctrl.auditRepo.RegistrarAccionUsuario(
			tenantID, creadorID, user.ID,
			repo.AccionAuditCrearUsuario,
			nil,
			helper.GetClientIP(c),
		)
	}
	helper.Created(c, user)
}

// Update PUT /api/v1/usuarios/:id
func (ctrl *UsuarioController) Update(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de usuario inválido")
		return
	}

	var req dto.UpdateUsuarioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre_completo y rol son obligatorios")
		return
	}

	req.NombreCompleto = strings.TrimSpace(req.NombreCompleto)
	if !reNombreUsuario.MatchString(req.NombreCompleto) {
		helper.ValidationError(c, "El nombre solo admite letras y espacios")
		return
	}

	// Protección de roles admin
	solicitanteEsAdmin, _ := c.Get("user_es_admin")
	solicitanteID, _ := helper.GetUserID(c)

	// Un admin no puede degradarse a sí mismo
	if solicitanteID == userID && solicitanteEsAdmin == true {
		// Verificar si el nuevo rol también es admin; si no, bloquear
		nuevoRolEsAdmin := ctrl.esRolAdmin(c, tenantID, req.Rol)
		if !nuevoRolEsAdmin {
			helper.ForbiddenError(c, "No puedes cambiar tu propio rol de administrador. Pide a otro administrador que lo haga.")
			return
		}
	}

	// Solo admin puede modificar a otro admin o asignar rol admin
	if solicitanteEsAdmin != true {
		objetivo, err := ctrl.usuarioService.GetByID(c.Request.Context(), tenantID, userID)
		if err != nil {
			helper.Error(c, err)
			return
		}
		if objetivo != nil && ctrl.esRolAdmin(c, tenantID, objetivo.Rol) {
			helper.ForbiddenError(c, "Solo un administrador puede modificar a otro administrador")
			return
		}
		if ctrl.esRolAdmin(c, tenantID, req.Rol) {
			helper.ForbiddenError(c, "Solo un administrador puede asignar el rol de administrador")
			return
		}
	}

	sedeUUIDs := parsearSedeIDs(req.SedeIDs)
	if err := ctrl.usuarioService.Update(
		c.Request.Context(), tenantID, userID,
		req.NombreCompleto, req.Rol, sedeUUIDs, req.Activo,
	); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Usuario actualizado"})
}

// ChangePassword PUT /api/v1/usuarios/password
func (ctrl *UsuarioController) ChangePassword(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	userID, _ := helper.GetUserID(c)

	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "current_password y new_password son obligatorios")
		return
	}

	if err := ctrl.usuarioService.ChangePassword(
		c.Request.Context(), tenantID, userID, req.CurrentPassword, req.NewPassword,
	); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Contraseña actualizada"})
}

// AdminResetPassword PATCH /api/v1/usuarios/:id/password
func (ctrl *UsuarioController) AdminResetPassword(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID inválido")
		return
	}

	var req dto.AdminResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "password es obligatorio (mínimo 8 caracteres)")
		return
	}

	if err := ctrl.usuarioService.AdminResetPassword(c.Request.Context(), tenantID, userID, req.Password); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"message": "Contraseña actualizada"})
}

// Deactivate DELETE /api/v1/usuarios/:id
func (ctrl *UsuarioController) Deactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de usuario inválido")
		return
	}

	// Snapshot ANTES de desactivar — el helper enriquecedor lee el usuario, y
	// si esperamos hasta después de Deactivate puede que el flag activo=false
	// haga que algunos repos lo filtren. Disparamos el helper antes para que
	// el lookup encuentre el registro completo. Es fire-and-forget asíncrono.
	actorID, _ := helper.GetUserID(c)
	ctrl.auditRepo.RegistrarAccionUsuario(
		tenantID, actorID, userID,
		repo.AccionAuditDesactivarUsuario,
		nil,
		helper.GetClientIP(c),
	)
	if err := ctrl.usuarioService.Deactivate(c.Request.Context(), tenantID, userID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.NoContent(c)
}

// Reactivate POST /api/v1/usuarios/:id/reactivar
func (ctrl *UsuarioController) Reactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de usuario inválido")
		return
	}

	if err := ctrl.usuarioService.Reactivate(c.Request.Context(), tenantID, userID); err != nil {
		helper.Error(c, err)
		return
	}
	actorID, _ := helper.GetUserID(c)
	ctrl.auditRepo.RegistrarAccionUsuario(
		tenantID, actorID, userID,
		repo.AccionAuditCrearUsuario, // reactivar = volver a habilitar; lo agrupamos como CREAR_USUARIO con flag
		map[string]interface{}{"accion_real": "reactivar"},
		helper.GetClientIP(c),
	)
	helper.NoContent(c)
}

// BuscarEnCuenta GET /api/v1/usuarios/buscar-en-cuenta?email=X
// Busca si un email ya existe en alguna empresa de la misma cuenta del
// tenant actual. Se usa en el modal "Agregar usuario existente".
func (ctrl *UsuarioController) BuscarEnCuenta(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" || !reEmailUsuario.MatchString(email) {
		helper.ValidationError(c, "Email requerido y con formato válido")
		return
	}

	accesos, err := ctrl.usuarioService.BuscarUsuarioEnCuenta(c.Request.Context(), tenantID, email)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, accesos)
}

// AgregarUsuarioExistente POST /api/v1/usuarios/agregar-existente
// Vincula un usuario que ya existe en otra empresa de la misma cuenta al
// tenant actual (reutilizando hash, nombre, etc.).
func (ctrl *UsuarioController) AgregarUsuarioExistente(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}
	actorID, _ := helper.GetUserID(c)

	var req dto.AgregarUsuarioExistenteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "email, rol y sede_ids son obligatorios")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if !reEmailUsuario.MatchString(req.Email) {
		helper.ValidationError(c, "Formato de email inválido")
		return
	}

	sedeUUIDs := parsearSedeIDs(req.SedeIDs)
	user, err := ctrl.usuarioService.AgregarUsuarioExistente(
		c.Request.Context(), tenantID, req.Email, req.Rol, sedeUUIDs, actorID,
	)
	if err != nil {
		helper.Error(c, err)
		return
	}
	if user != nil {
		ctrl.auditRepo.RegistrarAccionUsuario(
			tenantID, actorID, user.ID,
			repo.AccionAuditCrearUsuario,
			map[string]interface{}{"accion_real": "agregar_existente"},
			helper.GetClientIP(c),
		)
	}
	helper.Created(c, user)
}

// parsearSedeIDs convierte []string a []uuid.UUID, descartando valores inválidos.
func parsearSedeIDs(ids []string) []uuid.UUID {
	var result []uuid.UUID
	for _, s := range ids {
		if id, err := uuid.Parse(s); err == nil {
			result = append(result, id)
		}
	}
	return result
}