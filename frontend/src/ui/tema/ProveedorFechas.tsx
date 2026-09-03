import type { ReactNode } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

/**
 * Localización de los selectores de fecha.
 *
 * El idioma se fija también en dayjs, no solo en el proveedor: el
 * calendario toma de ahí los nombres de meses y días, y el primer día de
 * la semana. Sin esto el desplegable saldría en inglés aunque el resto de
 * la interfaz esté en español.
 */
export function UiProveedorFechas({
  children,
  idioma = 'es',
}: {
  children: ReactNode;
  idioma?: string;
}) {
  dayjs.locale(idioma);
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={idioma}>
      {children}
    </LocalizationProvider>
  );
}
