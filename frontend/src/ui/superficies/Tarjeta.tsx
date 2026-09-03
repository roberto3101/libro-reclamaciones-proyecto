import type { ReactNode, HTMLAttributes } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Tarjeta.module.css';

export type TarjetaVariante = 'estandar' | 'contorno' | 'suave';
export type TarjetaRelleno = 'ninguno' | 'p' | 'm' | 'g';

export interface TarjetaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variante?: TarjetaVariante;
  relleno?: TarjetaRelleno;
  efectoHover?: boolean;
  clicable?: boolean;
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  /** Contenido alineado a la derecha de la cabecera (menús, botones). */
  accionCabecera?: ReactNode;
  multimedia?: ReactNode;
  /** Sustituye por completo la cabecera generada a partir de `titulo`. */
  cabecera?: ReactNode;
  pie?: ReactNode;
  alHacerClick?: () => void;
  sx?: PropSx;
  children?: ReactNode;
}

/** Superficie contenedora con cabecera y pie opcionales. */
export function UiTarjeta({
  variante = 'estandar', relleno = 'm', efectoHover, clicable,
  titulo, subtitulo, accionCabecera, multimedia, cabecera, pie, alHacerClick,
  sx, className, style, children, ...resto
}: TarjetaProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const interactiva = clicable || !!alHacerClick;
  const hayCabecera = cabecera || titulo || subtitulo || accionCabecera;

  return (
    <div
      data-variante={variante}
      data-relleno={relleno}
      className={clases(
        css.tarjeta,
        (efectoHover || interactiva) && css.conHover,
        interactiva && css.clicable,
        cUsuario,
        className,
      )}
      style={{ ...sUsuario, ...style }}
      onClick={alHacerClick}
      // Una tarjeta que responde al clic debe poder activarse con teclado.
      role={interactiva ? 'button' : undefined}
      tabIndex={interactiva ? 0 : undefined}
      onKeyDown={
        interactiva
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                alHacerClick?.();
              }
            }
          : undefined
      }
      {...resto}
    >
      {multimedia && <div className={css.multimedia}>{multimedia}</div>}

      {hayCabecera && (
        <div className={css.cabecera}>
          {cabecera ?? (
            <>
              <div className={css.tituloBloque}>
                {titulo && <h3 className={css.titulo}>{titulo}</h3>}
                {subtitulo && <p className={css.subtitulo}>{subtitulo}</p>}
              </div>
              {accionCabecera && <div className={css.accion}>{accionCabecera}</div>}
            </>
          )}
        </div>
      )}

      {children != null && <div className={css.cuerpo}>{children}</div>}

      {pie && <div className={css.pie}>{pie}</div>}
    </div>
  );
}
