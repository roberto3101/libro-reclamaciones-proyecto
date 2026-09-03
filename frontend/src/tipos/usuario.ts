import type { Nullable } from './api';
import type { RolUsuario } from './auth';

export interface Usuario {
  id: string;
  tenant_id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  activo: boolean;
  debe_cambiar_password: boolean;
  ultimo_acceso: Nullable<string>;
  sede_ids: string[];
  fecha_creacion: string;
  creado_por: Nullable<string>;
}

export interface CrearUsuarioRequest {
  email: string;
  nombre_completo: string;
  password: string;
  rol: RolUsuario;
  sede_ids?: string[];
}

export interface ActualizarUsuarioRequest {
  nombre_completo: string;
  rol: RolUsuario;
  sede_ids?: string[];
  activo: boolean;
}

// Representa un "acceso" de un email a una empresa dentro de una cuenta.
// Lo devuelve la búsqueda del modal "Agregar usuario existente".
export interface AccesoUsuarioEnCuenta {
  tenant_id: string;
  razon_social: string;
  rol: string;
  nombre_completo: string;
  activo: boolean;
}

// Candidato para agregar a una empresa: un usuario que ya existe activo en
// otra empresa de la misma cuenta y que aún no tiene acceso al tenant destino.
// Lo devuelve el endpoint SA /empresas/:id/usuarios/candidatos-cuenta y se
// usa para poblar el selector del modal "Agregar usuario existente".
export interface CandidatoUsuarioCuenta {
  email: string;
  nombre_completo: string;
  // true si el usuario ya está activo en la empresa destino — el modal lo
  // muestra deshabilitado con un chip "Ya asignado" para dar visibilidad.
  ya_en_destino: boolean;
  empresas: AccesoUsuarioEnCuenta[];
}

// Body del POST /usuarios/agregar-existente
export interface AgregarUsuarioExistenteRequest {
  email: string;
  rol: string;
  sede_ids?: string[];
}
