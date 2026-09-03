// src/modulos/planes/paginas/PaginaSuscripcion.tsx
import { useState } from 'react';
import { UiCargando } from '@/ui';
import { UiCaja } from '@/ui';
import { usarSuscripcion, usarUsoTenant, usarHistorialSuscripciones } from '../ganchos/usarSuscripcion';
import { planesApi } from '../api/planes.api';
import { confirmar } from '@/aplicacion/helpers/confirmar';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoFecha, formatoMoneda } from '@/aplicacion/helpers/formato';
import { porcentajeUso } from '@/tipos/suscripcion';
import type { Plan, CicloSuscripcion } from '@/tipos';
import PaginaPlanes from './PaginaPlanes';

type Tab = 'resumen' | 'cambiar' | 'historial';

const C = {
  primario: 'var(--ui-acento)',
  primarioTexto: 'var(--ui-acento-texto)',
  fondo: 'var(--ui-fondo)',
  tarjeta: 'var(--ui-superficie)',
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

function ThTooltip({ texto }: { texto: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'help', marginLeft: 4, verticalAlign: 'middle' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      ?
      {visible && (
        <span style={{ position: 'fixed', zIndex: 99999, background: '#302d27', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', pointerEvents: 'none', marginTop: 24 }}>
          {texto}
        </span>
      )}
    </span>
  );
}

export default function PaginaSuscripcion() {
  const { datos, cargando, recargar } = usarSuscripcion();
  const { uso, cargando: cargandoUso } = usarUsoTenant();
  const { historial, cargando: cargandoHist } = usarHistorialSuscripciones();
  const [tab, setTab] = useState<Tab>('resumen');

  if (cargando) {
    return (
      <UiCaja centrado sx={{ minHeight: '60vh' }}>
        <UiCargando tipo="anillo" etiqueta="Cargando suscripción..." />
      </UiCaja>
    );
  }

  if (!datos) {
    return (
      <div style={est.contenedor}>
        <h2 style={est.titulo}>Mi Suscripción</h2>
        <div style={est.tarjeta}>
          <p style={{ color: C.textoSec }}>No tienes una suscripción activa.</p>
          <a href="/planes" style={{ color: C.primarioTexto, fontWeight: 600 }}>Ver planes disponibles →</a>
        </div>
      </div>
    );
  }

  const { suscripcion: sus, plan } = datos;

  const colorEstado: Record<string, string> = {
    ACTIVA: C.exito, TRIAL: C.info, SUSPENDIDA: C.advertencia, CANCELADA: C.peligro, VENCIDA: C.peligro,
  };

  const etiquetaEstado: Record<string, string> = {
    ACTIVA: 'Activa', TRIAL: 'Prueba gratuita', SUSPENDIDA: 'Suspendida', CANCELADA: 'Cancelada', VENCIDA: 'Vencida',
  };

  const etiquetaActivadoPor: Record<string, string> = {
    UPGRADE: 'Cambio de plan', ONBOARDING: 'Registro inicial', ADMIN: 'Administrador', SYSTEM: 'Sistema', MANUAL: 'Manual',
  };

  const etiquetaCiclo: Record<string, string> = {
    MENSUAL: 'Mensual', ANUAL: 'Anual',
  };

  const manejarCambiarPlan = async (nuevoPlan: Plan, ciclo: CicloSuscripcion) => {
    const confirmado = await confirmar({
      titulo: `¿Cambiar a ${nuevoPlan.nombre}?`,
      texto: `Tu plan actual será reemplazado por ${nuevoPlan.nombre} (${ciclo.toLowerCase()}).`,
      textoConfirmar: 'Sí, cambiar plan',
    });
    if (!confirmado) return;

    try {
      await planesApi.cambiarPlan({ plan_codigo: nuevoPlan.codigo, ciclo });
      notificar.exito(`Plan cambiado a ${nuevoPlan.nombre}`);
      recargar();
      setTab('resumen');
    } catch (error) {
      manejarError(error);
    }
  };

  return (
    <div style={est.contenedor}>
      <h2 style={est.titulo}>Mi Suscripción</h2>

      <div style={est.tabs}>
        {(['resumen', 'cambiar', 'historial'] as Tab[]).map((t) => (
          <button key={t} style={est.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'resumen' ? 'Resumen' : t === 'cambiar' ? 'Cambiar plan' : 'Historial'}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={est.tarjeta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: C.textoSec, fontWeight: 600 }}>PLAN ACTUAL</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.5rem', color: C.texto }}>{plan.nombre}</h3>
              </div>
              <span style={{
                background: colorEstado[sus.estado] ?? C.textoSec, color: '#fff',
                padding: '6px 16px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
              }}>
                {etiquetaEstado[sus.estado] ?? sus.estado}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Campo etiqueta="Ciclo" valor={etiquetaCiclo[sus.ciclo] ?? sus.ciclo} />
              <Campo etiqueta="Inicio" valor={formatoFecha(sus.fecha_inicio)} />
              <Campo etiqueta="Próximo cobro" valor={formatoFecha(sus.fecha_proximo_cobro)} />
              {sus.es_trial && <Campo etiqueta="Prueba termina" valor={formatoFecha(sus.fecha_fin_trial)} />}
              <Campo etiqueta="Precio" valor={`${formatoMoneda(plan.precio_mensual)}/mes`} />
            </div>
          </div>

          {!cargandoUso && uso && (
            <div style={est.tarjeta}>
              <h4 style={{ margin: '0 0 16px', color: C.texto }}>Uso de recursos</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <BarraUso etiqueta="Sedes" uso={uso.uso_sedes} limite={uso.limite_sedes} />
                <BarraUso etiqueta="Usuarios" uso={uso.uso_usuarios} limite={uso.limite_usuarios} />
                <BarraUso etiqueta="Reclamos/mes" uso={uso.uso_reclamos_mes} limite={uso.limite_reclamos_mes} />
                <BarraUso etiqueta="Chatbots" uso={uso.uso_chatbots} limite={uso.limite_chatbots} />
                <BarraUso etiqueta="Canales WhatsApp" uso={uso.uso_canales_whatsapp} limite={uso.limite_canales_whatsapp} />
              </div>
            </div>
          )}

          {!cargandoUso && uso && (
            <div style={est.tarjeta}>
              <h4 style={{ margin: '0 0 16px', color: C.texto }}>Funcionalidades</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <FuncItem nombre="Chatbot IA" activo={uso.permite_chatbot} />
                <FuncItem nombre="WhatsApp" activo={uso.permite_whatsapp} />
                <FuncItem nombre="Email" activo={uso.permite_email} />
                <FuncItem nombre="Reportes PDF" activo={uso.permite_reportes_pdf} />
                <FuncItem nombre="Exportar Excel" activo={uso.permite_exportar_excel} />
                <FuncItem nombre="Atención en vivo" activo={uso.permite_atencion_vivo} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'cambiar' && (
        <PaginaPlanes planActualCodigo={plan.codigo} onSeleccionar={manejarCambiarPlan} />
      )}

      {tab === 'historial' && (
        <div style={est.tarjeta}>
          {cargandoHist ? (
            <UiCargando tipo="anillo" etiqueta="Cargando historial..." />
          ) : historial.length === 0 ? (
            <p style={{ color: C.textoSec }}>No hay suscripciones anteriores.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={est.tabla}>
                <thead>
                  <tr>
                    <th style={est.th}>Estado <ThTooltip texto="Estado actual de la suscripción (activa, expirada, cancelada, etc.)" /></th>
                    <th style={est.th}>Ciclo <ThTooltip texto="Frecuencia de facturación del plan (mensual o anual)" /></th>
                    <th style={est.th}>Inicio <ThTooltip texto="Fecha en que comenzó esta suscripción" /></th>
                    <th style={est.th}>Fin <ThTooltip texto="Fecha en que finaliza o finalizó esta suscripción" /></th>
                    <th style={est.th}>Periodo de prueba <ThTooltip texto="Indica si la suscripción incluye un periodo de prueba gratuito" /></th>
                    <th style={est.th}>Asignado por <ThTooltip texto="Usuario que activó o asignó esta suscripción" /></th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((s) => (
                    <tr key={s.id}>
                      <td style={est.td}>
                        <span style={{
                          background: (colorEstado[s.estado] ?? '#857e70') + '20',
                          color: colorEstado[s.estado] ?? '#857e70',
                          padding: '4px 10px', borderRadius: 'var(--ui-r-lg)', fontSize: '0.8rem', fontWeight: 600,
                        }}>
                          {etiquetaEstado[s.estado] ?? s.estado}
                        </span>
                      </td>
                      <td style={est.td}>{etiquetaCiclo[s.ciclo] ?? s.ciclo}</td>
                      <td style={est.td}>{formatoFecha(s.fecha_inicio)}</td>
                      <td style={est.td}>{formatoFecha(s.fecha_fin)}</td>
                      <td style={est.td}>{s.es_trial ? `Sí (${s.dias_trial} días)` : 'No'}</td>
                      <td style={est.td}>{etiquetaActivadoPor[s.activado_por ?? ''] ?? s.activado_por ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: C.textoSec, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{etiqueta}</span>
      <p style={{ margin: '4px 0 0', fontWeight: 500, color: C.texto }}>{valor || '—'}</p>
    </div>
  );
}

function BarraUso({ etiqueta, uso, limite }: { etiqueta: string; uso: number; limite: number }) {
  const pct = porcentajeUso(uso, limite);
  const ilimitado = limite === -1;
  const color = ilimitado ? C.info : pct >= 90 ? C.peligro : pct >= 70 ? C.advertencia : C.exito;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: C.texto }}>{etiqueta}</span>
        <span style={{ fontSize: '0.85rem', color: C.textoSec }}>{ilimitado ? `${uso} / ∞` : `${uso} / ${limite}`}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--ui-hover)', overflow: 'hidden' }}>
        <div style={{ width: ilimitado ? '15%' : `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function FuncItem({ nombre, activo }: { nombre: string; activo: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: activo ? 1 : 0.4 }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: activo ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave)',
        color: activo ? C.exitoTexto : C.peligroTexto, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', flexShrink: 0,
      }}>
        {activo ? '✓' : '✕'}
      </span>
      <span style={{ fontSize: '0.85rem', color: C.texto }}>{nombre}</span>
    </div>
  );
}

const est = {
  contenedor: { maxWidth: 960, margin: '0 auto', padding: '32px 20px' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: 700, color: C.texto, margin: '0 0 24px' },
  tarjeta: { background: C.tarjeta, borderRadius: 'var(--ui-r-xl)', padding: 24, border: `1px solid ${C.borde}` } as React.CSSProperties,
  tabs: { display: 'flex', gap: 0, borderBottom: `2px solid ${C.borde}`, marginBottom: 24 } as React.CSSProperties,
  tab: (activo: boolean) => ({
    padding: '12px 24px', border: 'none', borderBottom: activo ? `2px solid ${C.primario}` : '2px solid transparent',
    marginBottom: -2, background: 'none', cursor: 'pointer', fontWeight: activo ? 700 : 500,
    color: activo ? C.primarioTexto : C.textoSec, fontSize: '0.9rem', transition: 'all 0.2s',
  }) as React.CSSProperties,
  tabla: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.9rem' },
  th: { textAlign: 'left' as const, padding: '10px 12px', borderBottom: `2px solid ${C.borde}`, color: C.textoSec, fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const },
  td: { padding: '12px', borderBottom: `1px solid ${C.borde}`, color: C.texto },
};