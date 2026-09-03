/**
 * Reancla los desplegables de MUI al hacer scroll.
 *
 * El Popover de MUI se posiciona una sola vez, con `position: fixed`. Si la
 * página se desplaza con el menú abierto, el panel se queda donde estaba y
 * acaba flotando lejos del campo que lo abrió.
 *
 * La mayoría de los desplegables de la aplicación ya son `<select>` nativos
 * —que el navegador ancla solo—, así que esto solo afecta a los pocos que
 * siguen siendo de MUI. Se mantiene porque quitarlo devolvería ese salto.
 *
 * Devuelve la función para dejar de escuchar.
 */
export function anclarDesplegables(): () => void {
  let pendiente = 0;

  const recolocar = () => {
    cancelAnimationFrame(pendiente);
    // Se agrupa en un frame: el evento de scroll dispara muy seguido y
    // medir el DOM en cada uno provocaría reflows en cadena.
    pendiente = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('.MuiPopover-root .MuiPopover-paper');
      if (!panel) return;
      const ancla = document.querySelector<HTMLElement>('.MuiSelect-select[aria-expanded="true"]');
      if (!ancla) return;
      const caja = ancla.getBoundingClientRect();
      panel.style.top = `${caja.bottom + 12}px`;
      panel.style.left = `${caja.left}px`;
    });
  };

  window.addEventListener('scroll', recolocar, { passive: true });
  document.addEventListener('scroll', recolocar, { capture: true, passive: true });

  return () => {
    cancelAnimationFrame(pendiente);
    window.removeEventListener('scroll', recolocar);
    document.removeEventListener('scroll', recolocar, { capture: true });
  };
}
