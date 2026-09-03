import { create } from 'zustand';
import type { Notificacion } from '@/tipos';
import { notificacionesApi } from '../api/notificaciones.api';
import { manejarError } from '@/aplicacion/helpers/errores';

interface EstadoNotificaciones {
  notificaciones: Notificacion[];
  totalSinLeer: number;
  siguienteCursor: string | null;
  tieneMas: boolean;
  cargando: boolean;
  error: boolean;

  cargarNotificaciones: (reiniciar?: boolean) => Promise<void>;
  cargarMasNotificaciones: () => Promise<void>;
  actualizarContadorSinLeer: (total: number) => void;
  agregarNotificacion: (notificacion: Notificacion) => void;
  marcarComoLeida: (id: string) => Promise<void>;
  marcarTodasComoLeidas: () => Promise<void>;
  incrementarContador: () => void;
}

export const usarEstadoNotificaciones = create<EstadoNotificaciones>((set, get) => ({
  notificaciones: [],
  totalSinLeer: 0,
  siguienteCursor: null,
  tieneMas: false,
  cargando: false,
  error: false,

  cargarNotificaciones: async (reiniciar = true) => {
    if (get().cargando) return;
    set({ cargando: true, error: false });
    try {
      const resultado = await notificacionesApi.listar({ limite: 20 });
      const nuevas = resultado?.notificaciones ?? [];
      set({
        notificaciones: reiniciar ? nuevas : [...get().notificaciones, ...nuevas],
        siguienteCursor: resultado?.siguiente_cursor ?? null,
        tieneMas: resultado?.tiene_mas ?? false,
        totalSinLeer: resultado?.total_sin_leer ?? 0,
      });
    } catch {
      set({ error: true });
    } finally {
      set({ cargando: false });
    }
  },

  cargarMasNotificaciones: async () => {
    const { siguienteCursor, tieneMas, cargando } = get();
    if (!tieneMas || cargando || !siguienteCursor) return;

    set({ cargando: true });
    try {
      const resultado = await notificacionesApi.listar({ cursor: siguienteCursor, limite: 20 });
      const nuevas = resultado?.notificaciones ?? [];
      set({
        notificaciones: [...get().notificaciones, ...nuevas],
        siguienteCursor: resultado?.siguiente_cursor ?? null,
        tieneMas: resultado?.tiene_mas ?? false,
      });
    } catch {
      // No setear error global en paginación para no ocultar datos ya cargados
    } finally {
      set({ cargando: false });
    }
  },

  actualizarContadorSinLeer: (total: number) => {
    set({ totalSinLeer: total });
  },

  agregarNotificacion: (notificacion: Notificacion) => {
    set((estado) => {
      const yaExiste = estado.notificaciones.some((n) => n.id === notificacion.id);
      if (yaExiste) return estado;
      return {
        notificaciones: [notificacion, ...estado.notificaciones],
        totalSinLeer: estado.totalSinLeer + 1,
      };
    });
  },

  marcarComoLeida: async (id: string) => {
    try {
      await notificacionesApi.marcarComoLeida(id);
      set((estado) => ({
        notificaciones: estado.notificaciones.map((n) =>
          n.id === id ? { ...n, leida: true, fecha_lectura: new Date().toISOString() } : n,
        ),
        totalSinLeer: Math.max(0, estado.totalSinLeer - 1),
      }));
    } catch (error) {
      manejarError(error);
    }
  },

  marcarTodasComoLeidas: async () => {
    try {
      await notificacionesApi.marcarTodasComoLeidas();
      set((estado) => ({
        notificaciones: estado.notificaciones.map((n) => ({ ...n, leida: true, fecha_lectura: new Date().toISOString() })),
        totalSinLeer: 0,
      }));
    } catch (error) {
      manejarError(error);
    }
  },

  incrementarContador: () => {
    set((estado) => ({ totalSinLeer: estado.totalSinLeer + 1 }));
  },
}));
