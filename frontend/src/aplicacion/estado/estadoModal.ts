import { create } from 'zustand';

/* ── Tipos ─────────────────────────────────────────────────── */
export type TipoModal = 'info' | 'alerta' | 'error' | 'exito' | 'confirmar';

export interface ConfigModal {
  tipo?: TipoModal;
  titulo: string;
  mensaje: string;
  mensajeSecundario?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  alConfirmar?: () => void;
  alCancelar?: () => void;
  bloqueado?: boolean;
}

interface EstadoModal {
  config: ConfigModal | null;
  mostrar: (config: ConfigModal) => void;
  cerrar: () => void;
}

/* ── Store Zustand ─────────────────────────────────────────── */
export const usarEstadoModal = create<EstadoModal>((set) => ({
  config: null,
  mostrar: (config) => set({ config }),
  cerrar: () => set({ config: null }),
}));

/* ── API imperativa (para usar fuera de React, ej: interceptors) */
export const modal = {
  confirmar: (config: Omit<ConfigModal, 'tipo'>) =>
    usarEstadoModal.getState().mostrar({ ...config, tipo: 'confirmar' }),
  alerta: (config: Omit<ConfigModal, 'tipo'>) =>
    usarEstadoModal.getState().mostrar({ ...config, tipo: 'alerta' }),
  error: (config: Omit<ConfigModal, 'tipo'>) =>
    usarEstadoModal.getState().mostrar({ ...config, tipo: 'error' }),
  exito: (config: Omit<ConfigModal, 'tipo'>) =>
    usarEstadoModal.getState().mostrar({ ...config, tipo: 'exito' }),
  info: (config: Omit<ConfigModal, 'tipo'>) =>
    usarEstadoModal.getState().mostrar({ ...config, tipo: 'info' }),
  cerrar: () => usarEstadoModal.getState().cerrar(),
};
