import type { Nullable } from './api';

export type OrigenRespuesta = 'PANEL' | 'CHATBOT' | 'API';

export interface Respuesta {
  id: string;
  tenant_id: string;
  reclamo_id: string;
  respuesta_empresa: string;
  accion_tomada: Nullable<string>;
  compensacion_ofrecida: Nullable<string>;
  respondido_por: Nullable<string>;
  cargo_responsable: Nullable<string>;
  archivos_adjuntos: Nullable<string[]>;
  notificado_cliente: boolean;
  canal_notificacion: Nullable<string>;
  fecha_notificacion: Nullable<string>;
  origen: OrigenRespuesta;
  chatbot_id: Nullable<string>;
  fecha_respuesta: string;
}

export interface CrearRespuestaRequest {
  respuesta_empresa: string;
  accion_tomada?: string;
  compensacion_ofrecida?: string;
  cargo_responsable?: string;
}
