package websocket

import "time"

// TipoEvento identifica la clase de evento transmitido por WebSocket.
type TipoEvento string

const (
	EventoSolicitudAtencionNueva            TipoEvento = "SOLICITUD_ATENCION_NUEVA"
	EventoSolicitudAtencionSinAtender       TipoEvento = "SOLICITUD_ATENCION_SIN_ATENDER"
	EventoMensajeAtencionClienteRecibido    TipoEvento = "MENSAJE_ATENCION_CLIENTE_RECIBIDO"
	EventoMensajeAtencionAsesorEnviado      TipoEvento = "MENSAJE_ATENCION_ASESOR_ENVIADO"
	EventoReclamoNuevoRegistrado            TipoEvento = "RECLAMO_NUEVO_REGISTRADO"
	EventoReclamoMensajeClienteRecibido     TipoEvento = "RECLAMO_MENSAJE_CLIENTE_RECIBIDO"
	EventoReclamoMensajeEmpresaEnviado      TipoEvento = "RECLAMO_MENSAJE_EMPRESA_ENVIADO"
	EventoReclamoAtendidoPorUsuario         TipoEvento = "RECLAMO_ATENDIDO_POR_USUARIO"
	EventoReclamoEstadoCambiado             TipoEvento = "RECLAMO_ESTADO_CAMBIADO"
	EventoReclamoResueltoConRespuesta       TipoEvento = "RECLAMO_RESUELTO_CON_RESPUESTA"
	EventoNotificacionNueva                 TipoEvento = "NOTIFICACION_NUEVA"
	EventoContadorNotificacionesActualizado TipoEvento = "CONTADOR_NOTIFICACIONES_ACTUALIZADO"
	EventoSeguimientoEstadoActualizado      TipoEvento = "SEGUIMIENTO_ESTADO_ACTUALIZADO"
	EventoSeguimientoMensajeNuevo           TipoEvento = "SEGUIMIENTO_MENSAJE_NUEVO"
	EventoErrorLogNuevo                     TipoEvento = "ERROR_LOG_NUEVO"
	EventoErrorAlertaNueva                  TipoEvento = "ERROR_ALERTA_NUEVA"
)

type DatosErrorLogNuevo struct {
	ID          string  `json:"id"`
	Nivel       string  `json:"nivel"`
	Origen      string  `json:"origen"`
	TenantID    *string `json:"tenant_id"`
	Metodo      string  `json:"metodo"`
	Ruta        string  `json:"ruta"`
	StatusCode  int     `json:"status_code"`
	Mensaje     string  `json:"mensaje"`
	IPAddress   string  `json:"ip_address"`
	Fingerprint string  `json:"fingerprint"`
	Fecha       string  `json:"fecha"`
}

type DatosErrorAlertaNueva struct {
	ID          string `json:"id"`
	Fingerprint string `json:"fingerprint"`
	Tipo        string `json:"tipo"`
	Mensaje     string `json:"mensaje"`
	Fecha       string `json:"fecha"`
}

// MensajeWebSocket es la estructura que se envía/recibe por el WebSocket.
type MensajeWebSocket struct {
	Tipo       TipoEvento  `json:"tipo"`
	Datos      interface{} `json:"datos,omitempty"`
	FechaEvento time.Time  `json:"fecha_evento"`
}

// DatosSolicitudAtencionNueva contiene la info de una nueva solicitud de atención.
type DatosSolicitudAtencionNueva struct {
	SolicitudID string `json:"solicitud_id"`
	Nombre      string `json:"nombre"`
	Motivo      string `json:"motivo"`
	CanalOrigen string `json:"canal_origen"`
	Prioridad   string `json:"prioridad"`
}

// DatosMensajeAtencionRecibido contiene la info de un nuevo mensaje en atención en vivo.
type DatosMensajeAtencionRecibido struct {
	SolicitudID string `json:"solicitud_id"`
	MensajeID   string `json:"mensaje_id"`
	Remitente   string `json:"remitente"`
	Contenido   string `json:"contenido"`
	FechaEnvio  string `json:"fecha_envio"`
	AsesorID    string `json:"asesor_id,omitempty"`
}

// DatosReclamoNuevoRegistrado contiene la info de un nuevo reclamo.
type DatosReclamoNuevoRegistrado struct {
	ReclamoID     string `json:"reclamo_id"`
	CodigoReclamo string `json:"codigo_reclamo"`
	TipoSolicitud string `json:"tipo_solicitud"`
	NombreCliente string `json:"nombre_cliente"`
	SedeNombre    string `json:"sede_nombre,omitempty"`
}

// DatosReclamoMensajeRecibido contiene la info de un nuevo mensaje de reclamo.
type DatosReclamoMensajeRecibido struct {
	ReclamoID     string `json:"reclamo_id"`
	CodigoReclamo string `json:"codigo_reclamo"`
	MensajeID     string `json:"mensaje_id"`
	TipoMensaje   string `json:"tipo_mensaje"`
	Contenido     string `json:"contenido"`
}

// DatosReclamoEstadoCambiado contiene la info del cambio de estado de un reclamo.
type DatosReclamoEstadoCambiado struct {
	ReclamoID      string `json:"reclamo_id"`
	CodigoReclamo  string `json:"codigo_reclamo"`
	EstadoAnterior string `json:"estado_anterior"`
	EstadoNuevo    string `json:"estado_nuevo"`
	UsuarioNombre  string `json:"usuario_nombre,omitempty"`
}

// DatosReclamoAtendidoPorUsuario contiene la info de quién atendió el reclamo.
type DatosReclamoAtendidoPorUsuario struct {
	ReclamoID     string `json:"reclamo_id"`
	CodigoReclamo string `json:"codigo_reclamo"`
	UsuarioID     string `json:"usuario_id"`
	UsuarioNombre string `json:"usuario_nombre"`
}

// DatosSeguimientoPublico contiene info limitada para el tracking público.
type DatosSeguimientoPublico struct {
	CodigoReclamo string `json:"codigo_reclamo"`
	EstadoNuevo   string `json:"estado_nuevo,omitempty"`
	TipoEvento    string `json:"tipo_evento"`
}

// DatosNotificacionNueva acompaña el evento de nueva notificación in-app.
type DatosNotificacionNueva struct {
	NotificacionID string                 `json:"notificacion_id"`
	Tipo           string                 `json:"tipo"`
	Titulo         string                 `json:"titulo"`
	Contenido      string                 `json:"contenido"`
	DatosExtra     map[string]interface{} `json:"datos_extra,omitempty"`
	FechaCreacion  string                 `json:"fecha_creacion"`
}

// DatosContadorNotificaciones lleva el contador actualizado de no leídas.
type DatosContadorNotificaciones struct {
	TotalSinLeer int `json:"total_sin_leer"`
}
