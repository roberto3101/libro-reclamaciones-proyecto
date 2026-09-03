package middleware

import (
	"testing"
)

func TestGenerarFingerprint(t *testing.T) {
	fp1 := generarFingerprint("Not Found", "/api/v1/reclamos", 404)
	fp2 := generarFingerprint("Not Found", "/api/v1/reclamos", 404)
	fp3 := generarFingerprint("Not Found", "/api/v1/usuarios", 404)

	if fp1 != fp2 {
		t.Error("mismo input debe generar mismo fingerprint")
	}
	if fp1 == fp3 {
		t.Error("input diferente debe generar fingerprint diferente")
	}
	if len(fp1) != 32 {
		t.Errorf("fingerprint debe ser MD5 de 32 chars, got %d", len(fp1))
	}
}

func TestSanitizarBody(t *testing.T) {
	tests := []struct {
		nombre   string
		entrada  string
		contiene string
		noContiene string
	}{
		{"vacio", "", "", ""},
		{"json_sin_sensibles", `{"nombre":"test"}`, "test", ""},
		{"password_redactado", `{"email":"a@b.com","password":"secreto123"}`, "[REDACTED]", "secreto123"},
		{"token_redactado", `{"token":"abc123","data":"ok"}`, "[REDACTED]", "abc123"},
		{"no_json", "esto no es json", "[binary/non-json]", ""},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			result := sanitizarBody(tt.entrada)
			if tt.contiene != "" && !contains(result, tt.contiene) {
				t.Errorf("sanitizarBody(%q) = %q, debe contener %q", tt.entrada, result, tt.contiene)
			}
			if tt.noContiene != "" && contains(result, tt.noContiene) {
				t.Errorf("sanitizarBody(%q) = %q, NO debe contener %q", tt.entrada, result, tt.noContiene)
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (substr == "" || indexOf(s, substr) >= 0)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
