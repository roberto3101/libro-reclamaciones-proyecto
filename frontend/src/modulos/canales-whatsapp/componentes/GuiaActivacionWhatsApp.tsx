import { useState } from 'react';
import { UiIcono } from '@/ui';
import { canalesWhatsAppApi } from '../api/canales-whatsapp.api';
import { usarTenant } from '@/modulos/tenant/ganchos/usarTenant';

/* ── Tipos ── */
interface Seccion {
  titulo: string;
  icono: string;
  contenido: React.ReactNode | (() => React.ReactNode);
}

/* ── Estilos (CSS variables del sistema) ── */
const S = {
  root: { height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  header: {
    padding: '16px 20px', borderBottom: '1px solid var(--ui-borde)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ui-texto)' },
  body: { flex: 1, overflowY: 'auto' as const, padding: '12px 20px 20px' },
  seccionBtn: (activa: boolean) => ({
    width: '100%', textAlign: 'left' as const, padding: '10px 14px', border: 'none',
    background: activa ? 'var(--ui-info-suave)' : 'transparent',
    borderRadius: 'var(--ui-r-lg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '0.85rem', fontWeight: activa ? 600 : 500, color: 'var(--ui-texto)',
    transition: 'background 0.15s', marginBottom: '2px',
  }),
  seccionContenido: {
    padding: '12px 14px', fontSize: '0.82rem', lineHeight: 1.7,
    color: 'var(--ui-texto-2)',
  },
  tabla: {
    width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.78rem', marginTop: '8px',
  },
  th: {
    textAlign: 'left' as const, padding: '6px 10px', fontSize: '0.7rem', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    color: 'var(--ui-texto-2)', borderBottom: '1px solid var(--ui-borde)',
    backgroundColor: 'var(--ui-superficie-2)',
  },
  td: {
    padding: '6px 10px', borderBottom: '1px solid var(--ui-borde)',
    color: 'var(--ui-texto)',
  },
  paso: {
    display: 'flex', gap: '10px', marginBottom: '10px',
  },
  pasoNum: {
    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
    background: 'var(--ui-primario)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700,
    marginTop: '2px',
  },
  bullet: { paddingLeft: '16px', margin: '6px 0', listStyle: 'disc' as const },
  nota: {
    padding: '10px 14px', borderRadius: 'var(--ui-r-lg)', fontSize: '0.8rem',
    backgroundColor: 'var(--ui-info-suave)', border: '1px solid var(--ui-info-borde)',
    color: 'var(--ui-info-texto)', marginTop: '8px',
  },
  contacto: {
    padding: '12px 14px', borderRadius: 'var(--ui-r-lg)',
    backgroundColor: 'var(--ui-exito-suave)', border: '1px solid var(--ui-exito-borde)',
    color: 'var(--ui-exito-texto)',
  },
};

/* ── Secciones de contenido ── */
const secciones: Seccion[] = [
  {
    titulo: 'Introducción',
    icono: 'assignment',
    contenido: (
      <div>
        <p style={{ fontWeight: 600, color: 'var(--ui-texto)', marginBottom: '8px' }}>
          ¿Qué es el servicio de WhatsApp Business?
        </p>
        <p>
          El servicio de WhatsApp Business integrado al sistema de Libro de Reclamaciones permite que su empresa
          reciba y gestione consultas y reclamos directamente desde WhatsApp, de forma profesional y automatizada.
        </p>
        <p style={{ fontWeight: 600, color: 'var(--ui-texto)', margin: '12px 0 6px' }}>Beneficios:</p>
        <ul style={S.bullet}>
          <li>Atención 24 horas vía WhatsApp</li>
          <li>Chatbot inteligente para consultas y reclamos</li>
          <li>Asesores pueden intervenir en tiempo real</li>
          <li>Todo queda registrado en el sistema</li>
          <li>Cuenta de empresa verificada en WhatsApp</li>
        </ul>
      </div>
    ),
  },
  {
    titulo: 'Requisitos',
    icono: 'check_circle',
    contenido: (
      <div>
        <p style={{ fontWeight: 600, color: 'var(--ui-texto)', marginBottom: '6px' }}>
          1. Número de teléfono dedicado
        </p>
        <ul style={S.bullet}>
          <li>Número de celular exclusivo para el negocio (no personal)</li>
          <li>El número NO puede tener WhatsApp instalado previamente</li>
          <li>Cualquier operador: Claro, Movistar, Entel, Bitel</li>
          <li>El chip debe estar en un teléfono para recibir el SMS de verificación</li>
          <li>Una vez verificado, el chip ya no necesita estar en un teléfono</li>
        </ul>

        <p style={{ fontWeight: 600, color: 'var(--ui-texto)', margin: '12px 0 6px' }}>
          2. Método de pago (tarjeta de crédito o débito)
        </p>
        <ul style={S.bullet}>
          <li>Meta requiere una tarjeta registrada como respaldo</li>
          <li>Para el uso del Libro de Reclamaciones no se genera cobro, ya que las conversaciones iniciadas por sus clientes son gratuitas</li>
          <li>Puede ser Visa o Mastercard</li>
        </ul>
        <div style={S.nota}>
          Nuestro equipo técnico se encarga de toda la configuración en Meta.
          Usted NO necesita crear cuentas de desarrollador ni configurar nada técnico.
        </div>

        <p style={{ fontWeight: 600, color: 'var(--ui-texto)', margin: '12px 0 6px' }}>
          3. Datos del negocio
        </p>
        <ul style={S.bullet}>
          <li>Razón social / nombre comercial</li>
          <li>RUC</li>
          <li>Dirección fiscal</li>
          <li>Correo electrónico de contacto</li>
          <li>Logo del negocio (opcional, para perfil de WhatsApp)</li>
        </ul>
      </div>
    ),
  },
  {
    titulo: 'Datos a proporcionar',
    icono: 'edit_document',
    contenido: (
      <div>
        <p>Para activar su canal de WhatsApp, necesitamos:</p>
        <table style={S.tabla}>
          <thead>
            <tr>
              <th style={S.th}>Dato</th>
              <th style={S.th}>Ejemplo</th>
              <th style={S.th}>Req.</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Número de celular', '+51 929 369 182', 'Sí'],
              ['Nombre del negocio', 'Mi Empresa SAC', 'Sí'],
              ['RUC', '20539782232', 'Sí'],
              ['Dirección', 'Av. Los Próceres MZA G3', 'Sí'],
              ['Correo de contacto', 'contacto@empresa.com', 'Sí'],
              ['Tarjeta crédito/débito', 'Visa o Mastercard', 'Sí'],
              ['Logo (640x640 px)', 'Imagen cuadrada', 'No'],
              ['Horario de atención', 'Lun-Vie 9:00-18:00', 'No'],
              ['Mensaje de bienvenida', 'Bienvenido a Mi Empresa', 'No'],
            ].map(([dato, ejemplo, req], i) => (
              <tr key={i}>
                <td style={{ ...S.td, fontWeight: 500 }}>{dato}</td>
                <td style={S.td}>{ejemplo}</td>
                <td style={{ ...S.td, fontWeight: 600, color: req === 'Sí' ? 'var(--ui-exito-texto)' : 'var(--ui-texto-2)' }}>{req}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    titulo: 'Proceso de activación',
    icono: 'rocket_launch',
    contenido: (
      <div>
        {[
          'Usted nos entrega los datos, el número de teléfono y la tarjeta para el método de pago',
          'Nuestro equipo registra el número en la plataforma de WhatsApp Business API',
          'Usted recibirá un SMS con un código de verificación de 6 dígitos — nos lo envía por WhatsApp o correo',
          'Configuramos el webhook, la integracion con el sistema y el metodo de pago',
          'Realizamos pruebas de envio y recepcion de mensajes',
          'Su WhatsApp Business queda activo y operativo',
        ].map((texto, i) => (
          <div key={i} style={S.paso}>
            <div style={S.pasoNum}>{i + 1}</div>
            <span style={{ color: 'var(--ui-texto)', fontSize: '0.82rem' }}>{texto}</span>
          </div>
        ))}
        <div style={S.nota}>
          Tiempo estimado: 1-2 días hábiles. Usted no necesita hacer nada técnico,
          solo proporcionarnos los datos y el código SMS cuando llegue.
        </div>
      </div>
    ),
  },
  {
    titulo: 'Costos',
    icono: 'payments',
    contenido: (
      <div>
        <div style={S.contacto}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.9rem' }}>
            Sin costo adicional de Meta
          </p>
          <p style={{ margin: 0 }}>
            El servicio de WhatsApp para su Libro de Reclamaciones no tiene costo adicional de Meta.
            Las conversaciones iniciadas por sus clientes son completamente gratuitas.
          </p>
        </div>

        <table style={{ ...S.tabla, marginTop: '14px' }}>
          <thead>
            <tr>
              <th style={S.th}>Concepto</th>
              <th style={S.th}>Costo</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Activación del canal', 'Incluido en su plan'],
              ['Conversaciones con clientes', 'GRATIS'],
              ['Respuestas del chatbot', 'GRATIS'],
              ['Atención de asesores en vivo', 'GRATIS'],
            ].map(([concepto, costo], i) => (
              <tr key={i}>
                <td style={{ ...S.td, fontWeight: 500 }}>{concepto}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--ui-exito-texto)' }}>{costo}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ ...S.nota, marginTop: '10px' }}>
          Su chatbot solo responde cuando el cliente escribe primero, por lo que todas las
          conversaciones entran en la categoría de servicio de Meta, que es gratuita.
        </div>
      </div>
    ),
  },
  {
    titulo: 'Preguntas frecuentes',
    icono: 'help',
    contenido: (
      <div>
        {[
          {
            p: '¿Puedo usar mi número personal?',
            r: 'No es recomendable. El número quedará exclusivamente para WhatsApp Business API y no podrá usarse con la app normal.',
          },
          {
            p: '¿Qué pasa si ya tengo WhatsApp en ese número?',
            r: 'Deberá desvincular WhatsApp de ese número antes de la activación. Se perderán las conversaciones personales.',
          },
          {
            p: '¿Necesito tener el teléfono encendido siempre?',
            r: 'No. Solo necesita el teléfono para recibir el SMS de verificación. Después, todo funciona desde la nube.',
          },
          {
            p: '¿Los clientes verán mi número como empresa?',
            r: 'Sí. Aparecerá con el nombre de su negocio, logo y la etiqueta de cuenta de empresa verificada.',
          },
          {
            p: '¿Puedo tener varios números de WhatsApp?',
            r: 'Sí, dependiendo de su plan puede tener múltiples canales activos.',
          },
          {
            p: '¿Tiene algún costo de Meta?',
            r: 'No. Las conversaciones donde el cliente escribe primero son gratuitas. Su chatbot solo responde, nunca inicia contacto.',
          },
          {
            p: '¿El chatbot funciona 24/7?',
            r: 'Sí, el chatbot funciona automáticamente las 24 horas. Los asesores responden según el horario configurado.',
          },
          {
            p: '¿Necesito crear alguna cuenta en Facebook o Meta?',
            r: 'No. Nuestro equipo se encarga de toda la configuración técnica.',
          },
        ].map(({ p, r }, i) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <p style={{ fontWeight: 600, color: 'var(--ui-texto)', margin: '0 0 2px', fontSize: '0.82rem' }}>{p}</p>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>{r}</p>
          </div>
        ))}
      </div>
    ),
  },
];

const EMAIL_CONTACTO = 'meta@libroreclamaciones.pe';

const sanitizar = (v: string) => v.replace(/[<>{}()|\\`$]/g, '');

const CAMPOS = {
  negocio: { regex: /^[a-zA-Z0-9\s.,'&-]{3,100}$/, max: 100, msg: 'Solo letras, numeros y puntuacion basica (3-100)' },
  ruc: { regex: /^(10|15|17|20)\d{9}$/, max: 11, msg: 'RUC invalido (11 digitos, inicia con 10, 15, 17 o 20)' },
  celular: { regex: /^\+?\d[\d\s]{8,19}$/, max: 20, msg: 'Formato: +51 929 369 182' },
  telefono_contacto: { regex: /^\+?\d[\d\s]{8,19}$/, max: 20, msg: 'Formato: +51 929 369 182' },
  direccion: { regex: /^[a-zA-Z0-9\s.,'#-]{5,300}$/, max: 300, msg: 'Direccion invalida (5-300 caracteres)' },
  correo: { regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, max: 150, msg: 'Correo invalido' },
  horario: { regex: /^[a-zA-Z0-9\s:;,.-]{3,50}$/, max: 50, msg: 'Ej: Lun-Vie 9:00-18:00' },
} as const;

function SeccionContactoWhatsApp() {
  const { tenant } = usarTenant();

  const [form, setForm] = useState({
    negocio: '', ruc: '', celular: '', telefono_contacto: '', direccion: '', correo: '', horario: '',
  });
  const [precargado, setPrecargado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const [tocados, setTocados] = useState<Record<string, boolean>>({});

  // Precargar datos del tenant cuando estén disponibles
  if (tenant && !precargado) {
    setPrecargado(true);
    setForm(f => ({
      ...f,
      negocio: f.negocio || tenant.nombre_comercial || tenant.razon_social || '',
      ruc: f.ruc || tenant.ruc || '',
      direccion: f.direccion || tenant.direccion_legal || '',
      correo: f.correo || tenant.email_contacto || '',
      telefono_contacto: f.telefono_contacto || tenant.telefono || '',
    }));
  }

  const validarCampo = (campo: keyof typeof CAMPOS, valor: string) => {
    const opcional = campo === 'direccion' || campo === 'horario';
    if (!valor && opcional) return '';
    if (!valor) return 'Campo obligatorio';
    return CAMPOS[campo].regex.test(valor.trim()) ? '' : CAMPOS[campo].msg;
  };

  const marcarTocado = (campo: string) => setTocados(t => ({ ...t, [campo]: true }));

  const todosValidos = () => {
    const nuevosErrores: Record<string, string> = {};
    const todos: Record<string, boolean> = {};
    (Object.keys(CAMPOS) as (keyof typeof CAMPOS)[]).forEach(c => {
      todos[c] = true;
      const err = validarCampo(c, form[c]);
      if (err) nuevosErrores[c] = err;
    });
    setTocados(todos);
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const actualizarCampo = (campo: keyof typeof CAMPOS, valor: string) => {
    let limpio = sanitizar(valor).slice(0, CAMPOS[campo].max);
    if (campo === 'ruc') limpio = limpio.replace(/\D/g, '');
    if (campo === 'celular') limpio = limpio.replace(/[^\d+\s]/g, '');
    setForm(f => ({ ...f, [campo]: limpio }));
    if (tocados[campo]) {
      const err = validarCampo(campo, campo === 'ruc' ? limpio.replace(/\D/g, '') : limpio);
      setErrores(e => ({ ...e, [campo]: err }));
    }
  };

  const enviarSolicitud = async () => {
    if (!todosValidos() || enviando) return;
    setEnviando(true);
    setErrorEnvio('');
    try {
      await canalesWhatsAppApi.enviarSolicitudWhatsApp({
        negocio: form.negocio,
        ruc: form.ruc,
        celular: form.celular,
        telefono_contacto: form.telefono_contacto,
        direccion: form.direccion || undefined,
        correo: form.correo,
        horario: form.horario || undefined,
        // Datos internos del tenant (no visibles para el usuario)
        tenant_id: tenant?.tenant_id,
        tenant_razon_social: tenant?.razon_social,
        tenant_ruc: tenant?.ruc,
        tenant_slug: tenant?.slug,
        tenant_email: tenant?.email_contacto,
      });
      setEnviado(true);
    } catch {
      setErrorEnvio('No se pudo enviar la solicitud. Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  const tieneError = (c: string) => tocados[c] && !!errores[c];
  const inputStyle = (campo: string) => ({
    width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '0.82rem',
    border: `1px solid ${tieneError(campo) ? '#b83a32' : 'var(--ui-borde)'}`,
    background: tieneError(campo) ? 'rgba(184,58,50,0.04)' : 'var(--ui-superficie-2)',
    color: 'var(--ui-texto)', outline: 'none', boxSizing: 'border-box' as const,
  });
  const labelStyle = {
    fontSize: '0.72rem', fontWeight: 600 as const, color: 'var(--ui-texto-2)',
    textTransform: 'uppercase' as const, letterSpacing: '0.3px', marginBottom: '3px',
    display: 'flex' as const, justifyContent: 'space-between' as const,
  };
  const contadorStyle = (campo: keyof typeof CAMPOS) => ({
    fontSize: '0.68rem', fontWeight: 400 as const, textTransform: 'none' as const,
    color: form[campo].length > CAMPOS[campo].max * 0.9 ? '#b83a32' : 'var(--ui-texto-2)',
  });
  const errorStyle = { fontSize: '0.7rem', color: 'var(--ui-peligro)', marginTop: '2px' };
  const fieldStyle = { marginBottom: '10px' };

  const camposCompletos = form.negocio && form.ruc && form.celular && form.telefono_contacto && form.correo;

  if (enviado) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <UiIcono nombre="check_circle" tamano={30} sx={{ display: "block", marginBottom: "10px", color: "var(--ui-exito-texto)" }} />
        <p style={{ fontWeight: 600, color: 'var(--ui-texto)', marginBottom: '6px' }}>
          Solicitud enviada
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--ui-texto-2)' }}>
          Su solicitud fue enviada exitosamente a nuestro equipo. Nos pondremos en contacto a <strong>{form.correo}</strong> en un plazo de 1-2 días hábiles.
        </p>
        <button onClick={() => { setEnviado(false); setPrecargado(false); setForm({ negocio: '', ruc: '', celular: '', telefono_contacto: '', direccion: '', correo: '', horario: '' }); setTocados({}); setErrores({}); }} style={{
          marginTop: '12px', padding: '6px 14px', borderRadius: '6px',
          border: '1px solid var(--ui-borde)', background: 'transparent',
          cursor: 'pointer', fontSize: '0.8rem', color: 'var(--ui-texto)',
        }}>
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ marginBottom: '10px' }}>
        Complete los datos de su negocio para solicitar la activacion:
      </p>

      <div style={{ marginBottom: '14px' }}>
        {([
          { campo: 'negocio' as const, label: 'Nombre del negocio', ph: 'Mi Empresa SAC', req: true },
          { campo: 'ruc' as const, label: 'RUC', ph: '20539782232', req: true },
          { campo: 'celular' as const, label: 'Celular dedicado para WhatsApp', ph: '+51 929 369 182', req: true },
          { campo: 'telefono_contacto' as const, label: 'Numero de contacto', ph: '+51 987 654 321', req: true },
          { campo: 'direccion' as const, label: 'Direccion', ph: 'Av. Los Proceres MZA G3 Lte 11', req: false },
          { campo: 'correo' as const, label: 'Correo de contacto', ph: 'contacto@empresa.com', req: true },
          { campo: 'horario' as const, label: 'Horario de atencion', ph: 'Lun-Vie 9:00-18:00', req: false },
        ]).map(({ campo, label, ph, req }) => (
          <div key={campo} style={fieldStyle}>
            <label style={labelStyle}>
              <span>{label}{req ? ' *' : ''}</span>
              <span style={contadorStyle(campo)}>{form[campo].length}/{CAMPOS[campo].max}</span>
            </label>
            <input
              style={inputStyle(campo)}
              placeholder={ph}
              value={form[campo]}
              maxLength={CAMPOS[campo].max}
              onChange={e => actualizarCampo(campo, e.target.value)}
              onBlur={() => { marcarTocado(campo); setErrores(er => ({ ...er, [campo]: validarCampo(campo, form[campo]) })); }}
            />
            {tieneError(campo) && <div style={errorStyle}>{errores[campo]}</div>}
          </div>
        ))}
      </div>

      <button
        onClick={enviarSolicitud}
        disabled={!camposCompletos || enviando}
        style={{
          width: '100%', padding: '10px', borderRadius: 'var(--ui-r-lg)', border: 'none',
          background: camposCompletos && !enviando ? 'var(--ui-primario)' : 'var(--ui-borde)',
          color: camposCompletos && !enviando ? '#fff' : 'var(--ui-texto-2)',
          cursor: camposCompletos && !enviando ? 'pointer' : 'default',
          fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
          opacity: enviando ? 0.7 : 1,
        }}
      >
        {enviando ? (
          <>
            <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Enviando...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            Enviar solicitud
          </>
        )}
      </button>

      {errorEnvio && (
        <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(184,58,50,0.08)', color: 'var(--ui-peligro)', fontSize: '0.8rem', textAlign: 'center' }}>
          {errorEnvio}
        </div>
      )}

      <div style={{ ...S.nota, marginTop: '12px', fontSize: '0.78rem' }}>
        Su solicitud sera enviada automaticamente. Nuestro equipo se pondra en contacto en un plazo de 1-2 dias habiles.
      </div>
    </div>
  );
}

/* ── Componente Principal ── */
export function GuiaActivacionWhatsApp({ alCerrar }: { alCerrar: () => void }) {
  const [seccionActiva, setSeccionActiva] = useState(0);

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <h3 style={S.headerTitle}>Guía de Activación</h3>
        <button
          onClick={alCerrar}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            color: 'var(--ui-texto-2)', fontSize: '1.2rem', lineHeight: 1,
          }}
          aria-label="Cerrar guía"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Navegación de secciones */}
        <div style={{ marginBottom: '12px' }}>
          {secciones.map((sec, i) => (
            <button
              key={i}
              onClick={() => setSeccionActiva(i)}
              style={S.seccionBtn(i === seccionActiva)}
            >
              <UiIcono nombre={sec.icono} tamano={17} />
              <span>{sec.titulo}</span>
              <span style={{
                marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.4,
                transform: i === seccionActiva ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s',
              }}>
                ▶
              </span>
            </button>
          ))}
        </div>

        {/* Contenido de la sección activa */}
        <div style={{
          ...S.seccionContenido,
          borderTop: '1px solid var(--ui-borde)', paddingTop: '14px',
        }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--ui-texto)' }}>
            <UiIcono nombre={secciones[seccionActiva].icono} tamano={19} /> {secciones[seccionActiva].titulo}
          </h4>
          {typeof secciones[seccionActiva].contenido === 'function'
            ? secciones[seccionActiva].contenido()
            : secciones[seccionActiva].contenido}
        </div>

        {/* Navegación prev/next */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: '16px',
          paddingTop: '12px', borderTop: '1px solid var(--ui-borde)',
        }}>
          <button
            onClick={() => setSeccionActiva(Math.max(0, seccionActiva - 1))}
            disabled={seccionActiva === 0}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--ui-borde)',
              background: 'transparent', cursor: seccionActiva === 0 ? 'default' : 'pointer',
              opacity: seccionActiva === 0 ? 0.3 : 1, fontSize: '0.8rem', fontWeight: 500,
              color: 'var(--ui-texto)',
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--ui-texto-2)', alignSelf: 'center' }}>
            {seccionActiva + 1} / {secciones.length}
          </span>
          <button
            onClick={() => setSeccionActiva(Math.min(secciones.length - 1, seccionActiva + 1))}
            disabled={seccionActiva === secciones.length - 1}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--ui-borde)',
              background: 'transparent', cursor: seccionActiva === secciones.length - 1 ? 'default' : 'pointer',
              opacity: seccionActiva === secciones.length - 1 ? 0.3 : 1, fontSize: '0.8rem', fontWeight: 500,
              color: 'var(--ui-texto)',
            }}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Accordion de Solicitud de Activación (mismo estilo que GuiaModulo) ── */
const estilosAccordion = {
  contenedor: {
    borderRadius: 'var(--ui-r-xl)',
    border: '1px solid var(--ui-borde)',
    backgroundColor: 'var(--ui-superficie)',
    overflow: 'hidden' as const,
    transition: 'all 0.3s ease',
  },
  cabecera: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  tituloCabecera: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--ui-texto)',
  },
  cuerpo: {
    padding: '0 20px 20px',
  },
  flecha: {
    transition: 'transform 0.2s',
    fontSize: '0.7rem',
    color: 'var(--ui-texto-2)',
  },
};

export function SolicitudActivacionWhatsApp() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={estilosAccordion.contenedor}>
      <div
        style={estilosAccordion.cabecera}
        onClick={() => setAbierto((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setAbierto((v) => !v)}
      >
        <h3 style={estilosAccordion.tituloCabecera}>
          <UiIcono nombre="rocket_launch" tamano={17} />
          Solicitar Activación — WhatsApp
        </h3>
        <span style={{ ...estilosAccordion.flecha, transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {abierto && (
        <div style={estilosAccordion.cuerpo}>
          <p style={{ margin: '0 0 14px', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--ui-texto-2)' }}>
            Complete los datos de su negocio y nuestro equipo se encargará de toda la configuración técnica.
          </p>
          <SeccionContactoWhatsApp />
        </div>
      )}
    </div>
  );
}
