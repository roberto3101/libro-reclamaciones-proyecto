package model

import (
	"database/sql"
	
)

type Sede struct {
	TenantModel

	Nombre     string     `json:"nombre" db:"nombre"`
	Slug       string     `json:"slug" db:"slug"`
	CodigoSede NullString `json:"codigo_sede" db:"codigo_sede"`

	// Dirección
	Direccion    string     `json:"direccion" db:"direccion"`
	Departamento NullString `json:"departamento" db:"departamento"`
	Provincia    NullString `json:"provincia" db:"provincia"`
	Distrito     NullString `json:"distrito" db:"distrito"`
	Referencia   NullString `json:"referencia" db:"referencia"`

	// Contacto
	Telefono          NullString `json:"telefono" db:"telefono"`
	Email             NullString `json:"email" db:"email"`
	ResponsableNombre NullString `json:"responsable_nombre" db:"responsable_nombre"`
	ResponsableCargo  NullString `json:"responsable_cargo" db:"responsable_cargo"`

	// Horario (JSONB) - usar sql.NullString para manejar NULL
HorarioAtencion sql.NullString `json:"horario_atencion" db:"horario_atencion"`

	// Geolocalización
	Latitud  NullFloat64 `json:"latitud" db:"latitud"`
	Longitud NullFloat64 `json:"longitud" db:"longitud"`

	// Estado
	Activo      bool `json:"activo" db:"activo"`
	EsPrincipal bool `json:"es_principal" db:"es_principal"`

	Timestamps
}