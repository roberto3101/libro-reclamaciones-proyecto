import { useState, useEffect, useCallback } from 'react';
import type { Usuario } from '@/tipos';
import { usuariosApi } from '../api/usuarios.api';
import { manejarError } from '@/aplicacion/helpers/errores';

// Caché de módulo: persiste entre navegaciones, se invalida al llamar recargar()
let _cache: Usuario[] | null = null;

export function usarUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(_cache ?? []);
  const [cargando, setCargando] = useState(_cache === null);

  const cargar = useCallback(async () => {
    if (_cache === null) setCargando(true);
    try {
      const datos = await usuariosApi.listar();
      _cache = datos;
      setUsuarios(datos);
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
    usuarios,
    cargando,
    recargar: () => { _cache = null; cargar(); },
  };
}
