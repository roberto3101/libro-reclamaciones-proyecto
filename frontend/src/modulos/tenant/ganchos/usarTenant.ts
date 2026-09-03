import { useEffect } from 'react';
import { usarEstadoTenant } from '@/aplicacion/estado/estadoTenant';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';

export function usarTenant() {
  const { tenant, cargando, cargar } = usarEstadoTenant();
  const token = usarEstadoAuth((s) => s.token);

  // Recargar datos del tenant cuando:
  //   - No hay tenant cacheado y el store está marcado como cargando
  //     (estado inicial o tras resetear() en login/logout/cambio de empresa)
  //   - El token cambió (JWT nuevo tras seleccionar/cambiar empresa) —
  //     invalida el tenant viejo y fuerza refetch del razón_social correcto
  useEffect(() => {
    if (!token) return;
    if (!tenant && cargando) {
      cargar();
    }
  }, [tenant, cargando, cargar, token]);

  return { tenant, cargando, recargar: cargar };
}
