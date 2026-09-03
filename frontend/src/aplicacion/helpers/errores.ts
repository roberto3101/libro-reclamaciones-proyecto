import axios from 'axios';
import { notificar } from './toast';

export function manejarError(error: unknown, mensajeFallback = 'Ocurrió un error inesperado'): string {
  // Si el interceptor de http.ts ya mostró un modal de plan, no mostrar toast
  if (axios.isCancel(error)) return '';

  if (axios.isAxiosError(error)) {
    // 403 de permisos → silenciar toast; cada página muestra su propia UI
    if (error.response?.status === 403) return '';

    const raw = error.response?.data?.error ?? error.response?.data?.message ?? error.message;
    const mensaje = typeof raw === 'string' ? raw : (raw?.message ?? mensajeFallback);
    notificar.error(mensaje);
    return mensaje;
  }
  if (error instanceof Error) {
    notificar.error(error.message);
    return error.message;
  }
  notificar.error(mensajeFallback);
  return mensajeFallback;
}