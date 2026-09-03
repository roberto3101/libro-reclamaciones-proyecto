import { useState, useEffect, useCallback } from 'react';
import { UiIcono } from '@/ui';
import { http } from '@/api/http';
import { usarSedes } from '@/modulos/sedes/ganchos/usarSedes';
import { manejarError } from '@/aplicacion/helpers/errores';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { usarPermisos } from '@/aplicacion/ganchos/usarPermisos';
import { notificar } from '@/aplicacion/helpers/toast';
import type { ApiResponse } from '@/tipos';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaDashboard } from '@/componentes/ui/guias-contenido';
import { PantallaSinPermisos } from '@/componentes/ui/PantallaSinPermisos';

// ── Tipos ──

interface DashboardUso {
  plan_codigo: string;
  plan_nombre: string;
  suscripcion_estado: string;
  suscripcion_ciclo: string;
  suscripcion_es_trial: boolean;
  limite_sedes: number;
  limite_usuarios: number;
  limite_reclamos_mes: number;
  limite_chatbots: number;
  limite_canales_whatsapp: number;
  uso_sedes: number;
  uso_usuarios: number;
  uso_reclamos_mes: number;
  uso_chatbots: number;
  uso_canales_whatsapp: number;
  permite_chatbot: boolean;
  permite_whatsapp: boolean;
  permite_reportes_pdf: boolean;
  permite_exportar_excel: boolean;
  permite_api: boolean;
  permite_asistente_ia: boolean;
  permite_atencion_vivo: boolean;
}

interface DashboardMetricas {
  total: number;
  pendientes: number;
  en_proceso: number;
  resueltos: number;
  cerrados: number;
  total_reclamos: number;
  total_quejas: number;
  vencidos: number;
  ultimos_7_dias: number;
  este_mes: number;
  promedio_dias_resolucion: number;
}

// ── API ──

const dashboardApi = {
  obtenerUso: () =>
    http.get<ApiResponse<DashboardUso>>('/dashboard/uso').then((r) => r.data.data),
  obtenerMetricas: (sedeId?: string, periodo?: string, fechaDesde?: string, fechaHasta?: string) => {
    const params: Record<string, string> = {};
    if (sedeId) params.sede_id = sedeId;
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    if (!fechaDesde && !fechaHasta && periodo && periodo !== 'todo') params.periodo = periodo;
    return http.get<ApiResponse<DashboardMetricas>>('/dashboard/metricas', { params }).then((r) => r.data.data);
  },
};

// ── Componente Principal ──

