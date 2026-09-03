import type { Nullable } from './api';

// --- ENUMS (Coinciden con Backend Go) ---

export type TipoChatbot = 'ASISTENTE_IA' | 'WHATSAPP_BOT' | 'TELEGRAM_BOT' | 'CUSTOM';

// El backend valida "oneof=LIVE TEST", así que debemos enviar estos valores exactos.
export type EntornoAPIKey = 'LIVE' | 'TEST';

// --- INTERFACES PRINCIPALES ---

export interface Chatbot {
  id: string;
  tenant_id: string;
  nombre: string;
  tipo: TipoChatbot;
  descripcion: Nullable<string>;

  // Configuración IA (Nuevos campos v4)
  modelo_ia: Nullable<string>;       // ej: "gpt-4o", "claude-sonnet"
  prompt_sistema: Nullable<string>;  // Instrucciones base
  temperatura: Nullable<number>;     // 0.0 a 1.0
  max_tokens_respuesta: Nullable<number>;

  // Scopes / Permisos (Qué puede hacer este bot)
  puede_leer_reclamos: boolean;
  puede_responder: boolean;
  puede_cambiar_estado: boolean;
  puede_enviar_mensajes: boolean;
  puede_leer_metricas: boolean;

  // Reglas de Negocio
  requiere_aprobacion: boolean;      // Si true, respuestas quedan en borrador
  max_respuestas_dia: number;

  activo: boolean;
  creado_por: Nullable<string>;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface APIKey {
  id: string;
  tenant_id: string;
  chatbot_id: string;
  nombre: string;
  key_prefix: string;               // ej: "crb_live_a1b2..." (visible en tabla)
  entorno: EntornoAPIKey;
  activa: boolean;
  
  fecha_expiracion: Nullable<string>;
  ultimo_uso: Nullable<string>;
  
  // Límites
  requests_por_minuto: number;
  requests_por_dia: number;

  creado_por: Nullable<string>;
  fecha_creacion: string;
}

// CORRECCIÓN AQUÍ: Renombrado de APIKeyConPlain a APIKeyGenerada
export interface APIKeyGenerada extends APIKey {
  plain_key: string;                // El token completo visible SOLO al crear
}

// --- DTOs (Payloads para enviar al Backend) ---

export interface CrearChatbotRequest {
  nombre: string;
  tipo: TipoChatbot;
  descripcion?: string;
  
  // Config IA Opcional al crear
  modelo_ia?: string;
  prompt_sistema?: string;
  temperatura?: number;
  max_tokens_respuesta?: number;
}

export interface ActualizarChatbotRequest {
  nombre: string;
  tipo: TipoChatbot;
  descripcion?: string;
  activo: boolean;

  // Config IA
  modelo_ia?: string;
  prompt_sistema?: string;
  temperatura?: number;
  max_tokens_respuesta?: number;

  // Permisos (Scopes)
  puede_leer_reclamos?: boolean;
  puede_responder?: boolean;
  puede_cambiar_estado?: boolean;
  puede_enviar_mensajes?: boolean;
  puede_leer_metricas?: boolean;
  requiere_aprobacion?: boolean;
}

export interface CrearAPIKeyRequest {
  nombre: string;
  entorno: EntornoAPIKey; // 'LIVE' o 'TEST'
}