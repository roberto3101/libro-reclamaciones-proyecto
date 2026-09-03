import type { Nullable } from './api';

export interface Plan {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: Nullable<string>;

  // Precios (soles S/)
  precio_mensual: number;
  precio_anual: Nullable<number>;
  precio_sede_extra: number;
  precio_usuario_extra: number;

  // Límites de recursos (-1 = ilimitado)
  max_sedes: number;
  max_usuarios: number;
  max_reclamos_mes: number;
  max_chatbots: number;
  max_canales_whatsapp: number;
  max_storage_mb: number;

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

  // Display
  orden: number;
  activo: boolean;
  destacado: boolean;
  fecha_creacion: string;
}

// ── Helpers ──

export function esIlimitado(limite: number): boolean {
  return limite === -1;
}

export function formatoLimite(limite: number): string {
  return esIlimitado(limite) ? 'Ilimitado' : String(limite);
}

export function precioEfectivoMensual(plan: Plan, ciclo: 'MENSUAL' | 'ANUAL'): number {
  if (ciclo === 'ANUAL' && plan.precio_anual != null) {
    return plan.precio_anual / 12;
  }
  return plan.precio_mensual;
}

export function ahorroAnual(plan: Plan): number {
  if (plan.precio_anual == null) return 0;
  return plan.precio_mensual * 12 - plan.precio_anual;
}