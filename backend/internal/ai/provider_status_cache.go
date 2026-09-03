package ai

import (
	"strings"
	"sync"
	"time"
)

// ──────────────────────────────────────────────
// Cache de estado real de providers en memoria.
// Registra errores de Chat() reales (429, 402, etc.)
// sin consumir tokens ni agregar latencia.
// ──────────────────────────────────────────────

type providerStatus struct {
	ErrorMsg  string
	Timestamp time.Time
}

var (
	statusCache sync.Map // map[string]providerStatus  (key = provider name from .Name())
)

// RecordProviderFailure registra un error real de un provider.
// Se llama cuando Chat() falla (rate limit, sin créditos, etc.)
func RecordProviderFailure(providerName string, errMsg string) {
	statusCache.Store(normalizeKey(providerName), providerStatus{
		ErrorMsg:  errMsg,
		Timestamp: time.Now(),
	})
}

// ClearProviderFailure limpia el error cuando un provider responde exitosamente.
func ClearProviderFailure(providerName string) {
	statusCache.Delete(normalizeKey(providerName))
}

// GetCachedFailure retorna el error cacheado si existe y no ha expirado.
// TTL: 30 minutos para rate limits, 2 horas para errores de créditos/pago.
func GetCachedFailure(providerName string) (string, bool) {
	v, ok := statusCache.Load(normalizeKey(providerName))
	if !ok {
		return "", false
	}
	status := v.(providerStatus)

	// Determinar TTL según tipo de error
	ttl := 30 * time.Minute // default
	errLower := strings.ToLower(status.ErrorMsg)
	if strings.Contains(errLower, "402") ||
		strings.Contains(errLower, "payment") ||
		strings.Contains(errLower, "billing") ||
		strings.Contains(errLower, "quota") ||
		strings.Contains(errLower, "insufficient") ||
		strings.Contains(errLower, "credit") {
		ttl = 2 * time.Hour // errores de pago duran más
	}

	if time.Since(status.Timestamp) > ttl {
		statusCache.Delete(normalizeKey(providerName))
		return "", false
	}

	return status.ErrorMsg, true
}

// ClassifyError traduce errores HTTP crudos a mensajes legibles para el dropdown.
func ClassifyError(rawErr string) string {
	lower := strings.ToLower(rawErr)

	if strings.Contains(lower, "429") || strings.Contains(lower, "rate limit") {
		return "Límite de uso alcanzado"
	}
	if strings.Contains(lower, "402") || strings.Contains(lower, "payment") ||
		strings.Contains(lower, "billing") || strings.Contains(lower, "insufficient") {
		return "Sin créditos disponibles"
	}
	if strings.Contains(lower, "401") || strings.Contains(lower, "unauthorized") ||
		strings.Contains(lower, "invalid") {
		return "API key inválida"
	}
	if strings.Contains(lower, "403") || strings.Contains(lower, "forbidden") {
		return "Acceso denegado"
	}
	if strings.Contains(lower, "503") || strings.Contains(lower, "unavailable") {
		return "Servicio no disponible"
	}
	if strings.Contains(lower, "timeout") || strings.Contains(lower, "deadline") {
		return "Tiempo de espera agotado"
	}

	return "Error reciente en uso"
}

func normalizeKey(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}
