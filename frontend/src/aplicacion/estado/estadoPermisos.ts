import { create } from 'zustand';

type MapaPermisos = Record<string, Record<string, boolean>>;

interface EstadoPermisos {
  permisos: MapaPermisos | null;
  cargando: boolean;
  setPermisos: (p: MapaPermisos | null) => void;
  setCargando: (v: boolean) => void;
  limpiar: () => void;
}

/**
 * Store global de permisos del usuario autenticado.
 * El fetch se realiza UNA sola vez por sesión y se reutiliza en todas las rutas.
 * Al cerrar sesión se limpia con limpiar().
 */
export const usarEstadoPermisos = create<EstadoPermisos>((set) => ({
  permisos: null,
  cargando: false,
  setPermisos: (permisos) => set({ permisos }),
  setCargando: (cargando) => set({ cargando }),
  limpiar: () => set({ permisos: null, cargando: false }),
}));
