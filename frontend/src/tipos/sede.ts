import type { Nullable } from './api';

export interface Sede {
  id: string;
  tenant_id: string;
  nombre: string;
  slug: string;
  codigo_sede: Nullable<string>;
  direccion: string;
  departamento: Nullable<string>;
  provincia: Nullable<string>;
  distrito: Nullable<string>;
  referencia: Nullable<string>;
  telefono: Nullable<string>;
  email: Nullable<string>;
  responsable_nombre: Nullable<string>;
  responsable_cargo: Nullable<string>;
  horario_atencion: Nullable<string>;
  latitud: Nullable<number>;
  longitud: Nullable<number>;
  activo: boolean;
  es_principal: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CrearSedeRequest {
  nombre: string;
  slug: string;
  codigo_sede?: string;
  direccion: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  referencia?: string;
  telefono?: string;
  email?: string;
  responsable_nombre?: string;
  responsable_cargo?: string;
  latitud?: number;
  longitud?: number;
}
