package service

import (
	"context"
	"fmt"
	"strings"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type UsuarioService struct {
	usuarioRepo     *repo.UsuarioRepo
	usuarioSedeRepo *repo.UsuarioSedeRepo
	dashboardRepo   *repo.DashboardRepo
	tenantRepo      *repo.TenantRepo
	rolRepo         *repo.RolRepo
}

func NewUsuarioService(usuarioRepo *repo.UsuarioRepo, usuarioSedeRepo *repo.UsuarioSedeRepo, dashboardRepo *repo.DashboardRepo, tenantRepo *repo.TenantRepo, rolRepo *repo.RolRepo) *UsuarioService {
	return &UsuarioService{
		usuarioRepo:     usuarioRepo,
		usuarioSedeRepo: usuarioSedeRepo,
		dashboardRepo:   dashboardRepo,
		tenantRepo:      tenantRepo,
		rolRepo:         rolRepo,
	}
}

// UsuarioConSedes extiende UsuarioAdmin con las sedes asignadas.
type UsuarioConSedes struct {
	model.UsuarioAdmin
	SedeIDs []string `json:"sede_ids"`
}

func (s *UsuarioService) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]UsuarioConSedes, error) {
	usuarios, err := s.usuarioRepo.GetByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	resultado := make([]UsuarioConSedes, len(usuarios))
	for i, u := range usuarios {
		sedes, _ := s.usuarioSedeRepo.ObtenerSedesPorUsuario(ctx, tenantID, u.ID)
		sedeStrs := make([]string, len(sedes))
		for j, sid := range sedes {
			sedeStrs[j] = sid.String()
		}
		resultado[i] = UsuarioConSedes{
			UsuarioAdmin: u,
			SedeIDs:      sedeStrs,
		}
	}
	return resultado, nil
}

func (s *UsuarioService) GetByID(ctx context.Context, tenantID, userID uuid.UUID) (*UsuarioConSedes, error) {
	user, err := s.usuarioRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.GetByID: %w", err)
	}
	if user == nil {
		return nil, apperror.ErrNotFound
	}
	sedes, _ := s.usuarioSedeRepo.ObtenerSedesPorUsuario(ctx, tenantID, userID)
	sedeStrs := make([]string, len(sedes))
	for i, sid := range sedes {
		sedeStrs[i] = sid.String()
	}
	return &UsuarioConSedes{
		UsuarioAdmin: *user,
		SedeIDs:      sedeStrs,
	}, nil
}

// rolValidoODefault confirma que el rol exista en roles_tenant para este
// tenant. La comparación es por slug en minúsculas (así lo guarda RolRepo),
// pero el valor persistido conserva las MAYÚSCULAS que ya usa el resto de la
// base (ADMIN, SOPORTE) para no romper el historial ni el login existente.
func (s *UsuarioService) rolValidoODefault(ctx context.Context, tenantID uuid.UUID, rol string) (string, error) {
	slug := strings.ToLower(strings.TrimSpace(rol))
	if slug == "" {
		return "", apperror.New(400, "ROL_REQUERIDO", "El rol es obligatorio.")
	}

	r, err := s.rolRepo.GetBySlug(ctx, tenantID, slug)
	if err != nil {
		return "", fmt.Errorf("usuario_service: validar rol: %w", err)
	}
	if r == nil {
		return "", apperror.New(400, "ROL_INVALIDO",
			"Ese rol no existe. Usa uno de los roles definidos para tu empresa.")
	}

	return strings.ToUpper(slug), nil
}

