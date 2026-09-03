import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Cuadricula.module.css';

export type CuadriculaDireccion = 'fila' | 'columna' | 'fila-reversa' | 'columna-reversa';
export type CuadriculaEnvoltorio = 'envolver' | 'no-envolver' | 'envolver-reversa';
export type CuadriculaAlineacion = 'inicio' | 'centro' | 'fin' | 'estirar' | 'linea-base';
export type CuadriculaJustificacion = 'inicio' | 'centro' | 'fin' | 'entre' | 'alrededor' | 'uniforme';
export type Columnas = boolean | number | 'auto';

const DIRECCION: Record<CuadriculaDireccion, string> = {
  fila: 'row',
  columna: 'column',
  'fila-reversa': 'row-reverse',
  'columna-reversa': 'column-reverse',
};
const ENVOLVER: Record<CuadriculaEnvoltorio, string> = {
  envolver: 'wrap',
  'no-envolver': 'nowrap',
  'envolver-reversa': 'wrap-reverse',
};
const ALINEACION: Record<CuadriculaAlineacion, string> = {
  inicio: 'flex-start',
  centro: 'center',
  fin: 'flex-end',
  estirar: 'stretch',
  'linea-base': 'baseline',
};
const JUSTIFICACION: Record<CuadriculaJustificacion, string> = {
  inicio: 'flex-start',
  centro: 'center',
  fin: 'flex-end',
  entre: 'space-between',
  alrededor: 'space-around',
  uniforme: 'space-evenly',
};

export interface CuadriculaProps extends HTMLAttributes<HTMLDivElement> {
  contenedor?: boolean;
  elemento?: boolean;
  /** Separación entre celdas. Número = múltiplos de 8px. */
  espaciado?: number | string;
  direccion?: CuadriculaDireccion;
  envolver?: CuadriculaEnvoltorio;
  alineacion?: CuadriculaAlineacion;
  justificacion?: CuadriculaJustificacion;
  centrado?: boolean;
  xs?: Columnas;
  sm?: Columnas;
  md?: Columnas;
  lg?: Columnas;
  xl?: Columnas;
  /** Ancho en columnas de 12. Número o mapa por breakpoint. */
  tamano?: number | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', Columnas>>;
  sx?: PropSx;
  children?: ReactNode;
}

/**
 * Rejilla de 12 columnas.
 *
 * El ancho se calcula con la fórmula de MUI —
 * `100% * n/12 - hueco * (12-n)/12` — para que la suma de una fila más
 * sus separaciones dé exactamente el 100 % del contenedor. El hueco viaja
 * del contenedor a las celdas por herencia de `--ui-hueco`, que es lo que
 * permite que el cálculo funcione sin conocer el ancho real.
 */
export const UiCuadricula = forwardRef<HTMLDivElement, CuadriculaProps>(function UiCuadricula(
  { contenedor, elemento, espaciado, direccion, envolver, alineacion, justificacion, centrado,
    xs, sm, md, lg, xl, tamano, sx, className, style, children, ...resto },
  ref,
) {
  const propio: Record<string, unknown> = {};

  if (contenedor) {
    propio['--ui-hueco'] =
      espaciado === undefined ? '0px' : typeof espaciado === 'number' ? `${espaciado * 8}px` : espaciado;
    if (direccion) propio.flexDirection = DIRECCION[direccion];
    if (envolver) propio.flexWrap = ENVOLVER[envolver];
    if (centrado) {
      propio.alignItems = 'center';
      propio.justifyContent = 'center';
    } else {
      if (alineacion) propio.alignItems = ALINEACION[alineacion];
      if (justificacion) propio.justifyContent = JUSTIFICACION[justificacion];
    }
  }

  // Las props sueltas (xs, md…) y el mapa `tamano` alimentan lo mismo.
  const porBreakpoint: Record<string, Columnas | undefined> =
    typeof tamano === 'object'
      ? { ...tamano }
      : { xs, sm, md, lg, xl, ...(typeof tamano === 'number' ? { xs: tamano } : {}) };

  const definidos = Object.entries(porBreakpoint).filter(([, v]) => v !== undefined && v !== false);

  if (definidos.length) {
    const cols: Record<string, string> = {};
    const flex: Record<string, string> = {};
    const ancho: Record<string, string> = {};
    for (const [bp, v] of definidos) {
      if (v === true || v === 'auto') {
        // `auto` reparte el espacio libre en lugar de fijar columnas: el
        // ancho lo decide el flex, así que se anula el cálculo por columnas.
        flex[bp] = v === true ? '1 1 0' : '0 1 auto';
        ancho[bp] = 'auto';
      } else {
        cols[bp] = String(v);
        flex[bp] = '0 0 auto';
      }
    }
    const unico = (o: Record<string, string>) =>
      Object.keys(o).length === 1 && 'xs' in o ? o.xs : o;
    if (Object.keys(cols).length) propio['--ui-col'] = unico(cols);
    if (Object.keys(ancho).length) propio.width = unico(ancho);
    propio.flex = unico(flex);
  }

  const { style: sProp, className: cProp } = convertirSx(propio);
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  return (
    <div
      ref={ref}
      className={clases(
        contenedor && css.contenedor,
        (elemento || definidos.length > 0) && css.elemento,
        cProp,
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
