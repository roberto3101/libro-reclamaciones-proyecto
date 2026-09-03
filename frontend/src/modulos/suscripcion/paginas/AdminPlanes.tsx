// src/modulos/suscripcion/paginas/AdminPlanes.tsx
import { useState, useCallback } from 'react';
import { UiCargando, UiIcono } from '@/ui';
import { UiCaja } from '@/ui';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { usarPlanes } from '../ganchos/usarPlanes';
import { suscripcionApi } from '../api/suscripcion.api';
import { confirmar } from '@/aplicacion/helpers/confirmar';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoMoneda } from '@/aplicacion/helpers/formato';
import type { Plan } from '@/tipos';

const C = {
  primario: 'var(--ui-acento)',
  primarioTexto: 'var(--ui-acento-texto)',
  texto: '#302d27',
  textoSec: '#857e70',
  borde: '#e5e0d4',
  tarjeta: '#fffefb',
  exito: 'var(--ui-exito)',
  exitoTexto: 'var(--ui-exito-texto)',
  peligro: 'var(--ui-peligro)',
  peligroTexto: 'var(--ui-peligro-texto)',
};

const PLAN_VACIO: Partial<Plan> = {
  codigo: '', nombre: '', descripcion: null, precio_mensual: 0, precio_anual: null,
  precio_sede_extra: 0, precio_usuario_extra: 0, max_sedes: 1, max_usuarios: 1,
  max_reclamos_mes: -1, max_chatbots: 0, max_canales_whatsapp: 0, max_storage_mb: 500,
  permite_chatbot: false, permite_whatsapp: false, permite_email: true,
  permite_reportes_pdf: false, permite_exportar_excel: false, permite_api: false,
  permite_marca_blanca: false, permite_multi_idioma: false, permite_asistente_ia: false,
  permite_atencion_vivo: false, orden: 10, activo: true, destacado: false,
};