func (s *UsuarioService) Create(ctx context.Context, tenantID uuid.UUID, email, nombre, password, rol string, sedeIDs []uuid.UUID, creadoPor uuid.UUID) (*model.UsuarioAdmin, error) {
	// El rol debe existir en la tabla de roles de ESTE tenant. Sin esto, el
	// binding solo comprobaba la longitud del texto y aceptaba cualquier
	// string (ej. "SUPERADMIN"), ensuciando la base con roles inexistentes.
	rol, err := s.rolValidoODefault(ctx, tenantID, rol)
	if err != nil {
		return nil, err
	}

	// Validar límite del plan
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.Create: %w", err)
	}
	if uso == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	if !uso.CanCreateUsuario() {
		return nil, apperror.ErrPlanLimitUsuarios.Withf(uso.LimiteUsuarios)
	}

	// Validar email único dentro de este tenant
	existing, err := s.usuarioRepo.GetByEmail(ctx, tenantID, email)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.Create: %w", err)
	}
	if existing != nil {
		return nil, apperror.ErrConflict
	}

	// Resolver la cuenta del tenant para verificar si el email ya existe
	// en otra empresa de la MISMA CUENTA. Si existe, debemos preservar el
	// password_hash compartido para que el selector multi-empresa siga
	// funcionando. Crear un hash nuevo acá rompería la invariante y haría
	// que el usuario solo pueda loguear con uno de los dos passwords.
	tenant, err := s.tenantRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.Create tenant: %w", err)
	}

	var hash string
	var nombreFinal = nombre
	var hashReutilizado bool

	if tenant != nil && tenant.CuentaID.Valid {
		// Busca el hash del mismo email en cualquier empresa activa de la
		// cuenta. Si existe, lo reutilizamos y el password provisto por el
		// admin se ignora deliberadamente: la regla de negocio es que un
		// usuario tiene UNA sola contraseña por cuenta, compartida en todas
		// sus empresas.
		hashExistente, herr := s.usuarioRepo.ObtenerHashPorEmailEnCuenta(ctx, email, tenant.CuentaID.UUID)
		if herr != nil {
			return nil, fmt.Errorf("usuario_service.Create hash lookup: %w", herr)
		}
		if hashExistente != "" {
			hash = hashExistente
			hashReutilizado = true

			// Tomamos también el nombre_completo canónico del usuario
			// existente para que sea consistente entre empresas. Si el
			// admin pasó un nombre distinto, preferimos el del form.
			// (Comportamiento permisivo: respetamos el input del admin.)
			if nombreFinal == "" {
				accesos, _ := s.usuarioRepo.BuscarEnCuentaPorEmail(ctx, tenant.CuentaID.UUID, email)
				for _, a := range accesos {
					if a.Activo && a.NombreCompleto != "" {
						nombreFinal = a.NombreCompleto
						break
					}
				}
			}
		}
	}

	// Si no reutilizamos, generamos un hash nuevo con el password del form
	if hash == "" {
		h, herr := helper.HashPassword(password)
		if herr != nil {
			return nil, fmt.Errorf("usuario_service.Create hash: %w", herr)
		}
		hash = h
	}

	user := &model.UsuarioAdmin{
		TenantModel:    model.TenantModel{TenantID: tenantID},
		Email:          email,
		NombreCompleto: nombreFinal,
		PasswordHash:   hash,
		Rol:            rol,
		CreadoPor:      model.NullUUID{UUID: creadoPor, Valid: true},
	}

	// Si reutilizamos hash, usamos CrearConHash (no re-hashea). Si no,
	// usamos Create normal (que inserta tal cual).
	if hashReutilizado {
		if err := s.usuarioRepo.CrearConHash(ctx, user); err != nil {
			return nil, fmt.Errorf("usuario_service.Create crear-con-hash: %w", err)
		}
	} else {
		if err := s.usuarioRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("usuario_service.Create: %w", err)
		}
	}

	// Asignar sedes
	if len(sedeIDs) > 0 {
		if err := s.usuarioSedeRepo.AsignarSedes(ctx, tenantID, user.ID, sedeIDs); err != nil {
			return nil, fmt.Errorf("usuario_service.Create sedes: %w", err)
		}
	}

	return user, nil
}

