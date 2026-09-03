import type { Nullable } from './api';

export type TipoSolicitud = 'RECLAMO' | 'QUEJA';
export type EstadoReclamo = 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTO' | 'CERRADO' | 'RECHAZADO';
export type CanalOrigen = 'WEB' | 'WHATSAPP' | 'EMAIL' | 'CHATBOT';

export interface Reclamo {
  id: string;
  tenant_id: string;
  codigo_reclamo: string;
  tipo_solicitud: TipoSolicitud;
  estado: EstadoReclamo;

  // Consumidor
  nombre_completo: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  email: string;
  domicilio: Nullable<string>;
  departamento: Nullable<string>;
  provincia: Nullable<string>;
  distrito: Nullable<string>;
  menor_de_edad: boolean;
  nombre_apoderado: Nullable<string>;

  // Proveedor snapshot
  razon_social_proveedor: Nullable<string>;
  ruc_proveedor: Nullable<string>;
  direccion_proveedor: Nullable<string>;

  // Sede snapshot
  sede_id: Nullable<string>;
  sede_nombre: Nullable<string>;
  sede_direccion: Nullable<string>;

  // Bien contratado
  tipo_bien: Nullable<string>;
  monto_reclamado: Nullable<number>;
  descripcion_bien: string;
  numero_pedido: Nullable<string>;

  // Detalle
  area_queja: Nullable<string>;
  descripcion_situacion: Nullable<string>;
  fecha_incidente: string;
  detalle_reclamo: string;
  pedido_consumidor: string;

  // Firma y metadata
  firma_digital: Nullable<string>;
  ip_address: Nullable<string>;
  user_agent: Nullable<string>;
  acepta_terminos: boolean;
  acepta_copia: boolean;

  // Fechas
  fecha_registro: string;
  fecha_limite_respuesta: Nullable<string>;
  fecha_respuesta: Nullable<string>;
  fecha_cierre: Nullable<string>;

  atendido_por: Nullable<string>;
  canal_origen: CanalOrigen;
  /* Coincide con la columna `reclamos.es_cliente_registrado` del backend.
     Indica si el consumidor ya figuraba como cliente de la empresa segun
     la validacion contra el sistema externo. */
  es_cliente_registrado: boolean;
  nombre_atendido_por?: string;
  
  // Agregado para soportar respuestas de la API
  mensaje?: string;

  // Archivos adjuntos (claves de Cloudflare R2)
  archivos_adjuntos?: string[] | null;

  // --- NUEVOS CAMPOS (Opcionales para no romper) ---
  respuesta_empresa?: string;
  dias_restantes?: number;
}

export interface CrearReclamoRequest {
  tipo_solicitud: TipoSolicitud;
  sede_slug?: string;

  nombre_completo: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  email: string;
  domicilio?: string;
  departamento?: string;
  provincia?: string;
  distridto?: string;
  menor_de_edad: boolean;
  nombre_apoderado?: string;

  tipo_bien?: string;
  monto_reclamado?: number;
  descripcion_bien: string;
  numero_pedido?: string;

  // Empresa (opcional, solo si es cliente empresa)
  ruc_empresa?: string;
  razon_social_empresa?: string;

  area_queja?: string;
  descripcion_situacion?: string;
  fecha_incidente: string;
  detalle_reclamo: string;
  pedido_consumidor: string;

  firma_digital?: string;
  acepta_terminos: boolean;
  acepta_copia: boolean;

  archivos_adjuntos?: string[];

  // Validación cliente empresa
  es_cliente_registrado?: boolean;

  // CAPTCHA Cloudflare Turnstile
  turnstile_token?: string;
}

export interface CambiarEstadoRequest {
  estado: EstadoReclamo;
  comentario?: string;
}

export interface AsignarReclamoRequest {
  admin_id: string;
}

export interface ReclamoTracking {
  codigo_reclamo: string;
  estado: EstadoReclamo;
  fecha_registro: string;
  fecha_limite_respuesta: string;
  fecha_respuesta?: string;
  sede_nombre?: string;
  tipo_solicitud: TipoSolicitud;
  descripcion_bien: string;
  respuesta_empresa?: string;
}

export const ESTADOS_RECLAMO: Record<EstadoReclamo, { etiqueta: string; color: string }> = {
  PENDIENTE: { etiqueta: 'Pendiente', color: '#a67718' },
  EN_PROCESO: { etiqueta: 'En Proceso', color: '#b85528' },
  RESUELTO: { etiqueta: 'Resuelto', color: '#5c8a4f' },
  CERRADO: { etiqueta: 'Cerrado', color: '#857e70' },
  RECHAZADO: { etiqueta: 'Rechazado', color: '#b83a32' },
};