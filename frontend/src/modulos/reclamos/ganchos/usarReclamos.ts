import { useState, useEffect, useCallback } from 'react';
import type { Reclamo, PaginatedResponse } from '@/tipos';
import { reclamosApi } from '../api/reclamos.api';
import { manejarError } from '@/aplicacion/helpers/errores';

export function usarReclamos(paginaInicial = 1, porPagina = 20, filtros?: Record<string, string>) {
  const [datos, setDatos] = useState<PaginatedResponse<Reclamo> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(paginaInicial);

  const filtrosKey = JSON.stringify(filtros || {});

  const cargar = useCallback(async (p: number, silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const resultado = await reclamosApi.listar(p, porPagina, filtros);
      setDatos(resultado);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [porPagina, filtrosKey]);

  useEffect(() => {
    setPagina(1);
  }, [filtrosKey]);

  useEffect(() => {
    cargar(pagina);
  }, [pagina, cargar]);

  const cambiarPagina = (_: unknown, nuevaPagina: number) => setPagina(nuevaPagina);

  return { datos, cargando, pagina, cambiarPagina, recargar: () => cargar(pagina, true) };
}