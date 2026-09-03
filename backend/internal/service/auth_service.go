package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

type AuthService struct {
	usuarioRepo     *repo.UsuarioRepo
	sesionRepo      *repo.SesionRepo
	tenantRepo      *repo.TenantRepo
	usuarioSedeRepo *repo.UsuarioSedeRepo
	jwtCfg          config.JWTConfig
}

func NewAuthService(usuarioRepo *repo.UsuarioRepo, sesionRepo *repo.SesionRepo, tenantRepo *repo.TenantRepo, usuarioSedeRepo *repo.UsuarioSedeRepo, jwtCfg config.JWTConfig) *AuthService {
	return &AuthService{
		usuarioRepo:     usuarioRepo,
		sesionRepo:      sesionRepo,
		tenantRepo:      tenantRepo,
		usuarioSedeRepo: usuarioSedeRepo,
		jwtCfg:          jwtCfg,
	}
}

type LoginResult struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"`
	User      struct {
		ID                 uuid.UUID `json:"id"`
		TenantID           uuid.UUID `json:"tenant_id"`
		TenantSlug         string    `json:"tenant_slug"`
		Email              string    `json:"email"`
		NombreCompleto     string    `json:"nombre_completo"`
		Rol                string    `json:"rol"`
		SedeIDs            []string  `json:"sede_ids"`
		DebeCambiarPassword bool     `json:"debe_cambiar_password"`
	} `json:"user"`
	EmpresasAccesibles []dto.TenantOption `json:"empresas_accesibles,omitempty"`
}

type ResultadoMultiLogin struct {
	RequiereSeleccion  bool               `json:"requires_selection"`
	Empresas           []dto.TenantOption `json:"tenants"`
	TokenTemporal      string             `json:"temp_token"`
}

func (s *AuthService) Login(ctx context.Context, email, password, ip, userAgent string) (interface{}, error) {
	usuarios, err := s.usuarioRepo.ObtenerTodosPorEmailGlobal(ctx, email)
	if err != nil {
		log.Printf("[AUTH] error login %s desde %s: %v", email, ip, err)
		return nil, fmt.Errorf("auth_service.Login: %w", err)
	}

	if len(usuarios) == 0 {
		return nil, apperror.ErrCredencialesInvalidas
	}

	var usuariosValidos []model.UsuarioAdmin
	for _, u := range usuarios {
		if helper.CheckPassword(password, u.PasswordHash) {
			usuariosValidos = append(usuariosValidos, u)
		}
	}

	if len(usuariosValidos) == 0 {
		return nil, apperror.ErrCredencialesInvalidas
	}

	if len(usuariosValidos) == 1 {
		// Poblamos empresasAccesibles con todas las empresas de la cuenta
		// del tenant al que el usuario acaba de loguear. Esto permite que
		// el dropdown "Cambiar empresa" del UI muestre las demás empresas
		// de la misma cuenta sin pedir re-autenticación. Gracias a la
		// invariante de hash compartido por cuenta, un match de password
		// en un tenant implica acceso válido en todos los demás tenants
		// activos de la misma cuenta.
		usuario := &usuariosValidos[0]
		tenantActual, _ := s.tenantRepo.GetByTenantID(ctx, usuario.TenantID)
		empresasAccesibles := s.empresasAccesiblesEnCuentaDeTenant(ctx, email, tenantActual)
		return s.emitirLoginCompleto(ctx, usuario, ip, userAgent, empresasAccesibles)
	}

	tenantIDs := make([]uuid.UUID, len(usuariosValidos))
	for i, u := range usuariosValidos {
		tenantIDs[i] = u.TenantID
	}
	tenants, err := s.tenantRepo.GetByTenantIDs(ctx, tenantIDs)
	if err != nil {
		return nil, fmt.Errorf("auth_service.Login tenants: %w", err)
	}

	tenantMap := make(map[uuid.UUID]model.TenantResumen)
	for _, t := range tenants {
		tenantMap[t.TenantID] = t
	}

	var opciones []dto.TenantOption
	for _, u := range usuariosValidos {
		t := tenantMap[u.TenantID]
		opcion := dto.TenantOption{
			TenantID:    u.TenantID,
			RazonSocial: t.RazonSocial,
			Slug:        t.Slug,
			Rol:         u.Rol,
		}
		if t.LogoURL.Valid {
			opcion.LogoURL = &t.LogoURL.NullString.String
		}
		opciones = append(opciones, opcion)
	}

	tokenTemporal, err := middleware.GenerarTokenTemporal(email, s.jwtCfg)
	if err != nil {
		return nil, fmt.Errorf("auth_service.Login temp_token: %w", err)
	}

	// Auditoría: registrar emisión del temp_token para poder correlacionarlo
	// con el canje posterior en SeleccionarEmpresa. El jti queda embebido en
	// el JWT pero lo parseamos aquí solo para dejar constancia en el log.
	if claimsEmit, errEmit := middleware.ParsearTokenTemporal(tokenTemporal, s.jwtCfg.Secret); errEmit == nil {
		log.Printf("[AUTH] temp_token emitido jti=%s email=%s empresas=%d",
			claimsEmit.ID, email, len(opciones))
	}

	return &ResultadoMultiLogin{
		RequiereSeleccion: true,
		Empresas:          opciones,
		TokenTemporal:     tokenTemporal,
	}, nil
}

