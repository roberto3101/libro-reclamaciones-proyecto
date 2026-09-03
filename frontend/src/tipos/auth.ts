export interface LoginRequest {
  email: string;
  password: string;
}

// ── Empresa accesible (coincide con TenantOption del backend) ──
export interface EmpresaAccesible {
  tenant_id: string;
  razon_social: string;
  slug: string;
  logo_url: string | null;
  rol: string;
  sede_id?: string;
}

// ── Respuesta cuando el usuario tiene 2+ empresas ──
export interface ResultadoMultiLogin {
  requires_selection: true;
  tenants: EmpresaAccesible[];
  temp_token: string;
}

// Backend devuelve: { token, expires_in, user: { ... }, empresas_accesibles?: [...] }
export interface LoginResponseRaw {
  token: string;
  expires_in: number;
  user: {
    id: string;
    tenant_id: string;
    tenant_slug: string;
    email: string;
    nombre_completo: string;
    rol: RolUsuario;
    sede_ids?: string[];
    debe_cambiar_password?: boolean;
  };
  empresas_accesibles?: EmpresaAccesible[];
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioAuth;
  empresasAccesibles: EmpresaAccesible[];
}

export interface UsuarioAuth {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  debe_cambiar_password: boolean;
  sede_ids?: string[];
}

/** Detecta si la respuesta del login requiere seleccionar empresa */
export function esMultiLogin(data: unknown): data is ResultadoMultiLogin {
  return typeof data === 'object' && data !== null && 'requires_selection' in data && (data as ResultadoMultiLogin).requires_selection === true;
}

// Roles dinámicos: slug en mayúsculas desde el JWT.
// Los roles base son ADMIN y SOPORTE; los personalizados usan el slug del tenant.
export type RolUsuario = string;

export interface CambiarPasswordRequest {
  password_actual: string;
  password_nueva: string;
}