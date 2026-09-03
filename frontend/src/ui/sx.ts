/**
 * Convertidor de `sx` a estilos nativos.
 *
 * La aplicación tiene ~400 usos de la prop `sx` heredados de MUI. Reescribir
 * todos a mano habría sido cambiar cientos de maquetaciones ya probadas, así
 * que los componentes de src/ui siguen aceptando `sx` y este módulo lo
 * traduce. Se respetan las convenciones de MUI para no alterar ni un píxel:
 *
 *   - espaciado numérico  ×8px   (m, p, gap y sus variantes)
 *   - borderRadius numérico ×4px
 *   - el resto de números los resuelve React (px o adimensional según la
 *     propiedad, que ya sabe distinguir `flex: 1` de `width: 200`)
 *
 * Lo plano se resuelve con `style` en línea. Lo que el atributo style no
 * puede expresar —`&:hover`, selectores descendientes, breakpoints— se emite
 * como CSS real en una hoja de estilos que se inyecta una sola vez y se
 * reutiliza por contenido, de modo que mil elementos con el mismo `sx`
 * comparten una única clase.
 */

import type { CSSProperties } from 'react';

export type ValorSx = string | number | undefined | null | Record<string, unknown>;
export type ObjetoSx = Record<string, unknown>;
export type PropSx = ObjetoSx | ObjetoSx[] | false | null | undefined;

/* ── Espaciado ──────────────────────────────────────────────────────── */

