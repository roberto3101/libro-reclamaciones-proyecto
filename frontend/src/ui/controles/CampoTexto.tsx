import {
  forwardRef, useId,
  type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes,
  type ChangeEventHandler, type FocusEventHandler,
} from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './CampoTexto.module.css';

type BaseInput = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'disabled' | 'readOnly' | 'placeholder' | 'type' | 'onFocus' | 'onBlur' | 'size'
>;

export interface CampoTextoProps extends BaseInput {
  etiqueta?: ReactNode;
  textoAyuda?: ReactNode;
  valor?: unknown;
  /* Se usan los alias de React (ChangeEventHandler…) y no una firma escrita
     a mano. React los declara con un truco que los hace bivariantes, y eso
     es lo que permite pasar un manejador tipado solo para <input> a un
     campo que también admite <textarea>. Con una firma propia, TypeScript
     aplicaría contravarianza y rechazaría la mitad de las llamadas. */
  alCambiar?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  deshabilitado?: boolean;
  soloLectura?: boolean;
  error?: boolean;
  /** Sustituye al texto de ayuda cuando hay error. */
  mensajeError?: ReactNode;
  multilinea?: boolean;
  filas?: number | string;
  filasMinimas?: number | string;
  filasMaximas?: number | string;
  marcador?: string;
  anchoCompleto?: boolean;
  tipo?: InputHTMLAttributes<unknown>['type'];
  iconoInicio?: ReactNode;
  iconoFin?: ReactNode;
  alEnfocar?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  alDesenfocar?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  /** Atributos nativos para el control (maxLength, inputMode, pattern…). */
  inputProps?: InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>;
  contenedorProps?: Record<string, unknown>;
  sx?: PropSx;
}

/** Campo de texto de una o varias líneas. */
export const UiCampoTexto = forwardRef<HTMLInputElement, CampoTextoProps>(function UiCampoTexto(
  { etiqueta, textoAyuda, valor, alCambiar, deshabilitado, soloLectura, error, mensajeError,
    multilinea, filas, filasMinimas, filasMaximas, marcador, anchoCompleto = true, tipo = 'text',
    iconoInicio, iconoFin, alEnfocar, alDesenfocar, inputProps, contenedorProps,
    sx, className, style, id, required, ...resto },
  ref,
) {
  const auto = useId();
  const idCampo = id ?? `campo-${auto}`;
  const idAyuda = `${idCampo}-ayuda`;

  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const pie = error && mensajeError ? mensajeError : textoAyuda;

  const comunes = {
    id: idCampo,
    value: (valor ?? '') as string | number,
    onChange: alCambiar,
    onFocus: alEnfocar,
    onBlur: alDesenfocar,
    disabled: deshabilitado,
    readOnly: soloLectura,
    placeholder: marcador,
    required,
    'aria-invalid': error || undefined,
    'aria-describedby': pie ? idAyuda : undefined,
    className: css.entrada,
  };

  return (
    <div
      className={clases(css.campo, anchoCompleto && css.anchoCompleto, cUsuario, className)}
      style={{ ...sUsuario, ...style }}
      data-error={error || undefined}
      data-deshabilitado={deshabilitado || undefined}
      {...contenedorProps}
    >
      {etiqueta && (
        <label className={css.etiqueta} htmlFor={idCampo}>
          {etiqueta}
          {required && <span className={css.requerido} aria-hidden> *</span>}
        </label>
      )}

      <div className={css.marco}>
        {iconoInicio && <span className={clases(css.icono, css.iconoInicio)}>{iconoInicio}</span>}

        {multilinea ? (
          <textarea
            {...comunes}
            ref={ref as unknown as React.Ref<HTMLTextAreaElement>}
            rows={Number(filas ?? filasMinimas ?? 3)}
            style={filasMaximas ? { maxHeight: `calc(${Number(filasMaximas)} * 1.5em + 20px)` } : undefined}
            {...(resto as object)}
            {...inputProps}
          />
        ) : (
          <input {...comunes} ref={ref} type={tipo} {...resto} {...inputProps} />
        )}

        {iconoFin && <span className={clases(css.icono, css.iconoFin)}>{iconoFin}</span>}
      </div>

      {pie && (
        <p id={idAyuda} className={clases(css.ayuda, error && css.ayudaError)}>
          {pie}
        </p>
      )}
    </div>
  );
});
