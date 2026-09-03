import { create } from 'zustand';
import type { Tenant } from '@/tipos';
import { tenantApi } from '@/modulos/tenant/api/tenant.api';

interface EstadoTenant {
  tenant: Tenant | null;
  cargando: boolean;
  cargar: () => Promise<void>;
  actualizar: (tenant: Tenant) => void;
  /**
   * Resetea el store al estado inicial. Se llama desde estadoAuth al
   * hacer login, logout o cambiar de empresa para forzar que
   * `usarTenant` vuelva a ejecutar `cargar()` contra el tenant actual
   * del nuevo JWT en vez de mantener el razón_social de la sesión
   * anterior cacheado en memoria.
   */
  resetear: () => void;
}

export const usarEstadoTenant = create<EstadoTenant>((set) => ({
  tenant: null,
  cargando: true,

  cargar: async () => {
    set({ cargando: true });
    try {
      const datos = await tenantApi.obtener();
      set({ tenant: datos, cargando: false });
    } catch {
      set({ cargando: false });
    }
  },

  actualizar: (tenant) => set({ tenant }),

  resetear: () => set({ tenant: null, cargando: true }),
}));
