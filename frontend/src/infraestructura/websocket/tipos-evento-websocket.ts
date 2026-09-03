export type TipoEventoWebSocket =
  | 'SOLICITUD_ATENCION_NUEVA'
  | 'SOLICITUD_ATENCION_SIN_ATENDER'
  | 'MENSAJE_ATENCION_CLIENTE_RECIBIDO'
  | 'MENSAJE_ATENCION_ASESOR_ENVIADO'
  | 'RECLAMO_NUEVO_REGISTRADO'
  | 'RECLAMO_MENSAJE_CLIENTE_RECIBIDO'
  | 'RECLAMO_MENSAJE_EMPRESA_ENVIADO'
  | 'RECLAMO_ATENDIDO_POR_USUARIO'
  | 'RECLAMO_ESTADO_CAMBIADO'
  | 'RECLAMO_RESUELTO_CON_RESPUESTA'
  | 'NOTIFICACION_NUEVA'
  | 'CONTADOR_NOTIFICACIONES_ACTUALIZADO'
  | 'SEGUIMIENTO_ESTADO_ACTUALIZADO'
  | 'SEGUIMIENTO_MENSAJE_NUEVO';

export interface MensajeWebSocket<T = unknown> {
  tipo: TipoEventoWebSocket;
  datos: T;
  fecha_evento: string;
}

export interface DatosSolicitudAtencionNueva {
  solicitud_id: string;
  nombre: string;
  motivo: string;
  canal_origen: string;
  prioridad: string;
}

export interface DatosMensajeAtencionRecibido {
  solicitud_id: string;
  mensaje_id: string;
  remitente: string;
  contenido: string;
  fecha_envio: string;
  asesor_id?: string;
}

export interface DatosReclamoNuevoRegistrado {
  reclamo_id: string;
  codigo_reclamo: string;
  tipo_solicitud: string;
  nombre_cliente: string;
  sede_nombre?: string;
}

export interface DatosReclamoMensajeRecibido {
  reclamo_id: string;
  codigo_reclamo: string;
  mensaje_id: string;
  tipo_mensaje: string;
  contenido: string;
}

export interface DatosReclamoEstadoCambiado {
  reclamo_id: string;
  codigo_reclamo: string;
  estado_anterior: string;
  estado_nuevo: string;
  usuario_nombre?: string;
}

export interface DatosSeguimientoPublico {
  codigo_reclamo: string;
  estado_nuevo?: string;
  tipo_evento: string;
}

export interface DatosNotificacionNueva {
  notificacion_id: string;
  tipo: string;
  titulo: string;
  contenido: string;
  datos_extra?: Record<string, unknown> | null;
  fecha_creacion: string;
}

export interface DatosContadorNotificaciones {
  total_sin_leer: number;
}
