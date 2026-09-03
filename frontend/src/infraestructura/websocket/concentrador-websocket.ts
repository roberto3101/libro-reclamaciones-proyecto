import type { MensajeWebSocket, TipoEventoWebSocket } from './tipos-evento-websocket';

type EscuchadorEvento<T = unknown> = (datos: T) => void;

export type EstadoConexionWS = 'conectado' | 'desconectado' | 'reconectando';
type EscuchadorEstado = (estado: EstadoConexionWS) => void;

const INTERVALO_RECONEXION_BASE_MS = 1000;
const MAXIMO_RECONEXION_MS = 30_000;
const MAXIMO_INTENTOS_RECONEXION = 15;
const INTERVALO_PING_MS = 30_000;

export class ConcentradorWebSocket {
  private socket: WebSocket | null = null;
  private escuchadores = new Map<TipoEventoWebSocket, Set<EscuchadorEvento>>();
  private escuchadoresEstado = new Set<EscuchadorEstado>();
  private urlConexion: string;
  private intentosReconexion = 0;
  private temporizadorReconexion: ReturnType<typeof setTimeout> | null = null;
  private temporizadorPing: ReturnType<typeof setInterval> | null = null;
  private cerradoManualmente = false;
  private _estado: EstadoConexionWS = 'desconectado';
  private manejadorVisibilidad: (() => void) | null = null;

  constructor(urlConexion: string) {
    this.urlConexion = urlConexion;
  }

  get conectado(): boolean {
    return this._estado === 'conectado';
  }

  get estado(): EstadoConexionWS {
    return this._estado;
  }

  conectar(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.cerradoManualmente = false;
    this.registrarVisibilidad();

    try {
      this.socket = new WebSocket(this.urlConexion);
    } catch {
      this.programarReconexion();
      return;
    }

    this.socket.onopen = () => {
      this.cambiarEstado('conectado');
      this.intentosReconexion = 0;
      this.iniciarPing();
    };

    this.socket.onmessage = (evento) => {
      try {
        const mensaje: MensajeWebSocket = JSON.parse(evento.data);
        this.despacharEvento(mensaje.tipo, mensaje.datos);
      } catch {
        // Ignorar mensajes no parseables (pong del servidor)
      }
    };

    this.socket.onclose = () => {
      this.detenerPing();
      if (!this.cerradoManualmente) {
        this.cambiarEstado('reconectando');
        this.programarReconexion();
      } else {
        this.cambiarEstado('desconectado');
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  desconectar(): void {
    this.cerradoManualmente = true;
    this.detenerPing();
    this.desregistrarVisibilidad();
    if (this.temporizadorReconexion) {
      clearTimeout(this.temporizadorReconexion);
      this.temporizadorReconexion = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.intentosReconexion = 0;
    this.cambiarEstado('desconectado');
  }

  suscribir<T = unknown>(tipo: TipoEventoWebSocket, escuchador: EscuchadorEvento<T>): () => void {
    if (!this.escuchadores.has(tipo)) {
      this.escuchadores.set(tipo, new Set());
    }
    this.escuchadores.get(tipo)!.add(escuchador as EscuchadorEvento);

    return () => {
      this.escuchadores.get(tipo)?.delete(escuchador as EscuchadorEvento);
    };
  }

  /** Suscribirse a cambios de estado de la conexión (conectado/desconectado/reconectando). */
  suscribirEstado(escuchador: EscuchadorEstado): () => void {
    this.escuchadoresEstado.add(escuchador);
    return () => {
      this.escuchadoresEstado.delete(escuchador);
    };
  }

  private cambiarEstado(nuevoEstado: EstadoConexionWS): void {
    if (this._estado === nuevoEstado) return;
    this._estado = nuevoEstado;
    for (const escuchador of this.escuchadoresEstado) {
      try {
        escuchador(nuevoEstado);
      } catch {
        // No propagar errores de escuchadores
      }
    }
  }

  private despacharEvento(tipo: TipoEventoWebSocket, datos: unknown): void {
    const suscriptores = this.escuchadores.get(tipo);
    if (!suscriptores) return;
    for (const escuchador of suscriptores) {
      try {
        escuchador(datos);
      } catch (error) {
        console.error(`[WS] Error en escuchador de ${tipo}:`, error);
      }
    }
  }

  private programarReconexion(): void {
    if (this.cerradoManualmente || this.intentosReconexion >= MAXIMO_INTENTOS_RECONEXION) {
      this.cambiarEstado('desconectado');
      return;
    }
    // Exponential backoff con jitter y cap máximo
    const base = INTERVALO_RECONEXION_BASE_MS * Math.pow(2, this.intentosReconexion);
    const jitter = Math.random() * INTERVALO_RECONEXION_BASE_MS;
    const demora = Math.min(base + jitter, MAXIMO_RECONEXION_MS);
    this.intentosReconexion++;
    this.temporizadorReconexion = setTimeout(() => this.conectar(), demora);
  }

  /** Reconectar automáticamente cuando el usuario vuelve a la pestaña. */
  private registrarVisibilidad(): void {
    if (this.manejadorVisibilidad) return;
    this.manejadorVisibilidad = () => {
      if (document.visibilityState === 'visible' && !this.conectado && !this.cerradoManualmente) {
        this.intentosReconexion = 0;
        this.conectar();
      }
    };
    document.addEventListener('visibilitychange', this.manejadorVisibilidad);
  }

  private desregistrarVisibilidad(): void {
    if (this.manejadorVisibilidad) {
      document.removeEventListener('visibilitychange', this.manejadorVisibilidad);
      this.manejadorVisibilidad = null;
    }
  }

  private iniciarPing(): void {
    this.detenerPing();
    this.temporizadorPing = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ tipo: 'PING' }));
      }
    }, INTERVALO_PING_MS);
  }

  private detenerPing(): void {
    if (this.temporizadorPing) {
      clearInterval(this.temporizadorPing);
      this.temporizadorPing = null;
    }
  }
}
