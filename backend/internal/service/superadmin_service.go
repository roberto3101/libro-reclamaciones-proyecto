package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type SuperAdminService struct {
	saRepo          *repo.SuperAdminRepo
	cuentaRepo      *repo.CuentaRepo
	tenantRepo      *repo.TenantRepo
	planRepo        *repo.PlanRepo
	sedeRepo        *repo.SedeRepo
	usuarioRepo     *repo.UsuarioRepo
	reclamoRepo     *repo.ReclamoRepo
	usuarioSedeRepo *repo.UsuarioSedeRepo
	auditSARepo     *repo.AuditoriaSARepo
	errorLogRepo    *repo.ErrorLogRepo
	alertaRepo      *repo.ErrorAlertaRepo
	metricasRepo    *repo.APIMetricasRepo
	cuentaNotasRepo *repo.CuentaNotasRepo
	onboardingSvc   *OnboardingService
	db              *sql.DB
	jwtCfg          config.JWTConfig
}

func NewSuperAdminService(
	saRepo *repo.SuperAdminRepo,
	cuentaRepo *repo.CuentaRepo,
	tenantRepo *repo.TenantRepo,
	planRepo *repo.PlanRepo,
	sedeRepo *repo.SedeRepo,
	usuarioRepo *repo.UsuarioRepo,
	reclamoRepo *repo.ReclamoRepo,
	usuarioSedeRepo *repo.UsuarioSedeRepo,
	auditSARepo *repo.AuditoriaSARepo,
	errorLogRepo *repo.ErrorLogRepo,
	alertaRepo *repo.ErrorAlertaRepo,
	metricasRepo *repo.APIMetricasRepo,
	cuentaNotasRepo *repo.CuentaNotasRepo,
	onboardingSvc *OnboardingService,
	db *sql.DB,
	jwtCfg config.JWTConfig,
) *SuperAdminService {
	return &SuperAdminService{
		saRepo:          saRepo,
		cuentaRepo:      cuentaRepo,
		tenantRepo:      tenantRepo,
		planRepo:        planRepo,
		sedeRepo:        sedeRepo,
		usuarioRepo:     usuarioRepo,
		reclamoRepo:     reclamoRepo,
		usuarioSedeRepo: usuarioSedeRepo,
		auditSARepo:     auditSARepo,
		errorLogRepo:    errorLogRepo,
		alertaRepo:      alertaRepo,
		metricasRepo:    metricasRepo,
		cuentaNotasRepo: cuentaNotasRepo,
		onboardingSvc:   onboardingSvc,
		db:              db,
		jwtCfg:          jwtCfg,
	}
}

// ── Auth ────────────────────────────────────────────────────────────────

type SALoginResult struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"`
	SA        struct {
		ID     uuid.UUID `json:"id"`
		Email  string    `json:"email"`
		Nombre string    `json:"nombre"`
	} `json:"user"`
}

func (s *SuperAdminService) Login(ctx context.Context, email, password string) (*SALoginResult, error) {
	sa, err := s.saRepo.ObtenerPorEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.Login: %w", err)
	}
	if sa == nil || !sa.Activo {
		return nil, apperror.ErrCredencialesInvalidas
	}

	if !helper.CheckPassword(password, sa.PasswordHash) {
		return nil, apperror.ErrCredencialesInvalidas
	}

	token, err := middleware.GenerarTokenSuperAdmin(sa.ID, sa.Email, s.jwtCfg)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.Login token: %w", err)
	}

	_ = s.saRepo.ActualizarUltimoAcceso(ctx, sa.ID)

	resultado := &SALoginResult{
		Token:     token,
		ExpiresIn: s.jwtCfg.ExpirationHours * 3600,
	}
	resultado.SA.ID = sa.ID
	resultado.SA.Email = sa.Email
	resultado.SA.Nombre = sa.Nombre

	return resultado, nil
}

// ── Estadísticas ────────────────────────────────────────────────────────

type EstadisticasGlobales struct {
	TotalCuentas    int `json:"total_cuentas"`
	CuentasActivas  int `json:"cuentas_activas"`
	TotalEmpresas   int `json:"total_empresas"`
	EmpresasActivas int `json:"empresas_activas"`
	TotalUsuarios   int `json:"total_usuarios"`
	TotalReclamos   int `json:"total_reclamos"`
	TotalPlanes     int `json:"total_planes"`
	TotalSuperAdmins int `json:"total_superadmins"`
}

func (s *SuperAdminService) ObtenerEstadisticas(ctx context.Context) (*EstadisticasGlobales, error) {
	var e EstadisticasGlobales

	queries := []struct {
		query string
		dest  *int
	}{
		{"SELECT COUNT(*) FROM cuentas", &e.TotalCuentas},
		{"SELECT COUNT(*) FROM cuentas WHERE activo = true", &e.CuentasActivas},
		{"SELECT COUNT(*) FROM configuracion_tenant", &e.TotalEmpresas},
		{"SELECT COUNT(*) FROM configuracion_tenant WHERE activo = true", &e.EmpresasActivas},
		{"SELECT COUNT(*) FROM usuarios_admin WHERE activo = true", &e.TotalUsuarios},
		{"SELECT COUNT(*) FROM reclamos WHERE deleted_at IS NULL", &e.TotalReclamos},
		{"SELECT COUNT(*) FROM planes WHERE activo = true", &e.TotalPlanes},
		{"SELECT COUNT(*) FROM superadmins WHERE activo = true", &e.TotalSuperAdmins},
	}

	for _, q := range queries {
		if err := s.db.QueryRowContext(ctx, q.query).Scan(q.dest); err != nil {
			return nil, fmt.Errorf("superadmin_service.Estadisticas: %w", err)
		}
	}

	return &e, nil
}

