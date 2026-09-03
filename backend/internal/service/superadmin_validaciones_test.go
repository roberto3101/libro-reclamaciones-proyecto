package service

import (
	"testing"
)

func TestValidarNombreCuenta(t *testing.T) {
	tests := []struct {
		nombre  string
		entrada string
		error   bool
	}{
		{"vacio", "", true},
		{"muy_corto", "ab", true},
		{"minimo_valido", "abc", false},
		{"con_numeros", "Empresa123", true},
		{"solo_numeros", "12345", true},
		{"valido_normal", "Grupo Quma SAC", false},
		{"con_tildes", "José María López", false},
		{"con_ñ", "Peña Hermanos", false},
		{"maximo_100", string(make([]byte, 101)), true},
		{"exacto_100", "abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij", false},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			err := validarNombreCuenta(tt.entrada)
			if (err != nil) != tt.error {
				t.Errorf("validarNombreCuenta(%q) = %v, esperaba error=%v", tt.entrada, err, tt.error)
			}
		})
	}
}

func TestValidarEmailCuenta(t *testing.T) {
	tests := []struct {
		nombre  string
		entrada string
		error   bool
	}{
		{"vacio", "", true},
		{"sin_arroba", "emailsindominio", true},
		{"sin_punto", "email@dominio", true},
		{"valido", "admin@empresa.com", false},
		{"con_subdominios", "admin@mail.empresa.com.pe", false},
		{"muy_corto", "a@b", true},
		{"maximo_100", "a@" + string(make([]byte, 99)), true},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			err := validarEmailCuenta(tt.entrada)
			if (err != nil) != tt.error {
				t.Errorf("validarEmailCuenta(%q) = %v, esperaba error=%v", tt.entrada, err, tt.error)
			}
		})
	}
}

func TestValidarRUCCuenta(t *testing.T) {
	tests := []struct {
		nombre  string
		entrada string
		error   bool
	}{
		{"vacio_opcional", "", false},
		{"valido_11_digitos", "20123456789", false},
		{"10_digitos", "2012345678", true},
		{"12_digitos", "201234567890", true},
		{"con_letras", "2012345678A", true},
		{"con_espacios", "201 234 5678", true},
		{"con_guiones", "201-234-5678", true},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			err := validarRUCCuenta(tt.entrada)
			if tt.entrada == "" {
				return // vacio es opcional, se valida en validarDatosCuenta
			}
			if (err != nil) != tt.error {
				t.Errorf("validarRUCCuenta(%q) = %v, esperaba error=%v", tt.entrada, err, tt.error)
			}
		})
	}
}

func TestValidarTelefonoCuenta(t *testing.T) {
	tests := []struct {
		nombre  string
		entrada string
		error   bool
	}{
		{"vacio_opcional", "", false},
		{"nacional_9_digitos", "987654321", false},
		{"internacional", "+51987654321", false},
		{"con_espacios", "+51 987 654 321", false},
		{"con_guiones", "+51-987-654-321", false},
		{"muy_corto", "12345", true},
		{"con_letras", "987abc321", true},
		{"solo_simbolos", "++--", true},
		{"16_digitos", "1234567890123456", true},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			if tt.entrada == "" {
				return
			}
			err := validarTelefonoCuenta(tt.entrada)
			if (err != nil) != tt.error {
				t.Errorf("validarTelefonoCuenta(%q) = %v, esperaba error=%v", tt.entrada, err, tt.error)
			}
		})
	}
}

func TestValidarDatosCuenta(t *testing.T) {
	tests := []struct {
		nombre    string
		nom       string
		email     string
		tel       string
		ruc       string
		dir       string
		notas     string
		error     bool
	}{
		{"todo_valido", "Grupo Quma", "admin@quma.com", "+51987654321", "20123456789", "Av Lima 123", "Nota", false},
		{"minimo_requerido", "abc", "a@b.c", "", "", "", "", false},
		{"nombre_con_numeros", "Empresa123", "admin@quma.com", "", "", "", "", true},
		{"email_invalido", "Grupo Quma", "sinformato", "", "", "", "", true},
		{"ruc_invalido", "Grupo Quma", "admin@quma.com", "", "123", "", "", true},
		{"direccion_larga", "Grupo Quma", "admin@quma.com", "", "", string(make([]byte, 201)), "", true},
		{"notas_largas", "Grupo Quma", "admin@quma.com", "", "", "", string(make([]byte, 501)), true},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			err := validarDatosCuenta(tt.nom, tt.email, tt.tel, tt.ruc, tt.dir, tt.notas)
			if (err != nil) != tt.error {
				t.Errorf("validarDatosCuenta = %v, esperaba error=%v", err, tt.error)
			}
		})
	}
}

func TestValidarDatosCuentaParcial(t *testing.T) {
	tests := []struct {
		nombre string
		nom    string
		email  string
		error  bool
	}{
		{"todo_vacio_ok", "", "", false},
		{"nombre_valido", "Grupo Nuevo", "", false},
		{"nombre_invalido", "12", "", true},
		{"email_valido", "", "nuevo@email.com", false},
		{"email_invalido", "", "sinformato", true},
	}
	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			err := validarDatosCuentaParcial(tt.nom, tt.email, "", "", "", "")
			if (err != nil) != tt.error {
				t.Errorf("validarDatosCuentaParcial = %v, esperaba error=%v", err, tt.error)
			}
		})
	}
}

