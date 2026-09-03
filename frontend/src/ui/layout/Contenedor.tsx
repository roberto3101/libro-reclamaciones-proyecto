import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Contenedor.module.css';

export type AnchoMaximo = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;

export interface ContenedorProps extends HTMLAttributes<HTMLDivElement> {
  /** Sin límite de ancho. */
  fluido?: boolean;
  /** Ocupa el alto de la ventana y centra su contenido. */
  paginaCentrada?: boolean;
  anchoMaximo?: AnchoMaximo;
  /** Fija el ancho al del breakpoint actual en lugar de dejarlo fluir. */
  fijo?: boolean;
  deshabilitarMargenes?: boolean;
  sx?: PropSx;
  children?: ReactNode;
}

/** Centra el contenido y le pone un ancho máximo legible. */
export const UiContenedor = forwardRef<HTMLDivElement, ContenedorProps>(function UiContenedor(
  { fluido, paginaCentrada, anchoMaximo = 'lg', fijo, deshabilitarMargenes,
    sx, className, style, children, ...resto },
  ref,
) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const ancho = fluido ? false : anchoMaximo;

  return (
    <div
      ref={ref}
      data-ancho={ancho === false ? undefined : ancho}
      className={clases(
        css.contenedor,
        fijo && css.fijo,
        deshabilitarMargenes && css.sinMargenes,
        paginaCentrada && css.paginaCentrada,
        cUsuario,
        className,
      )}
      style={{ ...sUsuario, ...style }}
      {...resto}
    >
      {children}
    </div>
  );
});
