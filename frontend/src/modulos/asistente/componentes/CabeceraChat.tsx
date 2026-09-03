import { useState, useRef, useEffect } from 'react';
import { UiBoton } from '@/ui';
import { UiIconoChat, UiIconoMenu } from '@/ui';
import type { ProviderInfo } from '../api/assistant.api';

interface CaberaChatProps {
  titulo: string | undefined;
  totalTokens: number;
  sidebarAbierto: boolean;
  esMovil: boolean;
  providers: ProviderInfo[];
  providerSeleccionado: string | null;
  cargandoProviders: boolean;
  onToggleSidebar: () => void;
  onNuevaConversacion: () => void;
  onSeleccionarProvider: (id: string) => void;
}

export default function CabeceraChat({
  titulo,
  totalTokens,
  sidebarAbierto,
  esMovil,
  providers,
  providerSeleccionado,
  cargandoProviders,
  onToggleSidebar,
  onNuevaConversacion,
  onSeleccionarProvider,
}: CaberaChatProps) {
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!dropdownAbierto) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownAbierto]);

  const providerActivo = providers.find((p) => p.id === providerSeleccionado);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: esMovil ? '10px 12px' : '12px 24px',
        borderBottom: '1px solid var(--ui-borde)',
        backgroundColor: 'var(--ui-superficie)',
        flexShrink: 0,
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: esMovil ? 8 : 12, minWidth: 0, flex: 1 }}>
        <UiBoton
          variante="contorno"
          soloIcono
          iconoIzquierda={<UiIconoMenu style={{ fontSize: 18 }} />}
          alHacerClick={onToggleSidebar}
          style={{ minWidth: 32, width: 32, height: 32, flexShrink: 0 }}
          title={sidebarAbierto ? 'Ocultar sidebar' : 'Mostrar sidebar'}
        />

        {!esMovil && (
          <div
            style={{
              width: 36,
              height: 36,
              background: 'var(--ui-primario)',
              borderRadius: 'var(--ui-r-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <UiIconoChat style={{ color: '#fff', fontSize: 18 }} />
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: esMovil ? 14 : 16,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {titulo ?? 'Nueva conversación'}
          </h2>
          <span style={{ fontSize: 11, color: 'var(--ui-texto-2)' }}>
            Asistente IA
            {totalTokens > 0 && ` · ${totalTokens.toLocaleString()} tokens`}
          </span>
        </div>
      </div>

      {/* Selector de modelo */}
      <div ref={dropdownRef} style={{ position: esMovil ? 'static' : 'relative', flexShrink: esMovil ? 1 : 0, minWidth: 0 }}>
        <button
          onClick={() => setDropdownAbierto(!dropdownAbierto)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: esMovil ? '5px 8px' : '6px 12px',
            borderRadius: 'var(--ui-r-lg)',
            border: '1px solid var(--ui-borde)',
            background: 'var(--ui-fondo, #faf8f4)',
            color: 'var(--ui-texto)',
            fontSize: esMovil ? 11 : 12,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: esMovil ? 150 : 'none',
          }}
          title="Seleccionar modelo de IA"
        >
          {/* Indicador de estado */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cargandoProviders
                ? '#aca596'
                : providerActivo?.ok
                  ? '#5c8a4f'
                  : '#b83a32',
              flexShrink: 0,
            }}
          />
          {cargandoProviders
            ? 'Verificando...'
            : providerActivo
              ? (esMovil ? providerActivo.model || providerActivo.provider : providerActivo.label)
              : 'Sin modelo'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownAbierto && providers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: esMovil ? 'auto' : '100%',
              right: esMovil ? 12 : 0,
              left: esMovil ? 12 : 'auto',
              marginTop: 4,
              background: 'var(--ui-superficie, #fffefb)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--ui-borde)',
              borderRadius: 'var(--ui-r-lg)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              zIndex: 100,
              minWidth: esMovil ? 200 : 260,
              maxWidth: esMovil ? 'calc(100vw - 24px)' : 'none',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ui-borde)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ui-texto-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Modelos disponibles
              </span>
            </div>
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  if (p.ok) {
                    onSeleccionarProvider(p.id);
                    setDropdownAbierto(false);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: p.id === providerSeleccionado ? 'var(--ui-seleccionado, rgba(184,85,40,0.08))' : 'transparent',
                  cursor: p.ok ? 'pointer' : 'not-allowed',
                  opacity: p.ok ? 1 : 0.5,
                  textAlign: 'left',
                  color: 'var(--ui-texto)',
                }}
              >
                {/* Dot de estado */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: p.ok ? '#5c8a4f' : '#b83a32',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ui-texto-2)' }}>
                    {p.ok ? p.detalle : p.detalle}
                    {p.es_default && ' · Por defecto'}
                  </div>
                </div>
                {p.id === providerSeleccionado && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b85528" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <UiBoton
        texto={esMovil ? '+' : 'Nueva conversación'}
        variante="contorno"
        alHacerClick={onNuevaConversacion}
        style={{ flexShrink: 0 }}
      />
    </div>
  );
}
