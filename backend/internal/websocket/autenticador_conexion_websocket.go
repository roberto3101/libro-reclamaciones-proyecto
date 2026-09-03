package websocket

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"libro-reclamaciones/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

// CredencialesConexionAdmin contiene la info extraída del JWT para conexiones admin.
type CredencialesConexionAdmin struct {
	TenantID  string
	UsuarioID string
}

// CredencialesConexionPublica contiene la info para conexiones públicas de seguimiento.
type CredencialesConexionPublica struct {
	TenantID      string
	CodigoReclamo string
}

// AutenticadorConexionWebSocket valida credenciales de conexiones WebSocket.
type AutenticadorConexionWebSocket struct {
	jwtConfig config.JWTConfig
	db        *sql.DB
}

// NuevoAutenticadorConexionWebSocket crea un autenticador de conexiones WS.
func NuevoAutenticadorConexionWebSocket(jwtCfg config.JWTConfig, db *sql.DB) *AutenticadorConexionWebSocket {
	return &AutenticadorConexionWebSocket{
		jwtConfig: jwtCfg,
		db:        db,
	}
}

// AutenticarConexionAdmin valida el JWT y extrae tenant_id + usuario_id.
func (a *AutenticadorConexionWebSocket) AutenticarConexionAdmin(tokenStr string) (*CredencialesConexionAdmin, error) {
	if tokenStr == "" {
		return nil, errors.New("token no proporcionado")
	}

	tokenStr = strings.TrimPrefix(tokenStr, "Bearer ")

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma inesperado: %v", t.Header["alg"])
		}
		return []byte(a.jwtConfig.Secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("token inválido: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("claims inválidos")
	}

	tenantID, _ := claims["tenant_id"].(string)
	usuarioID, _ := claims["user_id"].(string)

	if tenantID == "" || usuarioID == "" {
		return nil, errors.New("token sin tenant_id o user_id")
	}

	return &CredencialesConexionAdmin{
		TenantID:  tenantID,
		UsuarioID: usuarioID,
	}, nil
}

// CredencialesSuperAdmin contiene la info extraída del JWT de SuperAdmin.
type CredencialesSuperAdmin struct {
	SuperAdminID string
	Email        string
}

// AutenticarConexionSuperAdmin valida un JWT de SuperAdmin (sin tenant_id).
func (a *AutenticadorConexionWebSocket) AutenticarConexionSuperAdmin(tokenStr string) (*CredencialesSuperAdmin, error) {
	if tokenStr == "" {
		return nil, errors.New("token no proporcionado")
	}
	tokenStr = strings.TrimPrefix(tokenStr, "Bearer ")

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma inesperado: %v", t.Header["alg"])
		}
		return []byte(a.jwtConfig.Secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("token inválido: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("claims inválidos")
	}

	role, _ := claims["role"].(string)
	if role != "SUPERADMIN" {
		return nil, errors.New("no es un token de SuperAdmin")
	}

	saID, _ := claims["sa_id"].(string)
	email, _ := claims["email"].(string)

	if saID == "" {
		return nil, errors.New("token sin superadmin_id")
	}

	return &CredencialesSuperAdmin{
		SuperAdminID: saID,
		Email:        email,
	}, nil
}

// AutenticarConexionPublicaSeguimiento valida que el código de reclamo exista.
func (a *AutenticadorConexionWebSocket) AutenticarConexionPublicaSeguimiento(slug, codigoReclamo string) (*CredencialesConexionPublica, error) {
	if slug == "" || codigoReclamo == "" {
		return nil, errors.New("slug o código de reclamo vacío")
	}

	var tenantID string
	err := a.db.QueryRow(
		`SELECT ct.tenant_id FROM configuracion_tenant ct
		 JOIN reclamos r ON r.tenant_id = ct.tenant_id
		 WHERE ct.slug = $1 AND r.codigo_reclamo = $2 AND r.deleted_at IS NULL
		 LIMIT 1`,
		slug, codigoReclamo,
	).Scan(&tenantID)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("reclamo no encontrado")
		}
		return nil, fmt.Errorf("error consultando reclamo: %w", err)
	}

	return &CredencialesConexionPublica{
		TenantID:      tenantID,
		CodigoReclamo: codigoReclamo,
	}, nil
}
