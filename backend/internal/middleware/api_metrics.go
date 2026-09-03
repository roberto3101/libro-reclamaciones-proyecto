package middleware

import (
	"database/sql"
	"strings"
	"time"

	"libro-reclamaciones/internal/helper"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func MetricasRendimientoMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ruta := c.Request.URL.Path

		if strings.HasPrefix(ruta, "/ws/") || strings.HasPrefix(ruta, "/storage-api/") {
			c.Next()
			return
		}

		inicio := time.Now()

		c.Next()

		duracionMs := int(time.Since(inicio).Milliseconds())
		statusCode := c.Writer.Status()
		metodo := c.Request.Method

		var tenantID *uuid.UUID
		if val, exists := c.Get(helper.CtxTenantID); exists {
			if uid, ok := val.(uuid.UUID); ok {
				tenantID = &uid
			}
		}

		go func() {
			db.Exec(
				`INSERT INTO api_metricas (ruta, metodo, duracion_ms, status_code, tenant_id) VALUES ($1, $2, $3, $4, $5)`,
				ruta, metodo, duracionMs, statusCode, tenantID,
			)
		}()
	}
}
