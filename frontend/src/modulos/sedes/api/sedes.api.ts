import { http } from '@/api/http';
import type { ApiResponse, Sede, CrearSedeRequest } from '@/tipos';

// Reutilizamos CrearSedeRequest para update ya que los campos son los mismos
export type ActualizarSedeRequest = CrearSedeRequest & {
  es_principal?: boolean;
  horario_atencion?: Array<{ dia: string; inicio: string; fin: string }>;
};

export const sedesApi = {
  listar: (incluirInactivas = false) =>
    http.get<ApiResponse<Sede[]>>('/sedes', {
      params: incluirInactivas ? { incluir_inactivas: 'true' } : undefined,
    }).then((r) => r.data.data),

  obtenerPorId: (id: string) =>
    http.get<ApiResponse<Sede>>(`/sedes/${id}`).then((r) => r.data.data),

  crear: (datos: CrearSedeRequest) =>
    http.post<ApiResponse<Sede>>('/sedes', datos).then((r) => r.data.data),

  actualizar: (id: string, datos: ActualizarSedeRequest) =>
    http.put<ApiResponse<Sede>>(`/sedes/${id}`, datos).then((r) => r.data.data),

  eliminar: (id: string) =>
    http.delete<ApiResponse<void>>(`/sedes/${id}`).then((r) => r.data),

  reactivar: (id: string) =>
    http.post<ApiResponse<void>>(`/sedes/${id}/reactivar`).then((r) => r.data),
};