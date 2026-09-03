package dto

// CreateSedeRequest — POST /api/v1/sedes
type CreateSedeRequest struct {
	Nombre            string   `json:"nombre" binding:"required,min=3,max=100"`
	Slug              string   `json:"slug" binding:"required,min=2,max=50"`
	CodigoSede        string   `json:"codigo_sede" binding:"max=20"`
	Direccion         string   `json:"direccion" binding:"required,min=5,max=250"`
	Departamento      string   `json:"departamento" binding:"max=100"`
	Provincia         string   `json:"provincia" binding:"max=100"`
	Distrito          string   `json:"distrito" binding:"max=100"`
	Referencia        string   `json:"referencia" binding:"max=200"`
	Telefono          string   `json:"telefono" binding:"max=20"`
	Email             string   `json:"email" binding:"omitempty,email,max=150"`
	ResponsableNombre string   `json:"responsable_nombre" binding:"max=100"`
	ResponsableCargo  string   `json:"responsable_cargo" binding:"max=100"`
	HorarioAtencion   []any    `json:"horario_atencion" binding:"max=7"` // JSONB — ej: [{"dia":"lunes","inicio":"08:00","fin":"18:00"}]
	Latitud           *float64 `json:"latitud"`                          // Puntero para distinguir 0 de ausente
	Longitud          *float64 `json:"longitud"`
	EsPrincipal       bool     `json:"es_principal"`
}

// UpdateSedeRequest — PUT /api/v1/sedes/:id
type UpdateSedeRequest struct {
	Nombre            string   `json:"nombre" binding:"required,min=3,max=100"`
	Slug              string   `json:"slug" binding:"required,min=2,max=50"`
	CodigoSede        string   `json:"codigo_sede" binding:"max=20"`
	Direccion         string   `json:"direccion" binding:"required,min=5,max=250"`
	Departamento      string   `json:"departamento" binding:"max=100"`
	Provincia         string   `json:"provincia" binding:"max=100"`
	Distrito          string   `json:"distrito" binding:"max=100"`
	Referencia        string   `json:"referencia" binding:"max=200"`
	Telefono          string   `json:"telefono" binding:"max=20"`
	Email             string   `json:"email" binding:"omitempty,email,max=150"`
	ResponsableNombre string   `json:"responsable_nombre" binding:"max=100"`
	ResponsableCargo  string   `json:"responsable_cargo" binding:"max=100"`
	HorarioAtencion   []any    `json:"horario_atencion" binding:"max=7"`
	Latitud           *float64 `json:"latitud"`
	Longitud          *float64 `json:"longitud"`
	EsPrincipal       bool     `json:"es_principal"`
}

// SedeResponse — respuesta al frontend (consistente)
type SedeResponse struct {
	ID                 string   `json:"id"`
	TenantID           string   `json:"tenant_id"`
	Nombre             string   `json:"nombre"`
	Slug               string   `json:"slug"`
	CodigoSede         *string  `json:"codigo_sede"`
	Direccion          string   `json:"direccion"`
	Departamento       *string  `json:"departamento"`
	Provincia          *string  `json:"provincia"`
	Distrito           *string  `json:"distrito"`
	Referencia         *string  `json:"referencia"`
	Telefono           *string  `json:"telefono"`
	Email              *string  `json:"email"`
	ResponsableNombre  *string  `json:"responsable_nombre"`
	ResponsableCargo   *string  `json:"responsable_cargo"`
	HorarioAtencion    any      `json:"horario_atencion"` // JSON array o null
	Latitud            *float64 `json:"latitud"`
	Longitud           *float64 `json:"longitud"`
	Activo             bool     `json:"activo"`
	EsPrincipal        bool     `json:"es_principal"`
	FechaCreacion      string   `json:"fecha_creacion"`
	FechaActualizacion string   `json:"fecha_actualizacion"`
}
