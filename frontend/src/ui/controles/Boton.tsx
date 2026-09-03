import { forwardRef, type ReactNode, type ButtonHTMLAttributes, type MouseEventHandler } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Boton.module.css';

export type BotonVariante =
  | 'primario' | 'secundario' | 'contorno' | 'fantasma' | 'peligro' | 'exito'
  | 'advertencia' | 'info' | 'oscuro' | 'claro' | 'suave' | 'enlace';
export type BotonTamano = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BotonForma = 'cuadrado' | 'circulo' | 'pildora';
export type BotonEstado = 'inactivo' | 'cargando' | 'exito' | 'error';

export interface BotonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variante?: BotonVariante;
  tamano?: BotonTamano;
  forma?: BotonForma;
  /** Estado de la acción. `cargando` bloquea el botón y muestra el giro. */
  estado?: BotonEstado;
  cargando?: boolean;
  alHacerClick?: MouseEventHandler<HTMLButtonElement>;
  iconoIzquierda?: ReactNode;
  iconoDerecha?: ReactNode;
  soloIcono?: boolean;
  /** Alternativa a `children` cuando el texto cambia según el estado. */
  texto?: ReactNode;
  textoCargando?: ReactNode;
  textoExito?: ReactNode;
  textoError?: ReactNode;
  anchoCompleto?: boolean;
  fullWidth?: boolean;
  sx?: PropSx;
}

/** Botón de acción. */
export const UiBoton = forwardRef<HTMLButtonElement, BotonProps>(function UiBoton(
  { variante = 'primario', tamano = 'md', forma = 'cuadrado', estado = 'inactivo',
    cargando, alHacerClick, iconoIzquierda, iconoDerecha, soloIcono,
    texto, textoCargando, textoExito, textoError, anchoCompleto, fullWidth,
    sx, className, style, children, disabled, type = 'button', ...resto },
  ref,
) {
  const enCurso = cargando || estado === 'cargando';
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  const contenido =
    enCurso && textoCargando ? textoCargando
    : estado === 'exito' && textoExito ? textoExito
    : estado === 'error' && textoError ? textoError
    : (children ?? texto);

  return (
    <button
      ref={ref}
      type={type}
      data-variante={variante}
      data-tamano={tamano}
      data-forma={forma}
      data-estado={estado !== 'inactivo' ? estado : undefined}
      disabled={disabled || enCurso}
      aria-busy={enCurso || undefined}
      onClick={alHacerClick}
      className={clases(
        css.boton,
        soloIcono && css.soloIcono,
        (anchoCompleto || fullWidth) && css.anchoCompleto,
        cUsuario,
        className,
      )}
      style={{ ...sUsuario, ...style }}
      {...resto}
    >
      {/* El giro se superpone en lugar de reemplazar el contenido: así el
          botón no cambia de ancho al empezar a cargar y la fila no salta. */}
      {enCurso && <span className={css.giro} aria-hidden />}
      <span className={clases(css.cuerpo, enCurso && css.cuerpoOculto)}>
        {iconoIzquierda && <span className={css.icono}>{iconoIzquierda}</span>}
        {contenido != null && contenido !== '' && <span className={css.texto}>{contenido}</span>}
        {iconoDerecha && <span className={css.icono}>{iconoDerecha}</span>}
      </span>
    </button>
  );
});
