package service

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
	"golang.org/x/text/unicode/norm"
)

// OnboardingService orquesta la creación completa de un tenant nuevo.
type OnboardingService struct {
	db              *sql.DB
	planRepo        *repo.PlanRepo
	tenantRepo      *repo.TenantRepo
	sedeRepo        *repo.SedeRepo
	usuarioRepo     *repo.UsuarioRepo
	suscripcionRepo *repo.SuscripcionRepo
	rolRepo         *repo.RolRepo
}

func NewOnboardingService(
	db *sql.DB,
	planRepo *repo.PlanRepo,
	tenantRepo *repo.TenantRepo,
	sedeRepo *repo.SedeRepo,
	usuarioRepo *repo.UsuarioRepo,
	suscripcionRepo *repo.SuscripcionRepo,
	rolRepo *repo.RolRepo,
) *OnboardingService {
	return &OnboardingService{
		db:              db,
		planRepo:        planRepo,
		tenantRepo:      tenantRepo,
		sedeRepo:        sedeRepo,
		usuarioRepo:     usuarioRepo,
		suscripcionRepo: suscripcionRepo,
		rolRepo:         rolRepo,
	}
}

// OnboardingRequest datos necesarios para crear un tenant completo.
type OnboardingRequest struct {
	CuentaID       uuid.UUID `json:"cuenta_id"`
	RazonSocial    string    `json:"razon_social"`
	RUC            string    `json:"ruc"`
	Email          string    `json:"email"`
	Password       string    `json:"password"`
	// PasswordHash permite pasar un hash ya calculado (p.ej. para reutilizar
	// el de otro tenant del mismo usuario). Si está presente, se usa directamente
	// y se ignora el campo Password.
	PasswordHash      string    `json:"-"`
	NombreAdmin    string    `json:"nombre_admin"`
	Telefono       string    `json:"telefono"`
	DireccionLegal    string    `json:"direccion_legal"`
	PlanID            uuid.UUID `json:"plan_id"`
	EsTrial           bool      `json:"es_trial"`
	DiasTrialOverride int       `json:"dias_trial,omitempty"`
}

// OnboardingResult respuesta con todo lo creado.
type OnboardingResult struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	Slug        string    `json:"slug"`
	Usuario     struct {
		ID    uuid.UUID `json:"id"`
		Email string    `json:"email"`
		Rol   string    `json:"rol"`
	} `json:"usuario"`
	Suscripcion struct {
		PlanCodigo string `json:"plan_codigo"`
		Estado     string `json:"estado"`
		DiasTrial  int    `json:"dias_trial"`
	} `json:"suscripcion"`
	Mensaje string `json:"mensaje"`
}

