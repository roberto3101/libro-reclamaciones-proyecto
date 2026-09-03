import { forwardRef, useId, type ReactNode, type ChangeEvent } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Interruptor.module.css';

export type InterruptorColor = 'primario' | 'secundario' | 'exito' | 'error' | 'advertencia' | 'info';
export type InterruptorTamano = 'pequeno' | 'mediano';

export interface InterruptorProps {
  etiqueta?: ReactNode;
  posicionEtiqueta?: 'inicio' | 'fin' | 'arriba' | 'abajo';
  tamano?: InterruptorTamano;
  seleccionado?: boolean;
  porDefectoSeleccionado?: boolean;
  alCambiar?: (evento: ChangeEvent<HTMLInputElement>, seleccionado: boolean) => void;
  color?: InterruptorColor;
  deshabilitado?: boolean;
  error?: boolean;
  mensajeError?: string;
  name?: string;
  id?: string;
  className?: string;
  sx?: PropSx;
}

/** Conmutador de encendido/apagado. Aplica el cambio al instante. */
export const UiInterruptor = forwardRef<HTMLInputElement, InterruptorProps>(function UiInterruptor(
  { etiqueta, posicionEtiqueta = 'fin', tamano = 'mediano', seleccionado, porDefectoSeleccionado,
    alCambiar, color = 'primario', deshabilitado, error, mensajeError, name, id, className, sx },
  ref,
) {
  const auto = useId();
  const idCampo = id ?? `int-${auto}`;
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  return (
    <span className={css.bloque}>
      <label
        className={clases(css.envoltura, css[`pos_${posicionEtiqueta}`], cUsuario, className)}
        style={sUsuario}
        data-deshabilitado={deshabilitado || undefined}
        data-tamano={tamano}
        data-color={color}
      >
        <span className={css.pista}>
          <input
            ref={ref}
            id={idCampo}
            name={name}
            type="checkbox"
            role="switch"
            className={css.entrada}
            checked={seleccionado}
            defaultChecked={seleccionado === undefined ? porDefectoSeleccionado : undefined}
            disabled={deshabilitado}
            aria-invalid={error || undefined}
            onChange={(e) => alCambiar?.(e, e.target.checked)}
          />
          <span className={css.pulgar} aria-hidden />
        </span>
        {etiqueta && <span className={css.etiqueta}>{etiqueta}</span>}
      </label>
      {error && mensajeError && <p className={css.error}>{mensajeError}</p>}
    </span>
  );
});
