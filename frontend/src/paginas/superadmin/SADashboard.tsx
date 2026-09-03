import { useState, useEffect, useCallback } from 'react';
import { superadminApi } from '@/api/superadmin';
import type { EstadisticasGlobales } from '@/tipos';

/* ── Iconos SVG por tarjeta ─────────────────────────────────── */
const IconoCuentas = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const IconoEmpresas = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const IconoUsuarios = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconoReclamos = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

/* ── Configuracion de las 4 tarjetas ────────────────────────── */
interface CardConfig {
  titulo: string;
  mainKey: keyof EstadisticasGlobales;
  subtituloKey?: keyof EstadisticasGlobales;
  subtituloLabel?: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  iconBg: string;
}

const tarjetas: CardConfig[] = [
  {
    titulo: 'Total Cuentas',
    mainKey: 'total_cuentas',
    subtituloKey: 'cuentas_activas',
    subtituloLabel: 'Activas',
    icon: <IconoCuentas />,
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    textColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
  },
  {
    titulo: 'Total Empresas',
    mainKey: 'total_empresas',
    subtituloKey: 'empresas_activas',
    subtituloLabel: 'Activas',
    icon: <IconoEmpresas />,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
  },
  {
    titulo: 'Total Usuarios',
    mainKey: 'total_usuarios',
    icon: <IconoUsuarios />,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
  },
  {
    titulo: 'Total Reclamos',
    mainKey: 'total_reclamos',
    icon: <IconoReclamos />,
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
  },
];

/* ── Skeleton de carga ──────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SADashboard — Panel de estadisticas globales del SuperAdmin
   ══════════════════════════════════════════════════════════════ */
export default function SADashboard() {
  const [stats, setStats] = useState<EstadisticasGlobales | null>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [data, rev] = await Promise.all([
        superadminApi.estadisticas(),
        superadminApi.revenue(),
      ]);
      setStats(data);
      setRevenue(rev);
    } catch {
      setError('No se pudieron cargar las estadisticas. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Dashboard
      </h1>

      {/* ── Estado de error ── */}
      {error && !cargando && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={cargar}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Grid de tarjetas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cargando
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : !error &&
            tarjetas.map((card) => (
              <div
                key={card.mainKey}
                className={`rounded-xl border border-gray-200 dark:border-gray-700 ${card.bgColor} p-6 shadow-sm transition hover:shadow-md`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${card.iconBg} ${card.textColor} flex items-center justify-center shrink-0`}
                  >
                    {card.icon}
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${card.textColor}`}>
                      {stats ? stats[card.mainKey].toLocaleString() : '—'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {card.titulo}
                    </p>
                    {card.subtituloKey && stats && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {stats[card.subtituloKey].toLocaleString()} {card.subtituloLabel}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* ── Revenue Metrics ── */}
      {revenue && !cargando && !error && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1 dark:text-gray-400">MRR</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">S/ {revenue.mrr?.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1 dark:text-gray-400">ARR</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">S/ {revenue.arr?.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20 p-5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1 dark:text-gray-400">Suscripciones activas</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{revenue.total_activas}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 p-5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1 dark:text-gray-400">Trials activos</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{revenue.total_trials}</p>
            </div>
          </div>

          {revenue.por_plan?.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Distribución por plan</h3>
              <div className="space-y-2">
                {revenue.por_plan.map((pp: any) => (
                  <div key={pp.plan_nombre} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{pp.plan_nombre}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{pp.count} {pp.count === 1 ? 'empresa' : 'empresas'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
