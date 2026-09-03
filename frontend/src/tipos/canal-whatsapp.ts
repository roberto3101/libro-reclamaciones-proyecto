// ──────────────────────────────────────────────────────────────────────────────
// Tipos del módulo Canales WhatsApp (mirror del backend Go)
// Destino: src/tipos/canal-whatsapp.ts
// ──────────────────────────────────────────────────────────────────────────────

import type { Nullable } from './api';

export interface CanalWhatsApp {
  id: string;
  phone_number_id: string;
  display_phone: string;
  nombre_canal: string;
  chatbot_id: Nullable<string>;      // FK al chatbot vinculado (prompt/modelo/temperatura)
  activo: boolean;
  tiene_access_token: boolean;
  tiene_verify_token: boolean;
  fecha_creacion: string;
}

export interface CrearCanalWARequest {
  phone_number_id: string;
  display_phone?: string;
  access_token: string;
  verify_token?: string;
  nombre_canal?: string;
  chatbot_id?: string | null;        // UUID del chatbot o null
}

export interface ActualizarCanalWARequest {
  phone_number_id: string;
  display_phone?: string;
  access_token: string;
  verify_token?: string;
  nombre_canal?: string;
  chatbot_id?: string | null;        // UUID del chatbot o null
  activo: boolean;
}