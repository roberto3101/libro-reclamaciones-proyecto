import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

export type Tema = 'light' | 'dark';

export interface ContextoTemaTipo {
  tema: Tema;
  alternarTema: () => void;
  establecerTema: (tema: Tema) => void;
}

export const ContextoTema = createContext<ContextoTemaTipo | undefined>(undefined);

/** Clave de preferencia en el navegador. */
const CLAVE = 'lr-tema';

/**
 * Aplica el tema al elemento raíz.
 *
 * Se marcan dos cosas a la vez y las dos hacen falta:
 *   - la clase `dark`, que es lo que consulta la variante de Tailwind
 *   - `data-tema`, que activa el bloque oscuro de tokens.css y además deja
 *     el tema visible al inspeccionar el DOM
 * `color-scheme` lo hereda del token, y es lo que hace que los controles
 * nativos (barras de scroll, selects del sistema) acompañen al tema.
 */
function aplicar(tema: Tema) {
  const raiz = document.documentElement;
  raiz.classList.remove('light', 'dark');
  raiz.classList.add(tema);
  raiz.setAttribute('data-tema', tema);
}

function temaInicial(porDefecto: Tema): Tema {
  if (typeof window === 'undefined') return porDefecto;
  const guardado = window.localStorage.getItem(CLAVE);
  return guardado === 'light' || guardado === 'dark' ? guardado : porDefecto;
}

export interface ProveedorTemaProps {
  children: ReactNode;
  temaPorDefecto?: Tema;
}

export function UiProveedorTema({ children, temaPorDefecto = 'light' }: ProveedorTemaProps) {
  const [tema, setTema] = useState<Tema>(() => temaInicial(temaPorDefecto));

  useEffect(() => {
    aplicar(tema);
    try {
      window.localStorage.setItem(CLAVE, tema);
    } catch {
      /* Modo privado o almacenamiento lleno: el tema sigue funcionando,
         simplemente no se recuerda entre visitas. */
    }
  }, [tema]);

  /* El DOM se marca ANTES de propagar el estado, no después.
     El tema de MUI se construye leyendo los tokens con getComputedStyle;
     si la clase del elemento raíz cambiara en un efecto, ese re-render
     leería todavía la paleta anterior y MUI se quedaría un tema por
     detrás en cada cambio. */
  const establecerTema = useCallback((t: Tema) => {
    aplicar(t);
    setTema(t);
  }, []);

  const alternarTema = useCallback(
    () => establecerTema(tema === 'dark' ? 'light' : 'dark'),
    [tema, establecerTema],
  );

  const valor = useMemo(
    () => ({ tema, alternarTema, establecerTema }),
    [tema, alternarTema, establecerTema],
  );

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

/** Acceso al tema activo y a sus acciones. */
export function usarTema(): ContextoTemaTipo {
  const ctx = useContext(ContextoTema);
  if (!ctx) throw new Error('usarTema debe usarse dentro de <UiProveedorTema>');
  return ctx;
}
