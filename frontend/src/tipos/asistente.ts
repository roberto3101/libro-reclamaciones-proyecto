// ──────────────────────────────────────────────────────────────────────────────
// Tipos del módulo Asistente IA
// ──────────────────────────────────────────────────────────────────────────────

/** Mensaje renderizado en la UI del chat. */
export interface MensajeUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: { prompt: number; output: number };
  provider?: string;
}

/** Respuesta del endpoint POST /assistant/chat. */
export interface RespuestaAsistente {
  response: string;
  prompt_tokens: number;
  output_tokens: number;
  provider: string;
  conversacion_id: string;
}

/** Resumen de conversación para el sidebar. */
export interface ConversacionResumen {
  id: string;
  titulo: string;
  total_mensajes: number;
  total_tokens_prompt: number;
  total_tokens_output: number;
  proveedor_ia: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

/** Mensaje persistido en BD. */
export interface MensajeHistorial {
  id: string;
  rol: 'USER' | 'ASSISTANT';
  contenido: string;
  tokens_prompt: number;
  tokens_output: number;
  proveedor: string;
  duracion_ms: number;
  fecha_creacion: string;
}