import { useState, useEffect, useCallback } from 'react';
import type { DashboardUso } from '@/tipos';
import { dashboardApi } from '../api/dashboard.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarDashboard() {
  const [uso, setUso] = useState<DashboardUso | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await dashboardApi.obtenerUso();
      setUso(datos);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { uso, cargando, recargar: cargar };
}
