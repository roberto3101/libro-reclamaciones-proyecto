import { http } from '@/api/http';
import type { ApiResponse } from '@/tipos';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos — Conversaciones e historial del asistente IA
// ──────────────────────────────────────────────────────────────────────────────

export interface MensajeChat {
  role: 'user' | 'assistant';
  content: string;
}

export interface RespuestaAsistente {
  response: string;
  prompt_tokens: number;
  output_tokens: number;
  provider: string;
  conversacion_id: string;
}

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

export interface ProviderInfo {
  id: string;        // "primary" | "fallback"
  provider: string;  // "openai" | "google" | "anthropic" | "ollama"
  model: string;
  label: string;     // "Groq (llama-3.3-70b-versatile)"
  ok: boolean;
  detalle: string;
  es_default: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// API
// ──────────────────────────────────────────────────────────────────────────────

const TIMEOUT_CHAT = 120_000; // 120s — Ollama local puede tardar

export const assistantApi = {
  /**
   * Envía un mensaje al asistente.
   * Si conversacionId es vacío/undefined, el backend crea una conversación nueva.
   */
  chat: async (message: string, conversacionId?: string, providerId?: string) => {
    const { data } = await http.post<ApiResponse<RespuestaAsistente>>(
      '/assistant/chat',
      {
        message,
        conversacion_id: conversacionId ?? '',
        provider_id: providerId ?? '',
      },
      { timeout: TIMEOUT_CHAT },
    );
    return data.data;
  },

  /** Listar conversaciones activas del usuario (máximo 10). */
  listarConversaciones: async () => {
    const { data } = await http.get<ApiResponse<ConversacionResumen[]>>(
      '/assistant/conversations',
    );
    return data.data ?? [];
  },

  /** Obtener mensajes de una conversación específica. */
  obtenerMensajes: async (conversacionId: string) => {
    const { data } = await http.get<ApiResponse<MensajeHistorial[]>>(
      `/assistant/conversations/${conversacionId}/messages`,
    );
    return data.data ?? [];
  },

  /** Eliminar (desactivar) una conversación. */
  eliminarConversacion: async (conversacionId: string) => {
    const { data } = await http.delete<ApiResponse<{ message: string }>>(
      `/assistant/conversations/${conversacionId}`,
    );
    return data.data;
  },

  /** Health check. */
  health: async () => {
    const { data } = await http.get<ApiResponse<{ status: string }>>('/assistant/health');
    return data.data;
  },

  /** Obtener modelos/providers configurados con su estado (sin consumir tokens). */
  obtenerProviders: async () => {
    const { data } = await http.get<ApiResponse<ProviderInfo[]>>('/assistant/providers');
    return data.data ?? [];
  },
};