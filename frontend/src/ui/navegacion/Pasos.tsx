import { convertirSx, clases, type PropSx } from '../sx';
import css from './Pasos.module.css';

export interface Paso {
  etiqueta?: string;
  descripcion?: string;
  opcional?: boolean;
  error?: boolean;
  completado?: boolean;
  /** Alias en inglés, aceptados por compatibilidad. */
  label?: string;
  description?: string;
  optional?: boolean;
  completed?: boolean;
}

export interface PasosProps {
  pasos?: Paso[];
  /** Índice del paso en curso, empezando en 0. */
  pasoActivo: number;
  orientacion?: 'horizontal' | 'vertical';
  /**
   * Nombre del tono del sistema o un color propio (`#0f766e`), que es lo
   * que llega cuando la empresa tiene color de marca configurado.
   */
  color?: 'primario' | 'exito' | 'info' | 'primary' | 'success' | (string & {});
  className?: string;
  style?: React.CSSProperties;
  sx?: PropSx;
}

/**
 * Elige texto claro u oscuro para escribir sobre un color arbitrario.
 * Una marca clara con texto blanco encima sería ilegible, y el color lo
 * decide cada empresa, así que no se puede fijar de antemano.
 */
function textoSobre(fondo: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fondo.trim());
  if (!m) return '#fffefb';
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const canal = (i: number) => {
    const s = parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  // Se compara el contraste contra blanco y contra negro, y gana el mayor.
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? '#fffefb' : '#101828';
}

/** Indicador de avance por etapas. */
export function UiPasos({
  pasos = [], pasoActivo, orientacion = 'horizontal', color = 'primario',
  className, style, sx,
}: PasosProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  const propio = color?.startsWith('#');
  const tono = propio ? 'primario'
    : color === 'exito' || color === 'success' ? 'exito'
    : color === 'info' ? 'info'
    : 'primario';

  // Un color de marca se inyecta como variable local: el CSS sigue leyendo
  // los mismos tokens y no hace falta una rama aparte para este caso.
  const variables = propio
    ? ({ '--ui-paso-color': color, '--ui-paso-sobre': textoSobre(color!) } as React.CSSProperties)
    : undefined;

  return (
    <ol
      data-orientacion={orientacion}
      data-color={tono}
      className={clases(css.pasos, cUsuario, className)}
      style={{ ...variables, ...sUsuario, ...style }}
    >
      {pasos.map((p, i) => {
        const etiqueta = p.etiqueta ?? p.label ?? '';
        const descripcion = p.descripcion ?? p.description;
        const opcional = p.opcional ?? p.optional;
        const hecho = p.completado ?? p.completed ?? i < pasoActivo;
        const activo = i === pasoActivo;
        const estado = p.error ? 'error' : hecho ? 'hecho' : activo ? 'activo' : 'pendiente';

        return (
          <li
            key={i}
            className={css.paso}
            data-estado={estado}
            aria-current={activo ? 'step' : undefined}
          >
            <span className={css.marcador}>
              <span className={css.circulo}>
                {p.error ? (
                  '!'
                ) : hecho ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              {/* La línea la dibuja cada paso salvo el último, para que se
                  adapte sola al número de etapas. */}
              {i < pasos.length - 1 && <span className={css.linea} aria-hidden />}
            </span>

            <span className={css.textos}>
              <span className={css.etiqueta}>{etiqueta}</span>
              {opcional && <span className={css.opcional}>Opcional</span>}
              {descripcion && <span className={css.descripcion}>{descripcion}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
