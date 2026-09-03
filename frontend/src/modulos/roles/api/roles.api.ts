import { http } from '@/api/http';
import type {
  ApiResponse,
  RolTenant,
  CrearRolRequest,
  ActualizarRolRequest,
  DefinicionPermisos,
} from '@/tipos';

export const rolesApi = {
  listar: () =>
    http.get<ApiResponse<RolTenant[]>>('/roles').then((r) => r.data.data),

  obtenerPorId: (id: string) =>
    http.get<ApiResponse<RolTenant>>(`/roles/${id}`).then((r) => r.data.data),

  crear: (datos: CrearRolRequest) =>
    http.post<ApiResponse<RolTenant>>('/roles', datos).then((r) => r.data.data),

  actualizar: (id: string, datos: ActualizarRolRequest) =>
    http.put<ApiResponse<RolTenant>>(`/roles/${id}`, datos).then((r) => r.data.data),

  eliminar: (id: string) =>
    http.delete<ApiResponse<void>>(`/roles/${id}`).then((r) => r.data),

  obtenerDefinicion: () =>
    http.get<ApiResponse<DefinicionPermisos>>('/roles/definicion').then((r) => r.data.data),

  misPermisos: () =>
    http.get<ApiResponse<Record<string, Record<string, boolean>>>>('/roles/mis-permisos').then((r) => r.data.data),
};