// ── Cuentas ─────────────────────────────────────────────────────────────

func (s *SuperAdminService) ListarCuentas(ctx context.Context, offset, limite int, busqueda string) ([]model.Cuenta, int, error) {
	if busqueda != "" {
		return s.cuentaRepo.BuscarPorEmailONombre(ctx, busqueda, offset, limite)
	}
	return s.cuentaRepo.ListarTodas(ctx, offset, limite)
}

func (s *SuperAdminService) ObtenerCuenta(ctx context.Context, id uuid.UUID) (*model.CuentaConTenants, error) {
	cuenta, err := s.cuentaRepo.ObtenerPorID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.ObtenerCuenta: %w", err)
	}
	if cuenta == nil {
		return nil, apperror.ErrNotFound
	}

	tenants, err := s.tenantRepo.GetByCuentaID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.ObtenerCuenta tenants: %w", err)
	}

	return &model.CuentaConTenants{
		Cuenta:  *cuenta,
		Tenants: tenants,
	}, nil
}

func (s *SuperAdminService) CrearCuenta(ctx context.Context, req dto.CrearCuentaRequest) (*model.Cuenta, error) {
	if err := validarDatosCuenta(req.Nombre, req.EmailContacto, req.Telefono, req.RUC, req.Direccion, req.Notas); err != nil {
		return nil, err
	}
	cuenta := &model.Cuenta{
		Nombre:        req.Nombre,
		EmailContacto: req.EmailContacto,
		Telefono:      saNullStr(req.Telefono),
		RUC:           saNullStr(req.RUC),
		Direccion:     saNullStr(req.Direccion),
		Notas:         saNullStr(req.Notas),
		Activo:        true,
	}

	if err := s.cuentaRepo.Crear(ctx, cuenta); err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearCuenta: %w", err)
	}
	return cuenta, nil
}

func (s *SuperAdminService) ActualizarCuenta(ctx context.Context, id uuid.UUID, req dto.ActualizarCuentaRequest) error {
	nombre := ""
	if req.Nombre != nil { nombre = *req.Nombre }
	email := ""
	if req.EmailContacto != nil { email = *req.EmailContacto }
	tel := ""
	if req.Telefono != nil { tel = *req.Telefono }
	ruc := ""
	if req.RUC != nil { ruc = *req.RUC }
	dir := ""
	if req.Direccion != nil { dir = *req.Direccion }
	notas := ""
	if req.Notas != nil { notas = *req.Notas }
	if err := validarDatosCuentaParcial(nombre, email, tel, ruc, dir, notas); err != nil {
		return err
	}

	cuenta, err := s.cuentaRepo.ObtenerPorID(ctx, id)
	if err != nil {
		return fmt.Errorf("superadmin_service.ActualizarCuenta: %w", err)
	}
	if cuenta == nil {
		return apperror.ErrNotFound
	}

	if req.Nombre != nil {
		cuenta.Nombre = *req.Nombre
	}
	if req.EmailContacto != nil {
		cuenta.EmailContacto = *req.EmailContacto
	}
	if req.Telefono != nil {
		cuenta.Telefono = saNullStr(*req.Telefono)
	}
	if req.RUC != nil {
		cuenta.RUC = saNullStr(*req.RUC)
	}
	if req.Direccion != nil {
		cuenta.Direccion = saNullStr(*req.Direccion)
	}
	if req.Notas != nil {
		cuenta.Notas = saNullStr(*req.Notas)
	}
	if req.Activo != nil {
		cuenta.Activo = *req.Activo
	}

	return s.cuentaRepo.Actualizar(ctx, cuenta)
}

func (s *SuperAdminService) CambiarEstadoCuenta(ctx context.Context, id uuid.UUID, activo bool) error {
	if err := s.cuentaRepo.CambiarEstado(ctx, id, activo); err != nil {
		return err
	}
	if !activo {
		_, err := s.db.ExecContext(ctx, `UPDATE configuracion_tenant SET activo = false, fecha_actualizacion = now() WHERE cuenta_id = $1 AND activo = true`, id)
		return err
	}
	return nil
}

// ── Empresas (Tenants) ──────────────────────────────────────────────────

func (s *SuperAdminService) ListarEmpresas(ctx context.Context, offset, limite int) ([]model.TenantResumen, int, error) {
	return s.tenantRepo.ListAll(ctx, offset, limite)
}

func (s *SuperAdminService) CambiarEstadoEmpresa(ctx context.Context, tenantID uuid.UUID, activo bool) error {
	return s.tenantRepo.SetActivo(ctx, tenantID, activo)
}

func (s *SuperAdminService) CrearEmpresaBajoCuenta(ctx context.Context, cuentaID uuid.UUID, req dto.CrearTenantBajoCuentaRequest) (*OnboardingResult, error) {
	// Verificar que la cuenta existe
	cuenta, err := s.cuentaRepo.ObtenerPorID(ctx, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearEmpresa: %w", err)
	}
	if cuenta == nil {
		return nil, apperror.ErrNotFound
	}
	if !cuenta.Activo {
		return nil, apperror.New(409, "CUENTA_INACTIVA",
			"No se puede crear empresa en una cuenta inactiva. Reactiva la cuenta primero.")
	}



	var planID uuid.UUID
	if req.PlanID != "" {
		planID, _ = uuid.Parse(req.PlanID)
	}

	// Si el email ya existe en otro tenant de esta misma cuenta, reutilizar
	// su hash para que todos los tenants de la cuenta queden con el mismo
	// bcrypt hash y el selector de empresa funcione correctamente al login.
	hashExistente, err := s.usuarioRepo.ObtenerHashPorEmailEnCuenta(ctx, req.Email, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearEmpresa hash lookup: %w", err)
	}
	onbReq := OnboardingRequest{
		CuentaID:          cuentaID,
		RazonSocial:       req.RazonSocial,
		RUC:               req.RUC,
		Email:             req.Email,
		Password:          req.Password,
		NombreAdmin:       req.NombreAdmin,
		Telefono:          req.Telefono,
		DireccionLegal:    req.DireccionLegal,
		PlanID:            planID,
		EsTrial:           req.EsTrial,
		DiasTrialOverride: req.DiasTrial,
	}
	if hashExistente != "" {
		onbReq.PasswordHash = hashExistente
	}
	resultado, err := s.onboardingSvc.Registrar(ctx, onbReq)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearEmpresa onboarding: %w", err)
	}

	return resultado, nil
}

