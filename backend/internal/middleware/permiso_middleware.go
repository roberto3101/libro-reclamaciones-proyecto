package middleware

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ── Cache de permisos en memoria ──

const cacheTTLPermisos = 5 * time.Minute

type entradaCachePermisos struct {
	permisos map[string]map[string]bool
	esAdmin  bool
	expira   time.Time
}

var cachePermisos sync.Map // key: "tenantID:rolSlug" → *entradaCachePermisos

// InvalidarCacheRol elimina la entrada de cache para un rol específico.
// Llamar desde RolService al actualizar o eliminar un rol.
func InvalidarCacheRol(tenantID uuid.UUID, slug string) {
	clave := fmt.Sprintf("%s:%s", tenantID.String(), strings.ToLower(slug))
	cachePermisos.Delete(clave)
}

// InvalidarCacheTenant elimina todas las entradas de un tenant.
func InvalidarCacheTenant(tenantID uuid.UUID) {
	prefix := tenantID.String() + ":"
	cachePermisos.Range(func(key, _ interface{}) bool {
		if k, ok := key.(string); ok && len(k) > len(prefix) && k[:len(prefix)] == prefix {
			cachePermisos.Delete(key)
		}
		return true
	})
}

// ── Middleware principal ──

// PermisoMiddleware carga los permisos del usuario en el contexto.
// Debe ejecutarse DESPUÉS de AuthMiddleware y TenantMiddleware.
func PermisoMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := helper.GetUserRole(c)

		tenantID, err := helper.GetTenantID(c)
		if err != nil {
			helper.Error(c, apperror.ErrTokenInvalido)
			c.Abort()
			return
		}

		// Normalizar slug a minúsculas (JWT guarda "SOPORTE", DB guarda "soporte")
		slug := strings.ToLower(role)

		// Intentar cache primero
		clave := fmt.Sprintf("%s:%s", tenantID.String(), slug)
		if entrada, ok := cachePermisos.Load(clave); ok {
			if e, ok := entrada.(*entradaCachePermisos); ok && time.Now().Before(e.expira) {
				if e.esAdmin {
					c.Set("user_es_admin", true)
					c.Next()
					return
				}
				c.Set("user_permisos", e.permisos)
				c.Next()
				return
			}
			// Expirado → eliminar
			cachePermisos.Delete(clave)
		}

		// Consultar DB
		var permisosRaw []byte
		var esAdmin bool
		err = db.QueryRowContext(c.Request.Context(),
			"SELECT permisos, es_admin FROM roles_tenant WHERE tenant_id = $1 AND slug = $2",
			tenantID, slug,
		).Scan(&permisosRaw, &esAdmin)

		if err == sql.ErrNoRows {
			// Rol no existe en la tabla → denegar todo
			helper.Error(c, apperror.ErrRolInsuficiente)
			c.Abort()
			return
		}
		if err != nil {
			fmt.Printf("[ERROR PermisoMiddleware] DB: %v\n", err)
			helper.Error(c, apperror.ErrInternal)
			c.Abort()
			return
		}

		var permisos map[string]map[string]bool
		if err := json.Unmarshal(permisosRaw, &permisos); err != nil {
			fmt.Printf("[ERROR PermisoMiddleware] JSON: %v\n", err)
			helper.Error(c, apperror.ErrInternal)
			c.Abort()
			return
		}

		// Guardar en cache
		cachePermisos.Store(clave, &entradaCachePermisos{
			permisos: permisos,
			esAdmin:  esAdmin,
			expira:   time.Now().Add(cacheTTLPermisos),
		})

		// Admin con flag es_admin tiene bypass total
		if esAdmin {
			c.Set("user_es_admin", true)
			c.Next()
			return
		}

		// Inyectar en contexto
		c.Set("user_permisos", permisos)
		c.Next()
	}
}

// RequierePermiso verifica que el usuario tenga un permiso específico (módulo + acción).
// Se usa como middleware por endpoint:
//
//	router.GET("/reclamos", middleware.RequierePermiso("reclamos", "ver"), ctrl.Listar)
func RequierePermiso(modulo, accion string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Roles con es_admin tienen bypass total
		if esAdmin, _ := c.Get("user_es_admin"); esAdmin == true {
			c.Next()
			return
		}

		val, exists := c.Get("user_permisos")
		if !exists {
			helper.Error(c, apperror.New(403, "PERMISOS_NO_CARGADOS", "Permisos no encontrados — ¿falta PermisoMiddleware?"))
			c.Abort()
			return
		}

		permisos, ok := val.(map[string]map[string]bool)
		if !ok {
			helper.Error(c, apperror.ErrInternal)
			c.Abort()
			return
		}

		// Verificar permiso
		if acciones, tieneModulo := permisos[modulo]; tieneModulo {
			if acciones[accion] {
				c.Next()
				return
			}
		}

		helper.Error(c, apperror.New(403, "PERMISO_INSUFICIENTE",
			fmt.Sprintf("No tienes permiso para: %s → %s", modulo, accion)))
		c.Abort()
	}
}

// ── Función utilitaria para verificar permisos fuera de middleware ──

// TienePermiso verifica un permiso directamente desde el contexto de Gin.
func TienePermiso(c *gin.Context, modulo, accion string) bool {
	if esAdmin, _ := c.Get("user_es_admin"); esAdmin == true {
		return true
	}
	val, exists := c.Get("user_permisos")
	if !exists {
		return false
	}
	permisos, ok := val.(map[string]map[string]bool)
	if !ok {
		return false
	}
	if acciones, ok := permisos[modulo]; ok {
		return acciones[accion]
	}
	return false
}

// ObtenerPermisosPorRol busca permisos de un rol en cache o DB.
// Útil para validaciones fuera del ciclo HTTP (goroutines, workers).
func ObtenerPermisosPorRol(ctx context.Context, db *sql.DB, tenantID uuid.UUID, slug string) (map[string]map[string]bool, error) {
	slug = strings.ToLower(slug)
	clave := fmt.Sprintf("%s:%s", tenantID.String(), slug)
	if entrada, ok := cachePermisos.Load(clave); ok {
		if e, ok := entrada.(*entradaCachePermisos); ok && time.Now().Before(e.expira) {
			if e.esAdmin {
				var permisos map[string]map[string]bool
				json.Unmarshal(model.PermisosCompletoAdmin(), &permisos)
				return permisos, nil
			}
			return e.permisos, nil
		}
	}

	var permisosRaw []byte
	var esAdmin bool
	err := db.QueryRowContext(ctx,
		"SELECT permisos, es_admin FROM roles_tenant WHERE tenant_id = $1 AND slug = $2",
		tenantID, slug,
	).Scan(&permisosRaw, &esAdmin)
	if err != nil {
		return nil, err
	}

	var permisos map[string]map[string]bool
	if err := json.Unmarshal(permisosRaw, &permisos); err != nil {
		return nil, err
	}

	cachePermisos.Store(clave, &entradaCachePermisos{
		permisos: permisos,
		esAdmin:  esAdmin,
		expira:   time.Now().Add(cacheTTLPermisos),
	})

	if esAdmin {
		var completos map[string]map[string]bool
		json.Unmarshal(model.PermisosCompletoAdmin(), &completos)
		return completos, nil
	}

	return permisos, nil
}
