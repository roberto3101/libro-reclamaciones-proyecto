import { useState, useEffect, useCallback } from 'react';
import type { SuscripcionConPlan, UsoTenant, Suscripcion } from '@/tipos';
import { suscripcionApi } from '../api/suscripcion.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarSuscripcion() {
  const [datos, setDatos] = useState<SuscripcionConPlan | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await suscripcionApi.obtenerActiva();
      setDatos(res);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { datos, cargando, recargar: cargar };
}

export function usarUsoTenant() {
  const [uso, setUso] = useState<UsoTenant | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await suscripcionApi.obtenerUso();
      setUso(res);
    } catch {
      // silencioso para widgets
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { uso, cargando, recargar: cargar };
}

export function usarHistorialSuscripciones() {
  const [historial, setHistorial] = useState<Suscripcion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await suscripcionApi.obtenerHistorial();
      setHistorial(res ?? []);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { historial, cargando };
}