// ── Detalle de Empresa (para el SA — ve todo de cualquier tenant) ────────

func (s *SuperAdminService) ObtenerEmpresa(ctx context.Context, tenantID uuid.UUID) (*model.Tenant, error) {
	return s.tenantRepo.GetByTenantID(ctx, tenantID)
}

func (s *SuperAdminService) ObtenerSedesDeEmpresa(ctx context.Context, tenantID uuid.UUID) ([]model.Sede, error) {
	return s.sedeRepo.GetByTenant(ctx, tenantID)
}

type UsuarioEmpresaSA struct {
	model.UsuarioAdmin
	SedeIDs []string `json:"sede_ids"`
}

func (s *SuperAdminService) ObtenerUsuariosDeEmpresa(ctx context.Context, tenantID uuid.UUID) ([]UsuarioEmpresaSA, error) {
	usuarios, err := s.usuarioRepo.GetByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	resultado := make([]UsuarioEmpresaSA, len(usuarios))
	for i, u := range usuarios {
		sedes, _ := s.usuarioSedeRepo.ObtenerSedesPorUsuario(ctx, tenantID, u.ID)
		strs := make([]string, len(sedes))
		for j, sid := range sedes {
			strs[j] = sid.String()
		}
		resultado[i] = UsuarioEmpresaSA{UsuarioAdmin: u, SedeIDs: strs}
	}
	return resultado, nil
}

func (s *SuperAdminService) ObtenerReclamosDeEmpresa(ctx context.Context, tenantID uuid.UUID, offset, limite int, sedeID *uuid.UUID, busqueda string) ([]model.Reclamo, int, error) {
	pag := dto.PaginationRequest{Page: (offset / limite) + 1, PerPage: limite}
	filtros := repo.FiltrosListado{}
	if sedeID != nil {
		filtros.SedeIDs = []uuid.UUID{*sedeID}
	}
	if busqueda != "" {
		filtros.Busqueda = &busqueda
	}
	return s.reclamoRepo.GetByTenant(ctx, tenantID, pag, filtros)
}

func (s *SuperAdminService) ActualizarConfigEmpresa(ctx context.Context, tenant *model.Tenant) error {
	return s.tenantRepo.Update(ctx, tenant)
}

func (s *SuperAdminService) ActivarDesactivarSede(ctx context.Context, tenantID, sedeID uuid.UUID, activo bool) error {
	// Toggle directo en la DB
	query := `UPDATE sedes SET activo = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := s.db.ExecContext(ctx, query, activo, tenantID, sedeID)
	return err
}

func (s *SuperAdminService) CambiarPlanEmpresa(ctx context.Context, tenantID uuid.UUID, planID uuid.UUID) error {
	query := `UPDATE suscripciones SET plan_id = $1, fecha_actualizacion = now() WHERE tenant_id = $2 AND estado IN ('ACTIVA', 'TRIAL')`
	_, err := s.db.ExecContext(ctx, query, planID, tenantID)
	return err
}

func (s *SuperAdminService) ActualizarUsuarioDeEmpresa(ctx context.Context, tenantID, userID uuid.UUID, activo bool) error {
	query := `UPDATE usuarios_admin SET activo = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := s.db.ExecContext(ctx, query, activo, tenantID, userID)
	return err
}

// EditarUsuarioDeEmpresa actualiza nombre, email, rol y sedes de un usuario.
func (s *SuperAdminService) EditarUsuarioDeEmpresa(ctx context.Context, tenantID, userID uuid.UUID, nombre, email, rol string, sedeIDs []uuid.UUID) error {
	query := `UPDATE usuarios_admin SET nombre_completo = $1, email = $2, rol = $3 WHERE tenant_id = $4 AND id = $5`
	if _, err := s.db.ExecContext(ctx, query, nombre, email, rol, tenantID, userID); err != nil {
		return fmt.Errorf("superadmin_service.EditarUsuario: %w", err)
	}
	if err := s.usuarioSedeRepo.AsignarSedes(ctx, tenantID, userID, sedeIDs); err != nil {
		return fmt.Errorf("superadmin_service.EditarUsuario sedes: %w", err)
	}
	return nil
}

// ResetearPasswordUsuario genera un nuevo password para un usuario y lo aplica
// a TODAS las filas del mismo email dentro de la misma cuenta. Esto mantiene
// sincronizados los hashes multi-empresa y evita romper el selector de login
// cuando el usuario tiene acceso a varias empresas de la cuenta.
// debe_cambiar_password se deja en false: la contraseña que el SA asigna
// queda como la definitiva del usuario. Decisión de negocio: forzar el
// cambio generaba olvidos del usuario, bloqueos, y más carga de soporte.
// Se prioriza la ergonomía. El SA es responsable de comunicar la contraseña
// al usuario por un canal seguro.
func (s *SuperAdminService) ResetearPasswordUsuario(ctx context.Context, tenantID, userID uuid.UUID, nuevoPassword string) error {
	hash, err := helper.HashPassword(nuevoPassword)
	if err != nil {
		return fmt.Errorf("superadmin_service.ResetearPassword hash: %w", err)
	}
	return s.usuarioRepo.ActualizarPasswordEnCuenta(ctx, tenantID, userID, hash, false)
}

