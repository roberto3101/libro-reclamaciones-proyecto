// src/aplicacion/helpers/plan-guard.ts
// Intercepta errores 403 de límites de plan y muestra modales de upgrade.
// Usa el store centralizado de modales en vez de SweetAlert2.

import { modal } from '@/aplicacion/estado/estadoModal';

/** Códigos de error del backend que indican límite de plan */
const CODIGOS_LIMITE_PLAN = new Set([
  'LIMITE_PLAN_EXCEDIDO',
  'PLAN_LIMIT_SEDES',
  'PLAN_LIMIT_USUARIOS',
  'PLAN_LIMIT_RECLAMOS',
  'PLAN_LIMIT_CHATBOTS',
  'PLAN_NO_CHATBOT',
  'PLAN_NO_WHATSAPP',
  'PLAN_NO_REPORTES',
  'PLAN_NO_EXCEL',
  'PLAN_NO_API',
  'FUNCIONALIDAD_NO_DISPONIBLE',
]);

const CODIGOS_SUSCRIPCION = new Set([
  'SUSCRIPCION_INACTIVA',
  'SUSCRIPCION_VENCIDA',
]);

/** Extrae el código de error de la respuesta axios */
function extraerCodigo(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.code === 'string') return obj.code;
  if (obj.error && typeof obj.error === 'object') {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.code === 'string') return err.code;
  }
  return null;
}

/** Extrae el mensaje de error de la respuesta */
function extraerMensaje(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object') {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
  }
  return '';
}

/**
 * Verifica si un error 403 es de límite de plan.
 * Si lo es, muestra el modal correspondiente y retorna `true`.
 * Si no, retorna `false` para que el flujo normal de errores lo maneje.
 */
export function manejarErrorPlan(status: number, data: unknown): boolean {
  if (status !== 403) return false;

  const codigo = extraerCodigo(data);
  if (!codigo) return false;

  const mensaje = extraerMensaje(data);

  if (CODIGOS_LIMITE_PLAN.has(codigo)) {
    mostrarModalUpgrade(mensaje);
    return true;
  }

  if (CODIGOS_SUSCRIPCION.has(codigo)) {
    mostrarModalSuscripcion(mensaje, codigo);
    return true;
  }

  return false;
}

/** Modal para límites de recursos (sedes, usuarios, chatbots, etc.) */
function mostrarModalUpgrade(mensaje: string) {
  modal.alerta({
    titulo: 'Límite de tu plan alcanzado',
    mensaje,
    mensajeSecundario: 'Mejora tu plan para desbloquear más recursos y funcionalidades.',
    textoConfirmar: 'Ver planes',
    textoCancelar: 'Cerrar',
    alConfirmar: () => { window.location.href = '/suscripcion'; },
  });
}

/** Modal para suscripción inactiva o vencida */
function mostrarModalSuscripcion(mensaje: string, codigo: string) {
  const esVencida = codigo === 'SUSCRIPCION_VENCIDA';

  modal.error({
    titulo: esVencida ? 'Tu prueba ha expirado' : 'Suscripción inactiva',
    mensaje,
    mensajeSecundario: esVencida
      ? 'Elige un plan para seguir usando la plataforma.'
      : 'Contacta con soporte o activa un plan.',
    textoConfirmar: esVencida ? 'Elegir plan' : 'Ver planes',
    textoCancelar: esVencida ? undefined : 'Cerrar',
    bloqueado: esVencida,
    alConfirmar: () => { window.location.href = '/suscripcion'; },
  });
}
