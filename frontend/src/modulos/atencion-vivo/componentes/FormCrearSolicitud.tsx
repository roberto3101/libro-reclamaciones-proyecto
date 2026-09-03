import { useState } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiCampoTexto, UiSelector } from '@/ui';
import { UiPila } from '@/ui';
import { solicitudesAsesorApi } from '../api/solicitudes-asesor.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { CanalOrigenSolicitud, PrioridadSolicitud } from '@/tipos/solicitud-asesor';
import type { EventoSelector } from '@/ui';

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}

const CANALES: { valor: CanalOrigenSolicitud; etiqueta: string }[] = [
  { valor: 'TELEFONO', etiqueta: 'Teléfono' },
  { valor: 'WEB', etiqueta: 'Web / Chat' },
  { valor: 'WHATSAPP', etiqueta: 'WhatsApp' },
];

const PRIORIDADES: { valor: PrioridadSolicitud; etiqueta: string }[] = [
  { valor: 'BAJA', etiqueta: 'Baja' },
  { valor: 'NORMAL', etiqueta: 'Normal' },
  { valor: 'ALTA', etiqueta: 'Alta' },
  { valor: 'URGENTE', etiqueta: 'Urgente' },
];

export function FormCrearSolicitud({ abierto, alCerrar, alGuardar }: Props) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [motivo, setMotivo] = useState('');
  const [canalOrigen, setCanalOrigen] = useState<CanalOrigenSolicitud>('TELEFONO');
  const [prioridad, setPrioridad] = useState<PrioridadSolicitud>('NORMAL');
  const [cargando, setCargando] = useState(false);

  const limpiar = () => {
    setNombre('');
    setTelefono('');
    setMotivo('');
    setCanalOrigen('TELEFONO');
    setPrioridad('NORMAL');
  };

  const guardar = async () => {
    if (!nombre.trim()) return notificar.advertencia('El nombre es obligatorio');
    if (!telefono.trim()) return notificar.advertencia('El teléfono es obligatorio');
    if (!motivo.trim()) return notificar.advertencia('El motivo es obligatorio');

    setCargando(true);
    try {
      await solicitudesAsesorApi.crear({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        motivo: motivo.trim(),
        canal_origen: canalOrigen,
        prioridad,
      });
      notificar.exito('Solicitud creada exitosamente');
      limpiar();
      alGuardar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  const cerrar = () => {
    limpiar();
    alCerrar();
  };

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Nueva Solicitud de Atención"
      maxAncho="sm"
      pie={
        <>
          <BotonModal texto="Cancelar" variante="secundario" onClick={cerrar} />
          <BotonModal texto="Crear Solicitud" onClick={guardar} cargando={cargando} />
        </>
      }
    >
      <UiPila direccion="columna" espaciado={2}>
        <UiCampoTexto
          etiqueta="Nombre del solicitante *"
          valor={nombre}
          alCambiar={(e) => setNombre(e.target.value)}
          marcador="Ej: Juan Pérez"
          anchoCompleto
        />

        <UiCampoTexto
          etiqueta="Teléfono *"
          valor={telefono}
          alCambiar={(e) => setTelefono(e.target.value)}
          marcador="Ej: 51999888777"
          textoAyuda="Número con código de país, sin espacios ni guiones"
          anchoCompleto
        />

        <UiCampoTexto
          etiqueta="Motivo de la solicitud *"
          valor={motivo}
          alCambiar={(e) => setMotivo(e.target.value)}
          multilinea
          filas={3}
          marcador="Describa brevemente el motivo de la atención..."
          anchoCompleto
        />

        <UiPila direccion="fila" espaciado={2}>
          <UiSelector
            etiqueta="Canal de origen"
            opciones={CANALES}
            value={canalOrigen}
            alCambiar={(e: EventoSelector) => setCanalOrigen(e.target.value as CanalOrigenSolicitud)}
          />
          <UiSelector
            etiqueta="Prioridad"
            opciones={PRIORIDADES}
            value={prioridad}
            alCambiar={(e: EventoSelector) => setPrioridad(e.target.value as PrioridadSolicitud)}
          />
        </UiPila>
      </UiPila>
    </ModalBase>
  );
}