// ── Planes ──────────────────────────────────────────────────────────────

func (s *SuperAdminService) ListarPlanes(ctx context.Context) ([]model.Plan, error) {
	return s.planRepo.GetAllIncluyendoInactivos(ctx)
}

func (s *SuperAdminService) ObtenerPlan(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	plan, err := s.planRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.ObtenerPlan: %w", err)
	}
	if plan == nil {
		return nil, apperror.ErrNotFound
	}
	return plan, nil
}

func (s *SuperAdminService) CrearPlan(ctx context.Context, plan *model.Plan) error {
	return s.planRepo.Create(ctx, plan)
}

func (s *SuperAdminService) ActualizarPlan(ctx context.Context, id uuid.UUID, plan *model.Plan) error {
	plan.ID = id
	return s.planRepo.Update(ctx, plan)
}

func (s *SuperAdminService) ContarSuscripcionesPlan(ctx context.Context, planID uuid.UUID) (int, error) {
	return s.planRepo.ContarSuscripcionesActivas(ctx, planID)
}

// ── Staff (SuperAdmins) ─────────────────────────────────────────────────

func (s *SuperAdminService) ListarStaff(ctx context.Context) ([]model.SuperAdmin, error) {
	return s.saRepo.ListarTodos(ctx)
}

func (s *SuperAdminService) CrearStaff(ctx context.Context, email, password, nombre string) (*model.SuperAdmin, error) {
	existente, err := s.saRepo.ObtenerPorEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearStaff: %w", err)
	}
	if existente != nil {
		return nil, apperror.ErrConflict
	}

	hash, err := helper.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearStaff hash: %w", err)
	}

	sa := &model.SuperAdmin{
		Email:        email,
		PasswordHash: hash,
		Nombre:       nombre,
		Activo:       true,
	}

	if err := s.saRepo.Crear(ctx, sa); err != nil {
		return nil, fmt.Errorf("superadmin_service.CrearStaff: %w", err)
	}
	return sa, nil
}

// ── Búsqueda Global ────────────────────────────────────────────────────

type ResultadoBusqueda struct {
	Cuentas  []BusquedaItem `json:"cuentas"`
	Empresas []BusquedaItem `json:"empresas"`
	Usuarios []BusquedaItem `json:"usuarios"`
}

type BusquedaItem struct {
	ID          string `json:"id"`
	Titulo      string `json:"titulo"`
	Subtitulo   string `json:"subtitulo"`
	Tipo        string `json:"tipo"`
	TenantID    string `json:"tenant_id,omitempty"`
}

