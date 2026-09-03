import type { Nullable } from './api';

export interface Tenant {
  id: string;
  tenant_id: string;
  razon_social: string;
  ruc: string;
  nombre_comercial: Nullable<string>;
  direccion_legal: Nullable<string>;
  departamento: Nullable<string>;
  provincia: Nullable<string>;
  distrito: Nullable<string>;
  telefono: Nullable<string>;
  email_contacto: Nullable<string>;
  logo_url: Nullable<string>;
  slug: string;
  sitio_web: Nullable<string>;
  color_primario: Nullable<string>;
  plazo_respuesta_dias: number;
  mensaje_confirmacion: Nullable<string>;
  notificar_whatsapp: boolean;
  notificar_email: boolean;
  notificar_email_estado: boolean;
  notificar_email_mensaje: boolean;
  notificar_email_resolucion: boolean;
  firma_representante: Nullable<string>;
  tema_por_defecto: string;
  activo: boolean;
  version: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ActualizarTenantRequest {
  razon_social: string;
  ruc: string;
  nombre_comercial?: string;
  direccion_legal?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  telefono?: string;
  email_contacto?: string;
  logo_url?: string;
  sitio_web?: string;
  color_primario?: string;
  plazo_respuesta_dias?: number;
  mensaje_confirmacion?: string;
  notificar_whatsapp?: boolean;
  notificar_email?: boolean;
  notificar_email_estado?: boolean;
  notificar_email_mensaje?: boolean;
  notificar_email_resolucion?: boolean;
  firma_representante?: string;
  tema_por_defecto?: string;
  version: number;
}
