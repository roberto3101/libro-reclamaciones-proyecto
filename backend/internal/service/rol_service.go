package service

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
	"golang.org/x/text/unicode/norm"
)

// RolService gestiona la lógica de negocio de roles por tenant.
type RolService struct {
	rolRepo     *repo.RolRepo
	usuarioRepo *repo.UsuarioRepo
}

// NewRolService crea una nueva instancia del servicio de roles.
func NewRolService(rolRepo *repo.RolRepo, usuarioRepo *repo.UsuarioRepo) *RolService {
	return &RolService{
		rolRepo:     rolRepo,
		usuarioRepo: usuarioRepo,
	}
}

// ListarPorTenant retorna todos los roles del tenant con la cantidad de usuarios.
func (s *RolService) ListarPorTenant(ctx context.Context, tenantID uuid.UUID) ([]model.RolTenant, error) {
	roles, err := s.rolRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("rol_service.ListarPorTenant: %w", err)
	}

	// Enriquecer con cantidad de usuarios asignados a cada rol
	for i := range roles {
		count, errCount := s.rolRepo.CountUsuariosPorRol(ctx, tenantID, roles[i].Slug)
		if errCount == nil {
			roles[i].CantidadUsuarios = count
		}
	}

	return roles, nil
}

// ObtenerPorID retorna un rol por su ID.
func (s *RolService) ObtenerPorID(ctx context.Context, tenantID, rolID uuid.UUID) (*model.RolTenant, error) {
	rol, err := s.rolRepo.GetByID(ctx, tenantID, rolID)
	if err != nil {
		return nil, fmt.Errorf("rol_service.ObtenerPorID: %w", err)
	}
	if rol == nil {
		return nil, apperror.ErrNotFound
	}

	count, _ := s.rolRepo.CountUsuariosPorRol(ctx, tenantID, rol.Slug)
	rol.CantidadUsuarios = count

	return rol, nil
}

// Crear crea un nuevo rol personalizado.
// rolSolicitante es el slug del rol del usuario que realiza la operación.
func (s *RolService) Crear(ctx context.Context, tenantID uuid.UUID, req dto.CrearRolRequest, rolSolicitante string) (*model.RolTenant, error) {
	// Validar permisos JSON
	if err := validarPermisosJSON(req.Permisos); err != nil {
		return nil, apperror.New(400, "PERMISOS_INVALIDOS", err.Error())
	}

	slug := generarSlugRol(req.Nombre)

	// Verificar que no exista un rol con el mismo slug
	existente, err := s.rolRepo.GetBySlug(ctx, tenantID, slug)
	if err != nil {
		return nil, fmt.Errorf("rol_service.Crear: %w", err)
	}
	if existente != nil {
		return nil, apperror.New(409, "ROL_DUPLICADO", "Ya existe un rol con un nombre similar")
	}

	// Determinar orden (último + 1)
	count, _ := s.rolRepo.CountByTenant(ctx, tenantID)

	// Solo un admin puede crear roles con es_admin=true
	esAdminSolicitante := s.esRolAdmin(ctx, tenantID, rolSolicitante)
	esAdmin := req.EsAdmin && esAdminSolicitante
	if req.EsAdmin && !esAdminSolicitante {
		return nil, apperror.New(403, "PERMISO_INSUFICIENTE", "Solo un administrador puede crear roles con privilegios de administrador")
	}

	color := req.Color
	if color == "" {
		color = "#6b7280"
	}

	rol := &model.RolTenant{
		TenantModel: model.TenantModel{TenantID: tenantID},
		Slug:        slug,
		Nombre:      strings.TrimSpace(req.Nombre),
		Descripcion: strings.TrimSpace(req.Descripcion),
		Color:       color,
		Permisos:    req.Permisos,
		EsAdmin:     esAdmin,
		EsBase:      false,
		Orden:       count,
	}

	if err := s.rolRepo.Create(ctx, rol); err != nil {
		return nil, fmt.Errorf("rol_service.Crear: %w", err)
	}

	return rol, nil
}

// Actualizar actualiza un rol existente (nombre, descripción, color, permisos).
// rolSolicitante es el slug del rol del usuario que realiza la operación.
func (s *RolService) Actualizar(ctx context.Context, tenantID, rolID uuid.UUID, req dto.ActualizarRolRequest, rolSolicitante string) (*model.RolTenant, error) {
	rol, err := s.rolRepo.GetByID(ctx, tenantID, rolID)
	if err != nil {
		return nil, fmt.Errorf("rol_service.Actualizar: %w", err)
	}
	if rol == nil {
		return nil, apperror.ErrNotFound
	}

	// Solo un admin puede editar roles base y su propio rol
	esAdmin := s.esRolAdmin(ctx, tenantID, rolSolicitante)
	if !esAdmin {
		if rol.EsBase {
			return nil, apperror.New(403, "ROL_PROTEGIDO", "Solo los administradores pueden modificar roles base del sistema")
		}
		// Impedir que un usuario edite su propio rol (escalamiento de privilegios)
		if strings.EqualFold(rol.Slug, strings.ToLower(rolSolicitante)) {
			return nil, apperror.New(403, "ROL_PROPIO", "No puedes modificar tu propio rol")
		}
	}

	// Validar permisos JSON
	if err := validarPermisosJSON(req.Permisos); err != nil {
		return nil, apperror.New(400, "PERMISOS_INVALIDOS", err.Error())
	}

	// Solo un admin puede cambiar es_admin
	if req.EsAdmin != rol.EsAdmin && !esAdmin {
		return nil, apperror.New(403, "PERMISO_INSUFICIENTE", "Solo un administrador puede modificar privilegios de administrador")
	}

	// Actualizar campos editables (no se cambia slug ni es_base)
	rol.Nombre = strings.TrimSpace(req.Nombre)
	rol.Descripcion = strings.TrimSpace(req.Descripcion)
	if req.Color != "" {
		rol.Color = req.Color
	}
	rol.Permisos = req.Permisos
	rol.EsAdmin = req.EsAdmin

	if err := s.rolRepo.Update(ctx, rol); err != nil {
		return nil, fmt.Errorf("rol_service.Actualizar: %w", err)
	}

	// Invalidar cache de permisos para que los cambios apliquen de inmediato
	middleware.InvalidarCacheRol(tenantID, rol.Slug)

	return rol, nil
}