func (s *SuperAdminService) BuscarGlobal(ctx context.Context, query string, limite int) (*ResultadoBusqueda, error) {
	if limite <= 0 || limite > 10 {
		limite = 5
	}
	patron := "%" + query + "%"
	res := &ResultadoBusqueda{}

	// Cuentas
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, nombre, email_contacto FROM cuentas WHERE nombre ILIKE $1 OR email_contacto ILIKE $1 LIMIT $2`, patron, limite)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var item BusquedaItem
			var email string
			rows.Scan(&item.ID, &item.Titulo, &email)
			item.Subtitulo = email
			item.Tipo = "cuenta"
			res.Cuentas = append(res.Cuentas, item)
		}
	}

	// Empresas
	rows2, err := s.db.QueryContext(ctx,
		`SELECT tenant_id, razon_social, ruc FROM configuracion_tenant WHERE razon_social ILIKE $1 OR ruc ILIKE $1 OR slug ILIKE $1 LIMIT $2`, patron, limite)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var item BusquedaItem
			var ruc string
			rows2.Scan(&item.ID, &item.Titulo, &ruc)
			item.Subtitulo = ruc
			item.Tipo = "empresa"
			res.Empresas = append(res.Empresas, item)
		}
	}

	// Usuarios
	rows3, err := s.db.QueryContext(ctx,
		`SELECT id, nombre_completo, email, tenant_id FROM usuarios_admin WHERE nombre_completo ILIKE $1 OR email ILIKE $1 LIMIT $2`, patron, limite)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var item BusquedaItem
			var email, tenantID string
			rows3.Scan(&item.ID, &item.Titulo, &email, &tenantID)
			item.Subtitulo = email
			item.Tipo = "usuario"
			item.TenantID = tenantID
			res.Usuarios = append(res.Usuarios, item)
		}
	}

	return res, nil
}

// ── Revenue Metrics ────────────────────────────────────────────────────

type RevenueMetrics struct {
	MRR                float64             `json:"mrr"`
	ARR                float64             `json:"arr"`
	TotalActivas       int                 `json:"total_activas"`
	TotalTrials        int                 `json:"total_trials"`
	TotalCanceladas    int                 `json:"total_canceladas"`
	TotalVencidas      int                 `json:"total_vencidas"`
	PorPlan            []SuscripcionPorPlan `json:"por_plan"`
}

type SuscripcionPorPlan struct {
	PlanNombre string `json:"plan_nombre"`
	Count      int    `json:"count"`
}

func (s *SuperAdminService) ObtenerRevenueMetrics(ctx context.Context) (*RevenueMetrics, error) {
	m := &RevenueMetrics{}

	// MRR: mensual + (anual / 12)
	s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(
			CASE WHEN s.ciclo = 'MENSUAL' THEN p.precio_mensual
			     WHEN s.ciclo = 'ANUAL' AND p.precio_anual IS NOT NULL THEN p.precio_anual / 12
			     ELSE p.precio_mensual END
		), 0)
		FROM suscripciones s JOIN planes p ON s.plan_id = p.id
		WHERE s.estado IN ('ACTIVA', 'TRIAL')
	`).Scan(&m.MRR)
	m.ARR = m.MRR * 12

	// Conteos por estado
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM suscripciones WHERE estado = 'ACTIVA'`).Scan(&m.TotalActivas)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM suscripciones WHERE estado = 'TRIAL'`).Scan(&m.TotalTrials)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM suscripciones WHERE estado = 'CANCELADA'`).Scan(&m.TotalCanceladas)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM suscripciones WHERE estado = 'VENCIDA'`).Scan(&m.TotalVencidas)

	// Distribución por plan
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.nombre, COUNT(*)
		FROM suscripciones s JOIN planes p ON s.plan_id = p.id
		WHERE s.estado IN ('ACTIVA', 'TRIAL')
		GROUP BY p.nombre ORDER BY COUNT(*) DESC`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pp SuscripcionPorPlan
			rows.Scan(&pp.PlanNombre, &pp.Count)
			m.PorPlan = append(m.PorPlan, pp)
		}
	}

	return m, nil
}

// ── Impersonación ──────────────────────────────────────────────────────

type ImpersonarResult struct {
	Token              string `json:"token"`
	TenantID           string `json:"tenant_id"`
	UserID             string `json:"user_id"`
	Role               string `json:"role"`
	RazonSocial        string `json:"razon_social"`
	TenantSlug         string `json:"tenant_slug"`
	Email              string `json:"email"`
	NombreCompleto     string `json:"nombre_completo"`
	DebeCambiarPassword bool  `json:"debe_cambiar_password"`
}

func (s *SuperAdminService) Impersonar(ctx context.Context, tenantID uuid.UUID, userIDOpt *uuid.UUID) (*ImpersonarResult, error) {
	// Obtener empresa
	tenant, err := s.tenantRepo.GetByTenantID(ctx, tenantID)
	if err != nil || tenant == nil {
		return nil, apperror.ErrNotFound
	}

	var usuario *model.UsuarioAdmin
	if userIDOpt != nil {
		usuario, err = s.usuarioRepo.GetByID(ctx, tenantID, *userIDOpt)
	} else {
		// Buscar primer admin activo
		usuarios, err2 := s.usuarioRepo.GetByTenant(ctx, tenantID)
		if err2 != nil {
			return nil, fmt.Errorf("superadmin_service.Impersonar: %w", err2)
		}
		for _, u := range usuarios {
			if u.Activo && u.Rol == "ADMIN" {
				uCopy := u
				usuario = &uCopy
				break
			}
		}
	}
	if err != nil || usuario == nil {
		return nil, fmt.Errorf("no se encontró usuario admin activo en esta empresa")
	}

	// Generar token estándar del panel normal
	token, err := middleware.GenerateToken(tenantID, usuario.ID, usuario.Rol, s.jwtCfg)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.Impersonar token: %w", err)
	}

	return &ImpersonarResult{
		Token:               token,
		TenantID:            tenantID.String(),
		UserID:              usuario.ID.String(),
		Role:                usuario.Rol,
		RazonSocial:         tenant.RazonSocial,
		TenantSlug:          tenant.Slug,
		Email:               usuario.Email,
		NombreCompleto:      usuario.NombreCompleto,
		DebeCambiarPassword: usuario.DebeCambiarPassword,
	}, nil
}

// ── Audit Log ──────────────────────────────────────────────────────────

func (s *SuperAdminService) RegistrarAuditoria(ctx context.Context, saID uuid.UUID, accion, entidad string, entidadID string, detalles interface{}, ip string) {
	var entIDPtr, detPtr, ipPtr *string
	if entidadID != "" {
		entIDPtr = &entidadID
	}
	if detalles != nil {
		b, _ := json.Marshal(detalles)
		str := string(b)
		detPtr = &str
	}
	if ip != "" {
		ipPtr = &ip
	}
	// Fire and forget — no queremos que un error de auditoría bloquee la operación
	go func() {
		_ = s.auditSARepo.Create(context.Background(), saID, accion, entidad, entIDPtr, detPtr, ipPtr)
	}()
}

// ── Wrappers de auditoría enriquecida (delegan al repo) ──
//
// Estos delegan a los helpers del auditSARepo que hacen lookups automáticos
// de nombres legibles (razón social, email, etc.). El controller los llama
// en lugar de armar manualmente cada `detalles`.

func (s *SuperAdminService) AuditarAccionCuenta(saID, cuentaID uuid.UUID, accion string, extra map[string]interface{}, ip string) {
	s.auditSARepo.RegistrarAccionCuenta(saID, cuentaID, accion, extra, ip)
}

func (s *SuperAdminService) AuditarAccionEmpresa(saID, tenantID uuid.UUID, accion string, extra map[string]interface{}, ip string) {
	s.auditSARepo.RegistrarAccionEmpresa(saID, tenantID, accion, extra, ip)
}

func (s *SuperAdminService) AuditarAccionUsuarioTenant(saID, tenantID, userID uuid.UUID, accion string, extra map[string]interface{}, ip string) {
	s.auditSARepo.RegistrarAccionUsuarioTenant(saID, tenantID, userID, accion, extra, ip)
}

func (s *SuperAdminService) AuditarAccionPlan(saID, planID uuid.UUID, accion string, extra map[string]interface{}, ip string) {
	s.auditSARepo.RegistrarAccionPlanSA(saID, planID, accion, extra, ip)
}

func (s *SuperAdminService) AuditarAccionStaff(saID, targetSAID uuid.UUID, accion string, extra map[string]interface{}, ip string) {
	s.auditSARepo.RegistrarAccionStaff(saID, targetSAID, accion, extra, ip)
}

// QueryPlanResumen es un lookup ligero para obtener el código y nombre de un
// plan sin cargar la fila completa. Útil para enriquecer detalles de auditoría
// en el handler. Falla en silencio (codigo y nombre quedan vacíos).
func (s *SuperAdminService) QueryPlanResumen(ctx context.Context, planID uuid.UUID, codigo, nombre *string) error {
	plan, err := s.planRepo.GetByID(ctx, planID)
	if err != nil || plan == nil {
		return err
	}
	*codigo = plan.Codigo
	*nombre = plan.Nombre
	return nil
}

func (s *SuperAdminService) ListarAuditoria(ctx context.Context, limite, offset int) ([]repo.AuditoriaSAEntry, int, error) {
	return s.auditSARepo.Listar(ctx, limite, offset)
}

func (s *SuperAdminService) ListarActividadEmpresas(ctx context.Context, limite, offset int, filtros repo.FiltrosActividad) ([]repo.ActividadEmpresaEntry, int, error) {
	return s.auditSARepo.ListarActividadEmpresas(ctx, limite, offset, filtros)
}

// StreamActividadEmpresas delega al repo. El caller (controller) se encarga
// del writer HTTP y del formato de salida (CSV/JSON).
// `limite` permite al cliente acotar el export (p.ej. PDF pide últimos 5.000).
// Si es 0 o supera el máximo duro del repo, se usa el máximo.
func (s *SuperAdminService) StreamActividadEmpresas(
	ctx context.Context,
	filtros repo.FiltrosActividad,
	limite int,
	yield func(e repo.ActividadEmpresaEntry) error,
) (int, error) {
	return s.auditSARepo.StreamActividadEmpresas(ctx, filtros, limite, yield)
}

// ── Error Log ──────────────────────────────────────────────────────────

func (s *SuperAdminService) ListarErrores(ctx context.Context, limite, offset int, filtros repo.ErrorLogFiltros) ([]repo.ErrorLogEntry, int, error) {
	return s.errorLogRepo.Listar(ctx, limite, offset, filtros)
}

func (s *SuperAdminService) ResumenErrores(ctx context.Context, filtros repo.ErrorLogFiltros) (*repo.ErrorResumen, error) {
	return s.errorLogRepo.Resumen(ctx, filtros)
}

func (s *SuperAdminService) ReportarErrorFrontend(ctx context.Context, tenantID, usuarioID *uuid.UUID, mensaje, stack, ruta, ip, userAgent, breadcrumbs string) error {
	fingerprint := fmt.Sprintf("%x", []byte(mensaje+"::"+ruta+"::"))
	return s.errorLogRepo.InsertarErrorFrontend(ctx, tenantID, usuarioID, mensaje, stack, ruta, ip, userAgent, breadcrumbs, fingerprint)
}

func (s *SuperAdminService) ListarErroresAgrupados(ctx context.Context, limite, offset int, filtros repo.ErrorLogFiltros) ([]repo.ErrorLogAgrupado, int, error) {
	return s.errorLogRepo.ListarAgrupados(ctx, limite, offset, filtros)
}

func (s *SuperAdminService) ObtenerTimelineErrores(ctx context.Context, intervalo string, dias int, filtros repo.ErrorLogFiltros) ([]repo.PuntoTimeline, error) {
	return s.errorLogRepo.ObtenerTimeline(ctx, intervalo, dias, filtros)
}

func (s *SuperAdminService) ListarAlertasErrores(ctx context.Context) ([]repo.ErrorAlerta, error) {
	return s.alertaRepo.ListarSinVer(ctx)
}

func (s *SuperAdminService) MarcarAlertaComoVista(ctx context.Context, id uuid.UUID) error {
	return s.alertaRepo.MarcarComoVista(ctx, id)
}

func (s *SuperAdminService) MarcarTodasAlertasComoVistas(ctx context.Context) error {
	return s.alertaRepo.MarcarTodasComoVistas(ctx)
}

func (s *SuperAdminService) ContarAlertasSinVer(ctx context.Context) (int, error) {
	return s.alertaRepo.ContarSinVer(ctx)
}

func (s *SuperAdminService) ObtenerRendimientoAPI(ctx context.Context) ([]repo.RendimientoRuta, error) {
	return s.metricasRepo.ObtenerRendimientoPorRuta(ctx)
}

// ── Helpers ────────────────────────────────────────────────────────────

// saNullStr crea un NullString. Si el string está vacío, queda como NULL.
// ── Suscripción activa de empresa ──────────────────────────────────────

type SuscripcionEmpresaDetalle struct {
	PlanNombre    string  `json:"plan_nombre"`
	PlanCodigo    string  `json:"plan_codigo"`
	Estado        string  `json:"estado"`
	Ciclo         string  `json:"ciclo"`
	PrecioMensual float64 `json:"precio_mensual"`
	PrecioAnual   *float64 `json:"precio_anual"`
	EsTrial       bool    `json:"es_trial"`
	DiasTrial     int     `json:"dias_trial"`
	FechaInicio   string  `json:"fecha_inicio"`
	FechaFinTrial *string `json:"fecha_fin_trial"`
	ProximoCobro  *string `json:"proximo_cobro"`
	MetodoPago    *string `json:"metodo_pago"`
}

func (s *SuperAdminService) ObtenerSuscripcionEmpresa(ctx context.Context, tenantID uuid.UUID) (*SuscripcionEmpresaDetalle, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT p.nombre, p.codigo, sus.estado, sus.ciclo, p.precio_mensual, p.precio_anual,
			sus.es_trial, sus.dias_trial, sus.fecha_inicio, sus.fecha_fin_trial,
			sus.fecha_proximo_cobro, sus.metodo_pago
		FROM suscripciones sus
		JOIN planes p ON sus.plan_id = p.id
		WHERE sus.tenant_id = $1 AND sus.estado IN ('ACTIVA', 'TRIAL')
		LIMIT 1`, tenantID)

	var d SuscripcionEmpresaDetalle
	var precioAnual, fechaFinTrial, proximoCobro, metodoPago *string
	err := row.Scan(&d.PlanNombre, &d.PlanCodigo, &d.Estado, &d.Ciclo, &d.PrecioMensual, &precioAnual,
		&d.EsTrial, &d.DiasTrial, &d.FechaInicio, &fechaFinTrial, &proximoCobro, &metodoPago)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.ObtenerSuscripcionEmpresa: %w", err)
	}
	d.FechaFinTrial = fechaFinTrial
	d.ProximoCobro = proximoCobro
	d.MetodoPago = metodoPago
	return &d, nil
}

