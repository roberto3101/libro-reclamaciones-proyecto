package model

type Tenant struct {
	TenantModel

	// Datos legales
	RazonSocial     string     `json:"razon_social" db:"razon_social"`
	RUC             string     `json:"ruc" db:"ruc"`
	NombreComercial NullString `json:"nombre_comercial" db:"nombre_comercial"`
	DireccionLegal  NullString `json:"direccion_legal" db:"direccion_legal"`
	Departamento    NullString `json:"departamento" db:"departamento"`
	Provincia       NullString `json:"provincia" db:"provincia"`
	Distrito        NullString `json:"distrito" db:"distrito"`
	Telefono        NullString `json:"telefono" db:"telefono"`
	EmailContacto   NullString `json:"email_contacto" db:"email_contacto"`

	// Branding
	LogoURL       NullString `json:"logo_url" db:"logo_url"`
	Slug          string     `json:"slug" db:"slug"`
	SitioWeb      NullString `json:"sitio_web" db:"sitio_web"`
	ColorPrimario string     `json:"color_primario" db:"color_primario"`

	// Config del libro
	PlazoRespuestaDias   int        `json:"plazo_respuesta_dias" db:"plazo_respuesta_dias"`
	MensajeConfirmacion  NullString `json:"mensaje_confirmacion" db:"mensaje_confirmacion"`
	NotificarWhatsapp    bool       `json:"notificar_whatsapp" db:"notificar_whatsapp"`
	NotificarEmail       bool       `json:"notificar_email" db:"notificar_email"`

	// Toggles granulares de email
	NotificarEmailEstado     bool `json:"notificar_email_estado" db:"notificar_email_estado"`
	NotificarEmailMensaje    bool `json:"notificar_email_mensaje" db:"notificar_email_mensaje"`
	NotificarEmailResolucion bool `json:"notificar_email_resolucion" db:"notificar_email_resolucion"`

	// Firma del representante legal (base64 data URL para PDF)
	FirmaRepresentante NullString `json:"firma_representante" db:"firma_representante"`

	// Tema visual por defecto (light/dark)
	TemaPorDefecto string `json:"tema_por_defecto" db:"tema_por_defecto"`

	// Multi-empresa
	CuentaID NullUUID `json:"cuenta_id" db:"cuenta_id"`

	// Control
	Activo  bool `json:"activo" db:"activo"`
	Version int  `json:"version" db:"version"`

	Timestamps
}
