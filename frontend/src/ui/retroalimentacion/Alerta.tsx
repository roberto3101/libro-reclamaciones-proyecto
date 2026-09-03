import { useEffect, useState, type ReactNode } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Alerta.module.css';

export type AlertaVariante = 'info' | 'exito' | 'advertencia' | 'peligro';
export type AlertaDiseno = 'estandar' | 'lleno' | 'contorno' | 'suave';

export interface AlertaProps {
  variante?: AlertaVariante;
  diseno?: AlertaDiseno;
  titulo?: ReactNode;
  descripcion?: ReactNode;
  cerrable?: boolean;
  /** Control externo de la visibilidad. */
  abierto?: boolean;
  alCerrar?: () => void;
  /** Milisegundos hasta el cierre automático. */
  tiempoAutoCierre?: number;
  accion?: ReactNode;
  icono?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
  children?: ReactNode;
}

const ICONOS: Record<AlertaVariante, ReactNode> = {
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.6" />
    </svg>
  ),
  exito: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M8.2 12.3l2.6 2.6 5-5.4" />
    </svg>
  ),
  advertencia: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9L2.5 17.4A1.9 1.9 0 004.2 20.3h15.6a1.9 1.9 0 001.7-2.9L13.7 3.9a1.9 1.9 0 00-3.4 0z" />
      <path d="M12 9.5v4M12 16.8v.1" />
    </svg>
  ),
  peligro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
};

/** Mensaje contextual de estado. */
export function UiAlerta({
  variante = 'info', diseno = 'estandar', titulo, descripcion, cerrable,
  abierto, alCerrar, tiempoAutoCierre, accion, icono, className, style, sx, children,
}: AlertaProps) {
  const [visibleLocal, setVisibleLocal] = useState(true);
  const controlado = abierto !== undefined;
  const visible = controlado ? abierto : visibleLocal;

  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  useEffect(() => {
    if (!tiempoAutoCierre || !visible) return;
    const t = setTimeout(() => {
      if (!controlado) setVisibleLocal(false);
      alCerrar?.();
    }, tiempoAutoCierre);
    return () => clearTimeout(t);
  }, [tiempoAutoCierre, visible, controlado, alCerrar]);

  if (!visible) return null;

  const cerrar = () => {
    if (!controlado) setVisibleLocal(false);
    alCerrar?.();
  };

  return (
    <div
      // Los errores interrumpen al lector de pantalla; el resto espera turno.
      role={variante === 'peligro' ? 'alert' : 'status'}
      data-variante={variante}
      data-diseno={diseno}
      className={clases(css.alerta, cUsuario, className)}
      style={{ ...sUsuario, ...style }}
    >
      <span className={css.icono} aria-hidden>
        {icono ?? ICONOS[variante]}
      </span>

      <div className={css.cuerpo}>
        {titulo && <p className={css.titulo}>{titulo}</p>}
        {descripcion && <p className={css.descripcion}>{descripcion}</p>}
        {children && <div className={css.contenido}>{children}</div>}
      </div>

      {accion && <div className={css.accion}>{accion}</div>}

      {cerrable && (
        <button type="button" className={css.cerrar} onClick={cerrar} aria-label="Cerrar aviso">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
