// src/aplicacion/componentes/BannerTrial.tsx
import { useState, useMemo } from 'react';
import { UiIcono } from '@/ui';
import { useNavigate } from 'react-router-dom';
import { usarSuscripcion } from '@/modulos/suscripcion/ganchos/usarSuscripcion';

export default function BannerTrial() {
  const { datos, cargando } = usarSuscripcion();
  const [cerrado, setCerrado] = useState(false);
  const navegar = useNavigate();

  const diasRestantes = useMemo(() => {
    if (!datos?.suscripcion) return null;
    const { es_trial, fecha_fin_trial, estado } = datos.suscripcion;
    if (!es_trial || estado !== 'TRIAL' || !fecha_fin_trial) return null;
    const hoy = new Date();
    const fin = new Date(fecha_fin_trial);
    return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }, [datos]);

  if (cargando || diasRestantes === null || cerrado) return null;
  if (diasRestantes > 15) return null;

  const vencido = diasRestantes <= 0;
  const urgente = diasRestantes <= 3;
  const advertencia = diasRestantes <= 7;

  const colores = vencido
    ? { bg: '#fbf0ee', borde: '#e5c2bc', texto: '#7a251f', botonBg: '#a3312a', botonHover: '#932c25' }
    : urgente
      ? { bg: '#fff7ed', borde: '#fed7aa', texto: '#9a3412', botonBg: 'var(--ui-acento-hover)', botonHover: '#c2410c' }
      : advertencia
        ? { bg: '#faf4e6', borde: '#e8d6a8', texto: '#5c3f0b', botonBg: '#8a6112', botonHover: '#7d570f' }
        : { bg: '#fbf2ec', borde: '#f0dccd', texto: '#6d3216', botonBg: '#9a4a24', botonHover: '#8a4120' };

  const mensaje = vencido
    ? 'Tu período de prueba ha expirado. Elige un plan para seguir usando la plataforma.'
    : diasRestantes === 1
      ? 'Tu prueba gratuita vence mañana.'
      : `Tu prueba gratuita vence en ${diasRestantes} días.`;

  return (
    <div style={{
      background: colores.bg, borderBottom: `1px solid ${colores.borde}`,
      padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 16, fontSize: '0.88rem', color: colores.texto, position: 'relative', zIndex: 50,
    }}>
      <UiIcono nombre={vencido ? 'block' : urgente ? 'schedule' : 'info'} tamano={17} />
      <span style={{ fontWeight: 500 }}>{mensaje}</span>
      <button
        onClick={() => navegar('/suscripcion')}
        style={{
          padding: '6px 16px', border: 'none', borderRadius: 6, background: colores.botonBg,
          color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
          whiteSpace: 'nowrap', transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = colores.botonHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = colores.botonBg; }}
      >
        {vencido ? 'Elegir plan' : 'Mejorar plan'}
      </button>
      {!vencido && (
        <button
          onClick={() => setCerrado(true)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: colores.texto, cursor: 'pointer',
            fontSize: '1.1rem', opacity: 0.6, padding: 4, lineHeight: 1,
          }}
          title="Cerrar"
        >
          ✕
        </button>
      )}
    </div>
  );
}