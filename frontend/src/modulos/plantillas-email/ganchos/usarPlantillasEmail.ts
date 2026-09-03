import { useState, useEffect, useCallback } from 'react';
import type { PlantillaEmail } from '@/tipos';
import { plantillasEmailApi } from '../api/plantillas-email.api';
import { manejarError } from '@/aplicacion/helpers/errores';

// Caché de módulo: persiste entre navegaciones, se invalida al llamar recargar()
let _cache: PlantillaEmail[] | null = null;

export function usarPlantillasEmail() {
  const [plantillas, setPlantillas] = useState<PlantillaEmail[]>(_cache ?? []);
  const [cargando, setCargando] = useState(_cache === null);

  const cargar = useCallback(async () => {
    if (_cache === null) setCargando(true);
    try {
      const datos = await plantillasEmailApi.listar();
      _cache = datos;
      setPlantillas(datos);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    plantillas,
    cargando,
    recargar: () => { _cache = null; cargar(); },
  };
}