func (s *AuthService) SeleccionarEmpresa(ctx context.Context, tokenTemporal, tenantIDStr, ip, userAgent string) (*LoginResult, error) {
	claimsTmp, err := middleware.ParsearTokenTemporal(tokenTemporal, s.jwtCfg.Secret)
	if err != nil {
		return nil, apperror.ErrTokenInvalido
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return nil, apperror.New(400, "TENANT_ID_INVALIDO", "El ID de empresa no es valido")
	}

	usuario, err := s.usuarioRepo.GetByEmailAndTenant(ctx, claimsTmp.Email, tenantID)
	if err != nil {
		return nil, fmt.Errorf("auth_service.SeleccionarEmpresa: %w", err)
	}
	if usuario == nil {
		// Auditoría: intento de canje de temp_token hacia un tenant al que el
		// email no tiene acceso. Útil para detectar escaneo/abuso.
		log.Printf("[AUTH] temp_token canje RECHAZADO jti=%s email=%s tenant=%s motivo=SIN_ACCESO ip=%s",
			claimsTmp.ID, claimsTmp.Email, tenantID, ip)
		return nil, apperror.New(403, "SIN_ACCESO_EMPRESA", "No tienes acceso a esta empresa")
	}

	// Auditoría: canje exitoso del temp_token. Permite correlacionar con la
	// línea "temp_token emitido jti=..." y reconstruir el flujo completo.
	log.Printf("[AUTH] temp_token canjeado jti=%s email=%s tenant=%s ip=%s",
		claimsTmp.ID, claimsTmp.Email, tenantID, ip)

	// Construir la lista de empresas accesibles SOLO dentro de la cuenta del
	// tenant elegido — esto mantiene consistencia con el selector inicial
	// (que filtra por password match, excluyendo empresas de otras cuentas
	// con hashes distintos) y evita que el dropdown "Cambiar empresa" muestre
	// empresas de cuentas donde el usuario no validó su password.
	tenantElegido, _ := s.tenantRepo.GetByTenantID(ctx, tenantID)
	empresasAccesibles := s.empresasAccesiblesEnCuentaDeTenant(ctx, claimsTmp.Email, tenantElegido)

	return s.emitirLoginCompleto(ctx, usuario, ip, userAgent, empresasAccesibles)
}

