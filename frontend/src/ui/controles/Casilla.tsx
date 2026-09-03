import { forwardRef, useEffect, useId, useRef, type ReactNode, type ChangeEvent } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Casilla.module.css';

export type CasillaTamano = 'p' | 'm' | 'g';
export type CasillaColor = 'primario' | 'secundario' | 'exito' | 'error' | 'info' | 'advertencia';

export interface CasillaProps {
  etiqueta?: ReactNode;
  posicionEtiqueta?: 'derecha' | 'izquierda' | 'arriba' | 'abajo';
  seleccionado?: boolean;
  /** Tercer estado visual: ni marcado ni vacío. */
  indeterminado?: boolean;
  deshabilitado?: boolean;
  soloLectura?: boolean;
  requerido?: boolean;
  error?: boolean;
  tamano?: CasillaTamano;
  color?: CasillaColor;
  alCambiar?: (evento: ChangeEvent<HTMLInputElement>, seleccionado: boolean) => void;
  name?: string;
  id?: string;
  className?: string;
  sx?: PropSx;
}

export const UiCasilla = forwardRef<HTMLInputElement, CasillaProps>(function UiCasilla(
  { etiqueta, posicionEtiqueta = 'derecha', seleccionado, indeterminado, deshabilitado,
    soloLectura, requerido, error, tamano = 'm', color = 'primario', alCambiar,
    name, id, className, sx },
  ref,
) {
  const auto = useId();
  const idCampo = id ?? `casilla-${auto}`;
  const interno = useRef<HTMLInputElement>(null);
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  // `indeterminate` no es un atributo HTML: solo existe como propiedad del
  // elemento, así que hay que fijarlo desde JavaScript.
  useEffect(() => {
    if (interno.current) interno.current.indeterminate = !!indeterminado;
  }, [indeterminado]);

  return (
    <label
      className={clases(css.envoltura, css[`pos_${posicionEtiqueta}`], cUsuario, className)}
      style={sUsuario}
      data-deshabilitado={deshabilitado || undefined}
      data-error={error || undefined}
      data-tamano={tamano}
      data-color={color}
    >
      <span className={css.control}>
        <input
          ref={(n) => {
            interno.current = n;
            if (typeof ref === 'function') ref(n);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = n;
          }}
          id={idCampo}
          name={name}
          type="checkbox"
          className={css.entrada}
          checked={!!seleccionado}
          disabled={deshabilitado}
          required={requerido}
          aria-invalid={error || undefined}
          onChange={(e) => {
            if (soloLectura) {
              e.preventDefault();
              return;
            }
            alCambiar?.(e, e.target.checked);
          }}
        />
        <span className={css.marca} aria-hidden>
          {indeterminado ? (
            <svg viewBox="0 0 16 16" width="100%" height="100%">
              <path d="M4 8h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="100%" height="100%">
              <path
                d="M3.5 8.5l3 3 6-6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </span>
      {etiqueta && (
        <span className={css.etiqueta}>
          {etiqueta}
          {requerido && <span className={css.requerido} aria-hidden> *</span>}
        </span>
      )}
    </label>
  );
});
