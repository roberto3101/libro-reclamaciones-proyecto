package helper

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// --- PASSWORD (BCRYPT) ---

// HashPassword genera un hash bcrypt de la contraseña.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(bytes), nil
}

// CheckPassword compara una contraseña con su hash.
func CheckPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// --- API KEYS (SHA256) ---

// SHA256Hash genera el hash SHA-256 de un string.
// Usado para hashear la API Key antes de guardarla o buscarla.
func SHA256Hash(input string) string {
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:])
}

// GenerateAPIKey crea un token seguro y su prefijo.
// Formato: prefix_env_random (ej: crb_live_a1b2c3...)
// Retorna: (plainKey, keyPrefix, error)
func GenerateAPIKey(prefix, environment string) (string, string, error) {
	// 1. Generar 32 bytes de aleatoriedad criptográfica
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", err
	}
	
	// 2. Convertir a hex string
	randomPart := hex.EncodeToString(bytes)

	// 3. Normalizar entorno (LIVE o TEST)
	envCode := "test"
	if strings.ToUpper(environment) == "LIVE" || strings.ToUpper(environment) == "PRODUCCION" {
		envCode = "live"
	}
	
	// 4. Construir la key completa (ej: crb_live_a1b2c3d4...)
	if prefix == "" {
		prefix = "crb"
	}
	fullKey := fmt.Sprintf("%s_%s_%s", prefix, envCode, randomPart)
	
	// 5. Extraer el prefijo visible (aprox los primeros 15 chars) para identificarla en DB
	prefixLen := len(prefix) + len(envCode) + 8 // prefix + _ + env + _ + 6 chars de random
	if prefixLen > len(fullKey) {
		prefixLen = len(fullKey)
	}
	keyPrefix := fullKey[:prefixLen]

	return fullKey, keyPrefix, nil
}