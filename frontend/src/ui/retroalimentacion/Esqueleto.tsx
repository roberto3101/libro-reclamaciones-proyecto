import { convertirSx, clases, type PropSx } from '../sx';
import css from './Esqueleto.module.css';

export type EsqueletoVariante = 'texto' | 'rectangular' | 'redondeado' | 'circular';

export interface EsqueletoProps {
  variante?: EsqueletoVariante;
  ancho?: number | string;
  alto?: number | string;
  animacion?: 'pulso' | 'ola' | false;
  /** Color de relleno propio, si el del tema no encaja sobre ese fondo. */
  colorBase?: string;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
}

/** Marcador de posición mientras llega el contenido. */
export function UiEsqueleto({
  variante = 'texto', ancho, alto, animacion = 'pulso', colorBase,
  className, style, sx,
}: EsqueletoProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  return (
    <span
      // Es decoración: el lector de pantalla no debe anunciar cajas vacías.
      aria-hidden
      data-variante={variante}
      className={clases(
        css.esqueleto,
        animacion === 'pulso' && css.pulso,
        animacion === 'ola' && css.ola,
        cUsuario,
        className,
      )}
      style={{
        width: ancho,
        height: alto,
        background: colorBase,
        ...sUsuario,
        ...style,
      }}
    />
  );
}