func (s *UsuarioService) Update(ctx context.Context, tenantID, userID uuid.UUID, nombre, rol string, sedeIDs []uuid.UUID, activo bool) error {
	// Mismo blindaje que en Create: el rol debe existir para este tenant.
	rol, err := s.rolValidoODefault(ctx, tenantID, rol)
	if err != nil {
		return err
	}

	user, err := s.usuarioRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_service.Update: %w", err)
	}
	if user == nil {
		return apperror.ErrNotFound
	}

	// Si se está reactivando (de inactivo a activo), validar límite del plan
	if activo && !user.Activo {
		uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
		if err != nil {
			return fmt.Errorf("usuario_service.Update: %w", err)
		}
		if uso == nil {
			return apperror.ErrSuscripcionInactiva
		}
		if !uso.CanCreateUsuario() {
			return apperror.ErrPlanLimitUsuarios.Withf(uso.LimiteUsuarios)
		}
	}

	user.NombreCompleto = nombre
	user.Rol = rol
	user.Activo = activo

	if err := s.usuarioRepo.Update(ctx, user); err != nil {
		return err
	}

	// Reasignar sedes e invalidar cache
	if err := s.usuarioSedeRepo.AsignarSedes(ctx, tenantID, userID, sedeIDs); err != nil {
		return fmt.Errorf("usuario_service.Update sedes: %w", err)
	}
	middleware.InvalidarCacheSedes(tenantID, userID)

	return nil
}

func (s *UsuarioService) ChangePassword(ctx context.Context, tenantID, userID uuid.UUID, currentPwd, newPwd string) error {
	user, err := s.usuarioRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_service.ChangePassword: %w", err)
	}
	if user == nil {
		return apperror.ErrNotFound
	}
	if !helper.CheckPassword(currentPwd, user.PasswordHash) {
		return apperror.ErrCredencialesInvalidas
	}

	hash, err := helper.HashPassword(newPwd)
	if err != nil {
		return fmt.Errorf("usuario_service.ChangePassword hash: %w", err)
	}
	return s.usuarioRepo.UpdatePassword(ctx, tenantID, userID, hash)
}

func (s *UsuarioService) AdminResetPassword(ctx context.Context, tenantID, targetUserID uuid.UUID, newPwd string) error {
	user, err := s.usuarioRepo.GetByID(ctx, tenantID, targetUserID)
	if err != nil {
		return fmt.Errorf("usuario_service.AdminResetPassword: %w", err)
	}
	if user == nil {
		return apperror.ErrNotFound
	}
	hash, err := helper.HashPassword(newPwd)
	if err != nil {
		return fmt.Errorf("usuario_service.AdminResetPassword hash: %w", err)
	}
	return s.usuarioRepo.UpdatePassword(ctx, tenantID, targetUserID, hash)
}

func (s *UsuarioService) Deactivate(ctx context.Context, tenantID, userID uuid.UUID) error {
	user, err := s.usuarioRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_service.Deactivate: %w", err)
	}
	if user == nil {
		return apperror.ErrNotFound
	}
	return s.usuarioRepo.Deactivate(ctx, tenantID, userID)
}

func (s *UsuarioService) Reactivate(ctx context.Context, tenantID, userID uuid.UUID) error {
	user, err := s.usuarioRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_service.Reactivate: %w", err)
	}
	if user == nil {
		return apperror.ErrNotFound
	}

	// Validar límite del plan antes de reactivar
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("usuario_service.Reactivate: %w", err)
	}
	if uso == nil {
		return apperror.ErrSuscripcionInactiva
	}
	if !uso.CanCreateUsuario() {
		return apperror.ErrPlanLimitUsuarios.Withf(uso.LimiteUsuarios)
	}

	return s.usuarioRepo.Reactivate(ctx, tenantID, userID)
}

// ── Flujo "Agregar usuario existente" ────────────────────────────────────

// BuscarUsuarioEnCuenta busca un email dentro de todas las empresas de la
// cuenta a la que pertenece el tenantID indicado. Se usa en el modal de
// "Agregar usuario existente" para validar que el email tenga algún acceso
// previo en la cuenta antes de mostrar el formulario de asignación.
func (s *UsuarioService) BuscarUsuarioEnCuenta(ctx context.Context, tenantID uuid.UUID, email string) ([]repo.AccesoUsuarioEnCuenta, error) {
	tenant, err := s.tenantRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.BuscarUsuarioEnCuenta tenant: %w", err)
	}
	if tenant == nil || !tenant.CuentaID.Valid {
		return nil, apperror.ErrNotFound
	}
	return s.usuarioRepo.BuscarEnCuentaPorEmail(ctx, tenant.CuentaID.UUID, email)
}

