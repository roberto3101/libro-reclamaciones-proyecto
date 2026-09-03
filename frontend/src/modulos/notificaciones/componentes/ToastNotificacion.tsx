import { UiIcono } from '@/ui';
import toast from 'react-hot-toast';
import type { Notificacion } from '@/tipos';
import {
  obtenerModuloNotificacion,
  obtenerEtiquetaAccion,
  obtenerIconoTipo,
  obtenerRutaNotificacion,
} from './rutasNotificacion';

interface ToastNotificacionProps {
  notificacion: Notificacion;
  toastId: string;
  visible: boolean;
  alNavegar: (ruta: string) => void;
}

const COLORES_MODULO: Record<string, string> = {
  'Atención en vivo': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Reclamos: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function ToastNotificacion({ notificacion, toastId, visible, alNavegar }: ToastNotificacionProps) {
  const modulo = obtenerModuloNotificacion(notificacion.tipo);
  const colorModulo = COLORES_MODULO[modulo] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  const etiquetaAccion = obtenerEtiquetaAccion(notificacion.tipo);
  const icono = obtenerIconoTipo(notificacion.tipo);
  const ruta = obtenerRutaNotificacion(notificacion);

  const manejarAccion = () => {
    toast.dismiss(toastId);
    if (ruta) alNavegar(ruta);
  };

  const manejarCerrar = () => {
    toast.dismiss(toastId);
  };

  return (
    <div
      className={`
        w-96 max-w-[calc(100vw-2rem)]
        bg-white dark:bg-gray-800
        border border-[var(--ui-exito-borde)]
        rounded-xl shadow-2xl
        overflow-hidden
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      <div className="flex">
        <div className="w-1.5 bg-emerald-500 dark:bg-emerald-400 flex-shrink-0 rounded-l-xl" />

        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <UiIcono nombre={icono} tamano={17} sx={{ flex: 'none', color: 'var(--ui-texto-3)' }} />
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${colorModulo}`}>
                {modulo}
              </span>
            </div>
            <button
              type="button"
              onClick={manejarCerrar}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer dark:text-gray-400"
              aria-label="Cerrar notificación"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mb-0.5">
            {notificacion.titulo}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {notificacion.contenido}
          </p>

          {ruta && (
            <button
              type="button"
              onClick={manejarAccion}
              className="
                inline-flex items-center gap-1.5
                text-xs font-medium
                text-emerald-700 dark:text-emerald-400
                hover:text-emerald-800 dark:hover:text-emerald-300
                bg-emerald-50 dark:bg-emerald-900/20
                hover:bg-emerald-100 dark:hover:bg-emerald-900/30
                px-3 py-1.5 rounded-lg
                transition-colors cursor-pointer
              "
            >
              {etiquetaAccion}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
