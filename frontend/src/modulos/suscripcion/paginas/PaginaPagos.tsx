// src/modulos/suscripcion/paginas/PaginaPagos.tsx
import { useEffect, useState } from 'react';
import { UiCargando } from '@/ui';
import { UiCaja } from '@/ui';
import { pagosApi } from '../api/pagos.api';
import type { ConfigPagos, Pago, PagoManualRequest } from '../api/pagos.api';
import { usarPlanes } from '../ganchos/usarPlanes';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoFecha, formatoMoneda } from '@/aplicacion/helpers/formato';

const C = {
  primario: 'var(--ui-acento)',
  primarioTexto: 'var(--ui-acento-texto)',
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

const colorEstado: Record<Pago['estado'], string> = {
  PAGADO: C.exito,
  PENDIENTE: C.advertencia,
  FALLIDO: C.peligro,
  REEMBOLSADO: C.textoSec,
};

type Tab = 'cobrar' | 'historial';

export default function PaginaPagos() {
  const { planes, cargando: cargandoPlanes } = usarPlanes();
  const [config, setConfig] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>('cobrar');
  const [enviando, setEnviando] = useState(false);

  // Formulario de cobro manual (Yape / transferencia)
  const [form, setForm] = useState<PagoManualRequest>({
    proveedor: 'YAPE',
    referencia: '',
    plan_codigo: '',
    ciclo: 'MENSUAL',
    email: '',
    notas: '',
  });

  async function cargar() {
    try {
      const [cfg, hist] = await Promise.all([
        pagosApi.obtenerConfig(),
        pagosApi.historial(),
      ]);
      setConfig(cfg);
      setPagos(hist ?? []);
    } catch (e) {
      manejarError(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const planesPagos = (planes ?? []).filter((p) => p.precio_mensual > 0 && p.activo);

  async function registrarManual(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plan_codigo) {
      notificar.error('Elige un plan');
      return;
    }
    setEnviando(true);
    try {
      await pagosApi.registrarManual(form);
      notificar.exito('Pago registrado y plan activado');
      setForm({ ...form, referencia: '', notas: '' });
      await cargar();
    } catch (err) {
      manejarError(err);
    } finally {
      setEnviando(false);
    }
  }

  if (cargando || cargandoPlanes) return <UiCargando />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, color: C.texto }}>Pagos</h1>
        <p style={{ margin: '4px 0 0', color: C.textoSec, fontSize: 14 }}>
          Registra cobros y consulta el historial de la cuenta.
        </p>
      </div>

      {/* Estado de las pasarelas */}
      <UiCaja>
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: C.texto }}>Medios de cobro</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            <EstadoPasarela
              nombre="Mercado Pago"
              detalle="Suscripción recurrente, cobra sola cada mes"
              activo={!!config?.mercadopago.habilitado}
            />
            <EstadoPasarela
              nombre="Culqi"
              detalle="Cobro único con tarjeta"
              activo={!!config?.culqi.habilitado}
            />
            <EstadoPasarela nombre="Yape / Transferencia" detalle="Registro manual" activo />
          </div>
        </div>
      </UiCaja>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${C.borde}` }}>
        {(['cobrar', 'historial'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${C.primario}` : '2px solid transparent',
              color: tab === t ? C.primarioTexto : C.textoSec,
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === 'cobrar' ? 'Registrar cobro' : `Historial (${pagos.length})`}
          </button>
        ))}
      </div>

      {tab === 'cobrar' && (
        <UiCaja>
          <form onSubmit={registrarManual} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.textoSec }}>
              Para cobros recibidos por Yape o transferencia. Al guardar se activa el plan del cliente.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <Campo etiqueta="Medio">
                <select
                  value={form.proveedor}
                  onChange={(e) => setForm({ ...form, proveedor: e.target.value as PagoManualRequest['proveedor'] })}
                  style={estiloInput}
                >
                  <option value="YAPE">Yape</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="MANUAL">Otro / manual</option>
                </select>
              </Campo>

              <Campo etiqueta="Plan">
                <select
                  value={form.plan_codigo}
                  onChange={(e) => setForm({ ...form, plan_codigo: e.target.value })}
                  style={estiloInput}
                >
                  <option value="">Elegir…</option>
                  {planesPagos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre} — {formatoMoneda(p.precio_mensual)}/mes
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo etiqueta="Ciclo">
                <select
                  value={form.ciclo}
                  onChange={(e) => setForm({ ...form, ciclo: e.target.value as 'MENSUAL' | 'ANUAL' })}
                  style={estiloInput}
                >
                  <option value="MENSUAL">Mensual</option>
                  <option value="ANUAL">Anual</option>
                </select>
              </Campo>

              <Campo etiqueta="N° de operación">
                <input
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Código del Yape"
                  style={estiloInput}
                />
              </Campo>
            </div>

            <Campo etiqueta="Notas (opcional)">
              <input
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Quién pagó, por qué medio…"
                style={estiloInput}
              />
            </Campo>

            <div>
              <button
                type="submit"
                disabled={enviando}
                style={{
                  background: C.primario,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: enviando ? 'wait' : 'pointer',
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando ? 'Registrando…' : 'Registrar y activar'}
              </button>
            </div>
          </form>
        </UiCaja>
      )}

      {tab === 'historial' && (
        <UiCaja>
          <div style={{ padding: 16, overflowX: 'auto' }}>
            {pagos.length === 0 ? (
              <p style={{ color: C.textoSec, fontSize: 14, margin: 0 }}>Todavía no hay pagos registrados.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.textoSec }}>
                    {['Fecha', 'Medio', 'Monto', 'Ciclo', 'Estado', 'Referencia'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.borde}`, fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td style={celda}>{formatoFecha(p.fecha_creacion)}</td>
                      <td style={celda}>{p.proveedor}</td>
                      <td style={{ ...celda, fontVariantNumeric: 'tabular-nums' }}>{formatoMoneda(p.monto)}</td>
                      <td style={celda}>{p.ciclo}</td>
                      <td style={celda}>
                        <span
                          style={{
                            color: colorEstado[p.estado],
                            border: `1px solid ${colorEstado[p.estado]}`,
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {p.estado}
                        </span>
                      </td>
                      <td style={{ ...celda, color: C.textoSec, fontSize: 12 }}>
                        {p.referencia_externa || p.error_mensaje || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </UiCaja>
      )}
    </div>
  );
}

function EstadoPasarela({ nombre, detalle, activo }: { nombre: string; detalle: string; activo: boolean }) {
  return (
    <div style={{ border: `1px solid ${C.borde}`, borderRadius: 6, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: activo ? C.exito : C.textoSec,
            flex: 'none',
          }}
        />
        <strong style={{ fontSize: 14, color: C.texto }}>{nombre}</strong>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: C.textoSec }}>{detalle}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: activo ? C.exitoTexto : C.textoSec }}>
        {activo ? 'Disponible' : 'Sin configurar'}
      </p>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, color: C.textoSec }}>{etiqueta}</span>
      {children}
    </label>
  );
}

const estiloInput: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${C.borde}`,
  borderRadius: 6,
  background: C.tarjeta,
  color: C.texto,
  fontSize: 14,
  width: '100%',
};

const celda: React.CSSProperties = {
  padding: '9px 10px',
  borderBottom: `1px solid ${C.borde}`,
  color: C.texto,
};
