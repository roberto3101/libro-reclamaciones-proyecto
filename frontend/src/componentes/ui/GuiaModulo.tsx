import { useState } from 'react';
import { UiIcono } from '@/ui';
import type { CSSProperties, ReactNode } from 'react';

/* ── Tipos ── */

export interface PasoGuia {
  titulo: string;
  descripcion: string;
}

interface Props {
  /** Título corto del módulo (ej: "Reclamos") */
  titulo: string;
  /** Descripción de una línea sobre qué hace este módulo */
  descripcion: string;
  /** Pasos numerados de la guía */
  pasos: PasoGuia[];
  /** Tip/consejo breve al final (opcional) */
  consejo?: string;
}

/* ── Estilos con CSS variables del proyecto ── */

const estilos = {
  boton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 'var(--ui-r-lg)',
    border: '1px solid var(--ui-borde)',
    backgroundColor: 'var(--ui-superficie)',
    color: 'var(--ui-texto-2)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as CSSProperties,

  contenedor: {
    borderRadius: 'var(--ui-r-xl)',
    border: '1px solid var(--ui-borde)',
    backgroundColor: 'var(--ui-superficie)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  } as CSSProperties,

  cabecera: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  } as CSSProperties,

  tituloCabecera: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--ui-texto)',
  } as CSSProperties,

  cuerpo: {
    padding: '0 20px 20px',
  } as CSSProperties,

  descripcion: {
    margin: '0 0 16px',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    color: 'var(--ui-texto-2)',
  } as CSSProperties,

  listaPasos: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  } as CSSProperties,

  paso: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  } as CSSProperties,

  numeroPaso: {
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    backgroundColor: 'var(--ui-info-suave, #eef3f2)',
    color: 'var(--ui-info-texto, #b85528)',
    border: '1px solid var(--ui-info-borde, rgba(184,85,40,0.1))',
  } as CSSProperties,

  textoPaso: {
    flex: 1,
    minWidth: 0,
  } as CSSProperties,

  tituloPaso: {
    margin: 0,
    fontSize: '0.83rem',
    fontWeight: 600,
    color: 'var(--ui-texto)',
    lineHeight: 1.6,
  } as CSSProperties,

  descripcionPaso: {
    margin: '2px 0 0',
    fontSize: '0.78rem',
    color: 'var(--ui-texto-2)',
    lineHeight: 1.5,
  } as CSSProperties,

  consejo: {
    marginTop: 16,
    padding: '10px 14px',
    borderRadius: 'var(--ui-r-lg)',
    backgroundColor: 'var(--ui-exito-suave, rgba(92,138,79,0.06))',
    border: '1px solid var(--ui-exito-borde, rgba(92,138,79,0.15))',
    fontSize: '0.78rem',
    color: 'var(--ui-exito-texto, #2f4029)',
    lineHeight: 1.5,
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  } as CSSProperties,

  flecha: {
    transition: 'transform 0.2s',
    fontSize: '0.7rem',
    color: 'var(--ui-texto-2)',
  } as CSSProperties,
};

/* ── Componente ── */

export function GuiaModulo({ titulo, descripcion, pasos, consejo }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={estilos.contenedor}>
      <div
        style={estilos.cabecera}
        onClick={() => setAbierto((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setAbierto((v) => !v)}
      >
        <h3 style={estilos.tituloCabecera}>
          <UiIcono nombre="help" tamano={18} />
          Guía rápida — {titulo}
        </h3>
        <span style={{ ...estilos.flecha, transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {abierto && (
        <div style={estilos.cuerpo}>
          <p style={estilos.descripcion}>{descripcion}</p>

          <ol style={estilos.listaPasos}>
            {pasos.map((paso, i) => (
              <li key={i} style={estilos.paso}>
                <span style={estilos.numeroPaso}>{i + 1}</span>
                <div style={estilos.textoPaso}>
                  <p style={estilos.tituloPaso}>{paso.titulo}</p>
                  <p style={estilos.descripcionPaso}>{paso.descripcion}</p>
                </div>
              </li>
            ))}
          </ol>

          {consejo && (
            <div style={estilos.consejo}>
              <UiIcono nombre="lightbulb" tamano={16} sx={{ flex: "none", color: "var(--ui-adv-texto)" }} />
              <span>{consejo}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
