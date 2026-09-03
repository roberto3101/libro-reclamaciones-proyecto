import toast from 'react-hot-toast';
import { ToastNotificacion } from './ToastNotificacion';
import type { Notificacion } from '@/tipos';
import type { NavigateFunction } from 'react-router-dom';

export function mostrarToastNotificacion(
  notificacion: Notificacion,
  navegar: NavigateFunction,
): void {
  toast.custom(
    (t) => (
      <ToastNotificacion
        notificacion={notificacion}
        toastId={t.id}
        visible={t.visible}
        alNavegar={(ruta) => navegar(ruta)}
      />
    ),
    {
      duration: 6000,
      position: 'bottom-right',
      id: `notif-${notificacion.id}`,
    },
  );
}
