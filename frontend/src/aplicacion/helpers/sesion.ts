import type { UsuarioAuth, EmpresaAccesible } from '@/tipos';

const CLAVE_TOKEN = 'lr_token';
const CLAVE_USUARIO = 'lr_usuario';
const CLAVE_EMPRESAS = 'lr_empresas';

export function guardarSesion(token: string, usuario: UsuarioAuth): void {
  localStorage.setItem(CLAVE_TOKEN, token);
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function obtenerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function obtenerUsuarioGuardado(): UsuarioAuth | null {
  const raw = localStorage.getItem(CLAVE_USUARIO);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioAuth;
  } catch {
    return null;
  }
}

export function guardarEmpresasAccesibles(empresas: EmpresaAccesible[]): void {
  if (empresas.length > 0) {
    localStorage.setItem(CLAVE_EMPRESAS, JSON.stringify(empresas));
  } else {
    localStorage.removeItem(CLAVE_EMPRESAS);
  }
}

export function obtenerEmpresasAccesibles(): EmpresaAccesible[] {
  const raw = localStorage.getItem(CLAVE_EMPRESAS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as EmpresaAccesible[];
  } catch {
    return [];
  }
}

export function limpiarSesion(): void {
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_USUARIO);
  localStorage.removeItem(CLAVE_EMPRESAS);
}

export function haySesionActiva(): boolean {
  return !!obtenerToken();
}
