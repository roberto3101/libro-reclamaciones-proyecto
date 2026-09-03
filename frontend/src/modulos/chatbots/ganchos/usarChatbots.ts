import { useState, useEffect, useCallback, useRef } from 'react';
import type { Chatbot } from '@/tipos';
import { chatbotsApi } from '../api/chatbots.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarChatbots() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [cargando, setCargando] = useState(true);
  const yaCargo = useRef(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const datos = await chatbotsApi.listar();
      setChatbots(datos);
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

  return { chatbots, cargando, recargar: () => cargar(true) };
}
