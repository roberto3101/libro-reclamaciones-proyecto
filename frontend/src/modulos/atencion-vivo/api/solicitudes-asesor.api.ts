import { http } from '@/api/http';
import type {
  SolicitudAsesor,
  CrearSolicitudAsesorRequest,
  AsignarSolicitudRequest,
  ResolverSolicitudRequest,
  ActualizarPrioridadRequest,
  ActualizarNotaInternaRequest,
  ContadorPendientes,
  EstadoSolicitud,
  MensajeAtencion,
} from '@/tipos/solicitud-asesor';

const BASE = '/solicitudes-asesor';

export const solicitudesAsesorApi = {
  // --- CONSULTAS ---

  listarAbiertas: async () => {
    const { data } = await http.get<{ data: SolicitudAsesor[] }>(BASE);
    return data.data;
  },

  contarPendientes: async () => {
    const { data } = await http.get<{ data: ContadorPendientes }>(`${BASE}/pendientes/count`);
    return data.data;
  },

  misSolicitudes: async () => {
    const { data } = await http.get<{ data: SolicitudAsesor[] }>(`${BASE}/mis-solicitudes`);
    return data.data;
  },

  listarPorEstado: async (estado: EstadoSolicitud) => {
    const { data } = await http.get<{ data: SolicitudAsesor[] }>(`${BASE}/estado/${estado}`);
    return data.data;
  },

  obtener: async (id: string) => {
    const { data } = await http.get<{ data: SolicitudAsesor }>(`${BASE}/${id}`);
    return data.data;
  },

  // --- ACCIONES ---

  crear: async (payload: CrearSolicitudAsesorRequest) => {
    const { data } = await http.post<{ data: SolicitudAsesor }>(BASE, payload);
    return data.data;
  },

  asignar: async (id: string, payload: AsignarSolicitudRequest) => {
    const { data } = await http.post<{ data: SolicitudAsesor }>(`${BASE}/${id}/asignar`, payload);
    return data.data;
  },

  tomar: async (id: string) => {
    const { data } = await http.post<{ data: SolicitudAsesor }>(`${BASE}/${id}/tomar`);
    return data.data;
  },

  resolver: async (id: string, payload?: ResolverSolicitudRequest) => {
    const { data } = await http.post<{ data: SolicitudAsesor }>(`${BASE}/${id}/resolver`, payload || {});
    return data.data;
  },

  cancelar: async (id: string) => {
    const { data } = await http.post<{ data: SolicitudAsesor }>(`${BASE}/${id}/cancelar`);
    return data.data;
  },

  actualizarPrioridad: async (id: string, payload: ActualizarPrioridadRequest) => {
    const { data } = await http.patch<{ data: SolicitudAsesor }>(`${BASE}/${id}/prioridad`, payload);
    return data.data;
  },

actualizarNota: async (id: string, payload: ActualizarNotaInternaRequest) => {
    const { data } = await http.patch<{ data: SolicitudAsesor }>(`${BASE}/${id}/nota`, payload);
    return data.data;
  },

  // --- CHAT EN VIVO (Mensajes) ---

  listarMensajes: async (solicitudId: string) => {
    const { data } = await http.get<{ data: MensajeAtencion[] }>(`${BASE}/${solicitudId}/mensajes`);
    return data.data;
  },

  enviarMensaje: async (solicitudId: string, contenido: string) => {
    const { data } = await http.post<{ data: MensajeAtencion }>(`${BASE}/${solicitudId}/mensajes`, { contenido });
    return data.data;
  },


  listarAsesores: async () => {
   const { data } = await http.get<{ data: { id: string; nombre_completo: string; email: string; rol: string }[] }>('/usuarios');
    return data.data;
  },
};