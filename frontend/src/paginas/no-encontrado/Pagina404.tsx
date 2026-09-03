import { useNavigate } from 'react-router-dom';
import { UiCaja, UiPila } from '@/ui';
import { UiBoton } from '@/ui';

export default function Pagina404() {
  const navegar = useNavigate();

  return (
    <UiCaja centrado sx={{ minHeight: '100vh' }}>
      <UiPila direccion="columna" espaciado={2} sx={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '6rem', margin: 0, fontWeight: 700, color: 'var(--ui-info)' }}>404</h1>
        <h2 style={{ margin: 0 }}>Página no encontrada</h2>
        <p style={{ color: '#857e70' }}>La página que buscas no existe o fue movida.</p>
        <UiBoton texto="Volver al Inicio" variante="primario" alHacerClick={() => navegar('/dashboard')} />
      </UiPila>
    </UiCaja>
  );
}
