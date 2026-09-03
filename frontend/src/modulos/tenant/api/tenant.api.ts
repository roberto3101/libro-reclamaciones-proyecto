import { http } from '@/api/http';
import type { ApiResponse, Tenant, ActualizarTenantRequest } from '@/tipos';

export const tenantApi = {
  obtener: () =>
    http.get<ApiResponse<Tenant>>('/tenant').then((r) => r.data.data),

  actualizar: (datos: ActualizarTenantRequest) =>
    http.put<ApiResponse<void>>('/tenant', datos).then((r) => r.data),
};
