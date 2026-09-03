import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usarEstadoNotificaciones } from '../estado/estadoNotificaciones';
import {
  conectarWebSocketNotificaciones,
  desconectarWebSocketNotificaciones,
  obtenerConcentradorNotificaciones,
  usarEventoWebSocket,
} from '@/infraestructura/websocket';
import type { DatosNotificacionNueva, DatosContadorNotificaciones } from '@/infraestructura/websocket';
import type { Notificacion } from '@/tipos';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { mostrarToastNotificacion } from './disparadorToastNotificacion';
import { obtenerRutaNotificacion, obtenerAccionesNotificacion } from './rutasNotificacion';

const ETIQUETAS_TIPO: Record<string, string> = {
  SOLICITUD_ATENCION_NUEVA: 'Atención en vivo',
  SOLICITUD_ATENCION_SIN_ATENDER: 'Atención en vivo',
  MENSAJE_ATENCION_CLIENTE_RECIBIDO: 'Atención en vivo',
  RECLAMO_NUEVO_REGISTRADO: 'Reclamos',
  RECLAMO_MENSAJE_CLIENTE_RECIBIDO: 'Reclamos',
  RECLAMO_ATENDIDO_POR_USUARIO: 'Reclamos',
  RECLAMO_ESTADO_CAMBIADO: 'Reclamos',
  RECLAMO_RESUELTO_CON_RESPUESTA: 'Reclamos',
};

