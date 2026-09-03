import { createElement } from 'react';
import toast from 'react-hot-toast';
import { UiIcono } from '@/ui';

/* Los avisos llevaban emoji como icono. El emoji lo dibuja la fuente del
   sistema operativo: cambia de forma en cada plataforma, ignora el color
   del texto y desentona con el resto de símbolos de la interfaz. Aquí se
   construyen con createElement porque este archivo es .ts y no admite JSX;
   renombrarlo obligaría a tocar todos los sitios que lo importan. */
const icono = (nombre: string, color: string) =>
  createElement(UiIcono, { nombre, tamano: 18, style: { color } });

export const notificar = {
  exito: (mensaje: string) => toast.success(mensaje),
  error: (mensaje: string) => toast.error(mensaje),
  info: (mensaje: string) => toast(mensaje, { icon: icono('info', 'var(--ui-info-texto)') }),
  advertencia: (mensaje: string) =>
    toast(mensaje, { icon: icono('warning', 'var(--ui-adv-texto)') }),
  cargando: (mensaje: string) => toast.loading(mensaje),
  cerrar: (id?: string) => (id ? toast.dismiss(id) : toast.dismiss()),
  promesa: <T,>(promesa: Promise<T>, mensajes: { cargando: string; exito: string; error: string }) =>
    toast.promise(promesa, {
      loading: mensajes.cargando,
      success: mensajes.exito,
      error: mensajes.error,
    }),
};