// Registrar crea un tenant completo en una transacción atómica:
// 1. configuracion_tenant
// 2. sede principal
// 3. usuario admin
// 4. suscripción trial DEMO
func (s *OnboardingService) Registrar(ctx context.Context, req OnboardingRequest) (*OnboardingResult, error) {
	// ── Validaciones básicas ──
	// Devolvemos AppError con códigos semánticos para que helper.Error
	// mapee al status HTTP correcto (400/409) y el frontend pueda mostrar
	// un toast claro en vez de un 500 genérico.
	if req.CuentaID == uuid.Nil {
		return nil, apperror.New(400, "CUENTA_ID_OBLIGATORIO", "cuenta_id es obligatorio")
	}
	if strings.TrimSpace(req.RazonSocial) == "" {
		return nil, apperror.New(400, "RAZON_SOCIAL_OBLIGATORIA", "razon_social es obligatorio")
	}
	if strings.TrimSpace(req.RUC) == "" || len(req.RUC) != 11 {
		return nil, apperror.New(400, "RUC_INVALIDO", "RUC debe tener 11 dígitos")
	}
	if strings.TrimSpace(req.Email) == "" {
		return nil, apperror.New(400, "EMAIL_OBLIGATORIO", "email es obligatorio")
	}
	if req.PasswordHash == "" && len(req.Password) < 8 {
		return nil, apperror.New(400, "PASSWORD_CORTA", "password debe tener mínimo 8 caracteres")
	}
	if strings.TrimSpace(req.NombreAdmin) == "" {
		req.NombreAdmin = "Administrador"
	}

	// ── Verificar que el RUC no esté registrado ──
	existente, err := s.buscarTenantPorRUC(ctx, req.RUC)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error verificando RUC: %w", err)
	}
	if existente {
		return nil, apperror.New(409, "RUC_DUPLICADO",
			fmt.Sprintf("Ya existe una empresa registrada con el RUC %s", req.RUC))
	}

	// ── Buscar plan (por ID si se especificó, o DEMO por defecto) ──
	var planDemo *model.Plan
	if req.PlanID != uuid.Nil {
		planDemo, err = s.planRepo.GetByID(ctx, req.PlanID)
		if err != nil || planDemo == nil {
			return nil, apperror.New(404, "PLAN_NO_ENCONTRADO", "El plan indicado no existe")
		}
	} else {
		planDemo, err = s.planRepo.GetByCodigo(ctx, model.PlanDemo)
		if err != nil || planDemo == nil {
			return nil, apperror.New(500, "PLAN_DEMO_NO_ENCONTRADO",
				"El plan DEMO no está configurado en la base de datos")
		}
	}

	// ── Generar datos ──
	tenantID := uuid.New()
	// Pre-resolver un slug único ANTES de abrir la transacción. Hacerlo dentro
	// de la tx causaba tx-poisoning en CockroachDB: el primer INSERT fallaba
	// por colisión del índice idx_config_slug, dejaba la tx en estado aborted,
	// y el reintento con sufijo dentro de la misma tx explotaba con
	// "pq: current transaction is aborted, commands ignored until end of
	// transaction block".
	slug, err := s.resolverSlugUnico(ctx, req.RazonSocial, req.RUC)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error resolviendo slug único: %w", err)
	}

	// Si ya viene un hash pre-calculado (reutilización de email entre empresas
	// de la misma cuenta) se usa directamente; si no, se hashea la contraseña.
	var passwordHash string
	if req.PasswordHash != "" {
		passwordHash = req.PasswordHash
	} else {
		passwordHash, err = helper.HashPassword(req.Password)
		if err != nil {
			return nil, fmt.Errorf("onboarding: error hasheando password: %w", err)
		}
	}

	esTrial := req.EsTrial
	diasTrial := 30
	if !esTrial {
		diasTrial = 0
	}
	if req.DiasTrialOverride > 0 {
		diasTrial = req.DiasTrialOverride
	}

	// ── Transacción atómica ──
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error iniciando transacción: %w", err)
	}
	defer tx.Rollback()

	// 1. Crear configuracion_tenant (cuenta_id obligatorio)
	// El slug ya viene pre-resuelto como único vía resolverSlugUnico() —
	// no hacemos retry acá porque en CockroachDB una vez que un INSERT
	// falla en una tx, la tx queda "aborted" y cualquier query siguiente
	// (incluido un reintento) explota. Si pese al pre-check hay una race
	// y el índice choca, devolvemos un error limpio y el usuario reintenta.
	_, err = tx.ExecContext(ctx, `
		INSERT INTO configuracion_tenant (
			tenant_id, razon_social, ruc, slug,
			email_contacto, telefono, direccion_legal,
			color_primario, plazo_respuesta_dias,
			notificar_whatsapp, notificar_email,
			cuenta_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		tenantID, strings.TrimSpace(req.RazonSocial), req.RUC, slug,
		strings.TrimSpace(req.Email), strings.TrimSpace(req.Telefono), strings.TrimSpace(req.DireccionLegal),
		"#1a56db", 15,
		false, true,
		req.CuentaID,
	)
	if err != nil {
		// Mapear colisiones conocidas a AppError semánticos.
		msg := err.Error()
		if strings.Contains(msg, "idx_config_slug") {
			return nil, apperror.New(409, "SLUG_DUPLICADO",
				fmt.Sprintf("El slug '%s' ya está en uso. Intenta nuevamente.", slug))
		}
		if strings.Contains(msg, "idx_config_ruc") || strings.Contains(msg, "configuracion_tenant_ruc") {
			return nil, apperror.New(409, "RUC_DUPLICADO",
				fmt.Sprintf("Ya existe una empresa registrada con el RUC %s", req.RUC))
		}
		return nil, fmt.Errorf("onboarding: error creando tenant: %w", err)
	}

	// 2. Crear sede principal
	_, err = tx.ExecContext(ctx, `
		INSERT INTO sedes (
			tenant_id, nombre, slug, direccion, es_principal, activo
		) VALUES ($1,$2,$3,$4,$5,$6)`,
		tenantID, "Sede Principal", "principal", "Dirección por configurar", true, true,
	)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error creando sede: %w", err)
	}

	// 3. Crear usuario admin
	var usuarioID uuid.UUID
	err = tx.QueryRowContext(ctx, `
		INSERT INTO usuarios_admin (
			tenant_id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`,
		tenantID, strings.TrimSpace(req.Email), strings.TrimSpace(req.NombreAdmin),
		passwordHash, model.RolAdmin, true, false,
	).Scan(&usuarioID)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error creando usuario: %w", err)
	}

	// 4. Crear roles base (ADMIN + SOPORTE)
	_, err = tx.ExecContext(ctx, `
		INSERT INTO roles_tenant (tenant_id, slug, nombre, descripcion, color, permisos, es_admin, es_base, orden)
		VALUES ($1, 'admin', 'Administrador', 'Acceso total al sistema', '#1a56db', $2, true, true, 0)`,
		tenantID, string(model.PermisosCompletoAdmin()),
	)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error creando rol admin: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO roles_tenant (tenant_id, slug, nombre, descripcion, color, permisos, es_base, orden)
		VALUES ($1, 'soporte', 'Soporte', 'Gestión de reclamos y atención al cliente', '#6b7280', $2, true, 1)`,
		tenantID, string(model.PermisosSoporte()),
	)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error creando rol soporte: %w", err)
	}

	// 5. Crear suscripción (ACTIVA o TRIAL según lo indique el SA)
	estadoSuscripcion := model.SuscripcionActiva
	notaSuscripcion := "Creada por SuperAdmin — suscripción activa"
	var fechaFinTrialPtr interface{} = nil
	if esTrial {
		estadoSuscripcion = model.SuscripcionTrial
		fechaFinTrial := time.Now().AddDate(0, 0, diasTrial)
		fechaFinTrialPtr = fechaFinTrial
		notaSuscripcion = fmt.Sprintf("Trial %d días — creada por SuperAdmin", diasTrial)
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO suscripciones (
			tenant_id, plan_id, estado, ciclo,
			fecha_inicio, es_trial, dias_trial, fecha_fin_trial,
			activado_por, notas
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		tenantID, planDemo.ID, estadoSuscripcion, model.CicloMensual,
		time.Now(), esTrial, diasTrial, fechaFinTrialPtr,
		model.ActivadoPorOnboarding, notaSuscripcion,
	)
	if err != nil {
		return nil, fmt.Errorf("onboarding: error creando suscripción: %w", err)
	}

	// ── Commit ──
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("onboarding: error en commit: %w", err)
	}

	// ── Resultado ──
	result := &OnboardingResult{
		TenantID: tenantID,
		Slug:     slug,
		Mensaje:  fmt.Sprintf("Tenant '%s' creado exitosamente. Ya puede iniciar sesión.", req.RazonSocial),
	}
	result.Usuario.ID = usuarioID
	result.Usuario.Email = req.Email
	result.Usuario.Rol = model.RolAdmin
	result.Suscripcion.PlanCodigo = planDemo.Codigo
	result.Suscripcion.Estado = string(estadoSuscripcion)
	result.Suscripcion.DiasTrial = diasTrial

	fmt.Printf("[ONBOARDING] ✅ Tenant creado: %s (slug: %s, RUC: %s, admin: %s)\n",
		req.RazonSocial, slug, req.RUC, req.Email)

	return result, nil
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func (s *OnboardingService) buscarTenantPorRUC(ctx context.Context, ruc string) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM configuracion_tenant WHERE ruc = $1`, ruc,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// slugExiste chequea si un slug ya está en uso globalmente.
func (s *OnboardingService) slugExiste(ctx context.Context, slug string) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM configuracion_tenant WHERE slug = $1`, slug,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// resolverSlugUnico genera un slug desde la razón social y, si está en uso,
// prueba variantes con sufijos (primero los primeros 4 dígitos del RUC, luego
// todo el RUC, y finalmente sufijos numéricos incrementales). Siempre corre
// FUERA de la transacción para evitar poisoning en CockroachDB.
func (s *OnboardingService) resolverSlugUnico(ctx context.Context, razonSocial, ruc string) (string, error) {
	base := generarSlug(razonSocial)

	// Candidatos a probar en orden.
	candidatos := []string{base}
	if len(ruc) >= 4 {
		candidatos = append(candidatos, base+"-"+ruc[:4])
	}
	if len(ruc) == 11 {
		candidatos = append(candidatos, base+"-"+ruc)
	}

	for _, c := range candidatos {
		existe, err := s.slugExiste(ctx, c)
		if err != nil {
			return "", err
		}
		if !existe {
			return c, nil
		}
	}

	// Fallback: sufijo numérico incremental. Esto es muy raro — solo ocurre
	// si la misma razón social se registró varias veces bajo el mismo RUC,
	// que es casi imposible en producción.
	for i := 2; i < 100; i++ {
		candidato := fmt.Sprintf("%s-%d", base, i)
		existe, err := s.slugExiste(ctx, candidato)
		if err != nil {
			return "", err
		}
		if !existe {
			return candidato, nil
		}
	}
	return "", fmt.Errorf("no se pudo generar un slug único tras 100 intentos")
}

// generarSlug convierte "Pollería El Rey S.A.C." → "polleria-el-rey-sac"
func generarSlug(texto string) string {
	// Normalizar unicode (quitar tildes)
	t := norm.NFD.String(texto)
	resultado := strings.Builder{}
	for _, r := range t {
		if unicode.Is(unicode.Mn, r) {
			continue // Skip combining marks (tildes)
		}
		resultado.WriteRune(r)
	}
	slug := resultado.String()

	slug = strings.ToLower(slug)
	// Reemplazar caracteres no alfanuméricos por guion
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	// Limpiar guiones al inicio/final
	slug = strings.Trim(slug, "-")

	if slug == "" {
		slug = "tenant"
	}

	return slug
}