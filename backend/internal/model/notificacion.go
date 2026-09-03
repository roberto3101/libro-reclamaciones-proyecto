package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// TipoNotificacion define los tipos de notificación del sistema.
type TipoNotificacion string

const (
	NotifSolicitudAtencionNueva         TipoNotificacion = "SOLICITUD_ATENCION_NUEVA"
	NotifSolicitudAtencionSinAtender    TipoNotificacion = "SOLICITUD_ATENCION_SIN_ATENDER"
	NotifMensajeAtencionClienteRecibido TipoNotificacion = "MENSAJE_ATENCION_CLIENTE_RECIBIDO"
	NotifReclamoNuevoRegistrado         TipoNotificacion = "RECLAMO_NUEVO_REGISTRADO"
	NotifReclamoMensajeClienteRecibido  TipoNotificacion = "RECLAMO_MENSAJE_CLIENTE_RECIBIDO"
	NotifReclamoAtendidoPorUsuario      TipoNotificacion = "RECLAMO_ATENDIDO_POR_USUARIO"
	NotifReclamoEstadoCambiado          TipoNotificacion = "RECLAMO_ESTADO_CAMBIADO"
	NotifReclamoResueltoConRespuesta    TipoNotificacion = "RECLAMO_RESUELTO_CON_RESPUESTA"
	NotifReclamoAsignado                TipoNotificacion = "RECLAMO_ASIGNADO"
	NotifSolicitudAtencionAsignada      TipoNotificacion = "SOLICITUD_ATENCION_ASIGNADA"
)

// TodosLosTiposNotificacion contiene todos los tipos para listado en config.
var TodosLosTiposNotificacion = []TipoNotificacion{
	NotifSolicitudAtencionNueva,
	NotifSolicitudAtencionSinAtender,
	NotifMensajeAtencionClienteRecibido,
	NotifReclamoNuevoRegistrado,
	NotifReclamoMensajeClienteRecibido,
	NotifReclamoAtendidoPorUsuario,
	NotifReclamoEstadoCambiado,
	NotifReclamoResueltoConRespuesta,
	NotifReclamoAsignado,
	NotifSolicitudAtencionAsignada,
}

// EtiquetasTipoNotificacion mapea cada tipo a una etiqueta legible.
var EtiquetasTipoNotificacion = map[TipoNotificacion]string{
	NotifSolicitudAtencionNueva:         "Nueva solicitud de atención en vivo",
	NotifSolicitudAtencionSinAtender:    "Recordatorio: solicitud sin atender",
	NotifMensajeAtencionClienteRecibido: "Nuevo mensaje del cliente en atención en vivo",
	NotifReclamoNuevoRegistrado:         "Nuevo reclamo registrado",
	NotifReclamoMensajeClienteRecibido:  "Nuevo mensaje del cliente en reclamo",
	NotifReclamoAtendidoPorUsuario:      "Reclamo atendido por un usuario",
	NotifReclamoEstadoCambiado:          "Estado del reclamo cambiado",
	NotifReclamoResueltoConRespuesta:    "Reclamo resuelto con respuesta",
	NotifReclamoAsignado:                "Reclamo asignado a tu cargo",
	NotifSolicitudAtencionAsignada:      "Solicitud de atención asignada a tu cargo",
}

// ModuloRequeridoPorTipoNotificacion indica qué permiso de módulo se necesita.
var ModuloRequeridoPorTipoNotificacion = map[TipoNotificacion]string{
	NotifSolicitudAtencionNueva:         "atencion_vivo",
	NotifSolicitudAtencionSinAtender:    "atencion_vivo",
	NotifMensajeAtencionClienteRecibido: "atencion_vivo",
	NotifReclamoNuevoRegistrado:         "reclamos",
	NotifReclamoMensajeClienteRecibido:  "reclamos",
	NotifReclamoAtendidoPorUsuario:      "reclamos",
	NotifReclamoEstadoCambiado:          "reclamos",
	NotifReclamoResueltoConRespuesta:    "reclamos",
	NotifReclamoAsignado:                "reclamos",
	NotifSolicitudAtencionAsignada:      "atencion_vivo",
}

// Notificacion representa una notificación persistida en la base de datos.
type Notificacion struct {
	TenantID         uuid.UUID        `json:"tenant_id" db:"tenant_id"`
	ID               uuid.UUID        `json:"id" db:"id"`
	UsuarioDestinoID uuid.UUID        `json:"usuario_destino_id" db:"usuario_destino_id"`
	Tipo             TipoNotificacion `json:"tipo" db:"tipo"`
	Titulo           string           `json:"titulo" db:"titulo"`
	Contenido        string           `json:"contenido" db:"contenido"`
	DatosExtra       json.RawMessage  `json:"datos_extra" db:"datos_extra"`
	Leida            bool             `json:"leida" db:"leida"`
	FechaLectura     NullTime         `json:"fecha_lectura" db:"fecha_lectura"`
	FechaCreacion    time.Time        `json:"fecha_creacion" db:"fecha_creacion"`
}

// ConfiguracionNotificacionRol define si un rol recibe cierto tipo de notificación.
type ConfiguracionNotificacionRol struct {
	TenantID          uuid.UUID        `json:"tenant_id" db:"tenant_id"`
	ID                uuid.UUID        `json:"id" db:"id"`
	RolID             uuid.UUID        `json:"rol_id" db:"rol_id"`
	TipoNotificacion  TipoNotificacion `json:"tipo_notificacion" db:"tipo_notificacion"`
	Habilitado        bool             `json:"habilitado" db:"habilitado"`
}

// DefinicionTiposNotificacion se usa para la UI de configuración.
type DefinicionTiposNotificacion struct {
	Tipos     []TipoNotificacion            `json:"tipos"`
	Etiquetas map[TipoNotificacion]string    `json:"etiquetas"`
	Modulos   map[TipoNotificacion]string    `json:"modulos"`
}
