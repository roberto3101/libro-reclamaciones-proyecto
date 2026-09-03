export type TipoNotificacion =
  | 'SOLICITUD_ATENCION_NUEVA'
  | 'SOLICITUD_ATENCION_SIN_ATENDER'
  | 'MENSAJE_ATENCION_CLIENTE_RECIBIDO'
  | 'RECLAMO_NUEVO_REGISTRADO'
  | 'RECLAMO_MENSAJE_CLIENTE_RECIBIDO'
  | 'RECLAMO_ATENDIDO_POR_USUARIO'
  | 'RECLAMO_ESTADO_CAMBIADO'
  | 'RECLAMO_RESUELTO_CON_RESPUESTA'
  | 'RECLAMO_ASIGNADO'
  | 'SOLICITUD_ATENCION_ASIGNADA';

export interface Notificacion {
  tenant_id: string;
  id: string;
  usuario_destino_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  contenido: string;
  datos_extra: Record<string, unknown> | null;
  leida: boolean;
  fecha_lectura: string | null;
  fecha_creacion: string;
}

export interface NotificacionesPaginadas {
  notificaciones: Notificacion[];
  siguiente_cursor: string | null;
  tiene_mas: boolean;
  total_sin_leer: number;
}

export interface DefinicionTiposNotificacion {
  tipos: TipoNotificacion[];
  etiquetas: Record<TipoNotificacion, string>;
  modulos: Record<TipoNotificacion, string>;
}

export interface ConfiguracionNotificacionRol {
  tenant_id: string;
  id: string;
  rol_id: string;
  tipo_notificacion: TipoNotificacion;
  habilitado: boolean;
}
