package middleware

import (
	"strings"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims estructura del JWT (sede_id eliminado — se consulta desde usuarios_sedes).
type Claims struct {
	TenantID string `json:"tenant_id"`
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// AuthMiddleware valida el JWT y extrae tenant_id + user_id.
func AuthMiddleware(jwtCfg config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			helper.Error(c, apperror.ErrTokenRequerido)
			c.Abort()
			return
		}

		claims, err := parseToken(token, jwtCfg.Secret)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		tenantID, err := uuid.Parse(claims.TenantID)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		// Inyectar en contexto
		helper.SetContext(c, helper.CtxTenantID, tenantID)
		helper.SetContext(c, helper.CtxUserID, userID)
		helper.SetContext(c, helper.CtxUserRole, claims.Role)
		helper.SetContext(c, helper.CtxIPAddress, helper.GetClientIP(c))

		c.Next()
	}
}

// GenerateToken crea un JWT firmado (sin sede_id — se consulta desde usuarios_sedes).
func GenerateToken(tenantID, userID uuid.UUID, role string, jwtCfg config.JWTConfig) (string, error) {
	now := time.Now()
	claims := Claims{
		TenantID: tenantID.String(),
		UserID:   userID.String(),
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(jwtCfg.ExpirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtCfg.Secret))
}

func extractBearerToken(c *gin.Context) string {
	// 1. Intentar Authorization header (prioridad)
	header := c.GetHeader("Authorization")
	if header != "" {
		parts := strings.SplitN(header, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return strings.TrimSpace(parts[1])
		}
	}
	// 2. Fallback a cookie httpOnly
	if cookie, err := c.Cookie("lr_session"); err == nil && cookie != "" {
		return cookie
	}
	return ""
}

type ClaimsTemporales struct {
	Email            string `json:"email"`
	PasswordVerified bool   `json:"pw_verified"`
	jwt.RegisteredClaims
}

func GenerarTokenTemporal(email string, jwtCfg config.JWTConfig) (string, error) {
	// jti (JWT ID): UUID único por token. Permite identificar cada temp_token
	// emitido de forma individual para: (1) auditoría/correlación en logs,
	// (2) futura blacklist/marcado de "ya usado" si se agrega.
	claims := ClaimsTemporales{
		Email:            email,
		PasswordVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtCfg.Secret))
}

func ParsearTokenTemporal(tokenStr, secret string) (*ClaimsTemporales, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &ClaimsTemporales{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*ClaimsTemporales)
	if !ok || !token.Valid || !claims.PasswordVerified {
		return nil, jwt.ErrSignatureInvalid
	}
	return claims, nil
}

func parseToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}

	return claims, nil
}