const COLORES_MODULO: Record<string, string> = {
  'Atención en vivo': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Reclamos: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function CampanaNotificaciones() {
  const navegar = useNavigate();
  const { autenticado } = usarEstadoAuth();
  const {
    notificaciones,
    totalSinLeer,
    cargarNotificaciones,
    actualizarContadorSinLeer,
    agregarNotificacion,
    marcarComoLeida,
    marcarTodasComoLeidas,
  } = usarEstadoNotificaciones();

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [tooltip, setTooltip] = useState<{ notif: Notificacion; x: number; y: number } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContenedorRef = useRef<HTMLDivElement>(null);
  const concentradorRef = useRef(obtenerConcentradorNotificaciones());

  useEffect(() => {
    if (!autenticado) return;
    const concentrador = conectarWebSocketNotificaciones();
    concentradorRef.current = concentrador;
    cargarNotificaciones();

    return () => {
      desconectarWebSocketNotificaciones();
      concentradorRef.current = null;
    };
  }, [autenticado, cargarNotificaciones]);

  usarEventoWebSocket<DatosNotificacionNueva>(concentradorRef.current, 'NOTIFICACION_NUEVA', (datos) => {
    const nueva: Notificacion = {
      id: datos.notificacion_id,
      tenant_id: '',
      usuario_destino_id: '',
      tipo: datos.tipo as Notificacion['tipo'],
      titulo: datos.titulo,
      contenido: datos.contenido,
      datos_extra: datos.datos_extra ?? null,
      leida: false,
      fecha_lectura: null,
      fecha_creacion: datos.fecha_creacion,
    };
    agregarNotificacion(nueva);
    mostrarToastNotificacion(nueva, navegar);
    scrollContenedorRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  usarEventoWebSocket<DatosContadorNotificaciones>(
    concentradorRef.current,
    'CONTADOR_NOTIFICACIONES_ACTUALIZADO',
    (datos) => {
      actualizarContadorSinLeer(datos.total_sin_leer);
    },
  );

  useEffect(() => {
    const manejarClickFuera = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelAbierto(false);
      }
    };
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelAbierto(false);
    };
    if (panelAbierto) {
      document.addEventListener('mousedown', manejarClickFuera);
      document.addEventListener('keydown', manejarEscape);
    }
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [panelAbierto]);

  const alternarPanel = useCallback(() => setPanelAbierto((v) => !v), []);

  const mostrarTooltip = useCallback((e: React.MouseEvent, notif: Notificacion) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({ notif, x: rect.left, y: rect.top - 4 });
    }, 400);
  }, []);

  const ocultarTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltip(null);
  }, []);

  const manejarClickNotificacion = useCallback(
    async (notif: Notificacion) => {
      if (!notif.leida) await marcarComoLeida(notif.id);
      setPanelAbierto(false);
      const ruta = obtenerRutaNotificacion(notif);
      if (ruta) navegar(ruta);
    },
    [marcarComoLeida, navegar],
  );

  const tiempoRelativo = (fecha: string): string => {
    const diff = Date.now() - new Date(fecha).getTime();
    const minutos = Math.floor(diff / 60000);
    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos}m`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas}h`;
    const dias = Math.floor(horas / 24);
    return `Hace ${dias}d`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={alternarPanel}
        aria-label="Notificaciones"
        aria-expanded={panelAbierto}
        aria-haspopup="true"
        className="lr-boton-cabecera"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalSinLeer > 0 && (
          <span className="lr-insignia-cabecera">
            {totalSinLeer > 99 ? '99+' : totalSinLeer}
          </span>
        )}
      </button>

      <div className={`absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] max-h-[480px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden transition-opacity duration-150 ${panelAbierto ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notificaciones {totalSinLeer > 0 && <span className="text-blue-600 dark:text-blue-400">({totalSinLeer})</span>}
            </h3>
            <div className="flex items-center gap-2">
              {totalSinLeer > 0 && (
                <button
                  type="button"
                  onClick={() => marcarTodasComoLeidas()}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Marcar todas leídas
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPanelAbierto(false);
                  navegar('/notificaciones/configuracion');
                }}
                title="Configurar notificaciones"
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer dark:text-gray-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" ref={scrollContenedorRef}>
            {notificaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-gray-600 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-3 opacity-50">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm">Sin notificaciones</p>
              </div>
            ) : (
              notificaciones.slice(0, 15).map((notif) => {
                const modulo = ETIQUETAS_TIPO[notif.tipo] ?? 'Sistema';
                const colorModulo = COLORES_MODULO[modulo] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
                const acciones = obtenerAccionesNotificacion(notif);
                return (
                  <div
                    key={notif.id}
                    onMouseEnter={(e) => mostrarTooltip(e, notif)}
                    onMouseLeave={ocultarTooltip}
                    className={`
                      w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700/50
                      hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                      ${!notif.leida ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                    `}
                  >
                    <button
                      type="button"
                      onClick={() => manejarClickNotificacion(notif)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        {!notif.leida && <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--ui-primario)' }} />}
                        <div className={`flex-1 min-w-0 ${notif.leida ? 'ml-5' : ''}`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colorModulo}`}>{modulo}</span>
                            <span className="text-[10px] text-gray-600 dark:text-gray-400">{tiempoRelativo(notif.fecha_creacion)}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{notif.titulo}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{notif.contenido}</p>
                        </div>
                      </div>
                    </button>
                    {acciones && (
                      <div className="flex gap-2 mt-2 ml-5">
                        {acciones.map((accion) => (
                          <button
                            key={accion.ruta}
                            type="button"
                            onClick={async () => {
                              if (!notif.leida) await marcarComoLeida(notif.id);
                              setPanelAbierto(false);
                              navegar(accion.ruta);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer border border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            {accion.etiqueta}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {notificaciones.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 text-center">
              <button
                type="button"
                onClick={() => {
                  setPanelAbierto(false);
                  navegar('/notificaciones');
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>

      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            width: 320,
            maxWidth: 'none',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateY(-100%)',
            zIndex: 9999,
            padding: '8px 12px',
            borderRadius: 'var(--ui-r-lg)',
            fontSize: 12,
            lineHeight: 1.4,
            pointerEvents: 'none' as const,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          className="bg-gray-900 dark:bg-gray-700 text-white"
        >
          <p style={{ fontWeight: 500, marginBottom: 2 }}>{tooltip.notif.titulo}</p>
          <p className="text-gray-600 dark:text-gray-400" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{tooltip.notif.contenido}</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
