import type { Notificacion } from '@/tipos';

const ETIQUETAS_MODULO: Record<string, string> = {
  SOLICITUD_ATENCION_NUEVA: 'Atención en vivo',
  SOLICITUD_ATENCION_SIN_ATENDER: 'Atención en vivo',
  MENSAJE_ATENCION_CLIENTE_RECIBIDO: 'Atención en vivo',
  RECLAMO_NUEVO_REGISTRADO: 'Reclamos',
  RECLAMO_MENSAJE_CLIENTE_RECIBIDO: 'Reclamos',
  RECLAMO_ATENDIDO_POR_USUARIO: 'Reclamos',
  RECLAMO_ESTADO_CAMBIADO: 'Reclamos',
  RECLAMO_RESUELTO_CON_RESPUESTA: 'Reclamos',
  RECLAMO_ASIGNADO: 'Reclamos',
  SOLICITUD_ATENCION_ASIGNADA: 'Atención en vivo',
};

export function obtenerModuloNotificacion(tipo: string): string {
  return ETIQUETAS_MODULO[tipo] ?? 'Sistema';
}

export function obtenerRutaNotificacion(notif: Notificacion): string | null {
  const datos = notif.datos_extra as Record<string, string> | null;

  switch (notif.tipo) {
    case 'SOLICITUD_ATENCION_NUEVA':
    case 'SOLICITUD_ATENCION_SIN_ATENDER':
      return '/atencion-vivo';

    case 'MENSAJE_ATENCION_CLIENTE_RECIBIDO':
      return '/atencion-vivo';

    case 'RECLAMO_NUEVO_REGISTRADO':
      return datos?.reclamo_id
        ? `/reclamos/${datos.reclamo_id}`
        : '/reclamos';

    case 'RECLAMO_MENSAJE_CLIENTE_RECIBIDO':
    case 'RECLAMO_ATENDIDO_POR_USUARIO':
    case 'RECLAMO_ESTADO_CAMBIADO':
    case 'RECLAMO_RESUELTO_CON_RESPUESTA':
    case 'RECLAMO_ASIGNADO':
      return datos?.reclamo_id
        ? `/reclamos/${datos.reclamo_id}`
        : '/reclamos';

    case 'SOLICITUD_ATENCION_ASIGNADA':
      return '/atencion-vivo';

    default:
      return null;
  }
}

export function obtenerEtiquetaAccion(tipo: string): string {
  switch (tipo) {
    case 'SOLICITUD_ATENCION_NUEVA':
    case 'SOLICITUD_ATENCION_SIN_ATENDER':
      return 'Ver solicitudes';
    case 'MENSAJE_ATENCION_CLIENTE_RECIBIDO':
      return 'Ver conversación';
    case 'RECLAMO_NUEVO_REGISTRADO':
      return 'Ver reclamos';
    case 'RECLAMO_MENSAJE_CLIENTE_RECIBIDO':
      return 'Ver mensaje';
    case 'RECLAMO_ATENDIDO_POR_USUARIO':
    case 'RECLAMO_ESTADO_CAMBIADO':
    case 'RECLAMO_RESUELTO_CON_RESPUESTA':
    case 'RECLAMO_ASIGNADO':
      return 'Ver reclamo';
    case 'SOLICITUD_ATENCION_ASIGNADA':
      return 'Ver solicitud';
    default:
      return 'Ver detalle';
  }
}

/** Devuelve acciones adicionales para notificaciones que necesitan más de un destino. */
export function obtenerAccionesNotificacion(notif: Notificacion): { etiqueta: string; ruta: string }[] | null {
  const datos = notif.datos_extra as Record<string, string> | null;

  if (notif.tipo === 'RECLAMO_NUEVO_REGISTRADO' && datos?.reclamo_id) {
    return [
      { etiqueta: 'Ver reclamo', ruta: `/reclamos/${datos.reclamo_id}` },
      { etiqueta: 'Ver tabla', ruta: '/reclamos' },
    ];
  }
  return null;
}

export function obtenerIconoTipo(tipo: string): string {
  switch (tipo) {
    case 'SOLICITUD_ATENCION_NUEVA':
    case 'SOLICITUD_ATENCION_SIN_ATENDER':
    case 'MENSAJE_ATENCION_CLIENTE_RECIBIDO':
      return 'chat_bubble';
    case 'RECLAMO_NUEVO_REGISTRADO':
      return 'assignment';
    case 'RECLAMO_MENSAJE_CLIENTE_RECIBIDO':
      return 'mail';
    case 'RECLAMO_ATENDIDO_POR_USUARIO':
      return 'person';
    case 'RECLAMO_ESTADO_CAMBIADO':
      return 'sync';
    case 'RECLAMO_RESUELTO_CON_RESPUESTA':
      return 'check_circle';
    case 'RECLAMO_ASIGNADO':
    case 'SOLICITUD_ATENCION_ASIGNADA':
      return 'push_pin';
    default:
      return 'notifications';
  }
}
