import { http } from './http';
import type { ApiResponse, LoginRequest, LoginResponse, LoginResponseRaw, CambiarPasswordRequest, ResultadoMultiLogin, EmpresaAccesible } from '@/tipos';

function parsearLoginCompleto(raw: LoginResponseRaw): LoginResponse {
  return {
    token: raw.token,
    usuario: {
      id: raw.user.id,
      email: raw.user.email,
      nombre_completo: raw.user.nombre_completo,
      rol: raw.user.rol,
      tenant_id: raw.user.tenant_id,
      tenant_slug: raw.user.tenant_slug,
      sede_ids: raw.user.sede_ids ?? [],
      debe_cambiar_password: raw.user.debe_cambiar_password ?? false,
    },
    empresasAccesibles: raw.empresas_accesibles ?? [],
  };
}

export const authApi = {
  /**
   * Login: retorna LoginResponse (1 empresa) o ResultadoMultiLogin (2+ empresas).
   * El caller debe usar esMultiLogin() para distinguir.
   */
  login: async (datos: LoginRequest): Promise<LoginResponse | ResultadoMultiLogin> => {
    const res = await http.post<ApiResponse<LoginResponseRaw | ResultadoMultiLogin>>('/auth/login', datos);
    const raw = res.data.data;

    // Multi-empresa: requiere seleccionar empresa
    if ('requires_selection' in raw && raw.requires_selection) {
      return raw as ResultadoMultiLogin;
    }

    // Login directo (1 empresa)
    return parsearLoginCompleto(raw as LoginResponseRaw);
  },

  /** Seleccionar empresa durante el flujo multi-login (usa temp_token) */
  seleccionarEmpresa: async (tokenTemporal: string, tenantId: string): Promise<LoginResponse> => {
    const res = await http.post<ApiResponse<LoginResponseRaw>>(
      '/auth/seleccionar-tenant',
      { tenant_id: tenantId },
      { headers: { Authorization: `Bearer ${tokenTemporal}` } },
    );
    return parsearLoginCompleto(res.data.data);
  },

  /** Cambiar de empresa estando autenticado (usa cookie/token actual) */
  cambiarEmpresa: async (tenantId: string): Promise<LoginResponse> => {
    const res = await http.post<ApiResponse<LoginResponseRaw>>(
      '/auth/cambiar-empresa',
      { tenant_id: tenantId },
    );
    return parsearLoginCompleto(res.data.data);
  },

  cambiarPassword: (datos: CambiarPasswordRequest) =>
    http.post<ApiResponse<void>>('/auth/cambiar-password', datos).then((r) => r.data),

  logout: () =>
    http.post<ApiResponse<void>>('/auth/logout').then((r) => r.data),
};
