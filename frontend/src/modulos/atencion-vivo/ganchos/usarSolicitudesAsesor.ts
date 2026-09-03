import { useState, useEffect, useCallback, useRef } from 'react';
import type { SolicitudAsesor } from '@/tipos/solicitud-asesor';
import { solicitudesAsesorApi } from '../api/solicitudes-asesor.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarSolicitudesAsesor() {
  const [solicitudes, setSolicitudes] = useState<SolicitudAsesor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const yaCargo = useRef(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const [datos, contador] = await Promise.all([
        solicitudesAsesorApi.listarAbiertas(),
        solicitudesAsesorApi.contarPendientes(),
      ]);
      setSolicitudes(datos || []);
      setPendientes(contador?.total ?? 0);
      yaCargo.current = true;
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { solicitudes, cargando, pendientes, recargar: () => cargar(true) };
}