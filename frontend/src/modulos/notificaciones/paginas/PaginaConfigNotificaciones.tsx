import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import axios from 'axios';
import { ConfiguracionNotificacionesRol } from '../componentes/ConfiguracionNotificacionesRol';
import { notificacionesApi } from '../api/notificaciones.api';
import { rolesApi } from '@/modulos/roles/api/roles.api';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

export default function PaginaConfigNotificaciones() {
  const navegar = useNavigate();
  const { usuario } = usarEstadoAuth();
  const [rolId, setRolId] = useState<string | null>(null);
  const [configuraciones, setConfiguraciones] = useState<Record<string, boolean>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  useEffect(() => {
    if (!usuario?.rol) return;
    rolesApi
      .listar()
      .then((roles) => {
        const miRol = roles.find((r) => r.slug.toUpperCase() === usuario.rol.toUpperCase());
        if (miRol) setRolId(miRol.id);
      })
      .catch((error) => {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setSinPermiso(true);
        } else {
          manejarError(error);
        }
      })
      .finally(() => setCargando(false));
  }, [usuario?.rol]);

  const manejarCambio = useCallback((nuevas: Record<string, boolean>) => {
    setConfiguraciones(nuevas);
  }, []);

  const guardar = async () => {
    if (!rolId) return;
    setGuardando(true);
    try {
      const configs = Object.entries(configuraciones).map(([tipo, habilitado]) => ({
        tipo_notificacion: tipo,
        habilitado,
      }));
      await notificacionesApi.actualizarConfiguracionPorRol(rolId, configs);
      notificar.exito('Configuración guardada');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        notificar.error('No tienes permiso para modificar esta configuración');
      } else {
        manejarError(error);
      }
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress size={32} />
      </div>
    );
  }

  if (sinPermiso) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-600 dark:text-gray-400">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Configuración de notificaciones
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-amber-500">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Acceso restringido
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
            No tienes permiso para configurar las notificaciones. Contacta al administrador si necesitas modificar esta configuración.
          </p>
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="mt-6 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-600 dark:text-gray-400">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Configuración de notificaciones
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Activa o desactiva los tipos de notificación para tu rol
          </p>
        </div>
      </div>

      {/* Config */}
      {rolId ? (
        <div className="flex flex-col gap-4">
          <ConfiguracionNotificacionesRol
            rolId={rolId}
            configuraciones={configuraciones}
            alCambiar={manejarCambio}
          />

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              {guardando && <CircularProgress size={14} sx={{ color: 'white' }} />}
              Guardar cambios
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p>No se pudo determinar tu rol. Contacta al administrador.</p>
        </div>
      )}
    </div>
  );
}