// ── Notas de cuenta ────────────────────────────────────────────────────

func (s *SuperAdminService) CrearNotaCuenta(ctx context.Context, cuentaID, autorID uuid.UUID, autorNombre, contenido string) (*repo.CuentaNota, error) {
	return s.cuentaNotasRepo.Crear(ctx, cuentaID, autorID, autorNombre, contenido)
}

func (s *SuperAdminService) ListarNotasCuenta(ctx context.Context, cuentaID uuid.UUID) ([]repo.CuentaNota, error) {
	return s.cuentaNotasRepo.ListarPorCuenta(ctx, cuentaID, 50)
}

// ── Facturación agregada por cuenta ────────────────────────────────────

type FacturacionCuenta struct {
	TotalMensual      float64              `json:"total_mensual"`
	ProximoCobro      *string              `json:"proximo_cobro"`
	TotalActivas      int                  `json:"total_activas"`
	TotalTrials       int                  `json:"total_trials"`
	Suscripciones     []SuscripcionResumen `json:"suscripciones"`
}

type SuscripcionResumen struct {
	EmpresaNombre string  `json:"empresa_nombre"`
	PlanNombre    string  `json:"plan_nombre"`
	Estado        string  `json:"estado"`
	Ciclo         string  `json:"ciclo"`
	Precio        float64 `json:"precio"`
	ProximoCobro  *string `json:"proximo_cobro"`
}

