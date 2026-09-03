import { useState, type ReactNode, type HTMLAttributes } from 'react';
import { clases } from '../sx';
import type { InfoUsuario } from './BarraLateral';
import css from './Cabecera.module.css';

export interface ElementoMigaPan {
  etiqueta: string;
  href?: string;
  alHacerClick?: () => void;
}

export interface CabeceraProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  titulo?: string;
  migasPan?: ElementoMigaPan[];
  usuario?: InfoUsuario;
  mostrarBusqueda?: boolean;
  alBuscar?: (consulta: string) => void;
  alPerfil?: () => void;
  /**
   * Contenido pegado al borde izquierdo, antes del título. Aquí va el
   * botón que pliega el panel lateral: vive en la cabecera y no flotando
   * sobre el contenido, que es donde el usuario lo busca.
   */
  inicio?: ReactNode;
  children?: ReactNode;
}

/** Barra superior: control del panel y título a la izquierda, acciones a la derecha. */
export function UiCabecera({
  titulo, migasPan, usuario, mostrarBusqueda, alBuscar, alPerfil,
  inicio, className, children, ...resto
}: CabeceraProps) {
  const [consulta, setConsulta] = useState('');

  return (
    <header className={clases(css.cabecera, className)} {...resto}>
      {inicio && <div className={css.inicio}>{inicio}</div>}

      <div className={css.izquierda}>
        {migasPan?.length ? (
          <nav aria-label="Ruta de navegación">
            <ol className={css.migas}>
              {migasPan.map((m, i) => (
                <li key={i}>
                  {m.href || m.alHacerClick ? (
                    <button type="button" className={css.miga} onClick={m.alHacerClick}>
                      {m.etiqueta}
                    </button>
                  ) : (
                    <span className={css.migaActual}>{m.etiqueta}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          titulo && <h1 className={css.titulo}>{titulo}</h1>
        )}
      </div>

      {mostrarBusqueda && (
        <form
          className={css.busqueda}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            alBuscar?.(consulta);
          }}
        >
          <span className={css.lupa} aria-hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
            </svg>
          </span>
          <input
            type="search"
            className={css.campoBusqueda}
            placeholder="Buscar…"
            aria-label="Buscar"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
          />
        </form>
      )}

      <div className={css.derecha}>
        {children}
        {usuario && (
          <button
            type="button"
            className={css.usuario}
            onClick={alPerfil}
            title={usuario.email ?? usuario.nombre}
          >
            <span className={css.avatar} aria-hidden>
              {usuario.nombre.charAt(0).toUpperCase()}
            </span>
            <span className={css.datosUsuario}>
              <span className={css.nombre}>{usuario.nombre}</span>
              {usuario.rol && <span className={css.rol}>{usuario.rol}</span>}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
