import {
  forwardRef, useEffect, useId, useMemo, useRef, useState,
  type ChangeEvent, type ReactNode,
} from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Selector.module.css';

export interface SelectorOpcion {
  valor: string | number;
  etiqueta: string;
  deshabilitado?: boolean;
}

/** Evento de cambio. Estructura mínima para que valga a los dos motores. */
export type EventoSelector = {
  target: { value: string; name?: string };
};

export interface SelectorProps {
  etiqueta?: string;
  opciones?: SelectorOpcion[];
  value?: unknown;
  alCambiar?: (e: EventoSelector) => void;
  onChange?: (e: EventoSelector) => void;
  textoAyuda?: ReactNode;
  marcador?: string;
  mensajeError?: string;
  error?: boolean;
  disabled?: boolean;
  deshabilitado?: boolean;
  required?: boolean;
  anchoCompleto?: boolean;
  /** Añade un filtro de texto. Útil a partir de ~15 opciones. */
  buscable?: boolean;
  name?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
}

/** Lista desplegable de opción única. */
export const UiSelector = forwardRef<HTMLDivElement, SelectorProps>(function UiSelector(
  { etiqueta, opciones = [], value, alCambiar, onChange, textoAyuda, marcador,
    mensajeError, error, disabled, deshabilitado, required, anchoCompleto = true,
    buscable, name, id, className, style, sx },
  ref,
) {
  const auto = useId();
  const idCampo = id ?? `sel-${auto}`;
  const idAyuda = `${idCampo}-ayuda`;
  const inhabilitado = disabled || deshabilitado;
  const hayError = error || !!mensajeError;
  const pie = mensajeError || textoAyuda;

  const { style: sUsuario, className: cUsuario } = convertirSx(sx);
  const emitir = (v: string) => {
    const evento: EventoSelector = { target: { value: v, name } };
    alCambiar?.(evento);
    onChange?.(evento);
  };

  const envoltura = (contenido: ReactNode) => (
    <div
      ref={ref}
      className={clases(css.campo, anchoCompleto && css.anchoCompleto, cUsuario, className)}
      style={{ ...sUsuario, ...style }}
      data-error={hayError || undefined}
      data-deshabilitado={inhabilitado || undefined}
    >
      {etiqueta && (
        <label className={css.etiqueta} htmlFor={idCampo}>
          {etiqueta}
          {required && <span className={css.requerido} aria-hidden> *</span>}
        </label>
      )}
      {contenido}
      {pie && (
        <p id={idAyuda} className={clases(css.ayuda, hayError && css.ayudaError)}>
          {pie}
        </p>
      )}
    </div>
  );

  /* Caso normal: select nativo. Gana en accesibilidad y, sobre todo, en
     móvil, donde el sistema abre su propio selector a pantalla completa.
     El marco se estiliza igual que el buscable para que no se note. */
  if (!buscable) {
    const actual = String(value ?? '');
    /* Si el valor no coincide con ninguna opción hay que ofrecer una vacía
       SIEMPRE, aunque no se haya pasado marcador. Sin ella el navegador
       muestra la primera opción como elegida mientras el estado sigue en
       blanco: el usuario lee "DNI", envía, y el formulario le responde
       "selecciona un tipo". */
    const coincide = opciones.some((o) => String(o.valor) === actual);
    const necesitaVacia = marcador !== undefined || !coincide;

    return envoltura(
      <div className={css.marco}>
        <select
          id={idCampo}
          name={name}
          className={css.nativo}
          value={coincide ? actual : ''}
          disabled={inhabilitado}
          required={required}
          aria-invalid={hayError || undefined}
          aria-describedby={pie ? idAyuda : undefined}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => emitir(e.target.value)}
        >
          {necesitaVacia && (
            <option value="" disabled={required}>
              {marcador ?? ''}
            </option>
          )}
          {opciones.map((o) => (
            <option key={String(o.valor)} value={String(o.valor)} disabled={o.deshabilitado}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <span className={css.flecha} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>,
    );
  }

  return envoltura(
    <SelectorBuscable
      idCampo={idCampo}
      idAyuda={pie ? idAyuda : undefined}
      opciones={opciones}
      value={value}
      marcador={marcador}
      inhabilitado={inhabilitado}
      hayError={hayError}
      alElegir={emitir}
    />,
  );
});

/* ── Variante con filtro ────────────────────────────────────────────── */

function SelectorBuscable({
  idCampo, idAyuda, opciones, value, marcador, inhabilitado, hayError, alElegir,
}: {
  idCampo: string;
  idAyuda?: string;
  opciones: SelectorOpcion[];
  value: unknown;
  marcador?: string;
  inhabilitado?: boolean;
  hayError?: boolean;
  alElegir: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const seleccionada = opciones.find((o) => String(o.valor) === String(value ?? ''));

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q ? opciones.filter((o) => o.etiqueta.toLowerCase().includes(q)) : opciones;
  }, [filtro, opciones]);

  // Cerrar al pulsar fuera; sin esto la lista se queda abierta al navegar.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  useEffect(() => {
    if (abierto) {
      setFiltro('');
      setResaltado(0);
      campo.current?.focus();
    }
  }, [abierto]);

  const elegir = (o: SelectorOpcion) => {
    if (o.deshabilitado) return;
    alElegir(String(o.valor));
    setAbierto(false);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return setAbierto(true);
      setResaltado((i) => {
        const n = visibles.length;
        if (!n) return 0;
        return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      });
    } else if (e.key === 'Enter') {
      if (abierto && visibles[resaltado]) {
        e.preventDefault();
        elegir(visibles[resaltado]);
      }
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div className={css.buscable} ref={caja}>
      <div
        className={css.marco}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${idCampo}-lista`}
        aria-haspopup="listbox"
        aria-describedby={idAyuda}
        aria-invalid={hayError || undefined}
        tabIndex={inhabilitado ? -1 : 0}
        onClick={() => !inhabilitado && setAbierto((v) => !v)}
        onKeyDown={teclas}
      >
        {abierto ? (
          <input
            ref={campo}
            id={idCampo}
            className={css.nativo}
            value={filtro}
            placeholder="Escribe para filtrar…"
            onChange={(e) => {
              setFiltro(e.target.value);
              setResaltado(0);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={clases(css.valor, !seleccionada && css.marcador)}>
            {seleccionada?.etiqueta ?? marcador ?? ''}
          </span>
        )}
        <span className={css.flecha} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {abierto && (
        <ul className={css.lista} id={`${idCampo}-lista`} role="listbox">
          {visibles.length === 0 && <li className={css.vacio}>Sin coincidencias</li>}
          {visibles.map((o, i) => (
            <li
              key={String(o.valor)}
              role="option"
              aria-selected={String(o.valor) === String(value ?? '')}
              data-resaltado={i === resaltado || undefined}
              data-deshabilitado={o.deshabilitado || undefined}
              className={css.opcion}
              onMouseEnter={() => setResaltado(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o)}
            >
              {o.etiqueta}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
