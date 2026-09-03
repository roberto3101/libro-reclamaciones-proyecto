import { useState, useEffect, useCallback, useRef } from 'react';
import type { CanalWhatsApp } from '@/tipos/canal-whatsapp';
import { canalesWhatsAppApi } from '../api/canales-whatsapp.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarCanalesWhatsApp() {
  const [canales, setCanales] = useState<CanalWhatsApp[]>([]);
  const [cargando, setCargando] = useState(true);
  const yaCargo = useRef(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const datos = await canalesWhatsAppApi.listar();
      setCanales(datos || []);
      yaCargo.current = true;
    } catch (error) {
      manejarError(error);
      setCanales([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { canales, cargando, recargar: () => cargar(true) };
}