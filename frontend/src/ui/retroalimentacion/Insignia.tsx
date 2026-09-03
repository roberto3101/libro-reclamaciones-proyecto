import type { ReactNode } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Insignia.module.css';

export type InsigniaColor =
  | 'primario' | 'secundario' | 'error' | 'info' | 'advertencia' | 'exito';
export type InsigniaVariante = 'estandar' | 'punto';
export type InsigniaSuperposicion = 'rectangular' | 'circular';

export interface InsigniaProps {
  /** Texto o número que muestra la insignia. */
  contenido?: ReactNode;
  color?: InsigniaColor | string;
  variante?: InsigniaVariante;
  superposicion?: InsigniaSuperposicion;
  /** Tope numérico: por encima se muestra `maximo+`. */
  maximo?: number;
  mostrarCero?: boolean;
  invisible?: boolean;
  posicionVertical?: 'arriba' | 'abajo';
  posicionHorizontal?: 'derecha' | 'izquierda';
  animado?: boolean;
  borde?: boolean;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
  /** Si se pasa contenido hijo, la insignia se ancla sobre él. */
  children?: ReactNode;
}

const COLORES: readonly string[] = [
  'primario', 'secundario', 'error', 'info', 'advertencia', 'exito',
];

/**
 * Distintivo de estado.
 *
 * Sin hijos se comporta como etiqueta suelta —que es como se usa en las
 * tablas—; con hijos se ancla sobre ellos como contador.
 */
export function UiInsignia({
  contenido, color = 'primario', variante = 'estandar', superposicion = 'rectangular',
  maximo, mostrarCero, invisible, posicionVertical = 'arriba', posicionHorizontal = 'derecha',
  animado, borde, className, style, sx, children,
}: InsigniaProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  const numero = typeof contenido === 'number' ? contenido : null;
  if (numero === 0 && !mostrarCero) return children ? <>{children}</> : null;

  const texto =
    numero !== null && maximo !== undefined && numero > maximo ? `${maximo}+` : contenido;

  // Un color fuera del catálogo se pasa tal cual como color de fondo.
  const conocido = COLORES.includes(String(color));

  const pastilla = (
    <span
      className={clases(
        css.insignia,
        variante === 'punto' && css.conPunto,
        superposicion === 'circular' && css.circular,
        animado && css.animado,
        borde && css.conBorde,
        !children && css.suelta,
        cUsuario,
        className,
      )}
      data-color={conocido ? color : undefined}
      style={{
        ...(conocido ? null : { background: color as string, color: 'var(--ui-texto-sobre-color)' }),
        ...sUsuario,
        ...style,
      }}
      hidden={invisible}
    >
      {variante === 'punto' && <span className={css.punto} aria-hidden />}
      {texto}
    </span>
  );

  if (!children) return pastilla;

  return (
    <span className={css.ancla}>
      {children}
      <span
        className={clases(
          css.flotante,
          css[`v_${posicionVertical}`],
          css[`h_${posicionHorizontal}`],
        )}
      >
        {pastilla}
      </span>
    </span>
  );
}
