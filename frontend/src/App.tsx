import { useEffect } from 'react';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import Enrutador from '@/aplicacion/Enrutador';
import { ErrorBoundary } from '@/aplicacion/componentes/ErrorBoundary';

export default function App() {
  const inicializar = usarEstadoAuth((s) => s.inicializar);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  return (
    <ErrorBoundary>
      <Enrutador />
    </ErrorBoundary>
  );
}
