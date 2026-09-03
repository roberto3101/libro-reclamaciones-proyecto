import { http } from '@/api/http';
import type {
  ApiResponse,
  PaginatedResponse,
  Reclamo,
  CambiarEstadoRequest,
  AsignarReclamoRequest,
} from '@/tipos';
import type { CrearRespuestaRequest } from '@/tipos/respuesta';

export const reclamosApi = {
  // Listado con paginación (Para la tabla principal del panel)
  listar: async (page = 1, perPage = 20, filtros?: Record<string, string>) => {
    const params: Record<string, any> = { page, per_page: perPage, ...filtros };
    const { data } = await http.get<ApiResponse<PaginatedResponse<Reclamo>>>('/reclamos', { params });
    return data.data;
  },

  // Obtener detalle de un reclamo
  obtenerPorId: async (id: string) => {
    const { data } = await http.get<ApiResponse<Reclamo>>(`/reclamos/${id}`);
    return data.data;
  },

  // Cambiar estado (PENDIENTE -> EN_PROCESO, etc.)
  // Cambiar estado (PENDIENTE -> EN_PROCESO, etc.)
 cambiarEstado: async (id: string, datos: CambiarEstadoRequest) => {
 const { data } = await http.post<ApiResponse<void>>(`/reclamos/${id}/estado`, datos);
 return data.data;
 },

  // Asignar reclamo a un usuario específico (Opcional)
  asignar: async (id: string, datos: AsignarReclamoRequest) => {
    const { data } = await http.post<ApiResponse<void>>(`/reclamos/${id}/asignar`, datos);
    return data.data;
  },




exportarPDF: async (params?: Record<string, string>) => {
    const { data } = await http.get('/reclamos/exportar/pdf', { params: params || {}, responseType: 'blob' });
    return data;
  },

  exportarExcel: async (params?: Record<string, string>) => {
    const { data } = await http.get('/reclamos/exportar/excel', { params: params || {}, responseType: 'blob' });
    return data;
  },



 // Emitir Resolución Final (Cierra el reclamo y envía PDF)
 emitirRespuesta: async (id: string, datos: CrearRespuestaRequest) => {
 const { data } = await http.post<ApiResponse<any>>(`/reclamos/${id}/respuestas`, datos);
 return data.data;
 }
};