import { ModalBase, BotonModal } from './ModalBase';
import { usarEstadoModal, type TipoModal } from '@/aplicacion/estado/estadoModal';

/* ── Iconos SVG por tipo ── */
const ICONOS: Record<TipoModal, { clase: string; d: string }> = {
  alerta: {
    clase: 'text-amber-500',
    d: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  error: {
    clase: 'text-red-600',
    d: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  },
  exito: {
    clase: 'text-green-500',
    d: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  info: {
    clase: 'text-blue-500',
    d: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  },
  confirmar: {
    clase: 'text-amber-500',
    d: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
  },
};

/* ══════════════════════════════════════════════════════════════
   ModalGlobal — Renderiza modales imperativos (alertas,
   confirmaciones, errores) controlados por el store Zustand.
   Reemplaza SweetAlert2.  Montar UNA vez en LayoutPrincipal.
   ══════════════════════════════════════════════════════════════ */
export function ModalGlobal() {
  const { config, cerrar } = usarEstadoModal();
  if (!config) return null;

  const tipo = config.tipo || 'info';
  const icono = ICONOS[tipo];
  const mostrarCancelar = tipo === 'confirmar' || !!config.textoCancelar;

  const confirmar = () => { config.alConfirmar?.(); cerrar(); };
  const cancelar = () => { config.alCancelar?.(); cerrar(); };

  return (
    <ModalBase
      abierto
      alCerrar={config.bloqueado ? () => {} : cancelar}
      maxAncho="xs"
      bloqueado={config.bloqueado}
      zIndex={1500}
      pie={
        <>
          {mostrarCancelar && (
            <BotonModal
              texto={config.textoCancelar || 'Cerrar'}
              variante="secundario"
              onClick={cancelar}
            />
          )}
          <BotonModal
            texto={config.textoConfirmar || 'Aceptar'}
            variante={tipo === 'error' ? 'peligro' : 'primario'}
            onClick={confirmar}
          />
        </>
      }
    >
      <div className="flex flex-col items-center text-center py-2 sm:py-4">
        <div className={`${icono.clase} mb-4`}>
          <svg className="w-12 h-12 sm:w-14 sm:h-14" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={icono.d} />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {config.titulo}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {config.mensaje}
        </p>
        {config.mensajeSecundario && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
            {config.mensajeSecundario}
          </p>
        )}
      </div>
    </ModalBase>
  );
}