func (s *SuperAdminService) ObtenerFacturacionCuenta(ctx context.Context, cuentaID uuid.UUID) (*FacturacionCuenta, error) {
	query := `
		SELECT ct.razon_social, p.nombre, sus.estado, sus.ciclo, p.precio_mensual, sus.fecha_proximo_cobro
		FROM suscripciones sus
		JOIN configuracion_tenant ct ON sus.tenant_id = ct.tenant_id
		JOIN planes p ON sus.plan_id = p.id
		WHERE ct.cuenta_id = $1 AND sus.estado IN ('ACTIVA', 'TRIAL')
		ORDER BY ct.razon_social`

	rows, err := s.db.QueryContext(ctx, query, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("superadmin_service.ObtenerFacturacion: %w", err)
	}
	defer rows.Close()

	result := &FacturacionCuenta{}
	for rows.Next() {
		var sr SuscripcionResumen
		var proximoCobro *string
		if err := rows.Scan(&sr.EmpresaNombre, &sr.PlanNombre, &sr.Estado, &sr.Ciclo, &sr.Precio, &proximoCobro); err != nil {
			return nil, err
		}
		sr.ProximoCobro = proximoCobro
		result.Suscripciones = append(result.Suscripciones, sr)
		result.TotalMensual += sr.Precio
		if sr.Estado == "ACTIVA" { result.TotalActivas++ }
		if sr.Estado == "TRIAL" { result.TotalTrials++ }
		if proximoCobro != nil && (result.ProximoCobro == nil || *proximoCobro < *result.ProximoCobro) {
			result.ProximoCobro = proximoCobro
		}
	}
	return result, rows.Err()
}

// ── Health Score ────────────────────────────────────────────────────────

type HealthScore struct {
	Puntuacion int              `json:"puntuacion"`
	Factores   []HealthFactor   `json:"factores"`
}

type HealthFactor struct {
	Nombre     string `json:"nombre"`
	Puntos     int    `json:"puntos"`
	MaxPuntos  int    `json:"max_puntos"`
	Detalle    string `json:"detalle"`
}

