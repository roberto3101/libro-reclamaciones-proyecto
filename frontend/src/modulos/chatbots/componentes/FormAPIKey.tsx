import { useState } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import {
  UiCampoTexto,
  UiSelector,
  UiAlerta
} from '@/ui';
import { UiPila } from '@/ui';
import type { EntornoAPIKey } from '@/tipos/chatbot';
import { chatbotsApi } from '../api/chatbots.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { EventoSelector } from '@/ui';

interface Props {
  abierto: boolean;
  chatbotId: string;
  alCerrar: () => void;
  alCrear: () => void;
}

// Estos valores deben coincidir con el tipo EntornoAPIKey ('LIVE' | 'TEST')
const ENTORNOS: { valor: EntornoAPIKey; etiqueta: string }[] = [
  { valor: 'TEST', etiqueta: 'Test / Desarrollo' },
  { valor: 'LIVE', etiqueta: 'Live / Producción' },
];

export function FormAPIKey({ abierto, chatbotId, alCerrar, alCrear }: Props) {
  const [nombre, setNombre] = useState('');
  // Valor por defecto seguro y tipado
  const [entorno, setEntorno] = useState<EntornoAPIKey>('TEST');
  
  const [keyGenerada, setKeyGenerada] = useState('');
  const [cargando, setCargando] = useState(false);

  const generar = async () => {
    if (!nombre.trim()) { 
      notificar.advertencia('El nombre es obligatorio'); 
      return; 
    }
    
    setCargando(true);
    try {
      const resultado = await chatbotsApi.generarKey(chatbotId, { nombre, entorno });
      setKeyGenerada(resultado.plain_key);
      notificar.exito('API Key generada — cópiala ahora, no se mostrará de nuevo');
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  const cerrar = () => {
    setNombre('');
    setKeyGenerada('');
    setEntorno('TEST'); // Reset al valor por defecto
    if (keyGenerada) alCrear(); // Si generó algo, recargar lista al cerrar
    else alCerrar();
  };

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Generar API Key"
      maxAncho="sm"
      pie={
        keyGenerada ? (
          <BotonModal texto="Cerrar" onClick={cerrar} />
        ) : (
          <>
            <BotonModal texto="Cancelar" variante="secundario" onClick={cerrar} />
            <BotonModal texto="Generar" onClick={generar} cargando={cargando} />
          </>
        )
      }
    >
      {keyGenerada ? (
        <UiPila direccion="columna" espaciado={2}>
          <UiAlerta 
            variante="advertencia" 
            titulo="¡Importante!" 
            descripcion="Copia esta key ahora. Por seguridad, no se volverá a mostrar." 
          />
          <UiCampoTexto 
            etiqueta="API Key (Token)" 
            valor={keyGenerada} 
            // InputProps={{ readOnly: true }} // Opcional si el componente lo soporta
            textoAyuda="Úsala en el header X-API-Key"
          />
        </UiPila>
      ) : (
        <UiPila direccion="columna" espaciado={2}>
          <UiCampoTexto 
            etiqueta="Nombre *" 
            valor={nombre} 
            alCambiar={(e) => setNombre(e.target.value)} 
            marcador="Ej: Integración Web" 
            anchoCompleto
          />
          <UiSelector
            etiqueta="Entorno *"
            opciones={ENTORNOS}
            value={entorno}
            alCambiar={(e: EventoSelector) => setEntorno(e.target.value as EntornoAPIKey)}
          />
        </UiPila>
      )}
    </ModalBase>
  );
}