import { http } from '@/api/http';

/** Lo que el backend expone sobre las pasarelas disponibles. */
export interface ConfigPagos {
  moneda: string;
  culqi: { habilitado: boolean; llave_publica: string };
  mercadopago: { habilitado: boolean; llave_publica: string; recurrente: boolean };
}

export interface Pago {
  id: string;
  tenant_id: string;
  plan_id: string;
  proveedor: 'CULQI' | 'MERCADOPAGO' | 'YAPE' | 'TRANSFERENCIA' | 'MANUAL';
  referencia_externa: string | null;
  monto: number;
  moneda: string;
  ciclo: 'MENSUAL' | 'ANUAL';
  estado: 'PENDIENTE' | 'PAGADO' | 'FALLIDO' | 'REEMBOLSADO';
  email: string | null;
  descripcion: string | null;
  error_mensaje?: string | null;
  fecha_pago: string | null;
  fecha_creacion: string;
}

export interface SuscribirRequest {
  plan_codigo: string;
  ciclo: 'MENSUAL' | 'ANUAL';
  email: string;
  token_tarjeta?: string;
  url_retorno?: string;
}

export interface RespuestaSuscripcion {
  pago: Pago;
  init_point: string;
}

/** Cobro hecho por fuera de la pasarela: Yape, transferencia o a dedo. */
export interface PagoManualRequest {
  proveedor: 'YAPE' | 'TRANSFERENCIA' | 'MANUAL';
  referencia?: string;
  plan_codigo: string;
  ciclo: 'MENSUAL' | 'ANUAL';
  email?: string;
  notas?: string;
}

interface ApiResp<T> {
  success: boolean;
  data: T;
}

export const pagosApi = {
  obtenerConfig: () =>
    http.get<ApiResp<ConfigPagos>>('/pagos/config').then((r) => r.data.data),

  historial: () =>
    http.get<ApiResp<Pago[]>>('/pagos').then((r) => r.data.data),

  /** Alta del cobro recurrente en Mercado Pago. */
  suscribir: (datos: SuscribirRequest) =>
    http
      .post<ApiResp<RespuestaSuscripcion>>('/pagos/suscripcion', datos)
      .then((r) => r.data.data),

  /** Registra un pago recibido por Yape o transferencia y activa el plan. */
  registrarManual: (datos: PagoManualRequest) =>
    http.post<ApiResp<Pago>>('/admin/pagos/manual', datos).then((r) => r.data.data),
};