// ListarCandidatosAgregarAEmpresa devuelve los usuarios de otras empresas de
// la misma cuenta que aún no tienen acceso al tenant indicado — alimenta el
// selector del modal "Agregar usuario existente" en el panel SA.
func (s *UsuarioService) ListarCandidatosAgregarAEmpresa(
	ctx context.Context,
	tenantID uuid.UUID,
) ([]repo.CandidatoUsuarioCuenta, error) {
	tenant, err := s.tenantRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.ListarCandidatosAgregarAEmpresa tenant: %w", err)
	}
	if tenant == nil || !tenant.CuentaID.Valid {
		return nil, apperror.ErrNotFound
	}
	return s.usuarioRepo.ListarCandidatosAgregarAEmpresa(ctx, tenant.CuentaID.UUID, tenantID)
}

// AgregarUsuarioExistente vincula a un usuario que ya existe en otra empresa
// de la misma cuenta al tenant destino, reutilizando el password_hash para
// mantener el selector multi-empresa funcionando.
//
// Comportamiento:
//   - Si el email no existe en NINGUNA empresa de la cuenta → ErrNotFound
//     (el SA/admin debe usar "Crear usuario" normal en ese caso)
//   - Si el email ya existe ACTIVO en el tenant destino → ErrConflict
//   - Si el email existe INACTIVO en el tenant destino → reactiva esa fila
//     y actualiza rol + sedes (preserva el user_id y el historial asociado)
//   - Si el email no existe en el tenant destino pero sí en otra empresa de
//     la cuenta → crea una fila nueva reutilizando el hash existente
//
// Validaciones:
//   - Límite de usuarios del plan del tenant destino
//   - Las sedes indicadas deben pertenecer al tenant destino (se asume que
//     el controller ya las parseó como UUIDs; la asignación falla si no
//     pertenecen al tenant)
func (s *UsuarioService) AgregarUsuarioExistente(
	ctx context.Context,
	tenantID uuid.UUID,
	email, rol string,
	sedeIDs []uuid.UUID,
	creadoPor uuid.UUID,
) (*model.UsuarioAdmin, error) {
	// 1. Resolver cuenta del tenant destino
	tenant, err := s.tenantRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.AgregarUsuarioExistente tenant: %w", err)
	}
	if tenant == nil || !tenant.CuentaID.Valid {
		return nil, apperror.ErrNotFound
	}
	cuentaID := tenant.CuentaID.UUID

	// 2. Buscar el email en todas las empresas de la cuenta
	accesos, err := s.usuarioRepo.BuscarEnCuentaPorEmail(ctx, cuentaID, email)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.AgregarUsuarioExistente buscar: %w", err)
	}
	if len(accesos) == 0 {
		// El email no existe en ninguna empresa de la cuenta — no hay nada
		// que reutilizar. El usuario debería crearse normalmente.
		return nil, apperror.ErrNotFound
	}

	// 3. Separar: ¿ya existe (activo o inactivo) en el tenant destino?
	var filaEnDestino *repo.AccesoUsuarioEnCuenta
	var hashReferencia string
	var nombreReferencia string
	for i := range accesos {
		a := accesos[i]
		if a.TenantID == tenantID {
			filaEnDestino = &accesos[i]
		}
		// Tomamos el hash y nombre de cualquier fila activa como referencia.
		// Gracias al fix de "hash compartido por cuenta", todas las filas
		// activas de la misma cuenta tienen el mismo hash.
		if a.Activo && hashReferencia == "" {
			hashReferencia = a.PasswordHash
			nombreReferencia = a.NombreCompleto
		}
	}

	// Si no hay ninguna fila activa en la cuenta, usamos la primera que
	// haya (el hash puede ser de una fila inactiva — es mejor que nada)
	if hashReferencia == "" {
		hashReferencia = accesos[0].PasswordHash
		nombreReferencia = accesos[0].NombreCompleto
	}

	// 4a. Caso: ya existe ACTIVO en el tenant destino → conflicto
	if filaEnDestino != nil && filaEnDestino.Activo {
		return nil, apperror.ErrConflict
	}

	// 4b. Caso: ya existe INACTIVO en el tenant destino → reactivar
	if filaEnDestino != nil && !filaEnDestino.Activo {
		// Validar límite del plan antes de reactivar
		uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("usuario_service.AgregarUsuarioExistente uso: %w", err)
		}
		if uso == nil {
			return nil, apperror.ErrSuscripcionInactiva
		}
		if !uso.CanCreateUsuario() {
			return nil, apperror.ErrPlanLimitUsuarios.Withf(uso.LimiteUsuarios)
		}

		// Resolver el userID de la fila inactiva
		existing, err := s.usuarioRepo.GetByEmail(ctx, tenantID, email)
		if err != nil {
			return nil, fmt.Errorf("usuario_service.AgregarUsuarioExistente get: %w", err)
		}
		if existing == nil {
			// Fallback: el GetByEmail solo trae activos, así que si el existente
			// está inactivo podemos no encontrarlo. Creamos una fila nueva.
			return s.crearNuevoAccesoConHash(ctx, tenantID, email, nombreReferencia, rol, hashReferencia, sedeIDs, creadoPor)
		}

		if err := s.usuarioRepo.ReactivarYActualizar(ctx, tenantID, existing.ID, nombreReferencia, rol, hashReferencia); err != nil {
			return nil, fmt.Errorf("usuario_service.AgregarUsuarioExistente reactivar: %w", err)
		}

		// Re-asignar sedes (reemplaza las que tenía antes de ser desactivado)
		if len(sedeIDs) > 0 {
			if err := s.usuarioSedeRepo.AsignarSedes(ctx, tenantID, existing.ID, sedeIDs); err != nil {
				return nil, fmt.Errorf("usuario_service.AgregarUsuarioExistente sedes: %w", err)
			}
		}

		// Devolver el modelo actualizado
		return s.usuarioRepo.GetByID(ctx, tenantID, existing.ID)
	}

	// 4c. Caso: no existe en el tenant destino → crear nueva fila
	return s.crearNuevoAccesoConHash(ctx, tenantID, email, nombreReferencia, rol, hashReferencia, sedeIDs, creadoPor)
}

