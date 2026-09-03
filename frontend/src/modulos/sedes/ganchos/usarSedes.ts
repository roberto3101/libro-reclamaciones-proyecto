import { useState, useEffect, useCallback } from 'react';
import type { Sede } from '@/tipos';
import { sedesApi } from '../api/sedes.api';
import { manejarError } from '@/aplicacion/helpers/errores';

// Caché de módulo por parámetro: persiste entre navegaciones
const _cache: Record<string, Sede[]> = {};

export function usarSedes(incluirInactivas = false) {
  const key = String(incluirInactivas);
  const [sedes, setSedes] = useState<Sede[]>(_cache[key] ?? []);
  const [cargando, setCargando] = useState(!_cache[key]);

  const cargar = useCallback(async () => {
    if (!_cache[key]) setCargando(true);
    try {
      const datos = await sedesApi.listar(incluirInactivas);
      _cache[key] = datos;
      setSedes(datos);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [incluirInactivas, key]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    sedes,
    cargando,
    recargar: () => { delete _cache[key]; cargar(); },
  };
}
