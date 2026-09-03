import { http } from '@/api/http';
import type {
  ApiResponse,
  NotificacionesPaginadas,
  DefinicionTiposNotificacion,
  ConfiguracionNotificacionRol,
} from '@/tipos';

interface ParametrosListarNotificaciones {
  cursor?: string;
  limite?: number;
  solo_no_leidas?: boolean;
  tipo?: string;
}

export const notificacionesApi = {
  listar: (params: ParametrosListarNotificaciones = {}) =>
    http
      .get<ApiResponse<NotificacionesPaginadas>>('/notificaciones', { params })
      .then((r) => r.data.data),

  contarNoLeidas: () =>
    http
      .get<ApiResponse<{ total: number }>>('/notificaciones/sin-leer/total')
      .then((r) => r.data.data.total),

  marcarComoLeida: (id: string) =>
    http.put<ApiResponse<void>>(`/notificaciones/${id}/leida`).then((r) => r.data),

  marcarTodasComoLeidas: () =>
    http.put<ApiResponse<void>>('/notificaciones/marcar-todas-leidas').then((r) => r.data),

  obtenerDefinicionTipos: () =>
    http
      .get<ApiResponse<DefinicionTiposNotificacion>>('/notificaciones/definicion-tipos')
      .then((r) => r.data.data),

  obtenerConfiguracionPorRol: (rolId: string) =>
    http
      .get<ApiResponse<ConfiguracionNotificacionRol[]>>(`/notificaciones/configuracion/rol/${rolId}`)
      .then((r) => r.data.data),

  actualizarConfiguracionPorRol: (rolId: string, configuraciones: { tipo_notificacion: string; habilitado: boolean }[]) =>
    http
      .put<ApiResponse<void>>(`/notificaciones/configuracion/rol/${rolId}`, { configuraciones })
      .then((r) => r.data),
};
