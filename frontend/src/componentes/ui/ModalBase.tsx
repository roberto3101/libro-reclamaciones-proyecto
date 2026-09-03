import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* ── Tamanios ──────────────────────────────────────────────── */
type MaxAncho = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const ANCHOS: Record<MaxAncho, string> = {
  xs:    'sm:max-w-sm',
  sm:    'sm:max-w-md',
  md:    'sm:max-w-xl',
  lg:    'sm:max-w-2xl lg:max-w-3xl',
  xl:    'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
};

/* ── Props ─────────────────────────────────────────────────── */
export interface ModalBaseProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo?: string;
  maxAncho?: MaxAncho;
  bloqueado?: boolean;
  pie?: ReactNode;
  children: ReactNode;
  zIndex?: number;
  /**
   * Si es false, el modal NO se cierra al hacer click fuera (en el
   * backdrop) ni al presionar Escape. Útil para modales con formularios
   * largos donde un click accidental haría perder todo lo escrito.
   * Por defecto es true para preservar compatibilidad con los modales
   * existentes.
   */
  cerrarAlClickFuera?: boolean;
}

/* ── CSS de animacion (inyectado una sola vez) ─────────────── */
let cssInyectado = false;
function inyectarAnimaciones() {
  if (cssInyectado || typeof document === 'undefined') return;
  cssInyectado = true;
  const s = document.createElement('style');
  s.id = 'modal-base-css';
  s.textContent = [
    '@keyframes mb-overlay{from{opacity:0}to{opacity:1}}',
    '@keyframes mb-panel{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes mb-slide{from{transform:translateY(100%)}to{transform:translateY(0)}}',
    '.mb-overlay{animation:mb-overlay .2s ease-out}',
    '.mb-panel{animation:mb-panel .2s ease-out}',
    '@media(max-width:639px){.mb-panel{animation:mb-slide .3s ease-out}}',
    '.MuiPopover-root,.MuiPopper-root,.MuiModal-root,.MuiMenu-root{z-index:1450!important}',
    '.MuiMenu-paper,.MuiPopover-paper{border-radius: var(--ui-r-xl)!important;box-shadow:0 8px 30px rgba(0,0,0,.12)!important;border:1px solid var(--ui-borde,#e5e0d4)!important;margin-top:4px!important;max-height:min(280px,40vh)!important;max-width:min(85vw,460px)!important;overflow-x:hidden!important}',
    '.MuiMenu-list{padding:6px!important}',
    '.MuiMenuItem-root{border-radius: var(--ui-r-lg)!important;margin:2px 0!important;padding:10px 14px!important;font-size:0.875rem!important;transition:background .15s!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:block!important;max-width:100%!important}',
    '.MuiMenuItem-root:hover{background:var(--ui-superficie-hundida,#f1eee6)!important}',
    '.MuiMenuItem-root.Mui-selected{background:rgba(154,74,36,.1)!important;font-weight:600!important}',
    '.MuiMenuItem-root.Mui-selected:hover{background:rgba(154,74,36,.15)!important}',
  ].join('');
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════
   ModalBase — Componente unico y centralizado para todos los
   modales de la aplicacion.  Estilos Tailwind unificados,
   responsive (bottom-sheet en mobile, centrado en desktop),
   dark mode, accesibilidad y animaciones.
   ══════════════════════════════════════════════════════════════ */
export function ModalBase({
  abierto,
  alCerrar,
  titulo,
  maxAncho = 'md',
  bloqueado = false,
  pie,
  children,
  zIndex = 1400,
  cerrarAlClickFuera = true,
}: ModalBaseProps) {
  const elAnterior = useRef<Element | null>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => { inyectarAnimaciones(); }, []);

  /* Cerrar con ESC — respeta bloqueado y cerrarAlClickFuera para ser
     consistente con el comportamiento del backdrop. */
  const onEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bloqueado && cerrarAlClickFuera) alCerrar();
    },
    [alCerrar, bloqueado, cerrarAlClickFuera],
  );

  /* Bloquear scroll del body + registrar ESC */
  useEffect(() => {
    if (!abierto) return;
    document.addEventListener('keydown', onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prev;
    };
  }, [abierto, onEsc]);

  /* Restaurar foco al cerrar */
  useEffect(() => {
    if (abierto) {
      elAnterior.current = document.activeElement;
    } else if (elAnterior.current instanceof HTMLElement) {
      elAnterior.current.focus();
      elAnterior.current = null;
    }
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 mb-overlay"
      style={{ zIndex }}
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => {
        // Solo cerrar si TANTO el mousedown como el click fueron en el backdrop.
        // Esto evita que al seleccionar texto y soltar fuera del panel se cierre.
        if (
          e.target === e.currentTarget &&
          mouseDownTarget.current === e.currentTarget &&
          !bloqueado &&
          cerrarAlClickFuera
        ) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={[
          'bg-white dark:bg-gray-900',
          'rounded-t-2xl sm:rounded-xl',
          'shadow-2xl',
          'w-full max-w-none', ANCHOS[maxAncho],
          'h-[100dvh] sm:h-auto sm:max-h-[90vh]',
          'flex flex-col',
          'border-0 sm:border border-gray-200 dark:border-gray-700',
          'sm:mx-auto',
          'mb-panel',
        ].join(' ')}
      >
        {/* ── Handle movil ── */}
        <div className="flex justify-center pt-2 pb-0 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* ── Header ── */}
        {titulo && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
              {titulo}
            </h2>
            {!bloqueado && (
              <button
                type="button"
                onClick={alCerrar}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 -mr-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {children}
        </div>

        {/* ── Footer ── */}
        {pie && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/30 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════════════════════
   BotonModal — Boton estandarizado para footer de modales.
   Garantiza apariencia identica en todos los modales.
   ══════════════════════════════════════════════════════════════ */
type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';

const ESTILOS_BOTON: Record<VarianteBoton, string> = {
  primario:    'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold',
  secundario:  'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium',
  fantasma:    'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium',
  peligro:     'bg-red-600 hover:bg-red-700 text-white font-semibold',
};

export interface BotonModalProps {
  texto: string;
  variante?: VarianteBoton;
  onClick: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
}

export function BotonModal({
  texto,
  variante = 'primario',
  onClick,
  cargando = false,
  deshabilitado = false,
}: BotonModalProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando || deshabilitado}
      className={`px-4 py-2.5 text-sm rounded-lg transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${ESTILOS_BOTON[variante]}`}
    >
      {cargando && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {texto}
    </button>
  );
}
