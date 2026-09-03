import { UiTarjeta, UiCargando } from '@/ui';
import { UiPila } from '@/ui';
import { usarRespuestas } from '../ganchos/usarRespuestas';
import { formatoFechaHora } from '@/aplicacion/helpers/formato';

interface Props {
  reclamoId: string;
}

export function ListaRespuestas({ reclamoId }: Props) {
  const { respuestas, cargando } = usarRespuestas(reclamoId);

  if (cargando) return <UiCargando tipo="puntos" etiqueta="Cargando respuestas..." />;
  if (!respuestas.length) return <p style={{ color: '#857e70' }}>Sin respuestas registradas.</p>;

  return (
    <UiPila direccion="columna" espaciado={2}>
      {respuestas.map((r) => (
        <UiTarjeta key={r.id} variante="contorno">
          <UiPila direccion="columna" espaciado={1}>
            <UiPila direccion="fila" sx={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Respuesta — {r.origen}</span>
              <span style={{ color: '#857e70', fontSize: '0.8rem' }}>{formatoFechaHora(r.fecha_respuesta)}</span>
            </UiPila>
            <p style={{ margin: 0 }}>{r.respuesta_empresa}</p>
            {r.accion_tomada && <p style={{ margin: 0, color: '#857e70' }}>Acción: {r.accion_tomada}</p>}
            {r.compensacion_ofrecida && <p style={{ margin: 0, color: '#857e70' }}>Compensación: {r.compensacion_ofrecida}</p>}
          </UiPila>
        </UiTarjeta>
      ))}
    </UiPila>
  );
}
