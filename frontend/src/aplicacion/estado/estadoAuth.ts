import { create } from 'zustand';
import type { UsuarioAuth, EmpresaAccesible } from '@/tipos';
import { obtenerToken, obtenerUsuarioGuardado, guardarSesion, limpiarSesion, guardarEmpresasAccesibles, obtenerEmpresasAccesibles } from '@/aplicacion/helpers/sesion';
import { tokenExpirado } from '@/aplicacion/helpers/jwt';
import { usarEstadoPermisos } from '@/aplicacion/estado/estadoPermisos';
import { usarEstadoTenant } from '@/aplicacion/estado/estadoTenant';

interface EstadoAuth {
  usuario: UsuarioAuth | null;
  token: string | null;
  autenticado: boolean;
  cargando: boolean;
  empresasAccesibles: EmpresaAccesible[];

  inicializar: () => void;
  establecerSesion: (token: string, usuario: UsuarioAuth, empresas?: EmpresaAccesible[]) => void;
  cerrarSesion: () => void;
}

export const usarEstadoAuth = create<EstadoAuth>((set) => ({
  usuario: null,
  token: null,
  autenticado: false,
  cargando: true,
  empresasAccesibles: [],

  inicializar: () => {
    const token = obtenerToken();
    const usuario = obtenerUsuarioGuardado();

    if (token && usuario && !tokenExpirado(token)) {
      const empresas = obtenerEmpresasAccesibles();
      set({ token, usuario, autenticado: true, cargando: false, empresasAccesibles: empresas });
    } else {
      limpiarSesion();
      usarEstadoPermisos.getState().limpiar();
      set({ token: null, usuario: null, autenticado: false, cargando: false, empresasAccesibles: [] });
    }
  },

  establecerSesion: (token, usuario, empresas) => {
    // Limpiar permisos del usuario anterior para forzar re-fetch
    usarEstadoPermisos.getState().limpiar();
    // Limpiar tenant cacheado de sesión anterior — sin esto el sidebar y
    // header siguen mostrando razon_social de la sesión previa aunque el
    // JWT nuevo apunte a otro tenant.
    usarEstadoTenant.getState().resetear();
    guardarSesion(token, usuario);
    const empresasAccesibles = empresas ?? [];
    guardarEmpresasAccesibles(empresasAccesibles);
    set({ token, usuario, autenticado: true, empresasAccesibles });
  },

  cerrarSesion: () => {
    limpiarSesion();
    usarEstadoPermisos.getState().limpiar();
    usarEstadoTenant.getState().resetear();
    set({ token: null, usuario: null, autenticado: false, empresasAccesibles: [] });
  },
}));
