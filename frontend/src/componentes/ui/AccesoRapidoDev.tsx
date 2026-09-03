// src/componentes/ui/AccesoRapidoDev.tsx
//
// Botones de autorelleno para no teclear credenciales en cada prueba local.
//
// SOLO EXISTE EN DESARROLLO. Vite reemplaza import.meta.env.DEV por `false`
// al construir para producción, así que el bundler elimina este bloque entero
// del build final: ni el componente ni las credenciales llegan al servidor.
//
// Si alguna vez ves este panel en producción, algo se rompió en el build.

interface CuentaDemo {
  etiqueta: string;
  email: string;
  password: string;
  nota?: string;
}

/** Cuentas de prueba locales. Ninguna es una credencial real de nadie. */
const CUENTAS_TENANT: CuentaDemo[] = [
  {
    etiqueta: 'Admin (Pollería)',
    email: 'admin@polleria.com',
    password: 'Admin1234',
    nota: 'Rol ADMIN, tenant con datos',
  },
];

const CUENTAS_SUPERADMIN: CuentaDemo[] = [
  {
    etiqueta: 'Superadmin dev',
    email: 'dev@local.test',
    password: 'DevLocal2026',
    nota: 'Cuenta creada solo para pruebas locales',
  },
];

interface Props {
  /** Cuál juego de cuentas mostrar. */
  tipo: 'tenant' | 'superadmin';
  /** Setters del formulario que recibe el autorelleno. */
  alRellenar: (email: string, password: string) => void;
  /** Estilo del contenedor, para encajar con cada pantalla. */
  oscuro?: boolean;
}

export function AccesoRapidoDev({ tipo, alRellenar, oscuro = false }: Props) {
  if (!import.meta.env.DEV) return null;

  const cuentas = tipo === 'superadmin' ? CUENTAS_SUPERADMIN : CUENTAS_TENANT;

  /* `oscuro` es para la consola interna, que va sobre fondo oscuro use la
     app el tema que use. Fuera de ese caso los colores salen de los
     tokens: antes eran valores claros fijos y, en el acceso con tema
     oscuro, la etiqueta de cada cuenta quedaba en 2.35:1. */
  const colorTexto = oscuro ? '#aca596' : 'var(--ui-texto-2)';
  const acento = oscuro ? '#e08a5c' : 'var(--ui-acento-texto)';
  const colorBorde = oscuro ? '#55504a' : 'var(--ui-borde)';
  const colorFondo = oscuro ? 'rgba(172,165,150,0.06)' : 'var(--ui-superficie-hundida)';
  const colorEtiqueta = oscuro ? '#e5e0d4' : 'var(--ui-texto)';

  return (
    <div
      style={{
        marginTop: 18,
        padding: '12px 14px',
        border: `1px dashed ${colorBorde}`,
        borderRadius: 'var(--ui-r-lg)',
        background: colorFondo,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: acento,
            border: `1px solid ${acento}`,
            borderRadius: 3,
            padding: '1px 5px',
          }}
        >
          DEV
        </span>
        <span style={{ fontSize: 11.5, color: colorTexto }}>
          Acceso rápido — no aparece en producción
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {cuentas.map((c) => (
          <button
            key={c.email}
            type="button"
            onClick={() => alRellenar(c.email, c.password)}
            title={c.nota ? `${c.email} — ${c.nota}` : c.email}
            style={{
              background: 'transparent',
              border: `1px solid ${colorBorde}`,
              borderRadius: 6,
              padding: '7px 12px',
              fontSize: 12.5,
              color: colorEtiqueta,
              cursor: 'pointer',
              transition: 'border-color 140ms ease, color 140ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = acento;
              e.currentTarget.style.color = acento;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colorBorde;
              e.currentTarget.style.color = colorEtiqueta;
            }}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
