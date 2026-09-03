import { useState } from 'react';
import { UiCampoTexto, UiBoton, UiTarjeta } from '@/ui';
import { UiPila } from '@/ui';
import { respuestasApi } from '../api/respuestas.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

interface Props {
  reclamoId: string;
  alResponder: () => void;
}

export function FormRespuesta({ reclamoId, alResponder }: Props) {
  const [respuesta, setRespuesta] = useState('');
  const [accion, setAccion] = useState('');
  const [compensacion, setCompensacion] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarEnviar = async () => {
    if (!respuesta.trim()) {
      notificar.advertencia('La respuesta es obligatoria');
      return;
    }
    setCargando(true);
    try {
      await respuestasApi.crear(reclamoId, {
        respuesta_empresa: respuesta,
        accion_tomada: accion || undefined,
        compensacion_ofrecida: compensacion || undefined,
      });
      notificar.exito('Respuesta registrada');
      setRespuesta('');
      setAccion('');
      setCompensacion('');
      alResponder();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <UiTarjeta titulo="Nueva Respuesta">
      <UiPila direccion="columna" espaciado={2}>
        <UiCampoTexto
          etiqueta="Respuesta de la Empresa *"
          valor={respuesta}
          alCambiar={(e) => setRespuesta(e.target.value)}
          multilinea
          marcador="Escriba la respuesta al consumidor..."
        />
        <UiCampoTexto
          etiqueta="Acción Tomada"
          valor={accion}
          alCambiar={(e) => setAccion(e.target.value)}
          marcador="Opcional"
        />
        <UiCampoTexto
          etiqueta="Compensación Ofrecida"
          valor={compensacion}
          alCambiar={(e) => setCompensacion(e.target.value)}
          marcador="Opcional"
        />
        <UiBoton
          texto="Enviar Respuesta"
          variante="primario"
          estado={cargando ? 'cargando' : 'inactivo'}
          alHacerClick={manejarEnviar}
        />
      </UiPila>
    </UiTarjeta>
  );
}
