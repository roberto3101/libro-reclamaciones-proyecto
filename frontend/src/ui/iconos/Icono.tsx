import type { CSSProperties, HTMLAttributes } from 'react';
import { convertirSx, clases, type PropSx } from '../sx';
import css from './Icono.module.css';

export interface IconoProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Nombre del símbolo en Material Symbols (ligadura), p. ej. 'search'. */
  nombre?: string;
  /** Versión sólida del símbolo. */
  relleno?: boolean;
  /** Tamaño en píxeles. Sin valor hereda el del texto que lo rodea. */
  tamano?: number;
  color?: string;
  sx?: PropSx;
  style?: CSSProperties;
}

/**
 * Símbolo de Material Symbols Rounded.
 *
 * La fuente resuelve el dibujo a partir del texto del elemento (ligaduras),
 * por eso el nombre va como contenido y no como atributo. El grosor y el
 * relleno se ajustan con `font-variation-settings`, que es lo que permite
 * animar entre contorno y sólido sin cambiar de icono.
 */
export function UiIcono({
  nombre, relleno, tamano, color, sx, className, style, children, ...resto
}: IconoProps) {
  const { style: sUsuario, className: cUsuario } = convertirSx(sx);

  return (
    <span
      aria-hidden
      translate="no"
      className={clases('material-symbols-rounded', css.icono, cUsuario, className)}
      style={{
        fontVariationSettings: relleno ? "'FILL' 1" : undefined,
        fontSize: tamano,
        color,
        ...sUsuario,
        ...style,
      }}
      {...resto}
    >
      {nombre ?? children}
    </span>
  );
}

/** Crea un icono con su ligadura ya fijada. */
const definir = (nombre: string) => {
  const C = (props: Omit<IconoProps, 'nombre'>) => <UiIcono nombre={nombre} {...props} />;
  C.displayName = `Icono(${nombre})`;
  return C;
};

/* Catálogo semántico. Los nombres conservan la ligadura exacta que usaba
   la librería anterior, para que ningún icono cambie de dibujo. */
export const UiIconoAnadir = definir('add_circle');
export const UiIconoBilletera = definir('account_balance_wallet');
export const UiIconoBorrar = definir('delete');
export const UiIconoBuscar = definir('search');
export const UiIconoCaja = definir('inbox');
export const UiIconoChat = definir('forum');
export const UiIconoCorreo = definir('mail');
export const UiIconoDiseno = definir('dashboard');
export const UiIconoEdificio = definir('apartment');
export const UiIconoEditar = definir('edit');
export const UiIconoEnviar = definir('send');
export const UiIconoExito = definir('check_circle');
export const UiIconoHerramientas = definir('home_repair_service');
export const UiIconoLlave = definir('key');
export const UiIconoMenu = definir('menu');
export const UiIconoRefrescar = definir('refresh');
export const UiIconoUsuario = definir('account_circle');
