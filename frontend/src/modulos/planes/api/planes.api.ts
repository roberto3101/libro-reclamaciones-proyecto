import { http } from '@/api/http';
import type { ApiResponse, Plan, SuscripcionConPlan, UsoTenant, Suscripcion, CambiarPlanRequest } from '@/tipos';

export const planesApi = {
  // ── Planes: lectura (tenants) ──
  listar: () =>
    http.get<ApiResponse<Plan[]>>('/planes').then((r) => r.data.data),

  obtenerPorId: (id: string) =>
    http.get<ApiResponse<Plan>>(`/planes/${id}`).then((r) => r.data.data),

  // ── Planes: admin CRUD ──
  listarAdmin: () =>
    http.get<ApiResponse<Plan[]>>('/admin/planes').then((r) => r.data.data),

  crear: (plan: Partial<Plan>) =>
    http.post<ApiResponse<Plan>>('/admin/planes', plan).then((r) => r.data.data),

  actualizar: (id: string, plan: Partial<Plan>) =>
    http.put<ApiResponse<Plan>>(`/admin/planes/${id}`, plan).then((r) => r.data.data),

  activar: (id: string) =>
    http.patch<ApiResponse<void>>(`/admin/planes/${id}/activar`).then((r) => r.data),

  desactivar: (id: string) =>
    http.patch<ApiResponse<void>>(`/admin/planes/${id}/desactivar`).then((r) => r.data),

  // ── Suscripción ──
  obtenerActiva: () =>
    http.get<ApiResponse<SuscripcionConPlan>>('/suscripcion').then((r) => r.data.data),

  obtenerUso: () =>
    http.get<ApiResponse<UsoTenant>>('/suscripcion/uso').then((r) => r.data.data),

  obtenerHistorial: () =>
    http.get<ApiResponse<Suscripcion[]>>('/suscripcion/historial').then((r) => r.data.data),

  cambiarPlan: (datos: CambiarPlanRequest) =>
    http.post<ApiResponse<Suscripcion>>('/suscripcion/cambiar-plan', datos).then((r) => r.data),
};