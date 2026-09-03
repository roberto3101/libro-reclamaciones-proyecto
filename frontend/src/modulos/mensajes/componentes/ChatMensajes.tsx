import { useState } from 'react';
import { UiTarjeta, UiCampoTexto, UiBoton, UiCargando } from '@/ui';
import { UiPila, UiCaja } from '@/ui';
import { UiIconoEnviar } from '@/ui';
import { usarMensajes } from '../ganchos/usarMensajes';
import { mensajesApi } from '../api/mensajes.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoFechaHora } from '@/aplicacion/helpers/formato';

interface Props {
  reclamoId: string;
}

export function ChatMensajes({ reclamoId }: Props) {
  const { mensajes, cargando, recargar } = usarMensajes(reclamoId);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      // CORRECCIÓN: Usamos 'enviar' y pasamos solo el texto
      // (Asumiendo que tu API wrapper ya sabe que el remitente es la EMPRESA/ADMIN)
      await mensajesApi.enviar(reclamoId, texto);
      
      setTexto('');
      notificar.exito('Mensaje enviado');
      recargar();
    } catch (error) {
      manejarError(error);
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <UiCargando tipo="puntos" etiqueta="Cargando mensajes..." />;

  // ... (El resto del renderizado se mantiene igual)
  return (
    <UiTarjeta titulo="Seguimiento de Mensajes">
      <UiPila direccion="columna" espaciado={2}>
        <UiCaja
          sx={{
            maxHeight: 400,
            overflowY: 'auto',
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 2,
          }}
        >
          {!mensajes.length && <p style={{ color: '#857e70', textAlign: 'center' }}>Sin mensajes aún.</p>}
          {mensajes.map((m) => (
            <UiCaja
              key={m.id}
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 2,
                // Ajuste visual: Si es EMPRESA (nosotros) va a la derecha/azul
                bgcolor: m.tipo_mensaje === 'EMPRESA' ? 'primary.50' : 'grey.100',
                ml: m.tipo_mensaje === 'EMPRESA' ? 4 : 0,
                mr: m.tipo_mensaje === 'CLIENTE' ? 4 : 0,
              }}
            >
              <UiPila direccion="fila" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {m.tipo_mensaje === 'EMPRESA' ? 'NOSOTROS' : 'CLIENTE'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#aca596' }}>{formatoFechaHora(m.fecha_mensaje)}</span>
              </UiPila>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{m.mensaje}</p>
            </UiCaja>
          ))}
        </UiCaja>

        <UiPila direccion="fila" espaciado={1}>
          <UiCampoTexto
            etiqueta=""
            valor={texto}
            alCambiar={(e) => setTexto(e.target.value)}
            marcador="Escriba un mensaje..."
            sx={{ flex: 1 }}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && enviar()}
          />
          <UiBoton
            variante="primario"
            soloIcono
            iconoIzquierda={<UiIconoEnviar />}
            estado={enviando ? 'cargando' : 'inactivo'}
            alHacerClick={enviar}
          />
        </UiPila>
      </UiPila>
    </UiTarjeta>
  );
}