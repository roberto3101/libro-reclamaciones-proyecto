// src/modulos/planes/paginas/PaginaPlanes.tsx
import { useState } from 'react';
import { UiCargando } from '@/ui';
import { UiCaja } from '@/ui';
import { usarPlanes } from '../ganchos/usarPlanes';
import { usarSuscripcion } from '../ganchos/usarSuscripcion';
import { formatoMoneda } from '@/aplicacion/helpers/formato';
import { ahorroAnual, formatoLimite } from '@/tipos/plan';
import type { Plan } from '@/tipos';
import type { CicloSuscripcion } from '@/tipos';

const colores = {
  primario: 'var(--ui-acento)',
  primarioTexto: 'var(--ui-acento-texto)',
  primarioOscuro: 'var(--ui-acento-hover)',
  fondo: 'var(--ui-fondo)',
  tarjeta: 'var(--ui-superficie)',
  texto: 'var(--ui-texto)',
  textoSecundario: 'var(--ui-texto-2)',
  borde: 'var(--ui-borde)',
  exito: 'var(--ui-exito)',
  exitoTexto: 'var(--ui-exito-texto)',
  destacado: 'var(--ui-acento)',
};

const estilos = {
  contenedor: { maxWidth: 1100, margin: '0 auto', padding: '40px 20px' } as React.CSSProperties,
  titulo: { fontSize: '1.9rem', fontWeight: 600, fontFamily: 'var(--ui-fuente-titulo)', letterSpacing: '-0.02em', color: colores.texto, margin: 0 },
  subtitulo: { color: colores.textoSecundario, fontSize: '1rem', maxWidth: '58ch', marginTop: 8, marginBottom: 32 },
  toggle: { display: 'flex', gap: 0, background: 'var(--ui-hover)', border: '1px solid var(--ui-borde)', borderRadius: 'var(--ui-r-md)', padding: 3, width: 'fit-content', margin: '0 0 40px' } as React.CSSProperties,
  toggleBtn: (activo: boolean) => ({
    padding: '10px 28px', border: 'none', borderRadius: 'var(--ui-r-lg)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
    transition: 'all 0.25s ease', background: activo ? colores.primario : 'transparent',
    color: activo ? 'var(--ui-primario-sobre)' : colores.textoSecundario,
  }) as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'stretch' } as React.CSSProperties,
  tarjeta: (destacado: boolean, esActual: boolean) => ({
    background: colores.tarjeta, borderRadius: 'var(--ui-r-xl)', padding: '32px 28px',
    border: destacado ? `2px solid ${colores.primario}` : `1px solid ${colores.borde}`,
    position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, gap: 20,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: 'none',
    opacity: esActual ? 0.7 : 1,
  }) as React.CSSProperties,
  badge: {
    display: 'inline-block', alignSelf: 'flex-start',
    background: 'transparent', color: 'var(--ui-primario-texto)',
    border: '1px solid var(--ui-primario)', padding: '2px 8px',
    borderRadius: 'var(--ui-r-sm)', fontSize: '0.625rem', fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
  },
  planNombre: { fontSize: '1.15rem', fontWeight: 600, color: colores.texto, margin: 0 },
  precio: { display: 'flex', alignItems: 'baseline', gap: 4 },
  precioNumero: { fontSize: '2.25rem', fontWeight: 600, fontFamily: 'var(--ui-fuente-titulo)', fontVariantNumeric: 'tabular-nums', color: colores.texto },
  precioPeriodo: { fontSize: '1rem', color: colores.textoSecundario },
  ahorro: { background: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', padding: '4px 12px', borderRadius: 'var(--ui-r-lg)', fontSize: '0.8rem', fontWeight: 600, display: 'inline-block' },
  separador: { border: 'none', borderTop: `1px solid ${colores.borde}`, margin: '4px 0' },
  limites: { display: 'flex', flexDirection: 'column' as const, gap: 10 } as React.CSSProperties,
  limiteItem: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: colores.texto },
  check: { width: 18, height: 18, borderRadius: 'var(--ui-r-xs)', background: 'var(--ui-exito-suave-2)', color: colores.exito, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 } as React.CSSProperties,
  cross: { width: 18, height: 18, borderRadius: 'var(--ui-r-xs)', background: 'var(--ui-peligro-suave)', color: 'var(--ui-peligro)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, opacity: 0.5 } as React.CSSProperties,
  boton: (destacado: boolean, deshabilitado: boolean) => ({
    width: '100%', padding: '14px 0',
    border: destacado ? 'none' : `2px solid ${colores.primario}`, borderRadius: 'var(--ui-r-xl)',
    cursor: deshabilitado ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.95rem',
    transition: 'all 0.2s ease',
    background: deshabilitado ? 'var(--ui-hover)' : destacado ? colores.destacado : 'transparent',
    color: deshabilitado ? 'var(--ui-texto-2)' : destacado ? '#fff' : colores.primarioTexto, marginTop: 'auto',
  }) as React.CSSProperties,
  extras: { marginTop: 40, maxWidth: '58ch', color: colores.textoSecundario, fontSize: '0.85rem' },
};

interface Props {
  planActualCodigo?: string;
  onSeleccionar?: (plan: Plan, ciclo: CicloSuscripcion) => void;
  soloLectura?: boolean;
}

