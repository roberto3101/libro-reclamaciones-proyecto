/* Auditor de contraste — HERRAMIENTA TEMPORAL DE PRUEBAS.
   Recorre el texto realmente pintado, calcula el fondo efectivo (subiendo
   por los ancestros y componiendo transparencias) y mide el contraste
   WCAG. Se borra al terminar la revisión; no debe llegar al repositorio. */
(function () {
  /* Tailwind v4 emite los colores en oklch() y MUI en rgb(). En vez de
     escribir un parser por espacio de color, se delega en el canvas, que
     normaliza cualquier color CSS válido a #rrggbb o rgba(). Sin esto los
     fondos de Tailwind se leían como "no reconocido", el auditor seguía
     subiendo por los ancestros y comparaba contra un fondo equivocado. */
  /* Conversión OKLCH → sRGB.
     Tailwind v4 emite todos sus colores en oklch() y Chrome los conserva
     así en getComputedStyle, sin normalizarlos a rgb(). Sin esta
     conversión el auditor no reconocía los fondos de Tailwind, seguía
     subiendo por los ancestros y comparaba el texto contra el fondo
     equivocado — dando fallos donde no los hay y, peor, ocultando los
     reales. La transformación es la estándar: OKLCH → OKLab → LMS →
     sRGB lineal → sRGB. */
  const oklchARgb = (L, C, H, alfa) => {
    const h = (H * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const aSrgb = (x) => {
      const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(v * 255)));
    };
    return [aSrgb(lin[0]), aSrgb(lin[1]), aSrgb(lin[2]), alfa];
  };

  const aRgb = (s) => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];

    let m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];

    m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }

    m = /oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)/i.exec(s);
    if (m) {
      const num = (v, escala) => (v.endsWith('%') ? parseFloat(v) / 100 * escala : parseFloat(v));
      return oklchARgb(num(m[1], 1), num(m[2], 0.4), parseFloat(m[3]),
        m[4] === undefined ? 1 : num(m[4], 1));
    }

    return null;
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const mez = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  /* Devuelve el color de fondo efectivo, o null si en el camino hay un
     degradado o una imagen: ahí el fondo no es un color único y medirlo
     como si lo fuera da falsos positivos (una insignia sobre un degradado
     naranja parecía blanco sobre blanco). */
  const fondoDe = (el) => {
    let n = el;
    while (n) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = aRgb(cs.backgroundColor);
      if (c && c[3] === 1) return [c[0], c[1], c[2]];
      if (c && c[3] > 0) {
        const p = n.parentElement ? fondoDe(n.parentElement) : [255, 255, 255];
        return p ? mez(c, p) : null;
      }
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const ctr = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  window.__aud = function () {
    const malos = [];
    let n = 0, omitidos = 0, inactivos = 0;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
      if (![...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 1)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      /* WCAG 1.4.3 exime a los controles inactivos: un botón deshabilitado
         DEBE verse apagado, y medirlo como texto normal marcaría un fallo
         donde el diseño es correcto. */
      if (el.closest('[disabled],[aria-disabled="true"],.Mui-disabled')) { inactivos++; continue; }
      const fg = aRgb(cs.color);
      if (!fg) continue;
      const bg = fondoDe(el);
      if (!bg) { omitidos++; continue; }
      const fgs = fg[3] < 1 ? mez(fg, bg) : [fg[0], fg[1], fg[2]];
      const c = ctr(fgs, bg);
      n++;
      const px = parseFloat(cs.fontSize);
      // WCAG AA: 3.0 para texto grande, 4.5 para el resto.
      const min = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
      if (c < min) {
        malos.push({
          t: el.textContent.trim().slice(0, 34),
          r: +c.toFixed(2), min,
          color: cs.color,
          fondo: 'rgb(' + bg.map(Math.round) + ')',
          px: +px.toFixed(1),
        });
      }
    }
    return {
      tema: document.documentElement.getAttribute('data-tema'),
      ruta: location.pathname,
      revisados: n,
      omitidosPorDegradado: omitidos,
      inactivosOmitidos: inactivos,
      fallos: malos.length,
      malos: malos.slice(0, 12),
    };
  };
})();