func (s *AuthService) CambiarEmpresa(ctx context.Context, tenantIDActual uuid.UUID, userIDActual uuid.UUID, tenantIDDestino uuid.UUID, ip, userAgent string) (*LoginResult, error) {
	usuarioActual, err := s.usuarioRepo.GetByID(ctx, tenantIDActual, userIDActual)
	if err != nil || usuarioActual == nil {
		return nil, apperror.New(404, "USUARIO_NO_ENCONTRADO", "Usuario actual no encontrado")
	}

	// Bloquear salto cross-cuenta: el tenant destino debe pertenecer a la
	// misma cuenta que el tenant actual. Sin esto, un usuario logueado en
	// una cuenta podría saltar a otra cuenta distinta donde el mismo email
	// esté activo sin haber validado el password de esa otra cuenta.
	tenantActualData, err := s.tenantRepo.GetByTenantID(ctx, tenantIDActual)
	if err != nil || tenantActualData == nil {
		return nil, apperror.New(404, "TENANT_NO_ENCONTRADO", "Tenant actual no encontrado")
	}
	tenantDestinoData, err := s.tenantRepo.GetByTenantID(ctx, tenantIDDestino)
	if err != nil || tenantDestinoData == nil {
		return nil, apperror.New(404, "TENANT_NO_ENCONTRADO", "Tenant destino no encontrado")
	}
	if !tenantActualData.CuentaID.Valid || !tenantDestinoData.CuentaID.Valid ||
		tenantActualData.CuentaID.UUID != tenantDestinoData.CuentaID.UUID {
		return nil, apperror.New(403, "SIN_ACCESO_EMPRESA", "No tienes acceso a esta empresa")
	}

	usuarioDestino, err := s.usuarioRepo.GetByEmailAndTenant(ctx, usuarioActual.Email, tenantIDDestino)
	if err != nil {
		return nil, fmt.Errorf("auth_service.CambiarEmpresa: %w", err)
	}
	if usuarioDestino == nil {
		return nil, apperror.New(403, "SIN_ACCESO_EMPRESA", "No tienes acceso a esta empresa")
	}

	empresasAccesibles := s.empresasAccesiblesEnCuentaDeTenant(ctx, usuarioActual.Email, tenantDestinoData)

	return s.emitirLoginCompleto(ctx, usuarioDestino, ip, userAgent, empresasAccesibles)
}

// empresasAccesiblesEnCuentaDeTenant construye la lista de empresas para el
// dropdown "Cambiar empresa" filtrada a la cuenta del tenant indicado.
// Si el tenant no tiene cuenta asignada (caso borde: tenants huérfanos), usa
// el comportamiento legado de lista global.
func (s *AuthService) empresasAccesiblesEnCuentaDeTenant(ctx context.Context, email string, tenant *model.Tenant) []dto.TenantOption {
	if tenant != nil && tenant.CuentaID.Valid {
		usuariosEnCuenta, err := s.usuarioRepo.ObtenerActivosPorEmailEnCuenta(ctx, email, tenant.CuentaID.UUID)
		if err == nil {
			return s.construirOpcionesEmpresa(ctx, usuariosEnCuenta)
		}
	}
	// Fallback legacy: lista global (tenants sin cuenta asignada)
	todos, _ := s.usuarioRepo.ObtenerTodosPorEmailGlobal(ctx, email)
	return s.construirOpcionesEmpresa(ctx, todos)
}

func (s *AuthService) VerifyPassword(ctx context.Context, tenantID, userID uuid.UUID, password string) error {
	user, err := s.usuarioRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return apperror.New(404, "USER_NOT_FOUND", "Usuario no encontrado")
	}
	if !helper.CheckPassword(password, user.PasswordHash) {
		return apperror.New(422, "INVALID_PASSWORD", "Contrasena incorrecta")
	}
	return nil
}

func (s *AuthService) Logout(ctx context.Context, tokenHash string) error {
	return s.sesionRepo.InvalidateByToken(ctx, tokenHash)
}

