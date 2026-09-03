import { usarPermisos } from '@/aplicacion/ganchos/usarPermisos';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { PantallaSinPermisos } from '@/componentes/ui/PantallaSinPermisos';
import { UiCargando } from '@/ui';
import { UiCaja } from '@/ui';

interface Props {
  modulo: string;
  etiqueta?: string;
  children: React.ReactNode;
}

/**
 * Wrapper que protege una página verificando permisos del usuario.
 * Si no tiene permiso "ver" del módulo, muestra PantallaSinPermisos.
 * Uso: <ProtectorModulo modulo="reclamos" etiqueta="Reclamos">...</ProtectorModulo>
 */
export function ProtectorModulo({ modulo, etiqueta, children }: Props) {
  const { tienePermiso, cargando, permisos } = usarPermisos();
  const { usuario } = usarEstadoAuth();

  const esAdmin = usuario?.rol?.toUpperCase() === 'ADMIN';

  // Mostrar loader mientras los permisos aún no se cargan (evita flash de
  // "Acceso restringido" en la primera carga antes de que el useEffect
  // haga el fetch de /roles/mis-permisos). ADMIN tiene bypass global.
  if (!esAdmin && (cargando || permisos === null)) {
    return (
      <UiCaja centrado sx={{ minHeight: '60vh' }}>
        <UiCargando tipo="anillo" etiqueta="Verificando permisos..." />
      </UiCaja>
    );
  }

  if (!tienePermiso(modulo, 'ver')) {
    return <PantallaSinPermisos modulo={etiqueta || modulo} />;
  }

  return <>{children}</>;
}
