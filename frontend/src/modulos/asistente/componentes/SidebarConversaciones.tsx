import { UiBoton } from '@/ui';
import { UiIconoAnadir, UiIconoBorrar } from '@/ui';
import type { ConversacionResumen } from '@/tipos';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function fechaRelativa(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `hace ${dias}d`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

interface SidebarConversacionesProps {
  conversaciones: ConversacionResumen[];
  conversacionActiva: string | null;
  cargando: boolean;
  abierto: boolean;
  esMovil: boolean;
  onSeleccionar: (id: string) => void;
  onNueva: () => void;
  onEliminar: (id: string, e: React.MouseEvent) => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────────

export default function SidebarConversaciones({
  conversaciones,
  conversacionActiva,
  cargando,
  abierto,
  esMovil,
  onSeleccionar,
  onNueva,
  onEliminar,
}: SidebarConversacionesProps) {
  const ancho = 280;

  const estiloBase: React.CSSProperties = {
    width: abierto ? ancho : 0,
    minWidth: abierto ? ancho : 0,
    borderRight: abierto ? '1px solid var(--ui-borde)' : 'none',
    backgroundColor: 'var(--ui-superficie-2)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.2s, min-width 0.2s, transform 0.2s',
  };

  // En móvil: sidebar flotante absoluto
  const estiloMovil: React.CSSProperties = esMovil
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 20,
        width: ancho,
        minWidth: ancho,
        transform: abierto ? 'translateX(0)' : `translateX(-${ancho}px)`,
        boxShadow: abierto ? '4px 0 12px rgba(0,0,0,0.15)' : 'none',
      }
    : {};

  return (
    <div style={{ ...estiloBase, ...estiloMovil }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--ui-borde)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ui-texto)' }}>Conversaciones</span>
        <UiBoton
          variante="contorno"
          soloIcono
          iconoIzquierda={<UiIconoAnadir style={{ fontSize: 18 }} />}
          alHacerClick={onNueva}
          style={{ minWidth: 32, width: 32, height: 32 }}
        />
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {cargando ? (
          <p style={{ padding: 16, textAlign: 'center', color: 'var(--ui-texto-2)', fontSize: 13 }}>
            Cargando...
          </p>
        ) : conversaciones.length === 0 ? (
          <p style={{ padding: 16, textAlign: 'center', color: 'var(--ui-texto-2)', fontSize: 13 }}>
            Sin conversaciones aún
          </p>
        ) : (
          conversaciones.map((conv) => (
            <ItemConversacion
              key={conv.id}
              conv={conv}
              activa={conversacionActiva === conv.id}
              onSeleccionar={onSeleccionar}
              onEliminar={onEliminar}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--ui-borde)',
          fontSize: 11,
          color: 'var(--ui-texto-2)',
          textAlign: 'center',
        }}
      >
        Máx. 10 conversaciones · 7 días TTL
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponente: Item de conversación
// ──────────────────────────────────────────────────────────────────────────────

function ItemConversacion({
  conv,
  activa,
  onSeleccionar,
  onEliminar,
}: {
  conv: ConversacionResumen;
  activa: boolean;
  onSeleccionar: (id: string) => void;
  onEliminar: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={() => onSeleccionar(conv.id)}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--ui-r-lg)',
        marginBottom: 4,
        cursor: 'pointer',
        backgroundColor: activa ? 'rgba(61,114,118,0.12)' : 'transparent',
        border: activa ? '1px solid rgba(61,114,118,0.3)' : '1px solid transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!activa) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--ui-hover)';
      }}
      onMouseLeave={(e) => {
        if (!activa) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: activa ? 600 : 400,
            color: 'var(--ui-texto)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {conv.titulo}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ui-texto-2)', marginTop: 2 }}>
          {conv.total_mensajes} msgs · {fechaRelativa(conv.fecha_actualizacion)}
        </div>
      </div>

      <button
        onClick={(e) => onEliminar(conv.id, e)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          borderRadius: 4,
          color: '#aca596',
          flexShrink: 0,
          opacity: 0.6,
          transition: 'opacity 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.opacity = '1';
          btn.style.color = '#b83a32';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.opacity = '0.6';
          btn.style.color = '#aca596';
        }}
        title="Eliminar conversación"
      >
        <UiIconoBorrar style={{ fontSize: 14 }} />
      </button>
    </div>
  );
}