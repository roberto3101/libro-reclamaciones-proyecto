import type { Nullable } from './api';

// --- ENUMS (Coinciden con Backend Go) ---

export type EstadoSolicitud = 'PENDIENTE' | 'EN_ATENCION' | 'RESUELTO' | 'CANCELADO';
export type CanalOrigenSolicitud = 'WHATSAPP' | 'WEB' | 'TELEFONO';
export type PrioridadSolicitud = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

// --- INTERFACE PRINCIPAL ---

export interface SolicitudAsesor {
  id: string;
  tenant_id: string;

  nombre: string;
  telefono: string;
  motivo: string;

  canal_origen: CanalOrigenSolicitud;
  canal_whatsapp_id: Nullable<string>;

  estado: EstadoSolicitud;
  prioridad: PrioridadSolicitud;

  asignado_a: Nullable<string>;
  fecha_asignacion: Nullable<string>;
  fecha_resolucion: Nullable<string>;

  nota_interna: Nullable<string>;
  resumen_conversacion: Nullable<string>;

  fecha_creacion: string;
  fecha_actualizacion: string;

  // Campo calculado (JOIN con usuarios_admin)
  nombre_asesor?: string;
}

// --- DTOs (Payloads para enviar al Backend) ---

export interface CrearSolicitudAsesorRequest {
  nombre: string;
  telefono: string;
  motivo: string;
  canal_origen?: CanalOrigenSolicitud;
  canal_whatsapp_id?: string;
  prioridad?: PrioridadSolicitud;
  resumen_conversacion?: string;
}

export interface AsignarSolicitudRequest {
  asignado_a: string;
}

export interface ResolverSolicitudRequest {
  nota_interna?: string;
}

export interface ActualizarPrioridadRequest {
  prioridad: PrioridadSolicitud;
}

export interface ActualizarNotaInternaRequest {
  nota_interna: string;
}

// --- RESPONSE HELPERS ---

export interface ContadorPendientes {
  total: number;
}

// --- MENSAJES DE ATENCIÓN (Chat en vivo) ---

export type RemitenteMensaje = 'CLIENTE' | 'ASESOR' | 'SISTEMA';

export interface MensajeAtencion {
  tenant_id: string;
  id: string;
  solicitud_id: string;
  remitente: RemitenteMensaje;
  contenido: string;
  asesor_id: string | null;
  fecha_envio: string;
}

// Para el selector de reasignación
export interface UsuarioResumen {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
}