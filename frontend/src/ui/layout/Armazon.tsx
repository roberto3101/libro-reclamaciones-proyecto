import { useEffect, useState, type ReactNode } from 'react';
import { UiBarraLateral, type BarraLateralProps, type ElementoMenuLateral, type InfoUsuario } from './BarraLateral';
import { UiCabecera, type CabeceraProps } from './Cabecera';
import css from './Armazon.module.css';

export interface ArmazonProps {
  /** Elementos del menú lateral. */
  menu: ElementoMenuLateral[];
  usuario?: InfoUsuario;
  sidebarProps?: Partial<BarraLateralProps>;
  headerProps?: Partial<CabeceraProps>;
  titulo?: string;
  children: ReactNode;
  alNavegar?: (href: string) => void;
  /** Estado del panel lateral en móvil, si se controla desde fuera. */
  movilAbierto?: boolean;
  alCambiarMovil?: (abierto: boolean) => void;
}

/** Punto en el que el panel lateral deja de ser fijo y pasa a ser cajón. */
const CORTE_MOVIL = 900;

/** Icono de plegado: dos paneles, el lateral se rellena al estar abierto. */
function IconoPanel({ abierto }: { abierto: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="15" height="13" rx="2"
        stroke="currentColor" strokeWidth="1.5" />
      <line x1="6.75" y1="2.5" x2="6.75" y2="15.5"
        stroke="currentColor" strokeWidth="1.5" />
      {abierto && <rect x="2.25" y="3.25" width="3.75" height="11.5" fill="currentColor" opacity="0.35" />}
    </svg>
  );
}

/**
 * Armazón de la aplicación: panel lateral, cabecera y contenido.
 *
 * El botón de plegar vive DENTRO de la cabecera, alineado con el borde del
 * panel. Antes era un botón flotante posicionado con coordenadas fijas,
 * que se solapaba con el título y obligaba a reservarle hueco a mano.
 *
 * El ancho del panel se publica como `--ui-barra-ancho` en el elemento
 * raíz del armazón, de modo que el contenido se desplaza solo y nadie
 * necesita repetir la medida.
 */
export function UiArmazon({
  menu, usuario, sidebarProps, headerProps, titulo, children, alNavegar,
  movilAbierto, alCambiarMovil,
}: ArmazonProps) {
  const colapsado = !!sidebarProps?.colapsado;

  const [esMovil, setEsMovil] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < CORTE_MOVIL,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${CORTE_MOVIL - 1}px)`);
    const alCambiar = () => setEsMovil(mq.matches);
    alCambiar();
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const controlado = movilAbierto !== undefined;
  const abierto = controlado ? movilAbierto : abiertoInterno;

  const ponerMovil = (v: boolean) => {
    if (!controlado) setAbiertoInterno(v);
    alCambiarMovil?.(v);
  };

  // Con el cajón abierto se bloquea el desplazamiento del documento; sin
  // esto la página de detrás se mueve al arrastrar sobre el panel.
  useEffect(() => {
    if (!esMovil || !abierto) return;
    const desplaza = (document.scrollingElement as HTMLElement) ?? document.documentElement;
    const previo = desplaza.style.overflow;
    desplaza.style.overflow = 'hidden';
    return () => {
      desplaza.style.overflow = previo;
    };
  }, [esMovil, abierto]);

  // Escape cierra el cajón, como cualquier capa superpuesta.
  useEffect(() => {
    if (!esMovil || !abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ponerMovil(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  });

  const navegar = (href: string) => {
    sidebarProps?.alNavegar?.(href);
    alNavegar?.(href);
    if (esMovil) ponerMovil(false);
  };

  /* Un único botón para las dos situaciones: en escritorio pliega el
     panel, en móvil abre y cierra el cajón. Para quien usa la interfaz es
     el mismo gesto, así que no tiene sentido separarlo en dos controles. */
  const alternar = () => {
    if (esMovil) ponerMovil(!abierto);
    else sidebarProps?.alAlternar?.(!colapsado);
  };

  const panelVisible = esMovil ? abierto : !colapsado;
  const botonPanel = (
    <button
      type="button"
      className={css.botonPanel}
      onClick={alternar}
      aria-expanded={panelVisible}
      aria-label={panelVisible ? 'Contraer menú' : 'Expandir menú'}
      title={panelVisible ? 'Contraer menú' : 'Expandir menú'}
    >
      <IconoPanel abierto={panelVisible} />
    </button>
  );

  return (
    <div
      className={css.armazon}
      data-colapsado={colapsado || undefined}
      data-movil={esMovil || undefined}
      data-abierto={esMovil && abierto ? '' : undefined}
    >
      <div className={css.panel}>
        <UiBarraLateral
          elementos={menu}
          usuario={usuario ?? sidebarProps?.usuario}
          textoLogo={sidebarProps?.textoLogo ?? titulo}
          colapsado={esMovil ? false : colapsado}
          mostrarPie={sidebarProps?.mostrarPie}
          alNavegar={navegar}
          alCerrarSesion={sidebarProps?.alCerrarSesion}
        >
          {sidebarProps?.children}
        </UiBarraLateral>
      </div>

      {esMovil && abierto && (
        <div className={css.velo} onClick={() => ponerMovil(false)} aria-hidden />
      )}

      <div className={css.principal}>
        <UiCabecera
          inicio={botonPanel}
          titulo={headerProps?.titulo ?? (headerProps?.migasPan ? undefined : titulo)}
          migasPan={headerProps?.migasPan}
          usuario={headerProps?.usuario ?? usuario}
          mostrarBusqueda={headerProps?.mostrarBusqueda}
          alBuscar={headerProps?.alBuscar}
          alPerfil={headerProps?.alPerfil}
          className={headerProps?.className}
        >
          {headerProps?.children}
        </UiCabecera>

        <main className={css.contenido}>{children}</main>
      </div>
    </div>
  );
}