export default function PaginaPlanes({ planActualCodigo, onSeleccionar, soloLectura }: Props) {
  const { planes, cargando } = usarPlanes();
  const { datos: suscripcionData } = usarSuscripcion();
  const [ciclo, setCiclo] = useState<CicloSuscripcion>('MENSUAL');

  const codigoActual = planActualCodigo ?? suscripcionData?.plan?.codigo;

  if (cargando) {
    return (
      <UiCaja centrado sx={{ minHeight: '60vh' }}>
        <UiCargando tipo="anillo" etiqueta="Cargando planes..." />
      </UiCaja>
    );
  }

  const planesVisibles = planes.filter((p) => p.activo && p.codigo !== 'DEMO').sort((a, b) => a.orden - b.orden);

  const funcionalidades = (plan: Plan) => [
    { nombre: `${formatoLimite(plan.max_sedes)} sedes`, activo: true },
    { nombre: `${formatoLimite(plan.max_usuarios)} usuarios`, activo: true },
    { nombre: `${formatoLimite(plan.max_reclamos_mes)} reclamos/mes`, activo: true },
    { nombre: `${formatoLimite(plan.max_chatbots)} chatbots`, activo: plan.permite_chatbot },
    { nombre: `${formatoLimite(plan.max_canales_whatsapp)} canales WhatsApp`, activo: plan.permite_whatsapp },
    { nombre: 'Notificaciones email', activo: plan.permite_email },
    { nombre: 'Reportes PDF', activo: plan.permite_reportes_pdf },
    { nombre: 'Exportar Excel', activo: plan.permite_exportar_excel },
    { nombre: 'Atención en vivo', activo: plan.permite_atencion_vivo },
  ];

  return (
    <div style={estilos.contenedor}>
      <h1 style={estilos.titulo}>Elige tu plan</h1>
      <p style={estilos.subtitulo}>Escala tu gestión de reclamos con el plan que mejor se adapte a tu negocio</p>

      <div style={estilos.toggle}>
        <button style={estilos.toggleBtn(ciclo === 'MENSUAL')} onClick={() => setCiclo('MENSUAL')}>Mensual</button>
        <button style={estilos.toggleBtn(ciclo === 'ANUAL')} onClick={() => setCiclo('ANUAL')}>
          Anual
          <span style={{ background: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', marginLeft: 8, fontWeight: 700 }}>Ahorra</span>
        </button>
      </div>

      <div style={estilos.grid}>
        {planesVisibles.map((plan) => {
          const esActual = plan.codigo === codigoActual;
          const precioMostrar = ciclo === 'ANUAL' && plan.precio_anual != null ? plan.precio_anual / 12 : plan.precio_mensual;
          const ahorro = ahorroAnual(plan);

          return (
            <div
              key={plan.id}
              style={estilos.tarjeta(plan.destacado, esActual)}
            >
              {plan.destacado && <div style={estilos.badge}>Recomendado</div>}
              {esActual && (
                <div style={{ ...estilos.badge, color: 'var(--ui-exito-texto)', borderColor: 'var(--ui-exito)' }}>
                  Tu plan actual
                </div>
              )}

              <h3 style={estilos.planNombre}>{plan.nombre}</h3>
              {plan.descripcion && <p style={{ color: colores.textoSecundario, fontSize: '0.9rem', margin: 0 }}>{plan.descripcion}</p>}

              <div>
                <div style={estilos.precio}>
                  <span style={estilos.precioNumero}>{formatoMoneda(precioMostrar)}</span>
                  <span style={estilos.precioPeriodo}>/mes</span>
                </div>
                {ciclo === 'ANUAL' && plan.precio_anual != null && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: colores.textoSecundario }}>{formatoMoneda(plan.precio_anual)}/año</p>
                )}
                {ciclo === 'ANUAL' && ahorro > 0 && <span style={estilos.ahorro}>Ahorras {formatoMoneda(ahorro)}/año</span>}
              </div>

              <hr style={estilos.separador} />

              <div style={estilos.limites}>
                {funcionalidades(plan).map((f) => (
                  <div key={f.nombre} style={{ ...estilos.limiteItem, opacity: f.activo ? 1 : 0.4 }}>
                    <div style={f.activo ? estilos.check : estilos.cross}>{f.activo ? '✓' : '✕'}</div>
                    <span style={{ textDecoration: f.activo ? 'none' : 'line-through' }}>{f.nombre}</span>
                  </div>
                ))}
              </div>

              <hr style={estilos.separador} />

              {(plan.precio_sede_extra > 0 || plan.precio_usuario_extra > 0) && (
                <div style={{ fontSize: '0.8rem', color: colores.textoSecundario }}>
                  {plan.precio_sede_extra > 0 && <p style={{ margin: '2px 0' }}>+ {formatoMoneda(plan.precio_sede_extra)}/sede extra</p>}
                  {plan.precio_usuario_extra > 0 && <p style={{ margin: '2px 0' }}>+ {formatoMoneda(plan.precio_usuario_extra)}/usuario extra</p>}
                </div>
              )}

              <button
                style={estilos.boton(plan.destacado, esActual || !!soloLectura)}
                disabled={esActual || soloLectura}
                onClick={() => onSeleccionar?.(plan, ciclo)}
              >
                {esActual ? 'Plan actual' : 'Seleccionar plan'}
              </button>
            </div>
          );
        })}
      </div>

      <div style={estilos.extras}>
        <p>Precios en Soles (S/). Incluye IGV. Puedes cambiar o cancelar tu plan en cualquier momento.</p>
      </div>
    </div>
  );
}