export default function AdminPlanes() {
  const { planes, cargando, recargar } = usarPlanes(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [planEditando, setPlanEditando] = useState<Partial<Plan>>(PLAN_VACIO);
  const [guardando, setGuardando] = useState(false);

  const abrirCrear = () => { setPlanEditando({ ...PLAN_VACIO }); setModalAbierto(true); };
  const abrirEditar = (plan: Plan) => { setPlanEditando({ ...plan }); setModalAbierto(true); };

  const guardar = useCallback(async () => {
    if (!planEditando.codigo || !planEditando.nombre) {
      notificar.error('Código y nombre son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      if (planEditando.id) {
        await suscripcionApi.actualizarPlan(planEditando.id, planEditando);
        notificar.exito('Plan actualizado');
      } else {
        await suscripcionApi.crearPlan(planEditando);
        notificar.exito('Plan creado');
      }
      setModalAbierto(false);
      recargar();
    } catch (error) {
      manejarError(error);
    } finally {
      setGuardando(false);
    }
  }, [planEditando, recargar]);

  const toggleActivo = async (plan: Plan) => {
    const accion = plan.activo ? 'desactivar' : 'activar';
    const ok = await confirmar({
      titulo: `¿${plan.activo ? 'Desactivar' : 'Activar'} ${plan.nombre}?`,
      texto: plan.activo
        ? 'Los tenants con este plan no se verán afectados, pero no se podrá seleccionar.'
        : 'El plan estará disponible para nuevos tenants.',
      textoConfirmar: `Sí, ${accion}`,
    });
    if (!ok) return;
    try {
      if (plan.activo) { await suscripcionApi.desactivarPlan(plan.id); }
      else { await suscripcionApi.activarPlan(plan.id); }
      notificar.exito(`Plan ${accion === 'activar' ? 'activado' : 'desactivado'}`);
      recargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const set = (campo: string, valor: unknown) => {
    setPlanEditando((prev) => ({ ...prev, [campo]: valor }));
  };

  if (cargando) {
    return (
      <UiCaja centrado sx={{ minHeight: '60vh' }}>
        <UiCargando tipo="anillo" etiqueta="Cargando planes..." />
      </UiCaja>
    );
  }

  return (
    <div style={est.contenedor}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: C.texto }}>Administrar Planes</h2>
        <button style={est.btnPrimario} onClick={abrirCrear}>+ Nuevo Plan</button>
      </div>

      <div style={{ ...est.tarjeta, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={est.tabla}>
            <thead>
              <tr>
                <th style={est.th}>Orden</th>
                <th style={est.th}>Código</th>
                <th style={est.th}>Nombre</th>
                <th style={est.th}>Mensual</th>
                <th style={est.th}>Anual</th>
                <th style={est.th}>Sedes</th>
                <th style={est.th}>Usuarios</th>
                <th style={est.th}>Estado</th>
                <th style={est.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {planes.sort((a, b) => a.orden - b.orden).map((plan) => (
                <tr key={plan.id} style={{ opacity: plan.activo ? 1 : 0.5 }}>
                  <td style={est.td}>{plan.orden}</td>
                  <td style={est.td}><code style={est.code}>{plan.codigo}</code></td>
                  <td style={est.td}>
                    <strong>{plan.nombre}</strong>
                    {plan.destacado && <span style={est.badgeDest}><UiIcono nombre="star" relleno tamano={13} /></span>}
                  </td>
                  <td style={est.td}>{formatoMoneda(plan.precio_mensual)}</td>
                  <td style={est.td}>{plan.precio_anual != null ? formatoMoneda(plan.precio_anual) : '—'}</td>
                  <td style={est.td}>{plan.max_sedes === -1 ? '∞' : plan.max_sedes}</td>
                  <td style={est.td}>{plan.max_usuarios === -1 ? '∞' : plan.max_usuarios}</td>
                  <td style={est.td}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 'var(--ui-r-lg)', fontSize: '0.75rem', fontWeight: 600,
                      background: plan.activo ? '#ecfdf5' : '#fbf0ee', color: plan.activo ? C.exito : C.peligro,
                    }}>
                      {plan.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={est.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={est.btnAccion} onClick={() => abrirEditar(plan)}>Editar</button>
                      <button style={{ ...est.btnAccion, color: plan.activo ? C.peligroTexto : C.exitoTexto }} onClick={() => toggleActivo(plan)}>
                        {plan.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAbierto && (
        <ModalBase
          abierto={modalAbierto}
          alCerrar={() => setModalAbierto(false)}
          titulo={planEditando.id ? 'Editar Plan' : 'Nuevo Plan'}
          maxAncho="md"
          pie={
            <>
              <BotonModal texto="Cancelar" variante="secundario" onClick={() => setModalAbierto(false)} />
              <BotonModal
                texto={planEditando.id ? 'Guardar cambios' : 'Crear plan'}
                onClick={guardar}
                cargando={guardando}
              />
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SeccionForm titulo="Información básica">
              <div style={est.gridForm}>
                <InputForm etiqueta="Código" valor={planEditando.codigo ?? ''} onChange={(v) => set('codigo', v.toUpperCase())} placeholder="PYME" disabled={!!planEditando.id} />
                <InputForm etiqueta="Nombre" valor={planEditando.nombre ?? ''} onChange={(v) => set('nombre', v)} placeholder="Plan Pyme" />
                <InputForm etiqueta="Orden" tipo="number" valor={String(planEditando.orden ?? 10)} onChange={(v) => set('orden', Number(v))} />
                <CheckForm etiqueta="Destacado" valor={planEditando.destacado ?? false} onChange={(v) => set('destacado', v)} />
              </div>
              <InputForm etiqueta="Descripción" valor={planEditando.descripcion ?? ''} onChange={(v) => set('descripcion', v || null)} placeholder="Descripción corta del plan" ancho="100%" />
            </SeccionForm>
            <SeccionForm titulo="Precios (S/)">
              <div style={est.gridForm}>
                <InputForm etiqueta="Mensual" tipo="number" valor={String(planEditando.precio_mensual ?? 0)} onChange={(v) => set('precio_mensual', Number(v))} />
                <InputForm etiqueta="Anual" tipo="number" valor={String(planEditando.precio_anual ?? '')} onChange={(v) => set('precio_anual', v ? Number(v) : null)} placeholder="Vacío si no aplica" />
                <InputForm etiqueta="Sede extra" tipo="number" valor={String(planEditando.precio_sede_extra ?? 0)} onChange={(v) => set('precio_sede_extra', Number(v))} />
                <InputForm etiqueta="Usuario extra" tipo="number" valor={String(planEditando.precio_usuario_extra ?? 0)} onChange={(v) => set('precio_usuario_extra', Number(v))} />
              </div>
            </SeccionForm>
            <SeccionForm titulo="Límites (-1 = ilimitado)">
              <div style={est.gridForm}>
                <InputForm etiqueta="Sedes" tipo="number" valor={String(planEditando.max_sedes ?? 1)} onChange={(v) => set('max_sedes', Number(v))} />
                <InputForm etiqueta="Usuarios" tipo="number" valor={String(planEditando.max_usuarios ?? 1)} onChange={(v) => set('max_usuarios', Number(v))} />
                <InputForm etiqueta="Reclamos/mes" tipo="number" valor={String(planEditando.max_reclamos_mes ?? -1)} onChange={(v) => set('max_reclamos_mes', Number(v))} />
                <InputForm etiqueta="Chatbots" tipo="number" valor={String(planEditando.max_chatbots ?? 0)} onChange={(v) => set('max_chatbots', Number(v))} />
                <InputForm etiqueta="Canales WhatsApp" tipo="number" valor={String(planEditando.max_canales_whatsapp ?? 0)} onChange={(v) => set('max_canales_whatsapp', Number(v))} />
                <InputForm etiqueta="Storage (MB)" tipo="number" valor={String(planEditando.max_storage_mb ?? 500)} onChange={(v) => set('max_storage_mb', Number(v))} />
              </div>
            </SeccionForm>
            <SeccionForm titulo="Funcionalidades">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <CheckForm etiqueta="Chatbot" valor={planEditando.permite_chatbot ?? false} onChange={(v) => set('permite_chatbot', v)} />
                <CheckForm etiqueta="WhatsApp" valor={planEditando.permite_whatsapp ?? false} onChange={(v) => set('permite_whatsapp', v)} />
                <CheckForm etiqueta="Email" valor={planEditando.permite_email ?? true} onChange={(v) => set('permite_email', v)} />
                <CheckForm etiqueta="Reportes PDF" valor={planEditando.permite_reportes_pdf ?? false} onChange={(v) => set('permite_reportes_pdf', v)} />
                <CheckForm etiqueta="Exportar Excel" valor={planEditando.permite_exportar_excel ?? false} onChange={(v) => set('permite_exportar_excel', v)} />
                <CheckForm etiqueta="API" valor={planEditando.permite_api ?? false} onChange={(v) => set('permite_api', v)} />
                <CheckForm etiqueta="Marca blanca" valor={planEditando.permite_marca_blanca ?? false} onChange={(v) => set('permite_marca_blanca', v)} />
                <CheckForm etiqueta="Multi-idioma" valor={planEditando.permite_multi_idioma ?? false} onChange={(v) => set('permite_multi_idioma', v)} />
                <CheckForm etiqueta="Asistente IA" valor={planEditando.permite_asistente_ia ?? false} onChange={(v) => set('permite_asistente_ia', v)} />
                <CheckForm etiqueta="Atención en vivo" valor={planEditando.permite_atencion_vivo ?? false} onChange={(v) => set('permite_atencion_vivo', v)} />
              </div>
            </SeccionForm>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

function SeccionForm({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: C.primarioTexto, fontWeight: 700 }}>{titulo}</h4>
      {children}
    </div>
  );
}

function InputForm({ etiqueta, valor, onChange, tipo = 'text', placeholder, disabled, ancho }: {
  etiqueta: string; valor: string; onChange: (v: string) => void;
  tipo?: string; placeholder?: string; disabled?: boolean; ancho?: string;
}) {
  return (
    <div style={{ width: ancho }}>
      <label style={est.label}>{etiqueta}</label>
      <input style={est.input} type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

function CheckForm({ etiqueta, valor, onChange }: { etiqueta: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={est.checkLabel}>
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: C.primario }} />
      <span>{etiqueta}</span>
    </label>
  );
}

const est = {
  contenedor: { maxWidth: 1100, margin: '0 auto', padding: '32px 20px' } as React.CSSProperties,
  tarjeta: { background: C.tarjeta, borderRadius: 'var(--ui-r-xl)', border: `1px solid ${C.borde}` } as React.CSSProperties,
  tabla: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' },
  th: { textAlign: 'left' as const, padding: '12px 16px', borderBottom: `2px solid ${C.borde}`, color: C.textoSec, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const },
  td: { padding: '12px 16px', borderBottom: `1px solid ${C.borde}`, color: C.texto },
  code: { background: '#f1eee6', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem' },
  badgeDest: { background: '#f4e7c5', color: '#5c3f0b', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', marginLeft: 6 },
  btnPrimario: { padding: '10px 24px', border: 'none', borderRadius: 'var(--ui-r-lg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: C.primario, color: '#fff' } as React.CSSProperties,
  btnSecundario: { padding: '10px 24px', border: `1px solid ${C.borde}`, borderRadius: 'var(--ui-r-lg)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: '#fff', color: C.texto } as React.CSSProperties,
  btnAccion: { padding: '4px 12px', border: 'none', background: 'none', cursor: 'pointer', color: C.primario, fontWeight: 600, fontSize: '0.8rem' } as React.CSSProperties,
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: C.textoSec, marginBottom: 4, textTransform: 'uppercase' as const } as React.CSSProperties,
  input: { width: '100%', padding: '8px 12px', border: `1px solid ${C.borde}`, borderRadius: 'var(--ui-r-lg)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: C.texto, cursor: 'pointer' } as React.CSSProperties,
};