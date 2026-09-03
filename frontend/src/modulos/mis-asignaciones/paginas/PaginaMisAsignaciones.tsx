import { useCallback, useEffect, useState } from 'react';
import { UiIcono } from '@/ui';
import { useNavigate } from 'react-router-dom';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { usarPermisos } from '@/aplicacion/ganchos/usarPermisos';
import { misAsignacionesApi } from '../api/mis-asignaciones.api';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { Reclamo } from '@/tipos';
import type { SolicitudAsesor } from '@/tipos/solicitud-asesor';

const PESTANAS_RECLAMOS = [
  { clave: '', etiqueta: 'Todos' },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes' },
  { clave: 'EN_PROCESO', etiqueta: 'En proceso' },
  { clave: 'RESUELTO', etiqueta: 'Resueltos' },
] as const;

const PESTANAS_SOLICITUDES = [
  { clave: '', etiqueta: 'Todas' },
  { clave: 'EN_ATENCION', etiqueta: 'En atención' },
  { clave: 'RESUELTO', etiqueta: 'Resueltas' },
] as const;

const OPCIONES_ORDEN = [
  { clave: 'recientes', etiqueta: 'Más recientes' },
  { clave: 'antiguos', etiqueta: 'Más antiguos' },
  { clave: 'prioridad', etiqueta: 'Prioridad' },
] as const;

const COLORES_ESTADO_RECLAMO: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  EN_PROCESO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  RESUELTO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CERRADO: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const COLORES_ESTADO_SOLICITUD: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  EN_ATENCION: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  RESUELTO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CANCELADO: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const ETIQUETAS_ESTADO_SOLICITUD: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_ATENCION: 'En atención',
  RESUELTO: 'Resuelto',
  CANCELADO: 'Cancelado',
};

