/**
 * Utilidades de color para los casos en los que el tono NO lo decide el
 * sistema de diseño, sino cada empresa.
 *
 * El libro público se pinta con el color de marca que el cliente guarda en
 * su configuración. Ese color puede ser cualquiera: un azul oscuro se lee
 * bien sobre fondo claro y desaparece sobre fondo oscuro, y al revés. Como
 * no se puede elegir por él, se ajusta: se mantiene el tono y se mueve la
 * luminosidad lo justo para alcanzar el contraste mínimo.
 */

export type Rgb = [number, number, number];

/** Acepta '#abc', '#aabbcc' y 'rgb(a, b, c)'. Devuelve null si no lo entiende. */
export function aRgb(valor: string): Rgb | null {
  const v = valor.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return null;
}

const aHex = ([r, g, b]: Rgb) =>
  '#' + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');

/** Luminancia relativa (WCAG 2.1). */
export function luminancia([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Relación de contraste entre dos colores, de 1 a 21. */
export function contraste(a: Rgb, b: Rgb): number {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Blanco o casi negro, el que mejor se lea sobre `fondo`. */
export function textoSobre(fondo: string | Rgb): string {
  const c = typeof fondo === 'string' ? aRgb(fondo) : fondo;
  if (!c) return '#fffefb';
  return contraste([255, 255, 255], c) >= contraste([16, 24, 40], c) ? '#fffefb' : '#101828';
}

/** Mezcla lineal entre dos colores. `t` va de 0 (a) a 1 (b). */
function mezclar(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Devuelve `marca` aclarado u oscurecido lo mínimo necesario para que se
 * lea sobre `fondo`.
 *
 * Se acerca al blanco si el fondo es oscuro y al negro si es claro, en
 * pasos pequeños, y se queda en el primero que cumple. Así un azul de
 * marca sigue siendo reconociblemente ese azul en vez de saltar a un color
 * del sistema. Si ni el extremo alcanza el mínimo (marcas muy saturadas
 * sobre fondos intermedios), devuelve el extremo, que es lo más legible
 * disponible.
 */
export function colorLegible(marca: string, fondo: string, minimo = 4.5): string {
  const m = aRgb(marca);
  const f = aRgb(fondo);
  if (!m || !f) return marca;
  if (contraste(m, f) >= minimo) return marca;

  const destino: Rgb = luminancia(f) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mezclar(m, destino, t);
    if (contraste(c, f) >= minimo) return aHex(c);
  }
  return aHex(destino);
}

/** Lee un token del elemento raíz. Útil para conocer la superficie actual. */
export function tokenActual(nombre: string, reserva = '#fffefb'): string {
  if (typeof document === 'undefined') return reserva;
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || reserva;
}
