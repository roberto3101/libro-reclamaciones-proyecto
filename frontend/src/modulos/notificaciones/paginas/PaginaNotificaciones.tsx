import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificacionesApi } from '../api/notificaciones.api';
import { usarEstadoNotificaciones } from '../estado/estadoNotificaciones';
import { manejarError } from '@/aplicacion/helpers/errores';
import { obtenerRutaNotificacion } from '../componentes/rutasNotificacion';
import type { Notificacion, TipoNotificacion } from '@/tipos';

const ETIQUETAS_TIPO: Record<string, string> = {
  SOLICITUD_ATENCION_NUEVA: 'Nueva solicitud de atención en vivo',
  SOLICITUD_ATENCION_SIN_ATENDER: 'Recordatorio: solicitud sin atender',
  MENSAJE_ATENCION_CLIENTE_RECIBIDO: 'Nuevo mensaje del cliente en atención en vivo',
  RECLAMO_NUEVO_REGISTRADO: 'Nuevo reclamo registrado',
  RECLAMO_MENSAJE_CLIENTE_RECIBIDO: 'Nuevo mensaje del cliente en reclamo',
  RECLAMO_ATENDIDO_POR_USUARIO: 'Reclamo atendido por un usuario',
  RECLAMO_ESTADO_CAMBIADO: 'Estado del reclamo cambiado',
  RECLAMO_RESUELTO_CON_RESPUESTA: 'Reclamo resuelto con respuesta',
};

const TODOS_LOS_TIPOS: TipoNotificacion[] = [
  'SOLICITUD_ATENCION_NUEVA',
  'SOLICITUD_ATENCION_SIN_ATENDER',
  'MENSAJE_ATENCION_CLIENTE_RECIBIDO',
  'RECLAMO_NUEVO_REGISTRADO',
  'RECLAMO_MENSAJE_CLIENTE_RECIBIDO',
  'RECLAMO_ATENDIDO_POR_USUARIO',
  'RECLAMO_ESTADO_CAMBIADO',
  'RECLAMO_RESUELTO_CON_RESPUESTA',
];

