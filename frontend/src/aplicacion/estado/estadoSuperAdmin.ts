import { create } from 'zustand';
import type { SuperAdminAuth } from '@/tipos';

const SA_TOKEN_KEY = 'lr_sa_token';
const SA_USER_KEY = 'lr_sa_usuario';

interface EstadoSuperAdmin {
  sa: SuperAdminAuth | null;
  token: string | null;
  autenticado: boolean;
  cargando: boolean;

  inicializar: () => void;
  establecerSesion: (token: string, sa: SuperAdminAuth) => void;
  cerrarSesion: () => void;
}

export const usarEstadoSuperAdmin = create<EstadoSuperAdmin>((set) => ({
  sa: null,
  token: null,
  autenticado: false,
  cargando: true,

  inicializar: () => {
    const token = localStorage.getItem(SA_TOKEN_KEY);
    const raw = localStorage.getItem(SA_USER_KEY);

    if (token && raw) {
      try {
        // Validar que no esté expirado
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          const sa = JSON.parse(raw) as SuperAdminAuth;
          set({ token, sa, autenticado: true, cargando: false });
          return;
        }
      } catch { /* token inválido */ }
    }

    localStorage.removeItem(SA_TOKEN_KEY);
    localStorage.removeItem(SA_USER_KEY);
    set({ token: null, sa: null, autenticado: false, cargando: false });
  },

  establecerSesion: (token, sa) => {
    localStorage.setItem(SA_TOKEN_KEY, token);
    localStorage.setItem(SA_USER_KEY, JSON.stringify(sa));
    set({ token, sa, autenticado: true });
  },

  cerrarSesion: () => {
    localStorage.removeItem(SA_TOKEN_KEY);
    localStorage.removeItem(SA_USER_KEY);
    localStorage.removeItem('lr_token');
    localStorage.removeItem('lr_sa_impersonando');
    set({ token: null, sa: null, autenticado: false });
  },
}));
