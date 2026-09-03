import { useState, useEffect, useRef, useCallback } from 'react';
import { chatbotsApi, type HealthCheckResult } from '../api/chatbots.api';
import type { Chatbot } from '@/tipos/chatbot';
import { obtenerToken } from '@/aplicacion/helpers/sesion';

// ──────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────

interface Props {
  chatbot: Chatbot;
  onIrAConfiguracion: () => void;
  onActivar: () => void;
}

// ──────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────

const INTERVALO_POLLING_MS = 30_000; // 30 segundos
const SSE_RETRY_MS = 5_000;

// ──────────────────────────────────────────────────────────────────
// Hook: usarHealthCheck
// ──────────────────────────────────────────────────────────────────

function usarHealthCheck(chatbotId: string) {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [conectado, setConectado] = useState(false);
  const [errorConexion, setErrorConexion] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchHealth = useCallback(async () => {
    try {
      const result = await chatbotsApi.healthCheck(chatbotId);
      if (mountedRef.current) {
        setHealth(result);
        setConectado(true);
        setErrorConexion(false);
      }
    } catch {
      if (mountedRef.current) {
        setErrorConexion(true);
      }
    }
  }, [chatbotId]);

  // Intentar SSE primero, fallback a polling
  const conectarSSE = useCallback(() => {
    const baseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
    const token = obtenerToken();
    const url = `${baseUrl}/chatbots/${chatbotId}/health/stream?token=${encodeURIComponent(token || '')}`;

    try {
      const es = new EventSource(url);
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as HealthCheckResult;
          if (mountedRef.current) {
            setHealth(data);
            setConectado(true);
            setErrorConexion(false);
          }
        } catch { /* parse error */ }
      };

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        // Fallback a polling
        if (mountedRef.current) iniciarPolling();
      };

      es.onopen = () => {
        if (mountedRef.current) {
          setConectado(true);
          setErrorConexion(false);
        }
      };
    } catch {
      // SSE no soportado, usar polling
      iniciarPolling();
    }
  }, [chatbotId]);

  const iniciarPolling = useCallback(() => {
    if (pollingRef.current) return; // Ya activo
    fetchHealth(); // Inmediato
    pollingRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHealth();
      }
    }, INTERVALO_POLLING_MS);
  }, [fetchHealth]);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch inmediato + iniciar polling (SSE requiere auth que EventSource nativa no soporta bien con JWT)
    iniciarPolling();

    // Pausar/reanudar con visibilidad
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchHealth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      if (sseRef.current) sseRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [chatbotId]);

  const inyectarErrores = useCallback(() => {
    setHealth((prev) => {
      const base = prev ?? {
        online: false,
        checked_at: new Date().toISOString(),
        checks: [],
        errores: [],
      };
      return {
        ...base,
        online: false,
        errores: [
          'Bot desactivado por el administrador',
          'Sin permisos de lectura configurados',
          'API key expirada o revocada',
          'Timeout al conectar con el modelo de IA',
        ],
        checks: base.checks.map((c) => ({ ...c, ok: false, detalle: 'Error simulado' })),
      };
    });
  }, []);

  return { health, conectado, errorConexion, refrescar: fetchHealth, inyectarErrores };
}

// ──────────────────────────────────────────────────────────────────
// Componente: PanelEstadoBot
// ──────────────────────────────────────────────────────────────────

const DEV = import.meta.env.DEV;

