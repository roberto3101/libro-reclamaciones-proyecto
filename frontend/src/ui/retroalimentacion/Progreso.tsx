import { convertirSx, clases, type PropSx } from '../sx';
import css from './Progreso.module.css';

export type ProgresoVariante =
  | 'primario' | 'secundario' | 'error' | 'info' | 'exito' | 'advertencia';
export type ProgresoTamano = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ProgresoProps {
  valor?: number;
  maximo?: number;
  etiqueta?: string;
  mostrarPorcentaje?: boolean;
  /** Escribe el porcentaje dentro de la barra en lugar de encima. */
  etiquetaInterna?: boolean;
  indeterminado?: boolean;
  tamano?: ProgresoTamano;
  variante?: ProgresoVariante;
  rayado?: boolean;
  animado?: boolean;
  colorPersonalizado?: string;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
}

const ALTO: Record<ProgresoTamano, number> = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 };

/** Barra de progreso. */
export function UiProgreso({
  valor = 0, maximo = 100, etiqueta, mostrarPorcentaje, etiquetaInterna, indeterminado,
  tamano = 'md', variante = 'primario', rayado, animado, colorPersonalizado,
  className, style, sx,
}: ProgresoProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const pct = maximo > 0 ? Math.min(100, Math.max(0, (valor / maximo) * 100)) : 0;
  const alto = ALTO[tamano];
  const mostrarTexto = mostrarPorcentaje || etiquetaInterna;

  return (
    <div className={clases(css.bloque, cUsuario, className)} style={{ ...sUsuario, ...style }}>
      {(etiqueta || (mostrarPorcentaje && !etiquetaInterna)) && (
        <div className={css.cabecera}>
          {etiqueta && <span className={css.etiqueta}>{etiqueta}</span>}
          {mostrarPorcentaje && !etiquetaInterna && (
            <span className={css.porcentaje}>{Math.round(pct)}%</span>
          )}
        </div>
      )}

      <div
        className={css.pista}
        style={{ height: etiquetaInterna ? Math.max(alto, 18) : alto }}
        role="progressbar"
        aria-valuenow={indeterminado ? undefined : Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta}
        data-variante={variante}
      >
        <div
          className={clases(
            css.relleno,
            indeterminado && css.indeterminado,
            rayado && css.rayado,
            animado && rayado && css.animado,
          )}
          style={{
            width: indeterminado ? undefined : `${pct}%`,
            background: colorPersonalizado,
          }}
        >
          {etiquetaInterna && mostrarTexto && pct >= 12 && (
            <span className={css.textoInterno}>{Math.round(pct)}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
