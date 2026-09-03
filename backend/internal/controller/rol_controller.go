package controller

import (
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RolController maneja los endpoints de gestión de roles.
type RolController struct {
	rolService *service.RolService
}

// NewRolController crea una nueva instancia del controlador.
func NewRolController(rolService *service.RolService) *RolController {
	return &RolController{rolService: rolService}
}

// Listar GET /api/v1/roles
func (ctrl *RolController) Listar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	roles, err := ctrl.rolService.ListarPorTenant(c.Request.Context(), tenantID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, roles)
}

// ObtenerPorID GET /api/v1/roles/:id
func (ctrl *RolController) ObtenerPorID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	rolID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de rol inválido")
		return
	}

	rol, err := ctrl.rolService.ObtenerPorID(c.Request.Context(), tenantID, rolID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, rol)
}

// Crear POST /api/v1/roles
func (ctrl *RolController) Crear(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var req dto.CrearRolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre y permisos son obligatorios")
		return
	}

	rolSolicitante := helper.GetUserRole(c)
	rol, err := ctrl.rolService.Crear(c.Request.Context(), tenantID, req, rolSolicitante)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Created(c, rol)
}

// Actualizar PUT /api/v1/roles/:id
func (ctrl *RolController) Actualizar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	rolID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de rol inválido")
		return
	}

	var req dto.ActualizarRolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "nombre y permisos son obligatorios")
		return
	}

	rolSolicitante := helper.GetUserRole(c)
	rol, err := ctrl.rolService.Actualizar(c.Request.Context(), tenantID, rolID, req, rolSolicitante)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, rol)
}

// Eliminar DELETE /api/v1/roles/:id
func (ctrl *RolController) Eliminar(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	rolID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de rol inválido")
		return
	}

	rolSolicitante := helper.GetUserRole(c)
	if err := ctrl.rolService.Eliminar(c.Request.Context(), tenantID, rolID, rolSolicitante); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, gin.H{"mensaje": "Rol eliminado exitosamente"})
}

// ObtenerDefinicion GET /api/v1/roles/definicion
// Retorna el catálogo de módulos y acciones disponibles para construir la matriz de permisos.
func (ctrl *RolController) ObtenerDefinicion(c *gin.Context) {
	helper.Success(c, gin.H{
		"modulos":            model.DefinicionModulosPermisos(),
		"etiquetas_modulos":  model.EtiquetasModulos(),
		"etiquetas_acciones": model.EtiquetasAcciones(),
	})
}

// MisPermisos GET /api/v1/roles/mis-permisos
// Retorna los permisos del usuario autenticado según su rol.
func (ctrl *RolController) MisPermisos(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	role := helper.GetUserRole(c)
	permisos, err := ctrl.rolService.ObtenerMisPermisos(c.Request.Context(), tenantID, role)
	if err != nil {
		helper.Error(c, err)
		return
	}

	helper.Success(c, permisos)
}
