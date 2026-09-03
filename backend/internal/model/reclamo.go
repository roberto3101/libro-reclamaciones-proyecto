package model

import (
	"encoding/json"
	"time"
)

type Reclamo struct {
	TenantModel

	CodigoReclamo string `json:"codigo_reclamo" db:"codigo_reclamo"`
	TipoSolicitud string `json:"tipo_solicitud" db:"tipo_solicitud"`
	Estado        string `json:"estado" db:"estado"`

	// Sección 1: Consumidor
	NombreCompleto  string     `json:"nombre_completo" db:"nombre_completo"`
	TipoDocumento   string     `json:"tipo_documento" db:"tipo_documento"`
	NumeroDocumento string     `json:"numero_documento" db:"numero_documento"`
	Telefono        string     `json:"telefono" db:"telefono"`
	Email           string     `json:"email" db:"email"`
	Domicilio       NullString `json:"domicilio" db:"domicilio"`
	Departamento    NullString `json:"departamento" db:"departamento"`
	Provincia       NullString `json:"provincia" db:"provincia"`
	Distrito        NullString `json:"distrito" db:"distrito"`
	MenorDeEdad     bool       `json:"menor_de_edad" db:"menor_de_edad"`
	NombreApoderado NullString `json:"nombre_apoderado" db:"nombre_apoderado"`

	// Sección 2: Proveedor (snapshot)
	RazonSocialProveedor NullString `json:"razon_social_proveedor" db:"razon_social_proveedor"`
	RUCProveedor         NullString `json:"ruc_proveedor" db:"ruc_proveedor"`
	DireccionProveedor   NullString `json:"direccion_proveedor" db:"direccion_proveedor"`

	// Sección 2b: Sede (snapshot)
	SedeID        NullUUID   `json:"sede_id" db:"sede_id"`
	SedeNombre    NullString `json:"sede_nombre" db:"sede_nombre"`
	SedeDireccion NullString `json:"sede_direccion" db:"sede_direccion"`

	// Sección 3: Bien contratado
	TipoBien        NullString  `json:"tipo_bien" db:"tipo_bien"`
	MontoReclamado  NullFloat64 `json:"monto_reclamado" db:"monto_reclamado"`
	DescripcionBien string      `json:"descripcion_bien" db:"descripcion_bien"`
	NumeroPedido    NullString  `json:"numero_pedido" db:"numero_pedido"`

	// Campos para QUEJA
	AreaQueja            NullString `json:"area_queja" db:"area_queja"`
	DescripcionSituacion NullString `json:"descripcion_situacion" db:"descripcion_situacion"`

	// Sección 4: Detalle
	FechaIncidente   time.Time `json:"fecha_incidente" db:"fecha_incidente"`
	DetalleReclamo   string    `json:"detalle_reclamo" db:"detalle_reclamo"`
	PedidoConsumidor string    `json:"pedido_consumidor" db:"pedido_consumidor"`

	// Firma y metadatos
	FirmaDigital NullString `json:"firma_digital" db:"firma_digital"`
	IPAddress    NullString `json:"ip_address" db:"ip_address"`
	UserAgent    NullString `json:"user_agent" db:"user_agent"`

	// Conformidad
	AceptaTerminos bool `json:"acepta_terminos" db:"acepta_terminos"`
	AceptaCopia    bool `json:"acepta_copia" db:"acepta_copia"`

	// Fechas
	FechaRegistro        time.Time `json:"fecha_registro" db:"fecha_registro"`
	FechaLimiteRespuesta NullTime  `json:"fecha_limite_respuesta" db:"fecha_limite_respuesta"`
	FechaRespuesta       NullTime  `json:"fecha_respuesta" db:"fecha_respuesta"`
	FechaCierre          NullTime  `json:"fecha_cierre" db:"fecha_cierre"`

	// Gestión
	AtendidoPor       NullUUID   `json:"atendido_por" db:"atendido_por"`
	CanalOrigen       string     `json:"canal_origen" db:"canal_origen"`
	EsClienteRegistrado bool             `json:"es_cliente_registrado" db:"es_cliente_registrado"`
	ArchivosAdjuntos  *json.RawMessage `json:"archivos_adjuntos" db:"archivos_adjuntos"`
	DeletedAt         NullTime         `json:"deleted_at" db:"deleted_at"`

	// Campo transiente (no es columna DB, se llena con JOIN en queries específicas)
	NombreAtendidoPor string `json:"nombre_atendido_por,omitempty" db:"-"`
}

// Tipos de solicitud.
const (
	TipoReclamo = "RECLAMO"
	TipoQueja   = "QUEJA"
)

// Estados de reclamo.
const (
	EstadoPendiente  = "PENDIENTE"
	EstadoEnProceso  = "EN_PROCESO"
	EstadoResuelto   = "RESUELTO"
	EstadoCerrado    = "CERRADO"
	EstadoRechazado  = "RECHAZADO" // <--- FALTABA ESTA LÍNEA
)

// Tipos de documento.
const (
	DocDNI       = "DNI"
	DocCE        = "CE"
	DocPasaporte = "Pasaporte"
	DocRUC       = "RUC"
)

// Tipos de bien.
const (
	BienProducto = "PRODUCTO"
	BienServicio = "SERVICIO"
)

// Canales de origen.
const (
	CanalWeb        = "WEB"
	CanalApp        = "APP"
	CanalPresencial = "PRESENCIAL"
	CanalQR         = "QR"
	CanalChatbot    = "CHATBOT"
)
