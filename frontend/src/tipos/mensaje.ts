import type { Nullable } from './api';

export type TipoMensaje = 'CLIENTE' | 'EMPRESA' | 'CHATBOT';

export interface Mensaje {
  id: string;
  tenant_id: string;
  reclamo_id: string;
  tipo_mensaje: TipoMensaje;
  mensaje: string;
  archivo_url: Nullable<string>;
  archivo_nombre: Nullable<string>;
  leido: boolean;
  fecha_lectura: Nullable<string>;
  chatbot_id: Nullable<string>;
  fecha_mensaje: string;
}

export interface CrearMensajeRequest {
  tipo_mensaje: TipoMensaje;
  mensaje: string;
  archivo_url?: string;
  archivo_nombre?: string;
}