// crearNuevoAccesoConHash crea una nueva fila en usuarios_admin para el tenant
// destino, reutilizando el hash del usuario existente en la cuenta. Respeta
// el límite del plan.
func (s *UsuarioService) crearNuevoAccesoConHash(
	ctx context.Context,
	tenantID uuid.UUID,
	email, nombre, rol, passwordHash string,
	sedeIDs []uuid.UUID,
	creadoPor uuid.UUID,
) (*model.UsuarioAdmin, error) {
	// Validar límite del plan
	uso, err := s.dashboardRepo.GetUsoTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_service.crearNuevoAccesoConHash uso: %w", err)
	}
	if uso == nil {
		return nil, apperror.ErrSuscripcionInactiva
	}
	if !uso.CanCreateUsuario() {
		return nil, apperror.ErrPlanLimitUsuarios.Withf(uso.LimiteUsuarios)
	}

	user := &model.UsuarioAdmin{
		TenantModel:    model.TenantModel{TenantID: tenantID},
		Email:          email,
		NombreCompleto: nombre,
		PasswordHash:   passwordHash,
		Rol:            rol,
		CreadoPor:      model.NullUUID{UUID: creadoPor, Valid: true},
	}

	if err := s.usuarioRepo.CrearConHash(ctx, user); err != nil {
		return nil, fmt.Errorf("usuario_service.crearNuevoAccesoConHash crear: %w", err)
	}

	if len(sedeIDs) > 0 {
		if err := s.usuarioSedeRepo.AsignarSedes(ctx, tenantID, user.ID, sedeIDs); err != nil {
			return nil, fmt.Errorf("usuario_service.crearNuevoAccesoConHash sedes: %w", err)
		}
	}

	return user, nil
}