const MODULO_POR_TIPO: Record<string, string> = {
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

type FiltroLeida = 'todas' | 'no_leidas' | 'leidas';

export default function PaginaNotificaciones() {
  const navegar = useNavigate();
  const { totalSinLeer } = usarEstadoNotificaciones();

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [siguienteCursor, setSiguienteCursor] = useState<string | null>(null);
  const [tieneMas, setTieneMas] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [filtroLeida, setFiltroLeida] = useState<FiltroLeida>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoNotificacion | ''>('');

  const observadorRef = useRef<IntersectionObserver | null>(null);
  const cargandoRef = useRef(false);
  const filtrosRef = useRef({ filtroLeida, filtroTipo });
  filtrosRef.current = { filtroLeida, filtroTipo };

  const cargar = useCallback(async (cursor?: string) => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    if (cursor) {
      setCargandoMas(true);
    } else {
      setCargandoInicial(true);
    }
    try {
      const { filtroLeida: fl, filtroTipo: ft } = filtrosRef.current;
      const resultado = await notificacionesApi.listar({
        cursor,
        limite: 30,
        solo_no_leidas: fl === 'no_leidas' ? true : undefined,
        tipo: ft || undefined,
      });
      const nuevas = resultado?.notificaciones ?? [];
      setNotificaciones((prev) => cursor ? [...prev, ...nuevas] : nuevas);
      setSiguienteCursor(resultado?.siguiente_cursor ?? null);
      setTieneMas(resultado?.tiene_mas ?? false);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargandoInicial(false);
      setCargandoMas(false);
      cargandoRef.current = false;
    }
  }, []);

  useEffect(() => {
    setNotificaciones([]);
    setSiguienteCursor(null);
    setTieneMas(false);
    cargar();
  }, [filtroLeida, filtroTipo, cargar]);

  const cargarMas = useCallback(() => {
    if (tieneMas && siguienteCursor && !cargandoRef.current) {
      cargar(siguienteCursor);
    }
  }, [tieneMas, siguienteCursor, cargar]);

  const referenciarCentinela = useCallback(
    (nodo: HTMLDivElement | null) => {
      if (observadorRef.current) observadorRef.current.disconnect();
      observadorRef.current = new IntersectionObserver(
        (entradas) => {
          if (entradas[0].isIntersecting) cargarMas();
        },
        { threshold: 1.0 },
      );
      if (nodo) observadorRef.current.observe(nodo);
    },
    [cargarMas],
  );

  // Filtro "leidas" se aplica client-side porque la API no tiene parámetro para solo leídas
  const listaBase = notificaciones ?? [];
  const notificacionesFiltradas = filtroLeida === 'leidas'
    ? listaBase.filter((n) => n.leida)
    : listaBase;

  const formatearFecha = (fecha: string): string => {
    const d = new Date(fecha);
    const ahora = new Date();
    const diffMs = ahora.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `Hace ${diffHoras}h`;
    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias < 7) return `Hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;

    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const manejarClickNotificacion = async (notif: Notificacion) => {
    if (!notif.leida) {
      try {
        await notificacionesApi.marcarComoLeida(notif.id);
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, leida: true, fecha_lectura: new Date().toISOString() } : n)),
        );
        usarEstadoNotificaciones.getState().actualizarContadorSinLeer(Math.max(0, totalSinLeer - 1));
      } catch (error) {
        manejarError(error);
      }
    }
    const ruta = obtenerRutaNotificacion(notif);
    if (ruta) navegar(ruta);
  };

  const manejarMarcarTodasLeidas = async () => {
    try {
      await notificacionesApi.marcarTodasComoLeidas();
      const ahora = new Date().toISOString();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true, fecha_lectura: ahora })));
      usarEstadoNotificaciones.setState((estado) => ({
        notificaciones: estado.notificaciones.map((n) => ({
          ...n, leida: true, fecha_lectura: ahora,
        })),
        totalSinLeer: 0,
      }));
    } catch (error) {
      manejarError(error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notificaciones</h1>
          {totalSinLeer > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {totalSinLeer} sin leer
            </p>
          )}
        </div>
        {totalSinLeer > 0 && (
          <button
            type="button"
            onClick={manejarMarcarTodasLeidas}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {([['todas', 'Todas'], ['no_leidas', 'Sin leer'], ['leidas', 'Leídas']] as [FiltroLeida, string][]).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltroLeida(valor)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                filtroLeida === valor
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoNotificacion | '')}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          <option value="">Todos los tipos</option>
          {TODOS_LOS_TIPOS.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETAS_TIPO[tipo] ?? tipo}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {notificacionesFiltradas.length === 0 && !cargandoInicial && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-16 h-16 mb-4 opacity-40">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-lg font-medium">Sin notificaciones</p>
            <p className="text-sm mt-1">
              {filtroLeida !== 'todas' || filtroTipo
                ? 'No hay notificaciones con los filtros seleccionados'
                : 'Las notificaciones del sistema aparecerán aquí'}
            </p>
          </div>
        )}

        {notificacionesFiltradas.map((notif) => {
          const modulo = MODULO_POR_TIPO[notif.tipo] ?? 'Sistema';
          const colorModulo = COLORES_MODULO[modulo] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';

          return (
            <div
              key={notif.id}
              onClick={() => manejarClickNotificacion(notif)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), manejarClickNotificacion(notif))}
              className={`
                flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer
                ${
                  notif.leida
                    ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    : 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }
              `}
            >
              <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${notif.leida ? 'bg-transparent' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorModulo}`}>{modulo}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{formatearFecha(notif.fecha_creacion)}</span>
                </div>
                <p className={`text-sm ${notif.leida ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                  {notif.titulo}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{notif.contenido}</p>
              </div>
            </div>
          );
        })}

        {/* Spinner carga inicial */}
        {cargandoInicial && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Sentinel + spinner para cargar más al scrollear al fondo */}
        {tieneMas && !cargandoInicial && (
          <div ref={referenciarCentinela} className="flex flex-col items-center gap-2 py-6">
            {cargandoMas ? (
              <>
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Cargando más notificaciones...</span>
              </>
            ) : (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Mostrando {notificacionesFiltradas.length} notificaciones &mdash; desplázate para ver más
              </span>
            )}
          </div>
        )}

        {/* Indicador cuando ya no hay más */}
        {!tieneMas && !cargandoInicial && notificacionesFiltradas.length > 0 && (
          <div className="text-center py-4">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {notificacionesFiltradas.length} notificación{notificacionesFiltradas.length !== 1 ? 'es' : ''} en total
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
