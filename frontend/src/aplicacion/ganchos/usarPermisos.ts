import { useEffect, useCallback } from 'react';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { usarEstadoPermisos } from '@/aplicacion/estado/estadoPermisos';
import { rolesApi } from '@/modulos/roles/api/roles.api';

type MapaPermisos = Record<string, Record<string, boolean>>;

/**
 * Hook que expone los permisos del usuario.
 * El fetch ocurre UNA sola vez por sesión gracias al store global usarEstadoPermisos.
 * Navegaciones subsiguientes no disparan ningún spinner de "Verificando permisos...".
 */
export function usarPermisos() {
  const { autenticado, usuario } = usarEstadoAuth();
  const { permisos, cargando, setPermisos, setCargando, limpiar } = usarEstadoPermisos();

  useEffect(() => {
    if (!autenticado || !usuario) {
      limpiar();
      return;
    }

    // getState() evita race condition cuando múltiples ProtectorModulo montan simultáneamente
    const estado = usarEstadoPermisos.getState();
    if (estado.permisos !== null || estado.cargando) return;

    setCargando(true);
    rolesApi.misPermisos()
      .then((p) => setPermisos(p))
      .catch(() => setPermisos(null))
      .finally(() => setCargando(false));
  }, [autenticado, usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  const tienePermiso = useCallback(
    (modulo: string, accion: string = 'ver'): boolean => {
      if (!usuario) return false;
      if (usuario.rol.toUpperCase() === 'ADMIN') return true;
      if (cargando || !permisos) return false;
      return (permisos as MapaPermisos)[modulo]?.[accion] === true;
    },
    [permisos, usuario, cargando],
  );

  return { permisos, cargando, tienePermiso };
}