func (s *SuperAdminService) CalcularHealthScore(ctx context.Context, cuentaID uuid.UUID) (*HealthScore, error) {
	hs := &HealthScore{}

	// Factor 1: Empresas activas (25 pts)
	var totalEmpresas, empresasActivas int
	s.db.QueryRowContext(ctx, `SELECT COUNT(*), COUNT(*) FILTER (WHERE activo = true) FROM configuracion_tenant WHERE cuenta_id = $1`, cuentaID).Scan(&totalEmpresas, &empresasActivas)
	f1 := HealthFactor{Nombre: "Empresas activas", MaxPuntos: 25}
	if totalEmpresas > 0 {
		f1.Puntos = 25 * empresasActivas / totalEmpresas
		f1.Detalle = fmt.Sprintf("%d de %d activas", empresasActivas, totalEmpresas)
	} else {
		f1.Detalle = "Sin empresas"
	}
	hs.Factores = append(hs.Factores, f1)

	// Factor 2: Suscripciones al día (25 pts)
	var susActivas, susTotal int
	s.db.QueryRowContext(ctx, `SELECT COUNT(*), COUNT(*) FILTER (WHERE s.estado IN ('ACTIVA', 'TRIAL')) FROM suscripciones s JOIN configuracion_tenant ct ON s.tenant_id = ct.tenant_id WHERE ct.cuenta_id = $1`, cuentaID).Scan(&susTotal, &susActivas)
	f2 := HealthFactor{Nombre: "Suscripciones al día", MaxPuntos: 25}
	if susTotal > 0 {
		f2.Puntos = 25 * susActivas / susTotal
		f2.Detalle = fmt.Sprintf("%d de %d al día", susActivas, susTotal)
	} else {
		f2.Detalle = "Sin suscripciones"
	}
	hs.Factores = append(hs.Factores, f2)

	// Factor 3: Actividad reciente (25 pts)
	var usuariosActivos int
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM usuarios_admin ua JOIN configuracion_tenant ct ON ua.tenant_id = ct.tenant_id WHERE ct.cuenta_id = $1 AND ua.ultimo_acceso >= now() - INTERVAL '7 days'`, cuentaID).Scan(&usuariosActivos)
	f3 := HealthFactor{Nombre: "Actividad reciente", MaxPuntos: 25}
	if usuariosActivos > 0 {
		f3.Puntos = 25
		f3.Detalle = fmt.Sprintf("%d usuarios activos en los últimos 7 días", usuariosActivos)
	} else {
		f3.Detalle = "Sin actividad en 7 días"
	}
	hs.Factores = append(hs.Factores, f3)

	// Factor 4: Reclamos procesados (25 pts)
	var totalReclamos, reclamosResueltos int
	s.db.QueryRowContext(ctx, `SELECT COUNT(*), COUNT(*) FILTER (WHERE r.estado IN ('RESUELTO', 'CERRADO')) FROM reclamos r JOIN configuracion_tenant ct ON r.tenant_id = ct.tenant_id WHERE ct.cuenta_id = $1 AND r.deleted_at IS NULL`, cuentaID).Scan(&totalReclamos, &reclamosResueltos)
	f4 := HealthFactor{Nombre: "Reclamos procesados", MaxPuntos: 25}
	if totalReclamos > 0 {
		f4.Puntos = 25 * reclamosResueltos / totalReclamos
		f4.Detalle = fmt.Sprintf("%d de %d resueltos (%.0f%%)", reclamosResueltos, totalReclamos, float64(reclamosResueltos)/float64(totalReclamos)*100)
	} else {
		f4.Puntos = 25
		f4.Detalle = "Sin reclamos (todo en orden)"
	}
	hs.Factores = append(hs.Factores, f4)

	for _, f := range hs.Factores {
		hs.Puntuacion += f.Puntos
	}
	return hs, nil
}

func validarDatosCuenta(nombre, email, telefono, ruc, direccion, notas string) error {
	if err := validarNombreCuenta(nombre); err != nil {
		return err
	}
	if err := validarEmailCuenta(email); err != nil {
		return err
	}
	if telefono != "" {
		if err := validarTelefonoCuenta(telefono); err != nil {
			return err
		}
	}
	if ruc != "" {
		if err := validarRUCCuenta(ruc); err != nil {
			return err
		}
	}
	if len(direccion) > 200 {
		return fmt.Errorf("la dirección no puede exceder 200 caracteres")
	}
	if len(notas) > 500 {
		return fmt.Errorf("las notas no pueden exceder 500 caracteres")
	}
	return nil
}

func validarDatosCuentaParcial(nombre, email, telefono, ruc, direccion, notas string) error {
	if nombre != "" {
		if err := validarNombreCuenta(nombre); err != nil { return err }
	}
	if email != "" {
		if err := validarEmailCuenta(email); err != nil { return err }
	}
	if telefono != "" {
		if err := validarTelefonoCuenta(telefono); err != nil { return err }
	}
	if ruc != "" {
		if err := validarRUCCuenta(ruc); err != nil { return err }
	}
	if len(direccion) > 200 {
		return fmt.Errorf("la dirección no puede exceder 200 caracteres")
	}
	if len(notas) > 500 {
		return fmt.Errorf("las notas no pueden exceder 500 caracteres")
	}
	return nil
}

func validarNombreCuenta(nombre string) error {
	if len(nombre) < 3 {
		return fmt.Errorf("el nombre debe tener al menos 3 caracteres")
	}
	if len(nombre) > 100 {
		return fmt.Errorf("el nombre no puede exceder 100 caracteres")
	}
	for _, c := range nombre {
		if c >= '0' && c <= '9' {
			return fmt.Errorf("el nombre no puede contener números")
		}
	}
	return nil
}

func validarEmailCuenta(email string) error {
	if len(email) < 5 || len(email) > 100 {
		return fmt.Errorf("el email debe tener entre 5 y 100 caracteres")
	}
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return fmt.Errorf("el email no tiene un formato válido")
	}
	return nil
}

func validarTelefonoCuenta(telefono string) error {
	limpio := strings.ReplaceAll(strings.ReplaceAll(telefono, " ", ""), "-", "")
	if len(limpio) > 0 && limpio[0] == '+' {
		limpio = limpio[1:]
	}
	for _, c := range limpio {
		if c < '0' || c > '9' {
			return fmt.Errorf("el teléfono solo puede contener números, espacios, guiones y código de país (+)")
		}
	}
	if len(limpio) < 7 || len(limpio) > 15 {
		return fmt.Errorf("el teléfono debe tener entre 7 y 15 dígitos")
	}
	return nil
}

func validarRUCCuenta(ruc string) error {
	for _, c := range ruc {
		if c < '0' || c > '9' {
			return fmt.Errorf("el RUC solo puede contener números")
		}
	}
	if len(ruc) != 11 {
		return fmt.Errorf("el RUC debe tener exactamente 11 dígitos")
	}
	return nil
}

func saNullStr(s string) model.NullString {
	if s == "" {
		return model.NullString{}
	}
	return model.NullString{NullString: sql.NullString{String: s, Valid: true}}
}
