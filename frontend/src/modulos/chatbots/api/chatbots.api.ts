import { http } from '@/api/http';
import type { 
  Chatbot, 
  APIKey, 
  APIKeyGenerada, 
  CrearChatbotRequest, 
  CrearAPIKeyRequest 
} from '@/tipos/chatbot';

export const chatbotsApi = {
  // --- CHATBOTS ---
  listar: async () => {
    const { data } = await http.get<{ data: Chatbot[] }>('/chatbots');
    return data.data;
  },

  obtener: async (id: string) => {
    const { data } = await http.get<{ data: Chatbot }>(`/chatbots/${id}`);
    return data.data;
  },

  crear: async (payload: CrearChatbotRequest) => {
    const { data } = await http.post<{ data: Chatbot }>('/chatbots', payload);
    return data.data;
  },

  actualizar: async (id: string, payload: Partial<Chatbot>) => {
    const { data } = await http.put<{ data: Chatbot }>(`/chatbots/${id}`, payload);
    return data.data;
  },

  eliminar: async (id: string) => {
    await http.delete(`/chatbots/${id}`);
  },

  desactivar: async (id: string) => {
    const { data } = await http.post(`/chatbots/${id}/deactivate`);
    return data;
  },

  reactivar: async (id: string) => {
    const { data } = await http.post(`/chatbots/${id}/reactivate`);
    return data;
  },

  // --- API KEYS ---
  listarKeys: async (chatbotId: string) => {
    const { data } = await http.get<{ data: APIKey[] }>(`/chatbots/${chatbotId}/api-keys`);
    return data.data;
  },

  generarKey: async (chatbotId: string, payload: CrearAPIKeyRequest) => {
    const { data } = await http.post<{ data: APIKeyGenerada }>(`/chatbots/${chatbotId}/api-keys`, payload);
    return data.data;
  },

  revocarKey: async (chatbotId: string, keyId: string) => {
    await http.delete(`/chatbots/${chatbotId}/api-keys/${keyId}`);
  },

  // --- HEALTH CHECK ---
  healthCheck: async (chatbotId: string) => {
    const { data } = await http.get<{ data: HealthCheckResult }>(`/chatbots/${chatbotId}/health`);
    return data.data;
  },

  // --- AI PROVIDERS ---
  obtenerProveedoresIA: async () => {
    const { data } = await http.get<{ data: AIProviderInfo[] }>('/chatbots/ai-providers');
    return data.data;
  },
};

// Tipos para AI providers
export interface AIProviderInfo {
  id: string;
  provider: string;
  model: string;
  label: string;
  ok: boolean;
  detalle: string;
  es_default: boolean;
}

// Tipos para health check
export interface HealthCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detalle: string;
}

export interface HealthCheckResult {
  online: boolean;
  checks: HealthCheckItem[];
  errores: string[];
  checked_at: string;
}