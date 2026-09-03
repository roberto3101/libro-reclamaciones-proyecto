import { useState, useEffect, useCallback } from 'react';
import type { RolTenant } from '@/tipos';
import { rolesApi } from '../api/roles.api';
import { manejarError } from '@/aplicacion/helpers/errores';

// Caché de módulo: persiste entre navegaciones, se invalida al llamar recargar()
let _cache: RolTenant[] | null = null;

export function usarRoles() {
  const [roles, setRoles] = useState<RolTenant[]>(_cache ?? []);
  const [cargando, setCargando] = useState(_cache === null);

  const cargar = useCallback(async () => {
    if (_cache === null) setCargando(true);
    try {
      const datos = await rolesApi.listar();
      _cache = datos;
      setRoles(datos);
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
    roles,
    cargando,
    recargar: () => { _cache = null; cargar(); },
  };
}
