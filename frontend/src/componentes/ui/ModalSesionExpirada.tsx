import { ModalBase, BotonModal } from './ModalBase';
import { usarEstadoUI } from '@/aplicacion/estado/estadoUI';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';

export function ModalSesionExpirada() {
  const { modalSesionExpirada, ocultarSesionExpirada } = usarEstadoUI();
  const { cerrarSesion } = usarEstadoAuth();

  const manejarCerrar = () => {
    ocultarSesionExpirada();
    cerrarSesion();
    window.location.href = '/acceso';
  };

  return (
    <ModalBase
      abierto={modalSesionExpirada}
      alCerrar={manejarCerrar}
      titulo="Sesión Expirada"
      bloqueado
      maxAncho="xs"
      zIndex={1500}
      pie={
        <BotonModal texto="Iniciar Sesión" onClick={manejarCerrar} />
      }
    >
      <div className="flex flex-col items-center text-center py-4">
        <div className="text-amber-500 mb-4">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tu sesión ha expirado. Por favor, inicia sesión nuevamente.
        </p>
      </div>
    </ModalBase>
  );
}
