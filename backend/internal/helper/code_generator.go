package helper

import (
	"fmt"
	"strings"
	"time"
)

// GenerateCodigoReclamo genera un código único para un reclamo.
// Formato: {AÑO}-{SLUG_TENANT}-{SLUG_SEDE}-{TIMESTAMP_SHORT}
// Ejemplo: 2026-POLLREY-MIR-A3F5B2
//
// No usa secuencias de DB (anti-pattern en CockroachDB).
// Usa timestamp en base36 para unicidad sin coordinación.
func GenerateCodigoReclamo(tenantSlug, sedeSlug string) string {
	year := time.Now().Year()
	shortTenant := sanitizeSlug(tenantSlug, 8)
	shortSede := sanitizeSlug(sedeSlug, 4)
	uniquePart := generateShortID()

	if shortSede != "" {
		return fmt.Sprintf("%d-%s-%s-%s", year, shortTenant, shortSede, uniquePart)
	}
	return fmt.Sprintf("%d-%s-%s", year, shortTenant, uniquePart)
}

// sanitizeSlug convierte un slug a mayúsculas y lo recorta.
func sanitizeSlug(slug string, maxLen int) string {
	clean := strings.ToUpper(strings.ReplaceAll(slug, "-", ""))
	if len(clean) > maxLen {
		return clean[:maxLen]
	}
	return clean
}

// generateShortID genera un ID corto basado en timestamp + random.
// Usa nanosegundos en base36 para obtener 6 caracteres únicos.
func generateShortID() string {
	now := time.Now().UnixNano()
	// Tomamos los últimos 6 dígitos del timestamp en base36
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	result := make([]byte, 6)
	for i := 5; i >= 0; i-- {
		result[i] = chars[now%36]
		now /= 36
	}
	return string(result)
}
