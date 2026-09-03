import { Navigate, useLocation } from 'react-router-dom';
import { UiCargando } from '@/ui';
import { UiCaja } from '@/ui';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import type { RolUsuario } from '@/tipos';

interface Props {
  children: React.ReactNode;
  rolesPermitidos?: RolUsuario[];
}

export default function ProtectorRutas({ children, rolesPermitidos }: Props) {
  const { autenticado, cargando, usuario } = usarEstadoAuth();
  const ubicacion = useLocation();

  if (cargando) {
    return (
      <UiCaja centrado sx={{ minHeight: '100vh' }}>
        <UiCargando tipo="anillo" etiqueta="Cargando..." />
      </UiCaja>
    );
  }

  if (!autenticado) {
    return <Navigate to="/acceso" state={{ desde: ubicacion }} replace />;
  }

  if (rolesPermitidos && usuario && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
