import { useState, useEffect, useCallback } from 'react';
import type { Plan } from '@/tipos';
import { suscripcionApi } from '../api/suscripcion.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarPlanes(admin = false) {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = admin ? await suscripcionApi.listarPlanesAdmin() : await suscripcionApi.listarPlanes();
      setPlanes(datos ?? []);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [admin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { planes, cargando, recargar: cargar };
}