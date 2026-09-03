import { convertirSx, clases, type PropSx } from '../sx';
import css from './Cargando.module.css';

export type CargandoTamano = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type CargandoColor =
  | 'primario' | 'secundario' | 'error' | 'info' | 'exito' | 'advertencia' | 'blanco' | 'gris';
export type CargandoTipo =
  | 'borde' | 'anillo' | 'puntos' | 'pulso' | 'segmentos' | 'lineas' | 'puntos-circulo' | 'cuadricula';

export interface CargandoProps {
  tamano?: CargandoTamano | number;
  color?: CargandoColor;
  tipo?: CargandoTipo;
  etiqueta?: string;
  posicionEtiqueta?: 'derecha' | 'abajo';
  /** Cubre la ventana con un velo mientras dura la espera. */
  pantallaCompleta?: boolean;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
}

const PX: Record<CargandoTamano, number> = { xs: 14, sm: 18, md: 26, lg: 36, xl: 48 };

/** Las formas que comparten dibujo se agrupan para no repetir animaciones. */
const FAMILIA: Record<CargandoTipo, 'anillo' | 'puntos' | 'pulso' | 'lineas'> = {
  anillo: 'anillo',
  borde: 'anillo',
  segmentos: 'anillo',
  puntos: 'puntos',
  'puntos-circulo': 'puntos',
  cuadricula: 'puntos',
  pulso: 'pulso',
  lineas: 'lineas',
};

/** Indicador de espera. */
export function UiCargando({
  tamano = 'md', color = 'primario', tipo = 'anillo', etiqueta,
  posicionEtiqueta = 'derecha', pantallaCompleta, className, style, sx,
}: CargandoProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const px = typeof tamano === 'number' ? tamano : PX[tamano];
  const familia = FAMILIA[tipo] ?? 'anillo';

  const figura =
    familia === 'anillo' ? (
      <span className={css.anillo} style={{ width: px, height: px }} />
    ) : familia === 'pulso' ? (
      <span className={css.pulso} style={{ width: px, height: px }} />
    ) : familia === 'lineas' ? (
      <span className={css.lineas} style={{ height: px }}>
        <i /><i /><i />
      </span>
    ) : (
      <span className={css.puntos} style={{ fontSize: Math.max(4, px / 3.4) }}>
        <i /><i /><i />
      </span>
    );

  const cuerpo = (
    <span
      role="status"
      aria-live="polite"
      aria-label={etiqueta ?? 'Cargando'}
      data-color={color}
      className={clases(
        css.cargando,
        posicionEtiqueta === 'abajo' && css.vertical,
        cUsuario,
        className,
      )}
      style={{ ...sUsuario, ...style }}
    >
      {figura}
      {etiqueta && <span className={css.etiqueta}>{etiqueta}</span>}
    </span>
  );

  if (!pantallaCompleta) return cuerpo;
  return <span className={css.velo}>{cuerpo}</span>;
}
