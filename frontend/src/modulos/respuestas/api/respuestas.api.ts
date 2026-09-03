import { http } from '@/api/http';
import type { ApiResponse, Respuesta, CrearRespuestaRequest } from '@/tipos';

export const respuestasApi = {
  listar: (reclamoId: string) =>
    http.get<ApiResponse<Respuesta[]>>(`/reclamos/${reclamoId}/respuestas`).then((r) => r.data.data),

  crear: (reclamoId: string, datos: CrearRespuestaRequest) =>
    http.post<ApiResponse<Respuesta>>(`/reclamos/${reclamoId}/respuestas`, datos).then((r) => r.data.data),
};