const ESPACIADO: Record<string, string[]> = {
  m: ['margin'],
  mt: ['marginTop'],
  mr: ['marginRight'],
  mb: ['marginBottom'],
  ml: ['marginLeft'],
  mx: ['marginLeft', 'marginRight'],
  my: ['marginTop', 'marginBottom'],
  p: ['padding'],
  pt: ['paddingTop'],
  pr: ['paddingRight'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
  gap: ['gap'],
  rowGap: ['rowGap'],
  columnGap: ['columnGap'],
};

/** Alias de MUI que no coinciden con el nombre real de la propiedad CSS. */
const ALIAS: Record<string, string> = {
  bgcolor: 'backgroundColor',
  backgroundColor: 'backgroundColor',
  borderColor: 'borderColor',
  boxShadow: 'boxShadow',
  zIndex: 'zIndex',
  typography: 'font',
};

/** Factor de espaciado de MUI. Cambiarlo desplazaría toda la interfaz. */
const UNIDAD = 8;
/** `shape.borderRadius` de MUI. */
const RADIO = 4;

/* ── Paleta ─────────────────────────────────────────────────────────── */

/**
 * Traduce las rutas de paleta de MUI a los tokens del sistema.
 * Sin esto, un `color: 'text.secondary'` llegaría al DOM tal cual y el
 * navegador lo descartaría por no ser un color válido.
 */
const PALETA: Record<string, string> = {
  'text.primary': 'var(--ui-texto)',
  'text.secondary': 'var(--ui-texto-2)',
  'text.tertiary': 'var(--ui-texto-3)',
  'text.disabled': 'var(--ui-texto-desactivado)',

  'primary.main': 'var(--ui-primario)',
  'primary.dark': 'var(--ui-primario-hover)',
  'primary.light': 'var(--ui-primario-suave)',
  'primary.50': 'var(--ui-primario-suave)',
  'primary.100': 'var(--ui-primario-suave-borde)',
  'primary.contrastText': 'var(--ui-primario-sobre)',

  'secondary.main': 'var(--ui-texto-2)',

  'success.main': 'var(--ui-exito)',
  'success.dark': 'var(--ui-exito-hover)',
  'success.light': 'var(--ui-exito-suave-2)',
  'success.contrastText': 'var(--ui-exito-sobre)',

  'error.main': 'var(--ui-peligro)',
  'error.dark': 'var(--ui-peligro-hover)',
  'error.light': 'var(--ui-peligro-suave-2)',
  'error.contrastText': 'var(--ui-peligro-sobre)',

  'warning.main': 'var(--ui-adv)',
  'warning.dark': 'var(--ui-adv-hover)',
  'warning.light': 'var(--ui-adv-suave)',
  'warning.contrastText': 'var(--ui-adv-sobre)',

  'info.main': 'var(--ui-info)',
  'info.dark': 'var(--ui-info-hover)',
  'info.light': 'var(--ui-info-suave-2)',
  'info.contrastText': 'var(--ui-info-sobre)',

  divider: 'var(--ui-borde)',
  'background.default': 'var(--ui-fondo)',
  'background.paper': 'var(--ui-superficie)',

  'action.hover': 'var(--ui-hover)',
  'action.selected': 'var(--ui-seleccionado)',
  'action.active': 'var(--ui-texto-2)',
  'action.disabled': 'var(--ui-texto-desactivado)',

  'grey.50': 'var(--ui-superficie-2)',
  'grey.100': 'var(--ui-superficie-hundida)',
  'grey.200': 'var(--ui-borde)',
  'grey.300': 'var(--ui-borde-fuerte)',
  'grey.500': 'var(--ui-texto-3)',
  'grey.700': 'var(--ui-texto-2)',
  'grey.900': 'var(--ui-texto)',
};

/**
 * Cuando un tono de la paleta se usa como color de TEXTO, el valor bueno
 * no es el mismo que como relleno.
 *
 * La aplicación escribe mucho `color: 'error.main'` sobre fondos suaves.
 * `error.main` es el rojo sólido, pensado para llevar texto blanco encima,
 * no para ser el texto: en tema oscuro eso daba 3.4:1 y las etiquetas de
 * estado de las tablas quedaban a medio leer. Aquí se redirige al tono
 * pensado para leerse, que sí contrasta contra las superficies suaves.
 */
const PALETA_TEXTO: Record<string, string> = {
  'primary.main': 'var(--ui-primario-texto)',
  'secondary.main': 'var(--ui-texto-2)',
  'success.main': 'var(--ui-exito-texto)',
  'error.main': 'var(--ui-peligro-texto)',
  'warning.main': 'var(--ui-adv-texto)',
  'info.main': 'var(--ui-info-texto)',
};

/** Propiedades cuyo valor es un color y por tanto admite rutas de paleta. */
const ES_COLOR = /color$/i;

function resolverValor(prop: string, valor: unknown): unknown {
  if (typeof valor === 'string') {
    // `color` es texto; `backgroundColor`, `borderColor`… son superficie.
    if (prop === 'color' && PALETA_TEXTO[valor]) return PALETA_TEXTO[valor];
    if (PALETA[valor]) return PALETA[valor];
    // `border: '1px solid divider'` y similares.
    if (ES_COLOR.test(prop) || prop === 'border' || prop.startsWith('border')) {
      return valor.replace(
        /\b([a-z]+\.[a-zA-Z0-9]+|divider)\b/g,
        (m) => PALETA[m] ?? m,
      );
    }
    return valor;
  }
  return valor;
}

/* ── Breakpoints ────────────────────────────────────────────────────── */

const BREAKPOINTS: Record<string, number> = { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 };
const esBreakpoint = (o: Record<string, unknown>) =>
  Object.keys(o).length > 0 && Object.keys(o).every((k) => k in BREAKPOINTS);

/* ── Hoja de estilos para lo que `style` no puede expresar ──────────── */

const cache = new Map<string, string>();
let hoja: CSSStyleSheet | null = null;
let contador = 0;

function obtenerHoja(): CSSStyleSheet | null {
  if (typeof document === 'undefined') return null;
  if (hoja) return hoja;
  const el = document.createElement('style');
  el.setAttribute('data-ui-sx', '');
  document.head.appendChild(el);
  hoja = el.sheet as CSSStyleSheet;
  return hoja;
}

function guion(prop: string): string {
  return prop.startsWith('--') ? prop : prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** Añade unidades como lo haría React: px salvo en propiedades adimensionales. */
const SIN_UNIDAD = new Set([
  'animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice',
  'borderImageWidth', 'boxFlex', 'boxOrdinalGroup', 'columnCount', 'columns', 'flex',
  'flexGrow', 'flexShrink', 'fontWeight', 'gridArea', 'gridColumn', 'gridColumnEnd',
  'gridColumnStart', 'gridRow', 'gridRowEnd', 'gridRowStart', 'lineHeight', 'opacity',
  'order', 'orphans', 'tabSize', 'widows', 'zIndex', 'zoom',
]);

function aCss(prop: string, valor: unknown): string {
  if (typeof valor === 'number' && !SIN_UNIDAD.has(prop)) return `${valor}px`;
  return String(valor);
}

function declaraciones(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${guion(k)}:${aCss(k, v)}`)
    .join(';');
}

/** Registra un bloque de reglas y devuelve la clase que las aplica. */
function registrar(reglas: { selector: string; media?: string; decl: Record<string, unknown> }[]): string {
  const cuerpo = reglas
    .map((r) => `${r.media ?? ''}|${r.selector}|${declaraciones(r.decl)}`)
    .join('||');
  const previa = cache.get(cuerpo);
  if (previa) return previa;

  const clase = `ui-sx-${contador++}`;
  cache.set(cuerpo, clase);

  const h = obtenerHoja();
  if (h) {
    for (const r of reglas) {
      const decl = declaraciones(r.decl);
      if (!decl) continue;
      const sel = r.selector.replace(/&/g, `.${clase}`);
      const texto = r.media ? `${r.media}{${sel}{${decl}}}` : `${sel}{${decl}}`;
      try {
        h.insertRule(texto, h.cssRules.length);
      } catch {
        /* Una regla mal formada no debe tumbar el render. */
      }
    }
  }
  return clase;
}

/* ── Conversión ─────────────────────────────────────────────────────── */

function aplanar(sx: PropSx): ObjetoSx {
  if (!sx) return {};
  if (Array.isArray(sx)) return sx.reduce<ObjetoSx>((a, s) => ({ ...a, ...aplanar(s) }), {});
  return sx;
}

export interface ResultadoSx {
  style: CSSProperties;
  className?: string;
}

/**
 * Traduce `sx` a `{ style, className }`.
 * `style` cubre el caso normal; `className` solo aparece si hubo selectores
 * anidados o breakpoints, que exigen CSS de verdad.
 */
export function convertirSx(sx: PropSx): ResultadoSx {
  const plano = aplanar(sx);
  if (!plano || Object.keys(plano).length === 0) return { style: {} };

  const style: Record<string, unknown> = {};
  const reglas: { selector: string; media?: string; decl: Record<string, unknown> }[] = [];
  const porMedia: Record<string, Record<string, unknown>> = {};

  const asignar = (destino: Record<string, unknown>, prop: string, valor: unknown) => {
    const objetivos = ESPACIADO[prop];
    if (objetivos) {
      const v = typeof valor === 'number' ? `${valor * UNIDAD}px` : valor;
      for (const o of objetivos) destino[o] = v;
      return;
    }
    if (prop === 'borderRadius' && typeof valor === 'number') {
      destino.borderRadius = `${valor * RADIO}px`;
      return;
    }
    const nombre = ALIAS[prop] ?? prop;
    destino[nombre] = resolverValor(nombre, valor);
  };

  for (const [prop, valor] of Object.entries(plano)) {
    if (valor === undefined || valor === null || valor === false) continue;

    // Selector anidado: '&:hover', '& .clase', '&.Mui-selected'…
    if (prop.startsWith('&') || prop.startsWith(':')) {
      const decl: Record<string, unknown> = {};
      for (const [p, v] of Object.entries(valor as ObjetoSx)) {
        if (v === undefined || v === null || v === false) continue;
        asignar(decl, p, v);
      }
      reglas.push({ selector: prop.startsWith('&') ? prop : `&${prop}`, decl });
      continue;
    }

    // Consulta de medios escrita a mano.
    if (prop.startsWith('@media')) {
      const decl: Record<string, unknown> = {};
      for (const [p, v] of Object.entries(valor as ObjetoSx)) asignar(decl, p, v);
      reglas.push({ selector: '&', media: prop, decl });
      continue;
    }

    /* Valor responsivo: { xs: 'columna', md: 'fila' }
       TODOS los escalones van a la hoja de estilos, incluido `xs`. Es
       tentador dejar `xs` en el atributo style por ser el caso base, pero
       un estilo en línea gana a cualquier regla con media query: el valor
       de móvil se quedaría clavado y `sm`/`md` no podrían sobrescribirlo
       nunca. Así se vio un botón con `width: {xs:'100%', sm:'auto'}`
       ocupando todo el ancho en escritorio y tapando el campo de al lado.
       Con todo en clases, la cascada vuelve a funcionar. */
    if (typeof valor === 'object' && !Array.isArray(valor) && esBreakpoint(valor as ObjetoSx)) {
      for (const [bp, v] of Object.entries(valor as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        const min = BREAKPOINTS[bp];
        const media = min === 0 ? '' : `@media (min-width:${min}px)`;
        porMedia[media] ??= {};
        asignar(porMedia[media], prop, v);
      }
      continue;
    }

    asignar(style, prop, valor);
  }

  /* Se emiten de menor a mayor min-width, con el escalón base (clave "")
     primero. Todas las reglas tienen la misma especificidad, así que quien
     gana es la última que aparece: el orden ascendente es lo que hace que
     `md` mande sobre `sm` y `sm` sobre el base. El objeto `sx` puede traer
     los escalones en cualquier orden, por eso no basta con recorrerlo. */
  const anchoDe = (media: string) => {
    const m = /min-width:(\d+)px/.exec(media);
    return m ? Number(m[1]) : 0;
  };
  for (const [media, decl] of Object.entries(porMedia).sort(
    ([a], [b]) => anchoDe(a) - anchoDe(b),
  )) {
    reglas.push({ selector: '&', media: media || undefined, decl });
  }

  const className = reglas.length ? registrar(reglas) : undefined;
  return { style: style as CSSProperties, className };
}

/** Une nombres de clase descartando los vacíos. */
export function clases(...xs: (string | false | null | undefined)[]): string | undefined {
  const l = xs.filter(Boolean) as string[];
  return l.length ? l.join(' ') : undefined;
}
