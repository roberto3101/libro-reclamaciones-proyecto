package middleware

import (
	"database/sql"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"

	"github.com/gin-gonic/gin"
)

// TenantMiddleware verifica que el tenant exista y esté activo.
// Requiere que AuthMiddleware haya corrido antes (tenant_id en contexto).
func TenantMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := helper.GetTenantID(c)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		var activo bool
		err = db.QueryRowContext(c.Request.Context(),
			"SELECT activo FROM configuracion_tenant WHERE tenant_id = $1 LIMIT 1",
			tenantID,
		).Scan(&activo)

		if err != nil {
			helper.Error(c, apperror.ErrNotFound.Withf())
			c.Abort()
			return
		}

		if !activo {
			helper.Error(c, apperror.ErrSuscripcionInactiva)
			c.Abort()
			return
		}

		c.Next()
	}
}

// RoleMiddleware verifica que el usuario tenga uno de los roles permitidos.
func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	roleSet := make(map[string]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		roleSet[r] = true
	}

	return func(c *gin.Context) {
		// Roles con es_admin tienen bypass de RoleMiddleware
		if esAdmin, _ := c.Get("user_es_admin"); esAdmin == true {
			c.Next()
			return
		}
		role := helper.GetUserRole(c)
		if !roleSet[role] {
			helper.Error(c, apperror.ErrRolInsuficiente)
			c.Abort()
			return
		}
		c.Next()
	}
}
