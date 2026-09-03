import type { MouseEvent } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Paginacion.module.css';

export interface PaginacionProps {
  /** Número total de páginas. */
  total?: number;
  count?: number;
  /** Página actual, empezando en 1. */
  pagina?: number;
  page?: number;
  alCambiar?: (evento: MouseEvent<HTMLButtonElement>, pagina: number) => void;
  onChange?: (evento: MouseEvent<HTMLButtonElement>, pagina: number) => void;
  centrado?: boolean;
  /** Se aceptan también los nombres de MUI por compatibilidad. */
  color?: 'primario' | 'secundario' | 'primary' | 'secondary' | 'standard';
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
}

/**
 * Calcula qué números mostrar.
 *
 * Se mantiene siempre la primera y la última página, una ventana alrededor
 * de la actual, y puntos suspensivos en los saltos. Así el control no
 * crece con el número de páginas.
 */
function construir(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const salida: (number | '…')[] = [1];
  const desde = Math.max(2, actual - 1);
  const hasta = Math.min(total - 1, actual + 1);

  if (desde > 2) salida.push('…');
  for (let i = desde; i <= hasta; i++) salida.push(i);
  if (hasta < total - 1) salida.push('…');

  salida.push(total);
  return salida;
}

/** Navegación entre páginas de un listado. */
export function UiPaginacion({
  total, count, pagina, page, alCambiar, onChange, centrado, color = 'primario',
  className, style, sx,
}: PaginacionProps) {
  const paginas = total ?? count ?? 1;
  const actual = pagina ?? page ?? 1;
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  if (paginas <= 1) return null;

  const ir = (e: MouseEvent<HTMLButtonElement>, n: number) => {
    if (n < 1 || n > paginas || n === actual) return;
    alCambiar?.(e, n);
    onChange?.(e, n);
  };

  const secundario = color === 'secundario' || color === 'secondary' || color === 'standard';

  return (
    <nav
      aria-label="Paginación"
      data-color={secundario ? 'secundario' : 'primario'}
      className={clases(css.paginacion, centrado && css.centrado, cUsuario, className)}
      style={{ ...sUsuario, ...style }}
    >
      <button
        type="button"
        className={css.boton}
        disabled={actual <= 1}
        aria-label="Página anterior"
        onClick={(e) => ir(e, actual - 1)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {construir(actual, paginas).map((p, i) =>
        p === '…' ? (
          <span key={`s-${i}`} className={css.salto} aria-hidden>…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={clases(css.boton, p === actual && css.activo)}
            aria-current={p === actual ? 'page' : undefined}
            aria-label={`Página ${p}`}
            onClick={(e) => ir(e, p)}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className={css.boton}
        disabled={actual >= paginas}
        aria-label="Página siguiente"
        onClick={(e) => ir(e, actual + 1)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
