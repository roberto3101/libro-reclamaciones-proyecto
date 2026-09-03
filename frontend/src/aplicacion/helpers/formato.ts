import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatoFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  try {
    // aFechaLocal corrige las fechas de calendario que el API manda como
    // medianoche UTC; parseISO por si solo las desplazaba un dia.
    const f = aFechaLocal(fecha);
    return f ? format(f, 'dd/MM/yyyy', { locale: es }) : fecha;
  } catch {
    return fecha;
  }
}

export function formatoFechaHora(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  try {
    return format(parseISO(fecha), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch {
    return fecha;
  }
}

export function formatoRelativo(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  try {
    return formatDistanceToNow(parseISO(fecha), { addSuffix: true, locale: es });
  } catch {
    return fecha;
  }
}

export function formatoMoneda(monto: number | null | undefined): string {
  if (monto == null) return 'S/ 0.00';
  const num = Number(monto);
  if (isNaN(num)) return 'S/ 0.00';
  return `S/ ${num.toFixed(2)}`;
}

export function truncar(texto: string, max = 50): string {
  return texto.length > max ? `${texto.substring(0, max)}...` : texto;
}

/**
 * Convierte un valor del API en Date respetando la zona horaria local.
 *
 * `new Date('2026-08-30')` NO da el 30 de agosto: la norma manda
 * interpretar una fecha sin hora como medianoche UTC, y al mostrarla en
 * Perú (UTC-5) retrocede al 29. Por eso una fecha de incidente aparecia
 * un dia antes de la que el consumidor habia escrito.
 *
 * Las marcas de tiempo completas (con hora o zona) si llevan el instante
 * exacto, y esas se dejan como estan.
 */
export function aFechaLocal(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const v = valor.trim();

  // "2026-08-30"
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (soloFecha) {
    const [, a, m, d] = soloFecha;
    return new Date(Number(a), Number(m) - 1, Number(d));
  }

  /* "2026-08-30T00:00:00Z" - asi serializa Go las columnas DATE: les pone
     medianoche UTC. No es un instante, es un dia del calendario. Tratarlo
     como instante hace que en Peru (UTC-5) retroceda al dia anterior, y el
     plazo legal de respuesta se muestre un dia antes del real.
     Medianoche UTC exacta solo la produce ese caso; una marca de tiempo de
     verdad (fecha_registro) trae horas y no entra por aqui. */
  const medianocheUtc = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?Z$/.exec(v);
  if (medianocheUtc) {
    const [, a, m, d] = medianocheUtc;
    return new Date(Number(a), Number(m) - 1, Number(d));
  }

  const f = new Date(v);
  return isNaN(f.getTime()) ? null : f;
}

/** Fecha en formato largo: "30 de agosto de 2026". */
export function formatoFechaLarga(valor: string | null | undefined): string {
  const f = aFechaLocal(valor);
  if (!f) return '—';
  return f.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Fecha corta local: "30/08/2026". */
export function formatoFechaCorta(valor: string | null | undefined): string {
  const f = aFechaLocal(valor);
  if (!f) return '—';
  return f.toLocaleDateString('es-PE');
}
