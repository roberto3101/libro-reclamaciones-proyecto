import { useState } from 'react';
import { UiBoton } from '@/ui';

const LIMITE_CARACTERES = 1000;

interface EntradaMensajeProps {
  input: string;
  cargando: boolean;
  esMovil: boolean;
  onInputChange: (valor: string) => void;
  onEnviar: () => void;
}

export default function EntradaMensaje({
  input,
  cargando,
  esMovil,
  onInputChange,
  onEnviar,
}: EntradaMensajeProps) {
  const [enfocado, setEnfocado] = useState(false);
  const caracteres = input.length;
  const excedido = caracteres > LIMITE_CARACTERES;
  const porcentaje = Math.min((caracteres / LIMITE_CARACTERES) * 100, 100);
  const puedeEnviar = input.trim().length > 0 && !cargando && !excedido;

  const colorContador =
    porcentaje >= 100 ? '#b83a32' : porcentaje >= 80 ? '#a67718' : 'var(--ui-texto-2)';

  return (
    <div
      style={{
        padding: esMovil ? '10px 12px' : '14px 24px',
        borderTop: '1px solid var(--ui-borde)',
        backgroundColor: 'var(--ui-superficie, #fffefb)',
        flexShrink: 0,
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Contenedor principal — un solo borde */}
        <div
          style={{
            border: `1.5px solid ${enfocado ? 'var(--ui-primario, #29585c)' : 'var(--ui-borde)'}`,
            borderRadius: 'var(--ui-r-xl)',
            backgroundColor: 'var(--ui-fondo, var(--ui-fondo))',
            boxShadow: enfocado ? '0 0 0 3px rgba(41, 88, 92, 0.08)' : 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            display: 'flex',
            flexDirection: 'column' as const,
          }}
        >
          {/* Textarea nativo — sin bordes propios */}
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setEnfocado(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (puedeEnviar) onEnviar();
              }
            }}
            placeholder="Escribe tu pregunta..."
            rows={esMovil ? 3 : 4}
            style={{
              width: '100%',
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--ui-texto)',
              fontSize: esMovil ? '0.9rem' : '0.95rem',
              lineHeight: 1.6,
              padding: esMovil ? '14px 16px 4px' : '16px 20px 4px',
              fontFamily: 'inherit',
              maxHeight: esMovil ? 140 : 200,
              overflow: 'auto',
            }}
          />

          {/* Footer: contador + botón */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: esMovil ? '4px 14px 10px' : '6px 18px 12px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: excedido ? '#b83a32' : colorContador,
                fontWeight: porcentaje >= 80 ? 600 : 400,
                fontVariantNumeric: 'tabular-nums',
                userSelect: 'none',
              }}
            >
              {excedido ? `Máximo ${LIMITE_CARACTERES} caracteres` : `${caracteres}/${LIMITE_CARACTERES}`}
            </span>

            <UiBoton
              texto={esMovil ? '→' : 'Enviar'}
              variante="primario"
              alHacerClick={onEnviar}
              estado={cargando ? 'cargando' : 'inactivo'}
              disabled={!puedeEnviar}
              style={{
                borderRadius: 'var(--ui-r-lg)',
                minWidth: esMovil ? 40 : 100,
                padding: esMovil ? '8px 12px' : '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
