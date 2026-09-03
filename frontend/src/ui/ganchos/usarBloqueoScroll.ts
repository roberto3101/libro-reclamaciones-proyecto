import { useEffect } from 'react';

/**
 * Congela el desplazamiento de la página mientras hay una capa abierta.
 *
 * Sin esto, al girar la rueda sobre un modal se mueve la página de detrás:
 * el usuario cierra el modal y se encuentra en otro punto de la lista, y en
 * móvil el gesto se "escapa" al fondo.
 *
 * El bloqueo se aplica al elemento que realmente desplaza, que en esta
 * aplicación es <html> y no <body> (lo decide `document.scrollingElement`).
 * Poner `overflow: hidden` solo en el body no habría hecho nada: es el
 * error clásico de este patrón, y aquí se veía tal cual.
 *
 * Se conserva el valor previo de `overflow` en lugar de dejarlo en `''`,
 * porque base.css ya define uno propio y borrarlo lo eliminaría. Y se
 * compensa el ancho de la barra de desplazamiento, o el contenido daría un
 * salto lateral al ocultarla.
 *
 * @param activo  true mientras la capa esté visible.
 */
export function usarBloqueoScroll(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;

    const desplaza = (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
    const cuerpo = document.body;

    const overflowPrevio = desplaza.style.overflow;
    const rellenoPrevio = cuerpo.style.paddingRight;
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;

    desplaza.style.overflow = 'hidden';
    if (anchoBarra > 0) {
      const actual = parseFloat(getComputedStyle(cuerpo).paddingRight) || 0;
      cuerpo.style.paddingRight = `${actual + anchoBarra}px`;
    }

    return () => {
      desplaza.style.overflow = overflowPrevio;
      cuerpo.style.paddingRight = rellenoPrevio;
    };
  }, [activo]);
}
