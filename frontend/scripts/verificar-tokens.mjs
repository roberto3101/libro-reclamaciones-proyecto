/**
 * Verificador del sistema de tokens.
 *
 * Comprueba dos cosas que a ojo se escapan y en producción se notan:
 *
 *   1. SIMETRÍA — todo token de color definido en un tema debe existir en
 *      el otro. Un token que falta hace que `var(--x)` no resuelva, la
 *      declaración se descarta y el elemento hereda un color cualquiera.
 *      Así es como algo "se ve en oscuro y desaparece en claro".
 *
 *   2. CONTRASTE — cada par texto/fondo que la interfaz usa de verdad se
 *      mide contra WCAG 2.1. No basta con que el color exista: tiene que
 *      leerse.
 *
 * Uso:  node scripts/verificar-tokens.mjs
 * Sale con código 1 si algo falla, para poder encadenarlo al build.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(aqui, '..', 'src', 'ui', 'tokens.css'), 'utf8');

/* ── Extracción de los bloques ──────────────────────────────────────── */

/** Devuelve el cuerpo del primer bloque cuyo selector cumpla `prueba`. */
function bloques(css) {
  const salida = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) salida.push({ selector: m[1].trim(), cuerpo: m[2] });
  return salida;
}

function propiedades(cuerpo) {
  const mapa = new Map();
  const re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(cuerpo))) mapa.set(m[1], m[2].trim());
  return mapa;
}

const todos = bloques(css);
const claro = new Map();
const oscuro = new Map();

for (const { selector, cuerpo } of todos) {
  const props = propiedades(cuerpo);
  if (!props.size) continue;
  const esOscuro = selector.includes('.dark') || selector.includes("data-tema='dark'");
  const destino = esOscuro ? oscuro : claro;
  for (const [k, v] of props) destino.set(k, v);
}

/* Los tokens de geometría y movimiento son intencionadamente comunes a
   los dos temas: se excluyen de la comprobación de simetría.          */
const COMUNES = /^--ui-(r|e|t)-|^--ui-(fuente|trans|z|barra-ancho)(-|$)/;

/* ── 1. Simetría ────────────────────────────────────────────────────── */

const soloClaro = [...claro.keys()].filter((k) => !COMUNES.test(k) && !oscuro.has(k));
const soloOscuro = [...oscuro.keys()].filter((k) => !COMUNES.test(k) && !claro.has(k));

/* ── 2. Contraste ───────────────────────────────────────────────────── */

function aRgb(valor, mapa, profundidad = 0) {
  if (profundidad > 5) return null;
  const v = valor.trim();

  const ref = v.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
  if (ref) return mapa.has(ref[1]) ? aRgb(mapa.get(ref[1]), mapa, profundidad + 1) : null;

  const hex = v.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];

  return null;
}

