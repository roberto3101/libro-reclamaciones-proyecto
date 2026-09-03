package helper

import (
	"html"
	"regexp"
	"strings"
)

var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]{1,64}@[a-zA-Z0-9.\-]{1,253}\.[a-zA-Z]{2,10}$`)
	rucRegex   = regexp.MustCompile(`^(10|15|17|20)\d{9}$`)
	dniRegex   = regexp.MustCompile(`^\d{8}$`)
	ceRegex    = regexp.MustCompile(`^\d{9,12}$`)
	slugRegex          = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	telefonoRegex      = regexp.MustCompile(`^[+]?[\d\s\-()]*$`)
	soloLetrasEspacios = regexp.MustCompile(`^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$`)
	codigoSedeRegex    = regexp.MustCompile(`^[a-zA-Z0-9\-_]*$`)
	horaRegex          = regexp.MustCompile(`^\d{2}:\d{2}$`)
)

// ValidateEmail verifica formato de email.
func ValidateEmail(email string) bool {
	return emailRegex.MatchString(strings.TrimSpace(email))
}

// ValidateRUC verifica formato de RUC peruano (11 dígitos, empieza con 10, 15, 17 o 20).
func ValidateRUC(ruc string) bool {
	return rucRegex.MatchString(strings.TrimSpace(ruc))
}

// ValidateDNI verifica formato de DNI peruano (8 dígitos).
func ValidateDNI(dni string) bool {
	return dniRegex.MatchString(strings.TrimSpace(dni))
}

// ValidateCE verifica formato de Carné de Extranjería (9-12 dígitos).
func ValidateCE(ce string) bool {
	return ceRegex.MatchString(strings.TrimSpace(ce))
}

// ValidateDocumento valida según el tipo de documento.
func ValidateDocumento(tipo, numero string) bool {
	switch strings.ToUpper(tipo) {
	case "DNI":
		return ValidateDNI(numero)
	case "CE":
		return ValidateCE(numero)
	case "RUC":
		return ValidateRUC(numero)
	case "Pasaporte":
		return len(strings.TrimSpace(numero)) >= 5
	default:
		return false
	}
}

// ValidateSlug verifica que un slug sea válido (minúsculas, números, guiones).
func ValidateSlug(slug string) bool {
	return slugRegex.MatchString(slug)
}

// ValidateTelefono verifica formato de teléfono (dígitos, +, espacios, guiones, paréntesis).
func ValidateTelefono(telefono string) bool {
	return telefonoRegex.MatchString(strings.TrimSpace(telefono))
}

// ValidateOnlyLettersSpaces verifica que solo contenga letras (incluyendo acentos) y espacios.
func ValidateOnlyLettersSpaces(text string) bool {
	return soloLetrasEspacios.MatchString(strings.TrimSpace(text))
}

// ValidateCodigoSede verifica formato alfanumérico con guiones y guiones bajos.
func ValidateCodigoSede(codigo string) bool {
	return codigoSedeRegex.MatchString(strings.TrimSpace(codigo))
}

// ValidateHora verifica formato HH:MM.
func ValidateHora(hora string) bool {
	return horaRegex.MatchString(strings.TrimSpace(hora))
}

// SanitizeText aplica TrimSpace y escapa HTML para prevenir XSS.
func SanitizeText(s string) string {
	return html.EscapeString(strings.TrimSpace(s))
}

// Required verifica que un string no esté vacío.
func Required(value, field string) string {
	if strings.TrimSpace(value) == "" {
		return field + " es obligatorio"
	}
	return ""
}
