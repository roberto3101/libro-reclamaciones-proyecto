import { useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { usarTema } from './ProveedorTema';
import { crearTemaMui } from './temaMui';

/**
 * Puente entre el sistema de tokens y los componentes que siguen siendo de
 * MUI (tablas, diálogos, selectores de fecha).
 *
 * Debe ir por dentro de <UiProveedorTema>: cuando el tema cambia, ese
 * proveedor marca ya el elemento raíz de forma síncrona, así que este
 * `useMemo` reconstruye la paleta leyendo los tokens correctos.
 */
export function UiProveedorMui({ children }: { children: ReactNode }) {
  const { tema } = usarTema();
  const temaMui = useMemo(() => crearTemaMui(tema), [tema]);

  return (
    <ThemeProvider theme={temaMui}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
