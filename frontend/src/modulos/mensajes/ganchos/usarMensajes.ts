import { useState, useEffect, useCallback } from 'react';
import type { Mensaje } from '@/tipos';
import { mensajesApi } from '../api/mensajes.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarMensajes(reclamoId: string) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    // Si no hay ID, no intentamos cargar nada para evitar errores 400
    if (!reclamoId) return;

    setCargando(true);
    try {
      // CORRECCIÓN AQUÍ: Cambiamos .listar() por .listarPorReclamo()
      const datos = await mensajesApi.listarPorReclamo(reclamoId);
      setMensajes(datos);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [reclamoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { mensajes, cargando, recargar: cargar };
}