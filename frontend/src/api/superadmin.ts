import axios from 'axios';
import type {
  ApiResponse,
  SALoginRequest,
  SALoginResponse,
  EstadisticasGlobales,
  Cuenta,
  CuentaConTenants,
  CrearCuentaRequest,
  ActualizarCuentaRequest,
  TenantResumen,
  CrearEmpresaRequest,
  SuperAdminStaff,
  CrearStaffRequest,
} from '@/tipos';
import type { Plan } from '@/tipos';

const SA_TOKEN_KEY = 'lr_sa_token';

// Instancia axios separada para SuperAdmin (no comparte interceptors con http.ts)
const saHttp = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Interceptor: inyectar token SA
saHttp.interceptors.request.use((config) => {
  const token = localStorage.getItem(SA_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: 401 → limpiar sesión SA
saHttp.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(SA_TOKEN_KEY);
      localStorage.removeItem('lr_sa_usuario');
      window.location.href = '/superadmin/acceso';
    }
    return Promise.reject(error);
  },
);

export const superadminApi = {
  // ── Auth ──
  login: async (datos: SALoginRequest): Promise<SALoginResponse> => {
    const res = await saHttp.post<ApiResponse<SALoginResponse>>('/superadmin/auth/login', datos);
    return res.data.data;
  },
  logout: () => saHttp.post('/superadmin/auth/logout'),

  // ── Estadísticas ──
  estadisticas: async (): Promise<EstadisticasGlobales> => {
    const res = await saHttp.get<ApiResponse<EstadisticasGlobales>>('/superadmin/estadisticas');
    return res.data.data;
  },

  // ── Cuentas ──
  listarCuentas: async (offset = 0, limite = 20, busqueda = ''): Promise<{ data: Cuenta[]; total: number }> => {
    const params: Record<string, string | number> = { offset, limite };
    if (busqueda) params.q = busqueda;
    const res = await saHttp.get<{ success: boolean; data: Cuenta[]; total: number }>('/superadmin/cuentas', { params });
    return { data: res.data.data, total: res.data.total };
  },
  obtenerCuenta: async (id: string): Promise<CuentaConTenants> => {
    const res = await saHttp.get<ApiResponse<CuentaConTenants>>(`/superadmin/cuentas/${id}`);
    return res.data.data;
  },
  crearCuenta: async (datos: CrearCuentaRequest): Promise<Cuenta> => {
    const res = await saHttp.post<ApiResponse<Cuenta>>('/superadmin/cuentas', datos);
    return res.data.data;
  },
  actualizarCuenta: (id: string, datos: ActualizarCuentaRequest) =>
    saHttp.put(`/superadmin/cuentas/${id}`, datos),
  cambiarEstadoCuenta: (id: string, activo: boolean) =>
    saHttp.patch(`/superadmin/cuentas/${id}/estado`, { activo }),

  // ── Empresas ──
  listarEmpresas: async (offset = 0, limite = 20): Promise<{ data: TenantResumen[]; total: number }> => {
    const res = await saHttp.get<{ success: boolean; data: TenantResumen[]; total: number }>('/superadmin/empresas', { params: { offset, limite } });
    return { data: res.data.data, total: res.data.total };
  },
  crearEmpresaBajoCuenta: async (cuentaId: string, datos: CrearEmpresaRequest) => {
    const res = await saHttp.post<ApiResponse<unknown>>(`/superadmin/cuentas/${cuentaId}/empresas`, datos);
    return res.data.data;
  },
  obtenerEmpresa: async (tenantId: string) => {
    const res = await saHttp.get<ApiResponse<any>>(`/superadmin/empresas/${tenantId}`);
    return res.data.data;
  },
  obtenerSedesDeEmpresa: async (tenantId: string) => {
    const res = await saHttp.get<ApiResponse<any[]>>(`/superadmin/empresas/${tenantId}/sedes`);
    return res.data.data;
  },
  obtenerUsuariosDeEmpresa: async (tenantId: string) => {
    const res = await saHttp.get<ApiResponse<any[]>>(`/superadmin/empresas/${tenantId}/usuarios`);
    return res.data.data;
  },
  obtenerReclamosDeEmpresa: async (tenantId: string, offset = 0, limite = 20): Promise<{ data: any[]; total: number }> => {
    const res = await saHttp.get<{ success: boolean; data: any[]; total: number }>(`/superadmin/empresas/${tenantId}/reclamos`, { params: { offset, limite } });
    return { data: res.data.data, total: res.data.total };
  },
  cambiarEstadoEmpresa: (tenantId: string, activo: boolean) =>
    saHttp.patch(`/superadmin/empresas/${tenantId}/estado`, { activo }),
  cambiarEstadoSede: (tenantId: string, sedeId: string, activo: boolean) =>
    saHttp.patch(`/superadmin/empresas/${tenantId}/sedes/${sedeId}/estado`, { activo }),
  cambiarPlanEmpresa: (tenantId: string, planId: string) =>
    saHttp.patch(`/superadmin/empresas/${tenantId}/plan`, { plan_id: planId }),
  cambiarEstadoUsuario: (tenantId: string, userId: string, activo: boolean) =>
    saHttp.patch(`/superadmin/empresas/${tenantId}/usuarios/${userId}/estado`, { activo }),
  editarUsuario: (tenantId: string, userId: string, datos: { nombre_completo: string; email: string; rol: string; sede_ids: string[] }) =>
    saHttp.put(`/superadmin/empresas/${tenantId}/usuarios/${userId}`, datos),
  resetearPassword: (tenantId: string, userId: string, password: string) =>
    saHttp.post(`/superadmin/empresas/${tenantId}/usuarios/${userId}/resetear-password`, { password }),

  // Agregar usuario existente (de otra empresa de la misma cuenta) a una empresa
  buscarUsuarioEnCuentaDeEmpresa: async (tenantId: string, email: string) => {
    const res = await saHttp.get<ApiResponse<any[] | null>>(
      `/superadmin/empresas/${tenantId}/usuarios/buscar-en-cuenta`,
      { params: { email } },
    );
    return res.data.data ?? [];
  },
  listarCandidatosCuentaDeEmpresa: async (tenantId: string) => {
    const res = await saHttp.get<ApiResponse<any[] | null>>(
      `/superadmin/empresas/${tenantId}/usuarios/candidatos-cuenta`,
    );
    return res.data.data ?? [];
  },
  agregarUsuarioExistenteAEmpresa: (
    tenantId: string,
    datos: { email: string; rol: string; sede_ids: string[] },
  ) =>
    saHttp
      .post<ApiResponse<any>>(`/superadmin/empresas/${tenantId}/usuarios/agregar-existente`, datos)
      .then((r) => r.data.data),

  // ── Reclamos con filtro de sede y búsqueda libre ──
  obtenerReclamosDeEmpresaConSede: async (tenantId: string, offset = 0, limite = 20, sedeId?: string, busqueda?: string): Promise<{ data: any[]; total: number }> => {
    const params: Record<string, string | number> = { offset, limite };
    if (sedeId) params.sede_id = sedeId;
    if (busqueda && busqueda.trim() !== '') params.q = busqueda.trim();
    const res = await saHttp.get<{ success: boolean; data: any[]; total: number }>(`/superadmin/empresas/${tenantId}/reclamos`, { params });
    return { data: res.data.data, total: res.data.total };
  },

  // ── Planes ──
  listarPlanes: async (): Promise<Plan[]> => {
    const res = await saHttp.get<ApiResponse<Plan[]>>('/superadmin/planes');
    return res.data.data;
  },
  obtenerPlan: async (id: string): Promise<Plan> => {
    const res = await saHttp.get<ApiResponse<Plan>>(`/superadmin/planes/${id}`);
    return res.data.data;
  },
  crearPlan: async (plan: Partial<Plan>): Promise<Plan> => {
    const res = await saHttp.post<ApiResponse<Plan>>('/superadmin/planes', plan);
    return res.data.data;
  },
  actualizarPlan: async (id: string, plan: Partial<Plan>) => {
    await saHttp.put(`/superadmin/planes/${id}`, plan);
  },

  // ── Staff ──
  listarStaff: async (): Promise<SuperAdminStaff[]> => {
    const res = await saHttp.get<ApiResponse<SuperAdminStaff[]>>('/superadmin/staff');
    return res.data.data;
  },
  crearStaff: async (datos: CrearStaffRequest): Promise<SuperAdminStaff> => {
    const res = await saHttp.post<ApiResponse<SuperAdminStaff>>('/superadmin/staff', datos);
    return res.data.data;
  },

  // ── Búsqueda global ──
  buscar: async (q: string, limite = 5) => {
    const res = await saHttp.get<ApiResponse<any>>('/superadmin/buscar', { params: { q, limite } });
    return res.data.data;
  },

  // ── Revenue metrics ──
  revenue: async () => {
    const res = await saHttp.get<ApiResponse<any>>('/superadmin/revenue');
    return res.data.data;
  },

  // ── Impersonar ──
  impersonar: async (tenantId: string, usuarioId?: string): Promise<{
    token: string;
    tenant_id: string;
    user_id: string;
    role: string;
    razon_social: string;
    tenant_slug: string;
    email: string;
    nombre_completo: string;
    debe_cambiar_password: boolean;
  }> => {
    const res = await saHttp.post<ApiResponse<any>>(`/superadmin/empresas/${tenantId}/impersonar`, usuarioId ? { usuario_id: usuarioId } : {});
    return res.data.data;
  },

  // ── Auditoría ──
  listarAuditoria: async (offset = 0, limite = 50): Promise<{ data: any[]; total: number }> => {
    const res = await saHttp.get<{ success: boolean; data: any[]; total: number }>('/superadmin/auditoria', { params: { offset, limite } });
    return { data: res.data.data, total: res.data.total };
  },
  listarActividadEmpresas: async (offset = 0, limite = 50, filtros?: { tenant_id?: string; cuenta_id?: string; accion?: string; fecha_desde?: string; fecha_hasta?: string }): Promise<{ data: any[]; total: number }> => {
    const params: Record<string, string | number> = { offset, limite };
    if (filtros?.cuenta_id) params.cuenta_id = filtros.cuenta_id;
    if (filtros?.tenant_id) params.tenant_id = filtros.tenant_id;
    if (filtros?.accion) params.accion = filtros.accion;
    if (filtros?.fecha_desde) params.fecha_desde = filtros.fecha_desde;
    if (filtros?.fecha_hasta) params.fecha_hasta = filtros.fecha_hasta;
    const res = await saHttp.get<{ success: boolean; data: any[]; total: number }>('/superadmin/actividad-empresas', { params });
    return { data: res.data.data, total: res.data.total };
  },

  // Descarga streaming de actividad de empresas. Usa fetch + Bearer token para
  // autenticar, luego el browser materializa el cuerpo como blob y dispara la
  // descarga. El backend streamea fila por fila desde CockroachDB, por lo que
  // el consumo de memoria del servidor es constante sin importar el tamaño.
  // En el browser, el cap de 90 días impuesto por el backend mantiene el blob
  // en un rango manejable.
  descargarActividadEmpresas: async (
    formato: 'csv' | 'json',
    filtros: {
      tenant_id?: string;
      cuenta_id?: string;
      accion?: string;
      fecha_desde: string;
      fecha_hasta: string;
      limite?: number;
    },
    onProgress?: (bytesRecibidos: number) => void,
  ): Promise<{ blob: Blob; filename: string }> => {
    const baseURL = (import.meta.env.VITE_API_URL ?? '/api/v1') as string;
    const params = new URLSearchParams({ formato });
    if (filtros.cuenta_id) params.set('cuenta_id', filtros.cuenta_id);
    if (filtros.tenant_id) params.set('tenant_id', filtros.tenant_id);
    if (filtros.accion) params.set('accion', filtros.accion);
    params.set('fecha_desde', filtros.fecha_desde);
    params.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.limite && filtros.limite > 0) params.set('limite', String(filtros.limite));

    const url = `${baseURL}/superadmin/actividad-empresas/export?${params.toString()}`;
    const token = localStorage.getItem(SA_TOKEN_KEY);

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const data = await res.json();
        msg = data?.error?.message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }

    // Leemos el body como stream — si el caller pasó onProgress lo notificamos.
    if (onProgress && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.length;
          onProgress(total);
        }
      }
      const mime = formato === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
      const blob = new Blob(chunks as BlobPart[], { type: mime });
      const filename = extraerFilename(res.headers.get('Content-Disposition')) ?? `actividad_${new Date().toISOString().slice(0, 10)}.${formato}`;
      return { blob, filename };
    }

    const blob = await res.blob();
    const filename = extraerFilename(res.headers.get('Content-Disposition')) ?? `actividad_${new Date().toISOString().slice(0, 10)}.${formato}`;
    return { blob, filename };
  },

  // ── Error log ──
  listarErrores: async (offset = 0, limite = 50, filtros?: { nivel?: string; origen?: string; tenant_id?: string; cuenta_id?: string; desde?: string; hasta?: string; fingerprint?: string }): Promise<{ data: any[]; total: number }> => {
    const params: Record<string, string | number> = { offset, limite };
    if (filtros?.nivel) params.nivel = filtros.nivel;
    if (filtros?.origen) params.origen = filtros.origen;
    if (filtros?.cuenta_id) params.cuenta_id = filtros.cuenta_id;
    if (filtros?.tenant_id) params.tenant_id = filtros.tenant_id;
    if (filtros?.desde) params.desde = filtros.desde;
    if (filtros?.hasta) params.hasta = filtros.hasta;
    if (filtros?.fingerprint) params.fingerprint = filtros.fingerprint;
    const res = await saHttp.get<{ success: boolean; data: any[]; total: number }>('/superadmin/errores', { params });
    return { data: res.data.data, total: res.data.total };
  },
  resumenErrores: async (
    desde?: string,
    hasta?: string,
    filtros?: { nivel?: string; origen?: string; cuenta_id?: string; tenant_id?: string },
  ) => {
    const params: Record<string, string> = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (filtros?.nivel) params.nivel = filtros.nivel;
    if (filtros?.origen) params.origen = filtros.origen;
    if (filtros?.cuenta_id) params.cuenta_id = filtros.cuenta_id;
    if (filtros?.tenant_id) params.tenant_id = filtros.tenant_id;
    const res = await saHttp.get<ApiResponse<any>>('/superadmin/errores/resumen', { params });
    return res.data.data;
  },
  listarErroresAgrupados: async (offset = 0, limite = 50, filtros?: { nivel?: string; origen?: string; cuenta_id?: string; tenant_id?: string; desde?: string }): Promise<{ data: any[]; total: number }> => {
    const params: Record<string, string | number> = { offset, limite };
    if (filtros?.nivel) params.nivel = filtros.nivel;
    if (filtros?.origen) params.origen = filtros.origen;
    if (filtros?.cuenta_id) params.cuenta_id = filtros.cuenta_id;
    if (filtros?.tenant_id) params.tenant_id = filtros.tenant_id;
    if (filtros?.desde) params.desde = filtros.desde;
    const res = await saHttp.get<{ success: boolean; data: any[]; total: number }>('/superadmin/errores/agrupados', { params });
    return { data: res.data.data, total: res.data.total };
  },
  timelineErrores: async (
    intervalo: 'hora' | 'dia',
    dias: number,
    filtros?: { nivel?: string; origen?: string; cuenta_id?: string; tenant_id?: string },
  ) => {
    const params: Record<string, string | number> = { intervalo, dias };
    if (filtros?.nivel) params.nivel = filtros.nivel;
    if (filtros?.origen) params.origen = filtros.origen;
    if (filtros?.cuenta_id) params.cuenta_id = filtros.cuenta_id;
    if (filtros?.tenant_id) params.tenant_id = filtros.tenant_id;
    const res = await saHttp.get<ApiResponse<any>>('/superadmin/errores/timeline', { params });
    return res.data.data;
  },
  listarAlertasErrores: async () => {
    const res = await saHttp.get<ApiResponse<any>>('/superadmin/alertas');
    return res.data.data;
  },
  marcarAlertaVista: (id: string) => saHttp.patch(`/superadmin/alertas/${id}/visto`),
  marcarTodasAlertasVistas: () => saHttp.patch('/superadmin/alertas/marcar-todas'),
  contarAlertasSinVer: async (): Promise<number> => {
    const res = await saHttp.get<ApiResponse<{ count: number }>>('/superadmin/alertas/count');
    return res.data.data.count;
  },
  obtenerSuscripcionEmpresa: async (tenantId: string) => {
    const res = await saHttp.get<ApiResponse<any>>(`/superadmin/empresas/${tenantId}/suscripcion`);
    return res.data.data;
  },

  listarNotasCuenta: async (cuentaId: string) => {
    const res = await saHttp.get<ApiResponse<any>>(`/superadmin/cuentas/${cuentaId}/notas`);
    return res.data.data;
  },
  crearNotaCuenta: async (cuentaId: string, contenido: string) => {
    const res = await saHttp.post<ApiResponse<any>>(`/superadmin/cuentas/${cuentaId}/notas`, { contenido });
    return res.data.data;
  },
  facturacionCuenta: async (cuentaId: string) => {
    const res = await saHttp.get<ApiResponse<any>>(`/superadmin/cuentas/${cuentaId}/facturacion`);
    return res.data.data;
  },
  healthScoreCuenta: async (cuentaId: string) => {
    const res = await saHttp.get<ApiResponse<any>>(`/superadmin/cuentas/${cuentaId}/health-score`);
    return res.data.data;
  },

  rendimientoAPI: async () => {
    const res = await saHttp.get<ApiResponse<any>>('/superadmin/metricas/rendimiento');
    return res.data.data;
  },
};

// Extrae el filename de un header Content-Disposition.
// Soporta la forma `attachment; filename="algo.csv"`.
function extraerFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? null;
}
