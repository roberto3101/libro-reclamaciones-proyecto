import { useState, useEffect, useCallback } from 'react';
import type { Respuesta } from '@/tipos';
import { respuestasApi } from '../api/respuestas.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarRespuestas(reclamoId: string) {
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await respuestasApi.listar(reclamoId);
      setRespuestas(datos);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [reclamoId]);

  useEffect(() => {
    if (reclamoId) cargar();
  }, [reclamoId, cargar]);

  return { respuestas, cargando, recargar: cargar };
}
