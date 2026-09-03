import { Outlet } from 'react-router-dom';

/**
 * Wrapper mínimo para rutas públicas (login, libro público, confirmación, seguimiento).
 * Cada página hija controla su propio layout y fondo.
 */
export default function LayoutPublico() {
  return <Outlet />;
}
