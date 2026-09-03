// ── Auth SuperAdmin ──
export interface SALoginRequest {
  email: string;
  password: string;
}

export interface SuperAdminAuth {
  id: string;
  email: string;
  nombre: string;
}

export interface SALoginResponse {
  token: string;
  expires_in: number;
  user: SuperAdminAuth;
}

// ── Estadísticas ──
export interface EstadisticasGlobales {
  total_cuentas: number;
  cuentas_activas: number;
  total_empresas: number;
  empresas_activas: number;
  total_usuarios: number;
  total_reclamos: number;
  total_planes: number;
  total_superadmins: number;
}

// ── Cuentas ──
export interface Cuenta {
  id: string;
  nombre: string;
  email_contacto: string;
  telefono: string | null;
  ruc: string | null;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface TenantResumen {
  tenant_id: string;
  razon_social: string;
  ruc: string;
  slug: string;
  logo_url: string | null;
  activo: boolean;
}

export interface CuentaConTenants extends Cuenta {
  tenants: TenantResumen[];
}

export interface CrearCuentaRequest {
  nombre: string;
  email_contacto: string;
  telefono?: string;
  ruc?: string;
  direccion?: string;
  notas?: string;
}

export interface ActualizarCuentaRequest {
  nombre?: string;
  email_contacto?: string;
  telefono?: string;
  ruc?: string;
  direccion?: string;
  notas?: string;
  activo?: boolean;
}

// ── Empresas ──
export interface CrearEmpresaRequest {
  razon_social: string;
  ruc: string;
  email: string;
  password: string;
  nombre_admin: string;
  telefono?: string;
  direccion_legal?: string;
}

// ── Staff ──
export interface SuperAdminStaff {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  ultimo_acceso: string | null;
  fecha_creacion: string;
}

export interface CrearStaffRequest {
  email: string;
  password: string;
  nombre: string;
}
