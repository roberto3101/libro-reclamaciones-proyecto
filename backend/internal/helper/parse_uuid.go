package helper

import "github.com/google/uuid"

// ParseUUID parsea un string a UUID, retornando error si es inválido.
func ParseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}