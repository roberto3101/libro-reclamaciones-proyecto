import { forwardRef, Children, isValidElement, type ReactNode, type HTMLAttributes } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Pila.module.css';

export type PilaDireccion = 'fila' | 'columna' | 'fila-reversa' | 'columna-reversa';
export type PilaAlineacion = 'inicio' | 'centro' | 'fin' | 'estirar' | 'linea-base';
export type PilaJustificacion = 'inicio' | 'centro' | 'fin' | 'entre' | 'alrededor' | 'uniforme';

const DIRECCION: Record<PilaDireccion, string> = {
  fila: 'row',
  columna: 'column',
  'fila-reversa': 'row-reverse',
  'columna-reversa': 'column-reverse',
};

const ALINEACION: Record<PilaAlineacion, string> = {
  inicio: 'flex-start',
  centro: 'center',
  fin: 'flex-end',
  estirar: 'stretch',
  'linea-base': 'baseline',
};

const JUSTIFICACION: Record<PilaJustificacion, string> = {
  inicio: 'flex-start',
  centro: 'center',
  fin: 'flex-end',
  entre: 'space-between',
  alrededor: 'space-around',
  uniforme: 'space-evenly',
};

export interface PilaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'dir'> {
  /** Eje principal. Admite un valor por breakpoint: `{ xs: 'columna', md: 'fila' }`. */
  direccion?: PilaDireccion | PilaDireccion[] | Record<string, PilaDireccion>;
  /** Separación entre hijos. Número = múltiplos de 8px (convención de MUI). */
  espaciado?: number | string;
  alineacion?: PilaAlineacion;
  justificacion?: PilaJustificacion;
  /** `true` inserta una línea divisoria entre cada hijo; también acepta un nodo propio. */
  divisor?: boolean | ReactNode;
  /** Atajo de alineacion="centro" + justificacion="centro". */
  centrado?: boolean;
  /** Atajo de justificacion="entre". */
  entre?: boolean;
  sx?: PropSx;
  children?: ReactNode;
}

const aHueco = (v: number | string | undefined) =>
  v === undefined ? undefined : typeof v === 'number' ? `${v * 8}px` : v;

/**
 * Contenedor flex de una sola dimensión.
 *
 * El caso responsivo se delega en el convertidor de `sx` en lugar de
 * duplicar aquí la lógica de breakpoints: así una dirección responsiva y
 * un `sx` responsivo se resuelven por el mismo camino.
 */
export const UiPila = forwardRef<HTMLDivElement, PilaProps>(function UiPila(
  { direccion = 'columna', espaciado, alineacion, justificacion, divisor, centrado, entre,
    sx, className, style, children, ...resto },
  ref,
) {
  const esResponsiva = typeof direccion === 'object';

  const propio: Record<string, unknown> = {
    gap: aHueco(espaciado),
    alignItems: centrado ? 'center' : alineacion ? ALINEACION[alineacion] : undefined,
    justifyContent: entre
      ? 'space-between'
      : centrado
        ? 'center'
        : justificacion
          ? JUSTIFICACION[justificacion]
          : undefined,
  };

  if (esResponsiva) {
    const mapa = Array.isArray(direccion)
      ? Object.fromEntries(direccion.map((d, i) => [['xs', 'sm', 'md', 'lg', 'xl'][i], d]))
      : direccion;
    propio.flexDirection = Object.fromEntries(
      Object.entries(mapa).filter(([, d]) => d).map(([bp, d]) => [bp, DIRECCION[d as PilaDireccion]]),
    );
  } else {
    propio.flexDirection = DIRECCION[direccion];
  }

  const { style: sProp, className: cProp } = convertirSx(propio);
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  // Children.toArray ya asigna claves estables, así que basta con intercalar.
  const hijos = divisor
    ? Children.toArray(children)
        .filter(Boolean)
        .flatMap((hijo, i) =>
          i === 0
            ? [hijo]
            : [
                <span key={`divisor-${i}`} aria-hidden className={css.divisor}>
                  {isValidElement(divisor) ? divisor : null}
                </span>,
                hijo,
              ],
        )
    : children;

  // Eje base: lo consume el CSS para orientar el separador. Con dirección
  // responsiva se toma el valor de `xs`, que es el que aplica sin media query.
  const ejeBase = esResponsiva
    ? (Array.isArray(direccion) ? direccion[0] : (direccion as Record<string, PilaDireccion>).xs) ?? 'columna'
    : (direccion as PilaDireccion);

  return (
    <div
      ref={ref}
      data-eje={ejeBase.startsWith('fila') ? 'fila' : 'columna'}
      className={clases(css.pila, cProp, cUsuario, className)}
      style={{ ...sProp, ...sUsuario, ...style }}
      {...resto}
    >
      {hijos}
    </div>
  );
});
