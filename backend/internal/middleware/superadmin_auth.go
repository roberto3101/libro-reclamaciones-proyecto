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

// Claves de contexto exclusivas del SuperAdmin.
// IMPORTANTE: CtxSuperAdminID está duplicada en helper/context.go para evitar
// un import cycle (helper no puede depender de middleware). Si cambias el
// valor aquí, sincronízalo allí también.
const (
	CtxSuperAdminID    = "superadmin_id"
	CtxSuperAdminEmail = "superadmin_email"
)

// SuperAdminClaims estructura del JWT de SuperAdmin (sin tenant_id).
type SuperAdminClaims struct {
	SuperAdminID string `json:"sa_id"`
	Email        string `json:"email"`
	Role         string `json:"role"` // siempre "SUPERADMIN"
	jwt.RegisteredClaims
}

// GenerarTokenSuperAdmin crea un JWT firmado para SuperAdmin.
func GenerarTokenSuperAdmin(saID uuid.UUID, email string, jwtCfg config.JWTConfig) (string, error) {
	now := time.Now()
	claims := SuperAdminClaims{
		SuperAdminID: saID.String(),
		Email:        email,
		Role:         "SUPERADMIN",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(jwtCfg.ExpirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtCfg.Secret))
}

// SuperAdminAuthMiddleware valida el JWT de SuperAdmin y extrae sa_id + email.
func SuperAdminAuthMiddleware(jwtCfg config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractSAToken(c)
		if tokenStr == "" {
			helper.Error(c, apperror.ErrTokenRequerido)
			c.Abort()
			return
		}

		claims, err := parseSAToken(tokenStr, jwtCfg.Secret)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		if claims.Role != "SUPERADMIN" {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		saID, err := uuid.Parse(claims.SuperAdminID)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		helper.SetContext(c, CtxSuperAdminID, saID)
		helper.SetContext(c, CtxSuperAdminEmail, claims.Email)

		c.Next()
	}
}

func extractSAToken(c *gin.Context) string {
	// 1. Authorization header
	header := c.GetHeader("Authorization")
	if header != "" {
		parts := strings.SplitN(header, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return strings.TrimSpace(parts[1])
		}
	}
	// 2. Cookie httpOnly propia del SuperAdmin
	if cookie, err := c.Cookie("lr_sa_session"); err == nil && cookie != "" {
		return cookie
	}
	return ""
}

func parseSAToken(tokenStr, secret string) (*SuperAdminClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &SuperAdminClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*SuperAdminClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}
	return claims, nil
}
