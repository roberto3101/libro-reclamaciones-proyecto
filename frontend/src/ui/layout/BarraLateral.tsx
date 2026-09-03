import { useEffect, useState, type ReactNode } from 'react';
import { clases } from '../sx';
import css from './BarraLateral.module.css';

export interface ElementoMenuLateral {
  id: string;
  etiqueta?: ReactNode;
  icono?: ReactNode;
  href?: string;
  activo?: boolean;
  deshabilitado?: boolean;
  insignia?: string;
  hijos?: ElementoMenuLateral[];
  alHacerClick?: () => void;
  tipo?: 'item' | 'seccion' | 'divisor';
}

export interface InfoUsuario {
  nombre: string;
  email?: string;
  rol?: string;
  avatar?: string;
}

export interface BarraLateralProps {
  elementos: ElementoMenuLateral[];
  usuario?: InfoUsuario;
  logo?: string;
  textoLogo?: string;
  colapsado?: boolean;
  alAlternar?: (colapsado: boolean) => void;
  alNavegar?: (href: string) => void;
  alCerrarSesion?: () => void;
  mostrarPie?: boolean;
  children?: ReactNode;
  ancho?: number;
}

/** ¿Hay algún descendiente marcado como activo? */
function contieneActivo(e: ElementoMenuLateral): boolean {
  if (e.activo) return true;
  return (e.hijos ?? []).some(contieneActivo);
}

export function UiBarraLateral({
  elementos, usuario, textoLogo, colapsado, alNavegar, mostrarPie = true, children,
}: BarraLateralProps) {
  // Un grupo arranca abierto si contiene la ruta actual; a partir de ahí
  // manda el usuario, para no cerrarle un grupo que acaba de abrir.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAbiertos((previo) => {
      const siguiente = { ...previo };
      for (const e of elementos) {
        if (e.hijos?.length && contieneActivo(e) && siguiente[e.id] === undefined) {
          siguiente[e.id] = true;
        }
      }
      return siguiente;
    });
  }, [elementos]);

  const activar = (e: ElementoMenuLateral) => {
    if (e.deshabilitado) return;
    e.alHacerClick?.();
    if (e.href) alNavegar?.(e.href);
  };

  const pintarItem = (e: ElementoMenuLateral, anidado = false) => {
    if (e.tipo === 'divisor') return <li key={e.id} className={css.divisor} role="separator" />;
    if (e.tipo === 'seccion') {
      return (
        <li key={e.id} className={css.seccion}>
          {!colapsado && e.etiqueta}
        </li>
      );
    }

    const grupo = !!e.hijos?.length;
    const abierto = !!abiertos[e.id];
    const resaltado = grupo ? contieneActivo(e) && !abierto : !!e.activo;

    return (
      <li key={e.id}>
        <button
          type="button"
          className={clases(css.item, anidado && css.anidado, resaltado && css.activo)}
          disabled={e.deshabilitado}
          aria-expanded={grupo ? abierto : undefined}
          aria-current={e.activo ? 'page' : undefined}
          // Con la barra plegada el texto no se ve: el título nativo es lo
          // que permite saber qué es cada icono.
          title={colapsado && typeof e.etiqueta === 'string' ? e.etiqueta : undefined}
          onClick={() =>
            grupo ? setAbiertos((p) => ({ ...p, [e.id]: !p[e.id] })) : activar(e)
          }
        >
          {e.icono && <span className={css.icono}>{e.icono}</span>}
          {!colapsado && <span className={css.etiqueta}>{e.etiqueta}</span>}
          {!colapsado && e.insignia && <span className={css.insignia}>{e.insignia}</span>}
          {!colapsado && grupo && (
            <span className={clases(css.chevron, abierto && css.chevronAbierto)} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          )}
        </button>

        {grupo && abierto && !colapsado && (
          <ul className={css.sublista}>{e.hijos!.map((h) => pintarItem(h, true))}</ul>
        )}

        {/* Plegada, la barra no tiene sitio para desplegar: el grupo se
            muestra como panel flotante al pasar el puntero. */}
        {grupo && colapsado && (
          <ul className={css.flotante}>
            {e.hijos!.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={clases(css.item, css.itemFlotante, h.activo && css.activo)}
                  onClick={() => activar(h)}
                >
                  {h.icono && <span className={css.icono}>{h.icono}</span>}
                  <span className={css.etiqueta}>{h.etiqueta}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside className={css.barra} data-colapsado={colapsado || undefined}>
      <div className={css.cabeceraBarra}>
        {children}
        {!colapsado && textoLogo && <span className={css.textoLogo}>{textoLogo}</span>}
      </div>

      <nav className={css.navegacion} aria-label="Menú principal">
        <ul className={css.lista}>{elementos.map((e) => pintarItem(e))}</ul>
      </nav>

      {mostrarPie && usuario && !colapsado && (
        <div className={css.pie}>
          <div className={css.avatar} aria-hidden>
            {usuario.nombre.charAt(0).toUpperCase()}
          </div>
          <div className={css.datosUsuario}>
            <span className={css.nombre}>{usuario.nombre}</span>
            {usuario.rol && <span className={css.rol}>{usuario.rol}</span>}
          </div>
        </div>
      )}
    </aside>
  );
}
