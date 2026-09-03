import { create } from 'zustand';

interface EstadoUI {
  barraLateralColapsada: boolean;
  modalSesionExpirada: boolean;

  alternarBarraLateral: () => void;
  mostrarSesionExpirada: () => void;
  ocultarSesionExpirada: () => void;
}

export const usarEstadoUI = create<EstadoUI>((set) => ({
  barraLateralColapsada: false,
  modalSesionExpirada: false,

  alternarBarraLateral: () =>
    set((s) => ({ barraLateralColapsada: !s.barraLateralColapsada })),

  mostrarSesionExpirada: () => set({ modalSesionExpirada: true }),
  ocultarSesionExpirada: () => set({ modalSesionExpirada: false }),
}));