// Eliminar elimina un rol (solo si no es base y no tiene usuarios asignados).
func (s *RolService) Eliminar(ctx context.Context, tenantID, rolID uuid.UUID, rolSolicitante string) error {
	rol, err := s.rolRepo.GetByID(ctx, tenantID, rolID)
	if err != nil {
		return fmt.Errorf("rol_service.Eliminar: %w", err)
	}
	if rol == nil {
		return apperror.ErrNotFound
	}

	// No se pueden eliminar roles base del sistema
	if rol.EsBase {
		return apperror.New(400, "ROL_BASE_NO_ELIMINABLE", "Los roles base del sistema no se pueden eliminar")
	}

	// Solo admin puede eliminar roles; no-admin no puede eliminar su propio rol
	esAdmin := s.esRolAdmin(ctx, tenantID, rolSolicitante)
	if !esAdmin && strings.EqualFold(rol.Slug, strings.ToLower(rolSolicitante)) {
		return apperror.New(403, "ROL_PROPIO", "No puedes eliminar tu propio rol")
	}

	// Verificar que no haya usuarios asignados
	count, err := s.rolRepo.CountUsuariosPorRol(ctx, tenantID, rol.Slug)
	if err != nil {
		return fmt.Errorf("rol_service.Eliminar: %w", err)
	}
	if count > 0 {
		return apperror.New(400, "ROL_CON_USUARIOS", fmt.Sprintf("No se puede eliminar: %d usuario(s) tienen este rol asignado", count))
	}

	// Invalidar cache antes de eliminar
	middleware.InvalidarCacheRol(tenantID, rol.Slug)

	return s.rolRepo.Delete(ctx, tenantID, rolID)
}

// ObtenerDefinicionPermisos retorna el mapa de módulos→acciones para la UI.
func (s *RolService) ObtenerDefinicionPermisos() map[string][]string {
	return model.DefinicionModulosPermisos()
}

// ObtenerMisPermisos retorna los permisos del rol actual del usuario.
// Para ADMIN retorna todos los permisos en true (bypass total).
func (s *RolService) ObtenerMisPermisos(ctx context.Context, tenantID uuid.UUID, rolSlug string) (map[string]map[string]bool, error) {
	rol, err := s.rolRepo.GetBySlug(ctx, tenantID, strings.ToLower(rolSlug))
	if err != nil {
		return nil, fmt.Errorf("rol_service.ObtenerMisPermisos: %w", err)
	}
	if rol == nil {
		return nil, apperror.New(404, "ROL_NO_ENCONTRADO", "Tu rol no tiene permisos configurados")
	}

	// Roles con es_admin tienen todos los permisos
	if rol.EsAdmin {
		var permisos map[string]map[string]bool
		json.Unmarshal(model.PermisosCompletoAdmin(), &permisos)
		return permisos, nil
	}

	var permisos map[string]map[string]bool
	if err := json.Unmarshal(rol.Permisos, &permisos); err != nil {
		return nil, fmt.Errorf("rol_service.ObtenerMisPermisos: JSON inválido: %w", err)
	}

	return permisos, nil
}

// ── Helpers internos ──

// esRolAdmin verifica si un rol tiene el flag es_admin en la DB.
func (s *RolService) esRolAdmin(ctx context.Context, tenantID uuid.UUID, rolSlug string) bool {
	rol, err := s.rolRepo.GetBySlug(ctx, tenantID, strings.ToLower(rolSlug))
	if err != nil || rol == nil {
		return false
	}
	return rol.EsAdmin
}

// generarSlugRol convierte "Supervisor de Calidad" → "supervisor-de-calidad"
func generarSlugRol(nombre string) string {
	t := norm.NFD.String(nombre)
	resultado := strings.Builder{}
	for _, r := range t {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		resultado.WriteRune(r)
	}
	slug := resultado.String()
	slug = strings.ToLower(slug)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "rol"
	}
	return slug
}

// validarPermisosJSON verifica que el JSON de permisos tenga estructura válida.
func validarPermisosJSON(raw json.RawMessage) error {
	var permisos map[string]map[string]bool
	if err := json.Unmarshal(raw, &permisos); err != nil {
		return fmt.Errorf("formato de permisos inválido: debe ser {modulo: {accion: bool}}")
	}
	return nil
}
