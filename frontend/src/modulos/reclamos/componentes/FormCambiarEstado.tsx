import { useState } from 'react';
import { UiSelector, UiCampoTexto, UiBoton, UiTarjeta } from '@/ui';
import { UiPila } from '@/ui';
import type { EstadoReclamo } from '@/tipos';
import { reclamosApi } from '../api/reclamos.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { EventoSelector } from '@/ui';

interface Props {
  reclamoId: string;
  estadoActual: EstadoReclamo;
  alCambiar: () => void;
}

const OPCIONES_ESTADO = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'EN_PROCESO', etiqueta: 'En Proceso' },
  { valor: 'CERRADO', etiqueta: 'Cerrado' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazado' },
];

export function FormCambiarEstado({ reclamoId, estadoActual, alCambiar }: Props) {
  const [estado, setEstado] = useState<EstadoReclamo>(estadoActual);
  const [comentario, setComentario] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarSubmit = async () => {
    if (estado === estadoActual) {
      notificar.advertencia('Selecciona un estado diferente');
      return;
    }
    setCargando(true);
    try {
      await reclamosApi.cambiarEstado(reclamoId, { estado, comentario: comentario || undefined });
      notificar.exito('Estado actualizado correctamente');
      alCambiar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <UiTarjeta titulo="Cambiar Estado">
      <UiPila direccion="columna" espaciado={2}>
        <UiSelector
          etiqueta="Nuevo Estado"
          opciones={OPCIONES_ESTADO}
          value={estado}
          onChange={(e: EventoSelector) => setEstado(e.target.value as EstadoReclamo)}
        />
        <UiCampoTexto
          etiqueta="Comentario (opcional)"
          valor={comentario}
          alCambiar={(e) => setComentario(e.target.value)}
          multilinea
          marcador="Motivo del cambio de estado..."
        />
        <UiBoton
          texto="Actualizar Estado"
          variante="primario"
          estado={cargando ? 'cargando' : 'inactivo'}
          alHacerClick={manejarSubmit}
        />
      </UiPila>
    </UiTarjeta>
  );
}