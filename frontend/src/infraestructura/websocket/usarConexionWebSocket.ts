import { useEffect, useRef } from 'react';
import { ConcentradorWebSocket } from './concentrador-websocket';
import type { TipoEventoWebSocket } from './tipos-evento-websocket';
import { obtenerToken } from '@/aplicacion/helpers/sesion';

function obtenerBaseWs(): string {
  const envWsUrl = import.meta.env.VITE_WS_URL;
  if (envWsUrl) return envWsUrl;
  const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocolo}//${window.location.host}`;
}

const BASE_WS = obtenerBaseWs();

function construirUrlWebSocketAdmin(ruta: string): string {
  const token = obtenerToken();
  return `${BASE_WS}${ruta}?token=${encodeURIComponent(token ?? '')}`;
}

function construirUrlWebSocketPublico(ruta: string): string {
  return `${BASE_WS}${ruta}`;
}

let concentradorNotificaciones: ConcentradorWebSocket | null = null;

export function obtenerConcentradorNotificaciones(): ConcentradorWebSocket | null {
  return concentradorNotificaciones;
}

export function conectarWebSocketNotificaciones(): ConcentradorWebSocket {
  if (concentradorNotificaciones?.conectado) {
    return concentradorNotificaciones;
  }
  concentradorNotificaciones?.desconectar();
  const url = construirUrlWebSocketAdmin('/ws/notificaciones');
  concentradorNotificaciones = new ConcentradorWebSocket(url);
  concentradorNotificaciones.conectar();
  return concentradorNotificaciones;
}

export function desconectarWebSocketNotificaciones(): void {
  concentradorNotificaciones?.desconectar();
  concentradorNotificaciones = null;
}

export function usarEventoWebSocket<T = unknown>(
  concentrador: ConcentradorWebSocket | null,
  tipoEvento: TipoEventoWebSocket,
  manejador: (datos: T) => void,
): void {
  const manejadorRef = useRef(manejador);
  manejadorRef.current = manejador;

  useEffect(() => {
    if (!concentrador) return;
    const desuscribir = concentrador.suscribir<T>(tipoEvento, (datos) => {
      manejadorRef.current(datos);
    });
    return desuscribir;
  }, [concentrador, tipoEvento]);
}

export function usarWebSocketAtencionVivo(solicitudId: string): ConcentradorWebSocket | null {
  const concentradorRef = useRef<ConcentradorWebSocket | null>(null);

  useEffect(() => {
    if (!solicitudId) return;
    const url = construirUrlWebSocketAdmin(`/ws/atencion-vivo/${solicitudId}`);
    const concentrador = new ConcentradorWebSocket(url);
    concentrador.conectar();
    concentradorRef.current = concentrador;

    return () => {
      concentrador.desconectar();
      concentradorRef.current = null;
    };
  }, [solicitudId]);

  return concentradorRef.current;
}

export function usarWebSocketReclamoMensajes(reclamoId: string): ConcentradorWebSocket | null {
  const concentradorRef = useRef<ConcentradorWebSocket | null>(null);

  useEffect(() => {
    if (!reclamoId) return;
    const url = construirUrlWebSocketAdmin(`/ws/reclamos/${reclamoId}/mensajes`);
    const concentrador = new ConcentradorWebSocket(url);
    concentrador.conectar();
    concentradorRef.current = concentrador;

    return () => {
      concentrador.desconectar();
      concentradorRef.current = null;
    };
  }, [reclamoId]);

  return concentradorRef.current;
}

export function usarWebSocketSeguimientoPublico(slug: string, codigoReclamo: string): ConcentradorWebSocket | null {
  const concentradorRef = useRef<ConcentradorWebSocket | null>(null);

  useEffect(() => {
    if (!slug || !codigoReclamo) return;
    const url = construirUrlWebSocketPublico(`/ws/publico/seguimiento/${slug}/${codigoReclamo}`);
    const concentrador = new ConcentradorWebSocket(url);
    concentrador.conectar();
    concentradorRef.current = concentrador;

    return () => {
      concentrador.desconectar();
      concentradorRef.current = null;
    };
  }, [slug, codigoReclamo]);

  return concentradorRef.current;
}
