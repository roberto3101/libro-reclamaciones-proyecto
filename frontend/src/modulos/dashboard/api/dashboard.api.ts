import { http } from '@/api/http';
import type { ApiResponse, DashboardUso } from '@/tipos';

export const dashboardApi = {
  obtenerUso: () =>
    http.get<ApiResponse<DashboardUso>>('/dashboard/uso').then((r) => r.data.data),
};