export function PanelEstadoBot({ chatbot, onIrAConfiguracion, onActivar }: Props) {
  const { health, conectado, errorConexion, refrescar, inyectarErrores } = usarHealthCheck(chatbot.id);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [mostrarErrores, setMostrarErrores] = useState(false);

  const cantErrores = health?.errores?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Barra de estado principal ── */}
      <div className="bg-white dark:bg-[var(--ui-superficie-2)] border border-[var(--ui-borde)] rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Lado izquierdo: indicador + texto */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Dot de estado */}
            <div className="relative shrink-0">
              <div
                className={`w-3 h-3 rounded-full ${
                  !health
                    ? 'bg-gray-400'
                    : health.online
                      ? 'bg-green-500'
                      : 'bg-red-500'
                }`}
              />
              {health?.online && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-40" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ui-texto)] m-0">
                {!health
                  ? 'Verificando...'
                  : health.online
                    ? 'Bot operativo'
                    : 'Bot con problemas'}
              </p>
              {health && (
                <p className="text-xs text-[var(--ui-texto-2)] m-0 mt-0.5">
                  Actualizado: {new Date(health.checked_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  {' · '}Auto-check cada 30s
                </p>
              )}
            </div>
          </div>

          {/* Lado derecho: acciones */}
          <div className="flex items-center gap-2">
            {/* Campana de errores */}
            <button
              onClick={() => setMostrarErrores(!mostrarErrores)}
              className={`relative p-2 rounded-lg border transition-colors ${
                cantErrores > 0
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900'
                  : 'border-[var(--ui-borde)] text-[var(--ui-texto-2)] hover:bg-[var(--ui-hover)]'
              }`}
              title={cantErrores > 0 ? `${cantErrores} error(es)` : 'Sin errores'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {cantErrores > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cantErrores}
                </span>
              )}
            </button>

            {/* Botón test errores (solo desarrollo) */}
            {DEV && (
              <button
                onClick={() => { inyectarErrores(); setMostrarErrores(true); }}
                className="p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors text-xs font-mono"
                title="[DEV] Inyectar errores de prueba"
              >
                Test Errors
              </button>
            )}

            {/* Botón ayuda */}
            <button
              onClick={() => setMostrarAyuda(!mostrarAyuda)}
              className="p-2 rounded-lg border border-[var(--ui-borde)] text-[var(--ui-texto-2)] hover:bg-[var(--ui-hover)] transition-colors"
              title="Manual de referencia"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            {/* Botón refrescar */}
            <button
              onClick={refrescar}
              className="p-2 rounded-lg border border-[var(--ui-borde)] text-[var(--ui-texto-2)] hover:bg-[var(--ui-hover)] transition-colors"
              title="Refrescar ahora"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel de errores desplegable */}
        {mostrarErrores && (
          <div className="mt-3 pt-3 border-t border-[var(--ui-borde)]">
            {cantErrores > 0 ? (
              <>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 m-0 mb-2 uppercase tracking-wide">
                  Errores detectados
                </p>
                <ul className="m-0 pl-4 flex flex-col gap-1">
                  {health!.errores.map((err, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-400">{err}</li>
                  ))}
                </ul>
                {health!.errores.some(e => e.includes('desactivado')) && (
                  <button
                    onClick={onActivar}
                    className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Activar bot
                  </button>
                )}
                {health!.errores.some(e => e.includes('permisos')) && (
                  <button
                    onClick={onIrAConfiguracion}
                    className="mt-2 ml-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Ir a configuracion
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-green-600 dark:text-green-400 m-0 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Sin errores detectados
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Checks individuales ── */}
      {health && (
        <div className="bg-white dark:bg-[var(--ui-superficie-2)] border border-[var(--ui-borde)] rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--ui-borde)] flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--ui-texto-2)] m-0 uppercase tracking-wide">
              Estado en tiempo real
            </p>
            {errorConexion && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Error de conexion. Reintentando...
              </span>
            )}
          </div>

          {health.checks.map((check, i) => (
            <div
              key={check.id}
              className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${
                i < health.checks.length - 1 ? 'border-b border-[var(--ui-borde)]' : ''
              }`}
            >
              {/* Indicador */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  check.ok ? 'bg-green-500' : 'bg-red-500'
                }`}
              />

              {/* Label */}
              <span className="text-sm font-medium text-[var(--ui-texto)] min-w-[100px]">
                {check.label}
              </span>

              {/* Detalle */}
              <span className={`text-sm ml-auto ${
                check.ok
                  ? 'text-[var(--ui-texto-2)]'
                  : 'text-red-600 dark:text-red-400 font-medium'
              }`}>
                {check.detalle}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Manual de referencia ── */}
      {mostrarAyuda && (
        <div className="bg-white dark:bg-[var(--ui-superficie-2)] border border-[var(--ui-borde)] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[var(--ui-texto-2)] m-0 uppercase tracking-wide">
              Manual de referencia
            </p>
            <button
              onClick={() => setMostrarAyuda(false)}
              className="text-[var(--ui-texto-2)] hover:text-[var(--ui-texto)] text-lg leading-none"
            >
              &times;
            </button>
          </div>
          <div className="flex flex-col gap-3 text-sm text-[var(--ui-texto-2)]">
            <ManualItem
              titulo="Bot activo"
              desc="Indica si el bot esta encendido. Si esta apagado, no procesa ninguna solicitud. Se activa/desactiva desde los botones superiores."
            />
            <ManualItem
              titulo="Permisos"
              desc='Define que puede hacer el bot: "lectura" para ver reclamos, "mensajes" para responder, "estados" para cambiar el estado. Minimo requiere lectura.'
            />
            <ManualItem
              titulo="Campana de errores"
              desc="Muestra la cantidad de problemas detectados. Click para ver el detalle y acciones correctivas."
            />
            <ManualItem
              titulo="Auto-check"
              desc="El sistema verifica el estado cada 30 segundos sin recargar la pagina. Se pausa automaticamente cuando la pestana no esta visible para no consumir recursos."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Subcomponente: ManualItem
// ──────────────────────────────────────────────────────────────────

function ManualItem({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div className="pl-3 border-l-2 border-[var(--ui-borde)]">
      <p className="text-sm font-semibold text-[var(--ui-texto)] m-0">{titulo}</p>
      <p className="text-xs text-[var(--ui-texto-2)] m-0 mt-0.5 leading-relaxed">{desc}</p>
    </div>
  );
}