func (s *AuthService) emitirLoginCompleto(ctx context.Context, usuario *model.UsuarioAdmin, ip, userAgent string, empresasAccesibles []dto.TenantOption) (*LoginResult, error) {
	tenantID := usuario.TenantID

	token, err := middleware.GenerateToken(tenantID, usuario.ID, usuario.Rol, s.jwtCfg)
	if err != nil {
		log.Printf("[AUTH] fallo generar jwt para usuario %s: %v", usuario.ID, err)
		return nil, fmt.Errorf("auth_service.emitirLogin token: %w", err)
	}

	tokenHash := helper.SHA256Hash(token)
	expiracion := time.Now().Add(time.Duration(s.jwtCfg.ExpirationHours) * time.Hour)
	sesion := &model.Sesion{
		TenantModel:     model.TenantModel{TenantID: tenantID},
		UsuarioID:       usuario.ID,
		TokenHash:       tokenHash,
		IPAddress:       model.NullString{NullString: sql.NullString{String: ip, Valid: ip != ""}},
		UserAgent:       model.NullString{NullString: sql.NullString{String: userAgent, Valid: userAgent != ""}},
		FechaExpiracion: expiracion,
	}

	if err := s.sesionRepo.Create(ctx, sesion); err != nil {
		log.Printf("[AUTH] fallo crear sesion para usuario %s: %v", usuario.ID, err)
		return nil, fmt.Errorf("auth_service.emitirLogin sesion: %w", err)
	}

	_ = s.usuarioRepo.UpdateUltimoAcceso(ctx, tenantID, usuario.ID)

	tenant, _ := s.tenantRepo.GetByTenantID(ctx, tenantID)
	var tenantSlug string
	if tenant != nil {
		tenantSlug = tenant.Slug
	}

	resultado := &LoginResult{
		Token:              token,
		ExpiresIn:          s.jwtCfg.ExpirationHours * 3600,
		EmpresasAccesibles: empresasAccesibles,
	}
	resultado.User.ID = usuario.ID
	resultado.User.TenantID = tenantID
	resultado.User.TenantSlug = tenantSlug
	resultado.User.Email = usuario.Email
	resultado.User.NombreCompleto = usuario.NombreCompleto
	resultado.User.Rol = usuario.Rol
	resultado.User.DebeCambiarPassword = usuario.DebeCambiarPassword

	// Cargar sedes asignadas
	sedeUUIDs, _ := s.usuarioSedeRepo.ObtenerSedesPorUsuario(ctx, tenantID, usuario.ID)
	sedeIDs := make([]string, len(sedeUUIDs))
	for i, s := range sedeUUIDs {
		sedeIDs[i] = s.String()
	}
	resultado.User.SedeIDs = sedeIDs

	return resultado, nil
}

func (s *AuthService) construirOpcionesEmpresa(ctx context.Context, usuarios []model.UsuarioAdmin) []dto.TenantOption {
	if len(usuarios) <= 1 {
		return nil
	}

	tenantIDs := make([]uuid.UUID, len(usuarios))
	for i, u := range usuarios {
		tenantIDs[i] = u.TenantID
	}

	tenants, err := s.tenantRepo.GetByTenantIDs(ctx, tenantIDs)
	if err != nil {
		return nil
	}

	tenantMap := make(map[uuid.UUID]model.TenantResumen)
	for _, t := range tenants {
		tenantMap[t.TenantID] = t
	}

	var opciones []dto.TenantOption
	for _, u := range usuarios {
		t := tenantMap[u.TenantID]
		op := dto.TenantOption{
			TenantID:    u.TenantID,
			RazonSocial: t.RazonSocial,
			Slug:        t.Slug,
			Rol:         u.Rol,
		}
		if t.LogoURL.Valid {
			op.LogoURL = &t.LogoURL.NullString.String
		}
		opciones = append(opciones, op)
	}
	return opciones
}
