import { createTheme, type Theme } from '@mui/material/styles';
import type { Tema } from './ProveedorTema';

/**
 * Tema de MUI derivado de los tokens CSS.
 *
 * Partes de la aplicación siguen usando MUI directamente (tablas, diálogos,
 * selectores de fecha). Para que no se despeguen del resto de la interfaz,
 * el tema no repite la paleta: la LEE de las mismas variables CSS que usan
 * los .module.css. Así un color se cambia en tokens.css y viaja solo a los
 * dos mundos, en vez de quedar definido dos veces y divergir con el tiempo.
 *
 * Esto sustituye a la hoja de `!important` que antes se inyectaba en
 * runtime para forzar el modo oscuro de MUI: si el tema está bien
 * configurado, no hay nada que forzar.
 */

/** Lee un token del elemento raíz, con valor de reserva si aún no existe. */
function leer(nombre: string, reserva: string): string {
  if (typeof document === 'undefined') return reserva;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v || reserva;
}

export function crearTemaMui(modo: Tema): Theme {
  const t = (n: string, reserva: string) => leer(n, reserva);

  const textoPrimario = t('--ui-texto', modo === 'dark' ? '#e8ecf1' : '#131210');
  const superficie = t('--ui-superficie', modo === 'dark' ? '#151b23' : '#fffefb');
  const borde = t('--ui-borde', modo === 'dark' ? '#2a323d' : '#dde1e7');

  return createTheme({
    palette: {
      mode: modo,
      primary: {
        main: t('--ui-primario', '#9a4a24'),
        dark: t('--ui-primario-hover', '#8a4120'),
        light: t('--ui-primario-suave', '#eff5ff'),
        contrastText: t('--ui-primario-sobre', '#fffefb'),
      },
      secondary: {
        main: t('--ui-texto-2', '#55504a'),
        contrastText: t('--ui-texto-sobre-color', '#fffefb'),
      },
      success: {
        main: t('--ui-exito', '#3a5834'),
        light: t('--ui-exito-suave-2', '#d6f7e8'),
        dark: t('--ui-exito-hover', '#036249'),
        contrastText: t('--ui-exito-sobre', '#fffefb'),
      },
      warning: {
        main: t('--ui-adv', '#7d570f'),
        light: t('--ui-adv-suave', '#fffaeb'),
        dark: t('--ui-adv-hover', '#96440a'),
        contrastText: t('--ui-adv-sobre', '#fffefb'),
      },
      error: {
        main: t('--ui-peligro', '#a3312a'),
        light: t('--ui-peligro-suave-2', '#fde3e1'),
        dark: t('--ui-peligro-hover', '#932c25'),
        contrastText: t('--ui-peligro-sobre', '#fffefb'),
      },
      info: {
        main: t('--ui-info', '#9a4a24'),
        light: t('--ui-info-suave-2', '#f5e2d5'),
        dark: t('--ui-info-hover', '#8a4120'),
        contrastText: t('--ui-info-sobre', '#fffefb'),
      },
      text: {
        primary: textoPrimario,
        secondary: t('--ui-texto-2', modo === 'dark' ? '#a3aebc' : '#55504a'),
        disabled: t('--ui-texto-desactivado', modo === 'dark' ? '#69727e' : '#a09a8c'),
      },
      background: {
        default: t('--ui-fondo', modo === 'dark' ? '#0d1117' : '#f4f6f8'),
        paper: superficie,
      },
      divider: borde,
      action: {
        hover: t('--ui-hover', 'rgba(127,127,127,0.06)'),
        selected: t('--ui-seleccionado', 'rgba(127,127,127,0.1)'),
        disabled: t('--ui-texto-desactivado', '#a09a8c'),
      },
    },

    /* MUI trae 8px de radio y lo propaga a menús, diálogos y tarjetas.
       Se baja al escalón del sistema para que un componente de MUI no se
       distinga de uno propio por la curva de la esquina. */
    shape: { borderRadius: 6 },

    typography: {
      /* Se lee del token en vez de repetir la lista aquí. MUI aplica esta
         familia al <body> a través de CssBaseline, así que si no coincide
         con --ui-fuente acaba imponiéndose sobre todo lo demás: era lo que
         mantenía Inter viva después de cambiar la tipografía. */
      fontFamily: leer('--ui-fuente', 'ui-sans-serif, system-ui, sans-serif'),
      fontSize: 14,
      button: { textTransform: 'none', fontWeight: 600 },
      h1: { fontFamily: leer('--ui-fuente-titulo', 'Georgia, serif') },
      h2: { fontFamily: leer('--ui-fuente-titulo', 'Georgia, serif') },
    },

    components: {
      /* Las superficies de MUI traen un degradado propio en modo oscuro que
         las separa del resto de la interfaz. Se anula para que todas las
         superficies vengan del mismo token. */
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: 'var(--ui-superficie)',
            color: 'var(--ui-texto)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--ui-superficie-elevada)',
            backgroundImage: 'none',
            color: 'var(--ui-texto)',
            border: '1px solid var(--ui-borde)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { color: 'var(--ui-texto)', fontWeight: 600 } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { color: 'var(--ui-texto)' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { borderTop: '1px solid var(--ui-borde)', padding: 16 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--ui-superficie-elevada)',
            backgroundImage: 'none',
            border: '1px solid var(--ui-borde)',
            boxShadow: 'var(--ui-sombra-2)',
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--ui-superficie-elevada)',
            backgroundImage: 'none',
            border: '1px solid var(--ui-borde)',
            boxShadow: 'var(--ui-sombra-2)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            color: 'var(--ui-texto)',
            '&:hover': { backgroundColor: 'var(--ui-hover)' },
            '&.Mui-selected': { backgroundColor: 'var(--ui-seleccionado)' },
            '&.Mui-selected:hover': { backgroundColor: 'var(--ui-activo)' },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            color: 'var(--ui-texto)',
            '& fieldset': { borderColor: 'var(--ui-borde)' },
            '&:hover fieldset': { borderColor: 'var(--ui-borde-fuerte)' },
            '&.Mui-focused fieldset': {
              borderColor: 'var(--ui-foco)',
              borderWidth: 2,
            },
            '&.Mui-error fieldset': { borderColor: 'var(--ui-peligro)' },
          },
          input: {
            color: 'var(--ui-texto)',
            /* El autorrelleno de Chrome pinta un fondo propio que ignora el
               tema. La sombra interna lo tapa y la transición eterna evita
               que llegue a pintarse. */
            '&:-webkit-autofill': {
              WebkitBoxShadow: '0 0 0 1000px var(--ui-superficie) inset',
              WebkitTextFillColor: 'var(--ui-texto)',
              caretColor: 'var(--ui-texto)',
              transition: 'background-color 9999s ease-in-out 0s',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'var(--ui-texto-2)',
            '&.Mui-focused': { color: 'var(--ui-foco)' },
            '&.Mui-error': { color: 'var(--ui-peligro)' },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: 'var(--ui-texto-3)',
            '&.Mui-error': { color: 'var(--ui-peligro-texto)' },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: { color: 'var(--ui-texto)' },
          icon: { color: 'var(--ui-texto-2)' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { color: 'var(--ui-texto)', borderColor: 'var(--ui-borde)' },
          head: {
            color: 'var(--ui-texto-2)',
            backgroundColor: 'var(--ui-superficie-2)',
            fontWeight: 600,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&:hover > td': { backgroundColor: 'var(--ui-hover)' } },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            color: 'var(--ui-texto)',
            borderColor: 'var(--ui-borde)',
            textTransform: 'none',
            '&:hover': { backgroundColor: 'var(--ui-hover)' },
            '&.Mui-selected': {
              color: 'var(--ui-primario-texto)',
              backgroundColor: 'var(--ui-seleccionado)',
            },
          },
        },
      },
      MuiPaginationItem: {
        styleOverrides: {
          root: {
            color: 'var(--ui-texto)',
            borderColor: 'var(--ui-borde)',
            '&:hover': { backgroundColor: 'var(--ui-hover)' },
            '&.Mui-selected': {
              backgroundColor: 'var(--ui-primario)',
              color: 'var(--ui-primario-sobre)',
            },
          },
        },
      },
      /* Los botones de texto y contorno pintan la etiqueta con el tono
         SÓLIDO de la paleta, pensado para llevar blanco encima. Sobre la
         superficie de una tabla eso deja el texto en 3.7:1, así que se
         redirige al tono legible. */
      MuiButton: {
        styleOverrides: {
          textPrimary: { color: 'var(--ui-primario-texto)' },
          outlinedPrimary: {
            color: 'var(--ui-primario-texto)',
            borderColor: 'var(--ui-primario-suave-borde)',
          },
          textError: { color: 'var(--ui-peligro-texto)' },
          outlinedError: {
            color: 'var(--ui-peligro-texto)',
            borderColor: 'var(--ui-peligro-borde)',
          },
        },
      },

      MuiDivider: { styleOverrides: { root: { borderColor: 'var(--ui-borde)' } } },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: 'var(--ui-texto-2)',
            '&:hover': { backgroundColor: 'var(--ui-hover)' },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: 'var(--ui-texto)',
            color: 'var(--ui-superficie)',
            fontSize: 12,
          },
          arrow: { color: 'var(--ui-texto)' },
        },
      },
      /* El chip con contorno pinta el texto con el tono SÓLIDO de la
         paleta, que está pensado para llevar texto blanco encima, no para
         ser el texto. En tema oscuro eso deja etiquetas como «Sin acceso»
         en 3.7:1. Cada variante se redirige al tono legible. */
      /* Se apunta por selector y no por las claves de variante porque MUI
         solo expone `outlinedPrimary` y `outlinedSecondary`; el resto de
         colores no tienen clave propia. */
      MuiChip: {
        styleOverrides: {
          root: {
            borderColor: 'var(--ui-borde)',
            '&.MuiChip-outlined.MuiChip-colorPrimary': {
              color: 'var(--ui-primario-texto)',
              borderColor: 'var(--ui-primario-suave-borde)',
            },
            '&.MuiChip-outlined.MuiChip-colorSuccess': {
              color: 'var(--ui-exito-texto)',
              borderColor: 'var(--ui-exito-borde)',
            },
            '&.MuiChip-outlined.MuiChip-colorWarning': {
              color: 'var(--ui-adv-texto)',
              borderColor: 'var(--ui-adv-borde)',
            },
            '&.MuiChip-outlined.MuiChip-colorError': {
              color: 'var(--ui-peligro-texto)',
              borderColor: 'var(--ui-peligro-borde)',
            },
            '&.MuiChip-outlined.MuiChip-colorInfo': {
              color: 'var(--ui-info-texto)',
              borderColor: 'var(--ui-info-borde)',
            },
          },
        },
      },
    },
  });
}
