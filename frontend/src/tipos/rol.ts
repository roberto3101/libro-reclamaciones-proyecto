export interface RolTenant {
  id: string;
  tenant_id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  color: string;
  permisos: Record<string, Record<string, boolean>>;
  es_admin: boolean;
  es_base: boolean;
  orden: number;
  cantidad_usuarios?: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CrearRolRequest {
  nombre: string;
  descripcion?: string;
  color?: string;
  permisos: Record<string, Record<string, boolean>>;
  es_admin?: boolean;
}

export interface ActualizarRolRequest {
  nombre: string;
  descripcion?: string;
  color?: string;
  permisos: Record<string, Record<string, boolean>>;
  es_admin?: boolean;
}

export interface DefinicionPermisos {
  modulos: Record<string, string[]>;
  etiquetas_modulos: Record<string, string>;
  etiquetas_acciones: Record<string, string>;
}
