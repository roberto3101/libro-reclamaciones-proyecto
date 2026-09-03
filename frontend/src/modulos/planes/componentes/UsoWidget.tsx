// src/modulos/planes/componentes/UsoWidget.tsx
// Widget compacto para el dashboard. Si falla la API, no muestra nada.
import { usarUsoTenant } from '../ganchos/usarSuscripcion';
import { porcentajeUso } from '@/tipos/suscripcion';

const C = {
  primario: 'var(--ui-acento)',
  primarioTexto: 'var(--ui-acento-texto)',
  texto: 'var(--ui-texto)',
  textoSec: 'var(--ui-texto-2)',
  borde: 'var(--ui-borde)',
  exito: 'var(--ui-exito)',
  exitoTexto: 'var(--ui-exito-texto)',
  advertencia: 'var(--ui-adv)',
  advertenciaTexto: 'var(--ui-adv-texto)',
  peligro: 'var(--ui-peligro)',
  peligroTexto: 'var(--ui-peligro-texto)',
  info: 'var(--ui-info)',
  infoTexto: 'var(--ui-info-texto)',
};

export default function UsoWidget() {
  const { uso, cargando } = usarUsoTenant();

  if (cargando || !uso) return null;

  const recursos = [
    { etiqueta: 'Sedes', uso: uso.uso_sedes, limite: uso.limite_sedes },
    { etiqueta: 'Usuarios', uso: uso.uso_usuarios, limite: uso.limite_usuarios },
    { etiqueta: 'Reclamos', uso: uso.uso_reclamos_mes, limite: uso.limite_reclamos_mes },
    { etiqueta: 'Chatbots', uso: uso.uso_chatbots, limite: uso.limite_chatbots },
    { etiqueta: 'WhatsApp', uso: uso.uso_canales_whatsapp, limite: uso.limite_canales_whatsapp },
  ];

  return (
    <div style={est.contenedor}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.texto }}>Tu plan</span>
        <span style={{
          background: C.primario + '15',
          color: C.primarioTexto,
          padding: '4px 12px',
          borderRadius: 'var(--ui-r-lg)',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}>
          {uso.plan_nombre}
          {uso.es_trial && ' (Prueba gratuita)'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recursos.map((r) => {
          const pct = porcentajeUso(r.uso, r.limite);
          const ilimitado = r.limite === -1;
          const color = ilimitado ? C.info : pct >= 90 ? C.peligro : pct >= 70 ? C.advertencia : C.exito;

          return (
            <div key={r.etiqueta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: C.textoSec }}>{r.etiqueta}</span>
                <span style={{ fontSize: '0.78rem', color: C.textoSec, fontWeight: 600 }}>
                  {ilimitado ? `${r.uso}/∞` : `${r.uso}/${r.limite}`}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--ui-hover)' }}>
                <div style={{
                  width: ilimitado ? '10%' : `${Math.min(pct, 100)}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: color,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <a href="/suscripcion" style={{
        display: 'block',
        textAlign: 'center',
        marginTop: 16,
        fontSize: '0.8rem',
        color: C.primarioTexto,
        fontWeight: 600,
        textDecoration: 'none',
      }}>
        Ver detalles del plan →
      </a>
    </div>
  );
}

const est = {
  contenedor: {
    background: 'var(--ui-superficie)',
    borderRadius: 'var(--ui-r-xl)',
    padding: 20,
    border: `1px solid ${C.borde}`,
  } as React.CSSProperties,
};