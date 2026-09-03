import { forwardRef, useId, type ReactNode } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
// Reutiliza el aspecto del campo de texto para que ambos sean el mismo
// control a ojos del usuario; aquí solo se añaden los incrementos.
import campo from './CampoTexto.module.css';
import css from './CampoNumero.module.css';

export type CampoNumeroAlineacion = 'izquierda' | 'centro' | 'derecha';

export interface CampoNumeroProps {
  etiqueta?: ReactNode;
  textoAyuda?: ReactNode;
  minimo?: number;
  maximo?: number;
  paso?: number;
  valor?: number | null;
  valorPorDefecto?: number;
  alineacion?: CampoNumeroAlineacion;
  mostrarControles?: boolean;
  error?: boolean;
  mensajeError?: ReactNode;
  deshabilitado?: boolean;
  soloLectura?: boolean;
  anchoCompleto?: boolean;
  requerido?: boolean;
  marcador?: string;
  name?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
  alCambiar?: (valor: number | null) => void;
}

/** Campo numérico con incrementos opcionales. */
export const UiCampoNumero = forwardRef<HTMLInputElement, CampoNumeroProps>(function UiCampoNumero(
  { etiqueta, textoAyuda, minimo, maximo, paso = 1, valor, valorPorDefecto, alineacion = 'izquierda',
    mostrarControles = true, error, mensajeError, deshabilitado, soloLectura, anchoCompleto = true,
    requerido, marcador, name, id, className, style, sx, alCambiar },
  ref,
) {
  const auto = useId();
  const idCampo = id ?? `num-${auto}`;
  const idAyuda = `${idCampo}-ayuda`;
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const pie = error && mensajeError ? mensajeError : textoAyuda;

  const limitar = (n: number) => {
    if (minimo !== undefined && n < minimo) return minimo;
    if (maximo !== undefined && n > maximo) return maximo;
    return n;
  };

  const actual = valor ?? valorPorDefecto ?? null;

  const mover = (signo: 1 | -1) => {
    if (deshabilitado || soloLectura) return;
    // Sin valor previo se arranca desde el mínimo si lo hay, no desde cero:
    // en un campo que empieza en 5, el primer clic debe dar 5, no 1.
    const base = actual ?? (signo === 1 ? (minimo ?? 0) - paso : (minimo ?? 0));
    alCambiar?.(limitar(base + signo * paso));
  };

  const topeMin = actual !== null && minimo !== undefined && actual <= minimo;
  const topeMax = actual !== null && maximo !== undefined && actual >= maximo;

  return (
    <div
      className={clases(campo.campo, anchoCompleto && campo.anchoCompleto, cUsuario, className)}
      style={{ ...sUsuario, ...style }}
      data-error={error || undefined}
      data-deshabilitado={deshabilitado || undefined}
    >
      {etiqueta && (
        <label className={campo.etiqueta} htmlFor={idCampo}>
          {etiqueta}
          {requerido && <span className={campo.requerido} aria-hidden> *</span>}
        </label>
      )}

      <div className={campo.marco}>
        <input
          ref={ref}
          id={idCampo}
          name={name}
          type="number"
          inputMode="decimal"
          className={clases(campo.entrada, css[`al_${alineacion}`])}
          value={actual ?? ''}
          min={minimo}
          max={maximo}
          step={paso}
          placeholder={marcador}
          disabled={deshabilitado}
          readOnly={soloLectura}
          required={requerido}
          aria-invalid={error || undefined}
          aria-describedby={pie ? idAyuda : undefined}
          onChange={(e) => {
            const t = e.target.value;
            alCambiar?.(t === '' ? null : limitar(Number(t)));
          }}
        />

        {mostrarControles && !soloLectura && (
          <span className={css.controles}>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Aumentar"
              className={css.paso}
              disabled={deshabilitado || topeMax}
              onClick={() => mover(1)}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Disminuir"
              className={css.paso}
              disabled={deshabilitado || topeMin}
              onClick={() => mover(-1)}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
        )}
      </div>

      {pie && (
        <p id={idAyuda} className={clases(campo.ayuda, error && campo.ayudaError)}>
          {pie}
        </p>
      )}
    </div>
  );
});
