import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { authApi } from '@/api/auth';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { esMultiLogin } from '@/tipos';

export function usarAuth() {
  const { usuario, autenticado, cargando, empresasAccesibles, establecerSesion, cerrarSesion } = usarEstadoAuth();
  const navegar = useNavigate();

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      try {
        const resultado = await authApi.login({ email, password });

        // Multi-empresa: el usuario tiene 2+ empresas → mostrar selector
        if (esMultiLogin(resultado)) {
          navegar('/seleccionar-empresa', {
            state: {
              empresas: resultado.tenants,
              tokenTemporal: resultado.temp_token,
            },
          });
          return;
        }

        // Login directo (1 empresa)
        establecerSesion(resultado.token, resultado.usuario, resultado.empresasAccesibles);
        notificar.exito(`Bienvenido, ${resultado.usuario.nombre_completo}`);

        if (resultado.usuario.debe_cambiar_password) {
          navegar('/cambiar-password');
        } else {
          navegar('/dashboard');
        }
      } catch (error) {
        manejarError(error, 'Credenciales inválidas');
        throw error;
      }
    },
    [establecerSesion, navegar],
  );

  /** Seleccionar empresa durante el flujo multi-login */
  const seleccionarEmpresa = useCallback(
    async (tokenTemporal: string, tenantId: string) => {
      const resultado = await authApi.seleccionarEmpresa(tokenTemporal, tenantId);
      establecerSesion(resultado.token, resultado.usuario, resultado.empresasAccesibles);
      notificar.exito(`Bienvenido, ${resultado.usuario.nombre_completo}`);

      if (resultado.usuario.debe_cambiar_password) {
        navegar('/cambiar-password');
      } else {
        navegar('/dashboard');
      }
    },
    [establecerSesion, navegar],
  );

  /** Cambiar de empresa estando autenticado (recarga completa) */
  const cambiarEmpresa = useCallback(
    async (tenantId: string) => {
      const resultado = await authApi.cambiarEmpresa(tenantId);
      establecerSesion(resultado.token, resultado.usuario, resultado.empresasAccesibles);
      // Recarga completa para limpiar todo el estado (tenant, permisos, data cacheada)
      window.location.href = '/dashboard';
    },
    [establecerSesion],
  );

  const salir = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignorar error de logout
    } finally {
      cerrarSesion();
      navegar('/acceso');
    }
  }, [cerrarSesion, navegar]);

  return { usuario, autenticado, cargando, empresasAccesibles, iniciarSesion, seleccionarEmpresa, cambiarEmpresa, salir };
}
