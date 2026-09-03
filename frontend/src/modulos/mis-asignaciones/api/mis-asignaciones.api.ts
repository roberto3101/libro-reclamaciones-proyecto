import { http } from '@/api/http';
import type { ApiResponse, PaginatedResponse, Reclamo } from '@/tipos';
import type { SolicitudAsesor } from '@/tipos/solicitud-asesor';

export const misAsignacionesApi = {
  obtenerReclamosAsignados: async (
    usuarioId?: string,
    pagina = 1,
    porPagina = 20,
    estado?: string,
  ) => {
    const params: Record<string, any> = {
      page: pagina,
      per_page: porPagina,
    };
    if (usuarioId) params.atendido_por = usuarioId;
    if (estado) params.estado = estado;

    const { data } = await http.get<ApiResponse<PaginatedResponse<Reclamo>>>('/reclamos', { params });
    return data.data;
  },

  obtenerSolicitudesAsignadas: async (
    usuarioId?: string,
    pagina = 1,
    porPagina = 20,
    estado?: string,
    orden = 'recientes',
  ) => {
    const params: Record<string, any> = {
      page: pagina,
      per_page: porPagina,
      orden,
    };
    if (usuarioId) params.asignado_a = usuarioId;
    if (estado) params.estado = estado;

    const { data } = await http.get<ApiResponse<PaginatedResponse<SolicitudAsesor>>>(
      '/solicitudes-asesor/paginado',
      { params },
    );
    return data.data;
  },
};
