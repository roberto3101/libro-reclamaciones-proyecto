package middleware

import (
	"context"
	"sync"
	"time"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type entradaCache struct {
	sedeIDs   []uuid.UUID
	expiracion time.Time
}

var (
	cacheSedes sync.Map
	cacheTTL   = 5 * time.Minute
)

// SedesMiddleware carga las sedes asignadas al usuario y las inyecta en el contexto.
// Usa cache en memoria con TTL de 5 minutos para evitar queries repetitivas.
func SedesMiddleware(usuarioSedeRepo *repo.UsuarioSedeRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := helper.GetTenantID(c)
		if err != nil {
			c.Next()
			return
		}
		userID, err := helper.GetUserID(c)
		if err != nil {
			c.Next()
			return
		}

		cacheKey := tenantID.String() + ":" + userID.String()

		// Buscar en cache
		if val, ok := cacheSedes.Load(cacheKey); ok {
			entrada := val.(entradaCache)
			if time.Now().Before(entrada.expiracion) {
				helper.SetUserSedesIDs(c, entrada.sedeIDs)
				c.Next()
				return
			}
			cacheSedes.Delete(cacheKey)
		}

		// Consultar DB
		sedeIDs, err := usuarioSedeRepo.ObtenerSedesPorUsuario(context.Background(), tenantID, userID)
		if err != nil {
			// Si falla, no restringir (acceso global como fallback seguro)
			c.Next()
			return
		}

		// Guardar en cache
		cacheSedes.Store(cacheKey, entradaCache{
			sedeIDs:    sedeIDs,
			expiracion: time.Now().Add(cacheTTL),
		})

		helper.SetUserSedesIDs(c, sedeIDs)
		c.Next()
	}
}

// InvalidarCacheSedes limpia el cache de sedes de un usuario específico.
// Llamar después de actualizar las sedes asignadas.
func InvalidarCacheSedes(tenantID, userID uuid.UUID) {
	cacheKey := tenantID.String() + ":" + userID.String()
	cacheSedes.Delete(cacheKey)
}
