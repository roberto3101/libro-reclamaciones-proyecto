package helper

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Claves del contexto. Definidas una sola vez para evitar typos.
const (
	CtxTenantID       = "tenant_id"
	CtxUserID         = "user_id"
	CtxUserRole       = "user_role"
	CtxChatbotID      = "chatbot_id"
	CtxAPIKeyID       = "api_key_id"
	CtxSedeIDs        = "sede_ids"
	CtxIPAddress      = "ip_address"
	CtxSuperAdminID   = "superadmin_id"   // espejo de middleware.CtxSuperAdminID para evitar import cycle
)

// GetTenantID extrae el tenant_id del contexto. Falla si no existe.
func GetTenantID(c *gin.Context) (uuid.UUID, error) {
	return GetUUIDFromContext(c, CtxTenantID)
}

// GetUserID extrae el user_id del contexto.
func GetUserID(c *gin.Context) (uuid.UUID, error) {
	return GetUUIDFromContext(c, CtxUserID)
}

// GetChatbotID extrae el chatbot_id del contexto (para requests de chatbot).
func GetChatbotID(c *gin.Context) (uuid.UUID, error) {
	return GetUUIDFromContext(c, CtxChatbotID)
}

// GetUserRole extrae el rol del usuario del contexto.
func GetUserRole(c *gin.Context) string {
	role, _ := c.Get(CtxUserRole)
	if r, ok := role.(string); ok {
		return r
	}
	return ""
}

// GetUserSedesIDs retorna las sedes asignadas al usuario.
// Slice vacío = acceso global (sin restricción).
func GetUserSedesIDs(c *gin.Context) []uuid.UUID {
	val, exists := c.Get(CtxSedeIDs)
	if !exists {
		return nil
	}
	ids, ok := val.([]uuid.UUID)
	if !ok {
		return nil
	}
	return ids
}

// SetUserSedesIDs guarda las sedes asignadas en el contexto.
func SetUserSedesIDs(c *gin.Context, sedeIDs []uuid.UUID) {
	c.Set(CtxSedeIDs, sedeIDs)
}

// GetClientIP retorna la IP real del cliente, priorizando headers de proxies conocidos.
func GetClientIP(c *gin.Context) string {
	// Cloudflare siempre envía la IP real en este header
	if ip := c.GetHeader("CF-Connecting-IP"); ip != "" {
		return ip
	}
	// Fallback estándar de Gin (X-Forwarded-For, X-Real-Ip, RemoteAddr)
	return c.ClientIP()
}

// SetContext guarda un valor en el contexto de gin.
func SetContext(c *gin.Context, key string, value interface{}) {
	c.Set(key, value)
}

// GetUUIDFromContext extrae un UUID del contexto por clave.
func GetUUIDFromContext(c *gin.Context, key string) (uuid.UUID, error) {
	val, exists := c.Get(key)
	if !exists {
		return uuid.Nil, errors.New(key + " no encontrado en contexto")
	}
	id, ok := val.(uuid.UUID)
	if !ok {
		return uuid.Nil, errors.New(key + " tiene formato inválido")
	}
	return id, nil
}