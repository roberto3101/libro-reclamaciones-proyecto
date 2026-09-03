import { BarChart, type BarChartProps } from '@mui/x-charts/BarChart';
import css from './BarChart.module.css';
import { clases } from '../sx';

export interface UiBarChartProps extends BarChartProps {
  title?: string;
  subTitle?: string;
  /** Envuelve el gráfico en una tarjeta con borde. */
  withPaper?: boolean;
  height?: number;
}

/**
 * Gráfico de barras.
 *
 * Los colores de ejes y leyenda se fijan por CSS desde los tokens en vez
 * de pasarlos por props: el SVG que dibuja la librería hereda `color` y
 * así el gráfico cambia con el tema sin volver a montarse.
 */
export function UiBarChart({
  title, subTitle, withPaper = true, height = 300, className, ...props
}: UiBarChartProps) {
  return (
    <div className={clases(css.bloque, withPaper && css.conMarco, className)}>
      {(title || subTitle) && (
        <div className={css.cabecera}>
          {title && <h4 className={css.titulo}>{title}</h4>}
          {subTitle && <p className={css.subtitulo}>{subTitle}</p>}
        </div>
      )}
      <div className={css.lienzo}>
        <BarChart height={height} {...props} />
      </div>
    </div>
  );
}
