import { UiBoton } from '@/ui';
import { UiIconoChat } from '@/ui';

const SUGERENCIAS = [
  '¿Cuantos reclamos tengo pendientes?',
  'Cambia el estado del reclamo mas urgente a EN_PROCESO',
  'Envia un mensaje al cliente del ultimo reclamo',
  'Prioriza mis casos mas urgentes',
];

interface EstadoVacioProps {
  onSugerencia: (texto: string) => void;
  esMovil: boolean;
}

export default function EstadoVacio({ onSugerencia, esMovil }: EstadoVacioProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: esMovil ? 12 : 16,
        padding: esMovil ? '16px 12px' : 0,
      }}
    >
      <div
        style={{
          width: esMovil ? 48 : 64,
          height: esMovil ? 48 : 64,
          background: 'var(--ui-superficie-hundida)',
          border: '1px solid var(--ui-borde)',
          borderRadius: 'var(--ui-r-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <UiIconoChat style={{ color: 'var(--ui-texto-3)', fontSize: esMovil ? 22 : 28 }} />
      </div>

      <div style={{ textAlign: 'center', maxWidth: esMovil ? '100%' : 480 }}>
        <p style={{ fontSize: esMovil ? 14 : 16, fontWeight: 600, color: 'var(--ui-texto)', marginBottom: 8 }}>
          ¿En qué te puedo ayudar?
        </p>
        {!esMovil && (
          <p style={{ fontSize: 14, color: 'var(--ui-texto-2)', lineHeight: 1.6 }}>
            Puedo consultar reclamos, cambiar estados, enviar mensajes al consumidor,
            redactar respuestas y asesorar sobre normativa INDECOPI.
          </p>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: esMovil ? 'column' : 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          maxWidth: esMovil ? '100%' : 520,
          marginTop: 8,
          width: esMovil ? '100%' : 'auto',
        }}
      >
        {SUGERENCIAS.map((s) => (
          <UiBoton
            key={s}
            texto={s}
            variante="contorno"
            alHacerClick={() => onSugerencia(s)}
            style={{ fontSize: 12, width: esMovil ? '100%' : 'auto' }}
          />
        ))}
      </div>
    </div>
  );
}