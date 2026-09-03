import type { Nullable } from './api';

export type EstadoSuscripcion = 'ACTIVA' | 'TRIAL' | 'CANCELADA' | 'SUSPENDIDA' | 'VENCIDA';
export type CicloSuscripcion = 'MENSUAL' | 'ANUAL';

export interface Suscripcion {
  id: string;
  tenant_id: string;
  plan_id: string;
  estado: EstadoSuscripcion;
  ciclo: CicloSuscripcion;
  fecha_inicio: string;
  fecha_fin: Nullable<string>;
  fecha_proximo_cobro: Nullable<string>;
  es_trial: boolean;
  dias_trial: number;
  fecha_fin_trial: Nullable<string>;
  override_max_sedes: Nullable<number>;
  override_max_usuarios: Nullable<number>;
  override_max_reclamos: Nullable<number>;
  override_max_chatbots: Nullable<number>;
  override_max_canales_whatsapp: Nullable<number>;
  override_max_storage_mb: Nullable<number>;
  referencia_pago: Nullable<string>;
  metodo_pago: Nullable<string>;
  activado_por: Nullable<string>;
  activado_por_usuario_id: Nullable<string>;
  activado_por_usuario_nombre: Nullable<string>;
  notas: Nullable<string>;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// Respuesta de GET /suscripcion (suscripción + plan)
export interface SuscripcionConPlan {
  suscripcion: Suscripcion;
  plan: import('./plan').Plan;
}

// Respuesta de GET /suscripcion/uso
export interface UsoTenant {
  tenant_id: string;

  // Plan y suscripción
  plan_id: string;
  plan_codigo: string;
  plan_nombre: string;
  suscripcion_id: string;
  suscripcion_estado: string;
  suscripcion_ciclo: string;
  es_trial: boolean;

  // Límites efectivos (-1 = ilimitado)
  limite_sedes: number;
  limite_usuarios: number;
  limite_reclamos_mes: number;
  limite_chatbots: number;
  limite_canales_whatsapp: number;
  limite_storage_mb: number;

  // Funcionalidades
  permite_chatbot: boolean;
  permite_whatsapp: boolean;
  permite_email: boolean;
  permite_reportes_pdf: boolean;
  permite_exportar_excel: boolean;
  permite_api: boolean;
  permite_marca_blanca: boolean;
  permite_multi_idioma: boolean;
  permite_asistente_ia: boolean;
  permite_atencion_vivo: boolean;

  // Uso actual
  uso_sedes: number;
  uso_usuarios: number;
  uso_reclamos_mes: number;
  uso_chatbots: number;
  uso_canales_whatsapp: number;
}

export interface CambiarPlanRequest {
  plan_codigo: string;
  ciclo: CicloSuscripcion;
  referencia_pago?: string;
  metodo_pago?: string;
  notas?: string;
}

// Helper: porcentaje de uso
export function porcentajeUso(uso: number, limite: number): number {
  if (limite === -1) return -1; // ilimitado
  if (limite === 0) return 100;
  return Math.round((uso / limite) * 100);
}