export default function PaginaDashboard() {
  const [uso, setUso] = useState<DashboardUso | null>(null);
  const [metricas, setMetricas] = useState<DashboardMetricas | null>(null);
  const [sedeId, setSedeId] = useState<string>('');
  const [periodo, setPeriodo] = useState<string>('todo');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [librosAbierto, setLibrosAbierto] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const { sedes } = usarSedes();
  const { usuario } = usarEstadoAuth();
  const { tienePermiso, cargando: cargandoPermisos } = usarPermisos();

  const esSoporteConSede = usuario?.sede_ids && usuario.sede_ids.length > 0;

  const esRangoPersonalizado = periodo === 'personalizado';

  // Rango aplicado: solo se actualiza al presionar "Aplicar"
  const [rangoAplicado, setRangoAplicado] = useState<{ desde: string; hasta: string }>({ desde: '', hasta: '' });

  const cargar = useCallback(async () => {
    // En modo personalizado, esperar a que el usuario aplique el rango
    if (esRangoPersonalizado && !rangoAplicado.desde && !rangoAplicado.hasta) return;

    setCargando(true);
    try {
      const [u, m] = await Promise.all([
        dashboardApi.obtenerUso(),
        dashboardApi.obtenerMetricas(
          sedeId || undefined,
          periodo,
          esRangoPersonalizado ? rangoAplicado.desde || undefined : undefined,
          esRangoPersonalizado ? rangoAplicado.hasta || undefined : undefined,
        ),
      ]);
      setUso(u);
      setMetricas(m);
    } catch (error: unknown) {
      // Detectar error 403 (sin permisos)
      if (error && typeof error === 'object' && 'response' in error) {
        const resp = (error as { response?: { status?: number } }).response;
        if (resp?.status === 403) {
          setSinPermiso(true);
          return;
        }
      }
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [sedeId, periodo, rangoAplicado, esRangoPersonalizado]);

  useEffect(() => {
    // Esperar a que los permisos se carguen antes de hacer la petición
    if (cargandoPermisos) return;

    // Si el hook ya sabe que no tiene permiso, no hacer la petición
    if (!tienePermiso('dashboard', 'ver')) {
      setSinPermiso(true);
      setCargando(false);
      return;
    }

    cargar();
  }, [cargar, cargandoPermisos, tienePermiso]);

  useEffect(() => {
    http.get<ApiResponse<{ slug: string }>>('/tenant')
      .then((r) => setTenantSlug(r.data.data.slug))
      .catch(() => {});
  }, []);

  // Pantalla de sin permisos
  if (sinPermiso) {
    return <PantallaSinPermisos modulo="Dashboard" />;
  }

  if (cargando || !uso || !metricas) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Cargando panel...</span>
        </div>
      </div>
    );
  }

  const esTrial = uso.suscripcion_es_trial;
  const limiteIlimitado = uso.limite_reclamos_mes === -1;

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Panel de Control</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {/* Los planes ya se llaman "Plan Emprendedor", "Plan PYME"...
                  Anteponer otro "Plan" daba "Plan Plan Emprendedor". Solo se
                  antepone si el nombre no lo trae ya. */}
              {uso.plan_nombre.toLowerCase().startsWith('plan ')
                ? uso.plan_nombre
                : `Plan ${uso.plan_nombre}`}
            </span>
            {esTrial && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                Periodo de Prueba
              </span>
            )}
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
              {uso.suscripcion_estado === 'TRIAL' ? 'Prueba gratuita' : uso.suscripcion_estado === 'ACTIVA' ? 'Activa' : uso.suscripcion_estado === 'SUSPENDIDA' ? 'Suspendida' : uso.suscripcion_estado === 'CANCELADA' ? 'Cancelada' : uso.suscripcion_estado === 'VENCIDA' ? 'Vencida' : uso.suscripcion_estado}
            </span>
          </div>
        </div>

        <div className="lr-filtros">
          {/* Selector de periodo */}
          <select
            value={periodo}
            onChange={(e) => {
              setPeriodo(e.target.value);
              if (e.target.value !== 'personalizado') {
                setFechaDesde('');
                setFechaHasta('');
                setRangoAplicado({ desde: '', hasta: '' });
              }
            }}
            className="lr-campo"
          >
            <option value="todo">Todo periodo</option>
            <option value="esta_semana">Esta semana</option>
            <option value="este_mes">Este mes</option>
            <option value="este_anio">Este año</option>
            <option value="personalizado">Personalizado</option>
          </select>

          {/* Rango de fechas personalizado */}
          {esRangoPersonalizado && (
            <div className="lr-filtros" style={{ gridColumn: '1 / -1' }}>
              <input
                type="date"
                value={fechaDesde}
                max={fechaHasta || undefined}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="lr-campo"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">a</span>
              <input
                type="date"
                value={fechaHasta}
                min={fechaDesde || undefined}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="lr-campo"
              />
              <button
                type="button"
                disabled={!fechaDesde && !fechaHasta}
                onClick={() => setRangoAplicado({ desde: fechaDesde, hasta: fechaHasta })}
                className="lr-campo" style={{ background: 'var(--ui-primario)', color: 'var(--ui-primario-sobre)', borderColor: 'transparent', fontWeight: 600, cursor: 'pointer' }}
              >
                Aplicar
              </button>
            </div>
          )}

          {/* Selector de sede */}
          {esSoporteConSede ? (
            <span className="lr-campo lr-campo--ancho" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ui-texto-2)' }}>
              {usuario?.sede_ids?.map((id) => sedes.find((s) => s.id === id)?.nombre).filter(Boolean).join(', ') ?? 'Tus sedes'}
            </span>
          ) : (
            <select
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              className="lr-campo lr-campo--ancho"
            >
              <option value="">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <GuiaModulo {...guiaDashboard} />

      {/* ── Banner Prueba Gratuita ── */}
      {esTrial && (
        <div className="lr-aviso-prueba">
          
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Estás en periodo de prueba</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Tienes acceso limitado a {uso.limite_reclamos_mes} reclamos/mes. Actualiza tu plan para desbloquear todas las funcionalidades.
            </p>
          </div>
        </div>
      )}

      {/* ── Acceso Rápido a Libros de Reclamaciones ── */}
      {tenantSlug && sedes.filter((s) => s.activo).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setLibrosAbierto(!librosAbierto)}
            className="w-full flex items-center justify-between px-4 py-3 text-left rounded-xl hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <UiIcono nombre="menu_book" tamano={17} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Libros de Reclamaciones
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                {sedes.filter((s) => s.activo).length}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${librosAbierto ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {librosAbierto && (
            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sedes.filter((s) => s.activo).map((sede) => {
                const urlLibro = `${window.location.origin}/libro/${tenantSlug}?sede=${sede.slug}`;
                return (
                  <div
                    key={sede.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/50 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                        {sede.nombre}
                      </p>
                      {sede.distrito && (
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{sede.distrito}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={urlLibro}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        title="Abrir libro"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(urlLibro);
                            notificar.exito('URL copiada');
                          } catch {
                            notificar.error('No se pudo copiar');
                          }
                        }}
                        className="p-1.5 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                        title="Copiar URL"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="lr-cifras">
        <TarjetaKPI
          titulo={
            periodo === 'esta_semana' ? 'Esta Semana'
            : periodo === 'este_anio' ? 'Este Año'
            : periodo === 'personalizado' ? 'Rango'
            : 'Este Mes'
          }
          valor={periodo === 'todo' || periodo === 'este_mes' ? metricas.este_mes : metricas.total}
          subtitulo={limiteIlimitado ? 'Ilimitado' : `de ${uso.limite_reclamos_mes}`}
        />
        <TarjetaKPI
          titulo="Pendientes"
          valor={metricas.pendientes}
          subtitulo={metricas.en_proceso > 0 ? `${metricas.en_proceso} en proceso` : 'Sin procesar'}
        />
        <TarjetaKPI
          titulo="Vencidos"
          valor={metricas.vencidos}
          subtitulo={metricas.vencidos > 0 ? 'Requieren atención' : 'Todo al día'}
          alerta={metricas.vencidos > 0}
        />
        <TarjetaKPI
          titulo="Resolución"
          valor={metricas.promedio_dias_resolucion}
          subtitulo="días promedio"
          esDias
        />
      </div>

      {/* ── Distribución + Tipo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribución por Estado */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-5">
            Distribución por Estado
          </h3>

          {metricas.total === 0 ? (
            <div className="flex flex-col items-center justify-center h-[140px] text-gray-600 dark:text-gray-400">
              <span className="text-3xl mb-2 font-light">—</span>
              <p className="text-sm font-medium">Sin reclamos registrados</p>
            </div>
          ) : (
            <>
              {/* Barra horizontal segmentada */}
              <BarraEstados metricas={metricas} />

              {/* Leyenda */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <ItemLeyenda color="#a67718" etiqueta="Pendiente" valor={metricas.pendientes} total={metricas.total} />
                <ItemLeyenda color="#b85528" etiqueta="En Proceso" valor={metricas.en_proceso} total={metricas.total} />
                <ItemLeyenda color="#5c8a4f" etiqueta="Cerrado" valor={metricas.resueltos + metricas.cerrados} total={metricas.total} />
              </div>
            </>
          )}
        </div>

        {/* Reclamos vs Quejas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-5">
            Tipo de Solicitud
          </h3>

          {metricas.total === 0 ? (
            <div className="flex flex-col items-center justify-center h-[140px] text-gray-600 dark:text-gray-400">
              <span className="text-3xl mb-2 font-light">—</span>
              <p className="text-sm font-medium">Sin datos</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnilloTipo metricas={metricas} />

              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Reclamos</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{metricas.total_reclamos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Quejas</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{metricas.total_quejas}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actividad Reciente ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">
          Actividad Reciente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniStat etiqueta="Últimos 7 días" valor={metricas.ultimos_7_dias} />
          <MiniStat etiqueta="Total histórico" valor={metricas.total} />
          <MiniStat etiqueta="Cerrados" valor={metricas.resueltos + metricas.cerrados} />
        </div>
      </div>

      {/* ── Recursos del Plan ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Recursos del Plan
          </h3>
          <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-full">
            {uso.suscripcion_ciclo}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BarraRecurso
            etiqueta="Sedes"
            uso={uso.uso_sedes}
            limite={uso.limite_sedes}
          />
          <BarraRecurso
            etiqueta="Usuarios"
            uso={uso.uso_usuarios}
            limite={uso.limite_usuarios}
          />
          {uso.permite_chatbot && (
            <BarraRecurso
              etiqueta="Chatbots"
              uso={uso.uso_chatbots}
              limite={uso.limite_chatbots}
            />
          )}
          {uso.permite_whatsapp && (
            <BarraRecurso
              etiqueta="Canales WhatsApp"
              uso={uso.uso_canales_whatsapp}
              limite={uso.limite_canales_whatsapp}
            />
          )}
          <BarraRecurso
            etiqueta="Reclamos / Mes"
            uso={uso.uso_reclamos_mes}
            limite={uso.limite_reclamos_mes}
          />
        </div>
      </div>

      {/* ── Funcionalidades ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">
          Funcionalidades del Plan
        </h3>
        <div className="flex flex-wrap gap-2">
          <Funcionalidad activa={true} nombre="Email" />
          <Funcionalidad activa={uso.permite_chatbot} nombre="Chatbot IA" />
          <Funcionalidad activa={uso.permite_whatsapp} nombre="WhatsApp" />
          <Funcionalidad activa={uso.permite_reportes_pdf} nombre="Reportes PDF" />
          <Funcionalidad activa={uso.permite_exportar_excel} nombre="Exportar Excel" />
          <Funcionalidad activa={uso.permite_asistente_ia} nombre="Asistente IA" />
          <Funcionalidad activa={uso.permite_atencion_vivo} nombre="Atención en Vivo" />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Subcomponentes
// ══════════════════════════════════════════════════════════════

/* Una celda de la tira de cifras.

   `alerta` es lo unico que introduce color, y solo cuando el dato lo pide
   (reclamos vencidos). El resto va en tinta normal: si las cuatro cifras
   gritan, ninguna se lee antes que las demas. */
function TarjetaKPI({ titulo, valor, subtitulo, alerta, esDias }: {
  titulo: string; valor: number; subtitulo: string; alerta?: boolean; esDias?: boolean;
}) {
  return (
    <div className="lr-cifra">
      <span className="lr-cifra-rotulo">{titulo}</span>
      <p className="lr-cifra-valor" data-alerta={alerta || undefined}>
        {esDias ? valor.toFixed(1) : valor}
      </p>
      <p className="lr-cifra-nota">{subtitulo}</p>
    </div>
  );
}

function BarraEstados({ metricas }: { metricas: DashboardMetricas }) {
  const total = metricas.total || 1;
  const segmentos = [
    { valor: metricas.pendientes, color: 'var(--ui-adv)' },
    { valor: metricas.en_proceso, color: 'var(--ui-info)' },
    { valor: metricas.resueltos + metricas.cerrados, color: 'var(--ui-exito)' },
  ];

  return (
    <div className="w-full h-8 rounded-lg overflow-hidden flex bg-gray-100 dark:bg-gray-700">
      {segmentos.map((seg, i) => {
        const pct = (seg.valor / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={i}
            style={{ width: `${pct}%`, backgroundColor: seg.color, minWidth: pct > 0 ? '2px' : 0 }}
            className="h-full transition-all duration-500 relative group"
          >
            {pct >= 8 && (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
                {seg.valor}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemLeyenda({ color, etiqueta, valor, total }: {
  color: string; etiqueta: string; valor: number; total: number;
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{valor}</p>
        <p className="text-[11px] text-gray-600 dark:text-gray-400">{etiqueta} · {pct}%</p>
      </div>
    </div>
  );
}

function AnilloTipo({ metricas }: { metricas: DashboardMetricas }) {
  const total = metricas.total || 1;
  const pctReclamos = (metricas.total_reclamos / total) * 100;
  const pctQuejas = (metricas.total_quejas / total) * 100;

  const circumference = 2 * Math.PI * 42;
  const offsetReclamos = circumference * (1 - pctReclamos / 100);

  return (
    <div className="flex justify-center">
      <div className="relative w-[120px] h-[120px]">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Fondo (quejas) */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="#3d7276"
            strokeWidth="12"
            opacity="0.2"
          />
          {/* Reclamos */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="#b85528"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offsetReclamos}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
          {/* Quejas (segundo arco) */}
          {pctQuejas > 0 && (
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="#3d7276"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pctQuejas / 100)}
              strokeLinecap="round"
              style={{ transform: `rotate(${pctReclamos * 3.6}deg)`, transformOrigin: '50% 50%' }}
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{total}</span>
          <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">total</span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center gap-3">
      <div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{valor}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400">{etiqueta}</p>
      </div>
    </div>
  );
}

function BarraRecurso({ etiqueta, uso, limite }: {
  etiqueta: string; uso: number; limite: number;
}) {
  const ilimitado = limite === -1;
  const pct = ilimitado ? (uso > 0 ? 15 : 0) : limite > 0 ? Math.min((uso / limite) * 100, 100) : 0;
  const esAlto = !ilimitado && pct >= 90;
  const esMedio = !ilimitado && pct >= 70 && pct < 90;

  const colorBarra = esAlto ? 'bg-red-500' : esMedio ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {etiqueta}
        </span>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {uso} {ilimitado ? '' : `/ ${limite}`}
          {ilimitado && <span className="text-xs font-normal text-gray-600 dark:text-gray-400 ml-1">&infin;</span>}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorBarra} transition-all duration-500`}
          style={{ width: `${Math.max(pct, uso > 0 ? 2 : 0)}%` }}
        />
      </div>
      {!ilimitado && (
        <p className={`text-[11px] mt-1 font-medium ${esAlto ? 'text-red-600 dark:text-red-400' : esMedio ? 'text-amber-500 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {esAlto ? 'Casi al límite' : esMedio ? 'Uso elevado' : `${Math.round(pct)}% utilizado`}
        </p>
      )}
    </div>
  );
}

function Funcionalidad({ activa, nombre }: { activa: boolean; nombre: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        activa
          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 line-through opacity-60'
      }`}
    >
      {activa ? '✓' : '✗'} {nombre}
    </span>
  );
}