const COLORES_PRIORIDAD: Record<string, string> = {
  URGENTE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  ALTA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  NORMAL: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  BAJA: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function formatearFechaRelativa(fechaStr: string): string {
  const diferencia = Date.now() - new Date(fechaStr).getTime();
  const minutos = Math.floor(diferencia / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos}m`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias}d`;
  return new Date(fechaStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function Paginador({ pagina, totalPaginas, alCambiar }: { pagina: number; totalPaginas: number; alCambiar: (p: number) => void }) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Página {pagina} de {totalPaginas}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => alCambiar(pagina - 1)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => alCambiar(pagina + 1)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default function PaginaMisAsignaciones() {
  const navegar = useNavigate();
  const usuario = usarEstadoAuth((s) => s.usuario);
  const usuarioId = usuario?.id ?? '';
  const { tienePermiso } = usarPermisos();
  const puedeVerTodas = tienePermiso('reclamos', 'asignar');

  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [totalReclamos, setTotalReclamos] = useState(0);
  const [solicitudes, setSolicitudes] = useState<SolicitudAsesor[]>([]);
  const [totalSolicitudes, setTotalSolicitudes] = useState(0);
  const [cargandoReclamos, setCargandoReclamos] = useState(true);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true);
  const [filtroEstadoReclamo, setFiltroEstadoReclamo] = useState('');
  const [filtroEstadoSolicitud, setFiltroEstadoSolicitud] = useState('');
  const [ordenSolicitudes, setOrdenSolicitudes] = useState('recientes');
  const [paginaReclamos, setPaginaReclamos] = useState(1);
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const [verTodas, setVerTodas] = useState(false);
  const [usuarioFiltrado, setUsuarioFiltrado] = useState('');
  const [listaUsuarios, setListaUsuarios] = useState<{ id: string; nombre_completo: string; rol: string }[]>([]);

  useEffect(() => {
    if (puedeVerTodas) {
      import('@/api/http').then(({ http }) => {
        http.get<{ data: { id: string; nombre_completo: string; rol: string }[] }>('/usuarios')
          .then((res) => setListaUsuarios(res.data.data ?? []))
          .catch(() => {});
      });
    }
  }, [puedeVerTodas]);

  const idFiltroUsuario = verTodas
    ? (usuarioFiltrado || undefined)
    : usuarioId;

  const cargarReclamos = useCallback(async () => {
    if (!usuarioId) return;
    setCargandoReclamos(true);
    try {
      const respuesta = await misAsignacionesApi.obtenerReclamosAsignados(
        idFiltroUsuario, paginaReclamos, 10, filtroEstadoReclamo || undefined,
      );
      setReclamos(respuesta.data ?? []);
      setTotalReclamos(respuesta.total ?? 0);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargandoReclamos(false);
    }
  }, [usuarioId, idFiltroUsuario, paginaReclamos, filtroEstadoReclamo]);

  const cargarSolicitudes = useCallback(async () => {
    if (!usuarioId) return;
    setCargandoSolicitudes(true);
    try {
      const respuesta = await misAsignacionesApi.obtenerSolicitudesAsignadas(
        idFiltroUsuario, paginaSolicitudes, 10, filtroEstadoSolicitud || undefined, ordenSolicitudes,
      );
      setSolicitudes(respuesta.data ?? []);
      setTotalSolicitudes(respuesta.total ?? 0);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargandoSolicitudes(false);
    }
  }, [usuarioId, idFiltroUsuario, paginaSolicitudes, filtroEstadoSolicitud, ordenSolicitudes]);

  useEffect(() => { cargarReclamos(); }, [cargarReclamos]);
  useEffect(() => { cargarSolicitudes(); }, [cargarSolicitudes]);

  useEffect(() => { setPaginaReclamos(1); }, [filtroEstadoReclamo]);
  useEffect(() => { setPaginaSolicitudes(1); }, [filtroEstadoSolicitud, ordenSolicitudes]);
  useEffect(() => { setPaginaReclamos(1); setPaginaSolicitudes(1); }, [verTodas, usuarioFiltrado]);

  const totalPaginasReclamos = Math.ceil(totalReclamos / 10);
  const totalPaginasSolicitudes = Math.ceil(totalSolicitudes / 10);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {verTodas ? 'Todas las Asignaciones' : 'Mis Asignaciones'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {verTodas ? 'Asignaciones de todo el equipo' : 'Todo lo que tienes asignado en un solo lugar'}
          </p>
        </div>
        {puedeVerTodas && (
          <button
            type="button"
            onClick={() => setVerTodas(!verTodas)}
            className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer border ${
              verTodas
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-500'
                : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {verTodas ? 'Ver solo las mías' : 'Ver todas del equipo'}
          </button>
        )}
      </div>

      {verTodas && puedeVerTodas && (
        <div className="flex items-center gap-3 px-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Filtrar por usuario:
          </label>
          <select
            value={usuarioFiltrado}
            onChange={(e) => setUsuarioFiltrado(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer flex-1 max-w-xs"
          >
            <option value="">Todos los usuarios</option>
            {listaUsuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo} ({u.rol})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ─── Solicitudes de Atención ─── */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <UiIcono nombre="chat_bubble" tamano={17} />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Solicitudes de Atención
              </h2>
              {totalSolicitudes > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {totalSolicitudes}
                </span>
              )}
            </div>
            <select
              value={ordenSolicitudes}
              onChange={(e) => setOrdenSolicitudes(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
            >
              {OPCIONES_ORDEN.map((op) => (
                <option key={op.clave} value={op.clave}>{op.etiqueta}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1">
            {PESTANAS_SOLICITUDES.map((pestana) => (
              <button
                key={pestana.clave}
                type="button"
                onClick={() => setFiltroEstadoSolicitud(pestana.clave)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filtroEstadoSolicitud === pestana.clave
                    ? 'bg-blue-600 text-white dark:bg-blue-600'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {pestana.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {cargandoSolicitudes ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-12 px-4">
            <UiIcono nombre="check_circle" tamano={17} />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {filtroEstadoSolicitud
                ? 'No tienes solicitudes con ese estado'
                : 'No tienes solicitudes asignadas'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {solicitudes.map((solicitud) => (
                <button
                  key={solicitud.id}
                  type="button"
                  onClick={() => navegar(`/atencion-vivo?solicitud=${solicitud.id}`)}
                  className="w-full text-left px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                        {solicitud.nombre}
                      </p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COLORES_ESTADO_SOLICITUD[solicitud.estado] ?? ''}`}>
                        {ETIQUETAS_ESTADO_SOLICITUD[solicitud.estado] ?? solicitud.estado}
                      </span>
                      {solicitud.prioridad !== 'NORMAL' && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COLORES_PRIORIDAD[solicitud.prioridad] ?? ''}`}>
                          {solicitud.prioridad}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {solicitud.motivo}
                    </p>
                    {verTodas && solicitud.nombre_asesor && (
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                        Asignado a: {solicitud.nombre_asesor}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                      {formatearFechaRelativa(solicitud.fecha_creacion)}
                    </p>
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 uppercase">
                      {solicitud.canal_origen}
                    </span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
            <Paginador pagina={paginaSolicitudes} totalPaginas={totalPaginasSolicitudes} alCambiar={setPaginaSolicitudes} />
          </>
        )}
      </section>

      {/* ─── Reclamos Asignados ─── */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <UiIcono nombre="assignment" tamano={17} />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Reclamos Asignados
              </h2>
              {totalReclamos > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {totalReclamos}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1">
            {PESTANAS_RECLAMOS.map((pestana) => (
              <button
                key={pestana.clave}
                type="button"
                onClick={() => setFiltroEstadoReclamo(pestana.clave)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filtroEstadoReclamo === pestana.clave
                    ? 'bg-blue-600 text-white dark:bg-blue-600'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {pestana.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {cargandoReclamos ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : reclamos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <UiIcono nombre="inbox" tamano={34} sx={{ display: "block", marginBottom: "12px", color: "var(--ui-texto-3)" }} />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {filtroEstadoReclamo
                ? `No tienes reclamos con estado "${filtroEstadoReclamo.replace('_', ' ').toLowerCase()}"`
                : 'No tienes reclamos asignados'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {reclamos.map((reclamo) => (
                <button
                  key={reclamo.id}
                  type="button"
                  onClick={() => navegar(`/reclamos/${reclamo.id}`)}
                  className="w-full text-left px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                        {reclamo.nombre_completo}
                      </p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COLORES_ESTADO_RECLAMO[reclamo.estado] ?? ''}`}>
                        {reclamo.estado.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      #{reclamo.codigo_reclamo} — {reclamo.detalle_reclamo || reclamo.descripcion_situacion || 'Sin detalle'}
                    </p>
                    {verTodas && reclamo.nombre_atendido_por && (
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                        Asignado a: {reclamo.nombre_atendido_por}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                      {formatearFechaRelativa(reclamo.fecha_registro)}
                    </p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">
                      {reclamo.tipo_solicitud}
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
            <Paginador pagina={paginaReclamos} totalPaginas={totalPaginasReclamos} alCambiar={setPaginaReclamos} />
          </>
        )}
      </section>
    </div>
  );
}