/** Luminancia relativa según WCAG 2.1. */
function luminancia([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(a, b) {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* Pares que la interfaz usa realmente.
   minimo 4.5 → texto corrido (WCAG AA)
   minimo 3.0 → texto grande, iconos y elementos de interfaz (AA)      */
const PARES = [
  ['--ui-texto', '--ui-fondo', 4.5],
  ['--ui-texto', '--ui-superficie', 4.5],
  ['--ui-texto', '--ui-superficie-2', 4.5],
  ['--ui-texto', '--ui-superficie-hundida', 4.5],
  ['--ui-texto', '--ui-superficie-elevada', 4.5],
  ['--ui-texto-2', '--ui-superficie', 4.5],
  ['--ui-texto-2', '--ui-fondo', 4.5],
  /* texto-3 se usa en descripciones reales de 11-12px, no solo en
     adornos, asi que se le exige el minimo de texto normal. Con 3.0 pasaba
     la comprobacion y en pantalla se quedaba en 4.2:1. */
  ['--ui-texto-3', '--ui-superficie', 4.5],
  ['--ui-texto-3', '--ui-fondo', 4.5],
  ['--ui-texto-desactivado', '--ui-superficie', 2.2],

  /* Estos pares llevan TEXTO encima (la etiqueta de un botón), no un icono
     ni un borde, así que el mínimo es 4.5 y no el 3.0 de los elementos de
     interfaz. Con 3.0 el azul del tema oscuro pasaba la comprobación y el
     texto blanco de los botones se quedaba en 3.68:1 en pantalla. */
  ['--ui-primario-sobre', '--ui-primario', 4.5],
  ['--ui-exito-sobre', '--ui-exito', 4.5],
  ['--ui-adv-sobre', '--ui-adv', 4.5],
  ['--ui-peligro-sobre', '--ui-peligro', 4.5],
  ['--ui-info-sobre', '--ui-info', 4.5],
  /* Y el relleno tiene que distinguirse de la superficie donde se apoya,
     o el botón se pierde sobre la tarjeta. */
  ['--ui-primario', '--ui-superficie', 2.5],
  ['--ui-peligro', '--ui-superficie', 2.5],

  ['--ui-primario-texto', '--ui-superficie', 4.5],
  ['--ui-primario-texto', '--ui-primario-suave', 4.5],
  ['--ui-exito-texto', '--ui-exito-suave', 4.5],
  ['--ui-exito-texto-2', '--ui-exito-suave', 4.5],
  ['--ui-adv-texto', '--ui-adv-suave', 4.5],
  ['--ui-peligro-texto', '--ui-peligro-suave', 4.5],
  ['--ui-info-texto', '--ui-info-suave', 4.5],
  ['--ui-acento-sobre', '--ui-acento', 4.5],
  ['--ui-acento-texto', '--ui-superficie', 4.5],
  ['--ui-acento-texto', '--ui-acento-suave', 4.5],

  ['--ui-borde', '--ui-superficie', 1.15],
  ['--ui-borde-fuerte', '--ui-superficie', 1.6],
];

function medir(mapa, nombreTema) {
  const fallos = [];
  const filas = [];
  for (const [frente, fondo, minimo] of PARES) {
    const a = mapa.has(frente) ? aRgb(mapa.get(frente), mapa) : null;
    const b = mapa.has(fondo) ? aRgb(mapa.get(fondo), mapa) : null;
    if (!a || !b) {
      fallos.push(`${nombreTema}: no se pudo resolver ${frente} sobre ${fondo}`);
      continue;
    }
    const r = contraste(a, b);
    const ok = r >= minimo;
    filas.push({ frente, fondo, r, minimo, ok });
    if (!ok) {
      fallos.push(
        `${nombreTema}: ${frente} sobre ${fondo} = ${r.toFixed(2)}:1 (mínimo ${minimo}:1)`,
      );
    }
  }
  return { fallos, filas };
}

/* ── Informe ────────────────────────────────────────────────────────── */

let errores = 0;

console.log('\n── Simetría de tokens ─────────────────────────────────────');
if (soloClaro.length === 0 && soloOscuro.length === 0) {
  const n = [...claro.keys()].filter((k) => !COMUNES.test(k)).length;
  console.log(`   OK  ${n} tokens de color definidos en los dos temas.`);
} else {
  errores += soloClaro.length + soloOscuro.length;
  for (const k of soloClaro) console.log(`   FALLO  ${k} existe en claro pero NO en oscuro`);
  for (const k of soloOscuro) console.log(`   FALLO  ${k} existe en oscuro pero NO en claro`);
}

for (const [tema, mapa] of [['claro', claro], ['oscuro', oscuro]]) {
  const { fallos, filas } = medir(mapa, tema);
  console.log(`\n── Contraste · tema ${tema} ───────────────────────────────`);
  for (const f of filas) {
    const marca = f.ok ? 'OK  ' : 'BAJO';
    const par = `${f.frente.replace('--ui-', '')} sobre ${f.fondo.replace('--ui-', '')}`;
    console.log(`   ${marca} ${par.padEnd(46)} ${f.r.toFixed(2).padStart(6)}:1  (min ${f.minimo})`);
  }
  errores += fallos.length;
}

console.log('');
if (errores) {
  console.log(`RESULTADO: ${errores} problema(s). El sistema de tokens NO pasa.\n`);
  process.exit(1);
}
console.log('RESULTADO: sistema de tokens correcto.\n');
