import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Caja.module.css';

export type CajaVariante = 'predeterminado' | 'bordeado' | 'sombreado' | 'vidrio' | 'gradiente';
export type CajaValidacion = 'error' | 'exito' | 'advertencia' | 'info';

export interface CajaProps extends HTMLAttributes<HTMLDivElement> {
  variante?: CajaVariante;
  /** Pinta un borde de color según el estado, sin tocar el contenido. */
  validacion?: CajaValidacion;
  centrado?: boolean;
  pantallaCompleta?: boolean;
  flexFila?: boolean;
  flexColumna?: boolean;
  colorFondo?: string;
  colorTexto?: string;
  /** Relleno interno. Número = múltiplos de 8px. */
  relleno?: number | string;
  margen?: number | string;
  redondeado?: number | string;
  /** Realce al pasar el puntero. */
  alFlotar?: { elevar?: boolean; escalar?: boolean };
  sx?: PropSx;
  children?: ReactNode;
}

const medida = (v: number | string | undefined) =>
  v === undefined ? undefined : typeof v === 'number' ? `${v * 8}px` : v;

/** Bloque genérico. Es el equivalente del `div` con estilos del sistema. */
export const UiCaja = forwardRef<HTMLDivElement, CajaProps>(function UiCaja(
  { variante = 'predeterminado', validacion, centrado, pantallaCompleta, flexFila, flexColumna,
    colorFondo, colorTexto, relleno, margen, redondeado, alFlotar,
    sx, className, style, children, ...resto },
  ref,
) {
  const propio: Record<string, unknown> = {
    padding: medida(relleno),
    margin: medida(margen),
    borderRadius: typeof redondeado === 'number' ? `${redondeado * 4}px` : redondeado,
    backgroundColor: colorFondo,
    color: colorTexto,
  };

  const { style: sProp } = convertirSx(propio);
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  return (
    <div
      ref={ref}
      data-variante={variante !== 'predeterminado' ? variante : undefined}
      data-validacion={validacion}
      className={clases(
        css.caja,
        centrado && css.centrado,
        pantallaCompleta && css.pantallaCompleta,
        flexFila && css.flexFila,
        flexColumna && css.flexColumna,
        alFlotar?.elevar && css.flotarElevar,
        alFlotar?.escalar && css.flotarEscalar,
        cUsuario,
        className,
      )}
      style={{ ...sProp, ...sUsuario, ...style }}
      {...resto}
    >
      {children}
    </div>
  );
});
