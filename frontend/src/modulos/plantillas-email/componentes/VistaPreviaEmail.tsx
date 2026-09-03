/* ── Vista previa del correo ───────────────────────────────────────────
   OJO: este componente NO sigue la paleta de la aplicación, y es a
   propósito.

   El HTML del correo que se envía de verdad lo compone el backend
   (internal/service/notificacion_service.go), con sus propios colores. La
   promesa de esta pantalla es «así se verá el correo real», así que tiene
   que reproducir esos colores y no los de la interfaz: si aquí se pintara
   con los tokens cálidos, la vista previa mentiría.

   Para que el correo adopte la paleta nueva hay que cambiarlo en el
   backend y luego igualar este archivo. Mientras tanto, no lo repintes.  */

interface Props {
  asunto: string;
  saludo: string;
  cuerpo: string;
  pie: string;
  boton?: string;
  tipoEvento: string;
  logoUrl?: string | null;
  colorMarca?: string;
  razonSocial?: string;
}

const ESTADO_PREVIEW = { color: '#2563eb', bg: '#dbeafe', texto: 'EN PROCESO' };

export function VistaPreviaEmail({
  asunto, saludo, cuerpo, pie, boton, tipoEvento,
  logoUrl, colorMarca = '#1a56db', razonSocial = 'Mi Empresa',
}: Props) {
  return (
    <div style={{ width: '100%' }}>
      {/* Barra de asunto simulando cliente de correo */}
      <div style={{
        padding: '10px 16px',
        backgroundColor: '#f1f3f5',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #d1d5db',
        borderBottom: 'none',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
      }}>
        <span style={{ fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>Asunto:</span>
        <span style={{ color: '#111827', wordBreak: 'break-word', minWidth: 0 }}>{asunto}</span>
      </div>

      {/* Fondo gris del email — replica exacta de buildEmail */}
      <div style={{
        backgroundColor: '#f4f6f9',
        padding: '32px 16px',
        border: '1px solid #d1d5db',
        borderRadius: '0 0 8px 8px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
      }}>
        {/* Contenedor 600px centrado — igual que el email real */}
        <div style={{
          maxWidth: '600px',
          width: '100%',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          {/* HEADER — padding: 32px 40px 24px */}
          <div style={{
            padding: '32px 40px 24px',
            textAlign: 'center',
            borderBottom: `3px solid ${colorMarca}`,
          }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={razonSocial}
                style={{ maxHeight: '56px', maxWidth: '200px', objectFit: 'contain', display: 'inline-block' }}
              />
            ) : (
              <span style={{
                fontSize: '1.25rem', fontWeight: 700, color: colorMarca,
                letterSpacing: '-0.3px',
              }}>
                {razonSocial}
              </span>
            )}
          </div>

          {/* BODY — padding: 36px 40px 32px */}
          <div style={{ padding: '36px 40px 32px', wordBreak: 'break-word' }}>
            {saludo && (
              <h3 style={{ margin: '0 0 10px', fontSize: '1.05rem', color: '#111827', fontWeight: 600 }}>
                {saludo}
              </h3>
            )}

            <p style={{
              margin: '0 0 24px', fontSize: '0.9rem',
              color: '#4b5563', lineHeight: 1.7,
            }}>
              {cuerpo}
            </p>

            {/* Bloques especificos por tipo de evento */}
            {tipoEvento === 'confirmacion_reclamo' && (
              <div style={{
                backgroundColor: '#f9fafb', borderRadius: '8px',
                border: '1px solid #e5e7eb', padding: '18px 22px',
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Codigo de seguimiento
                  </span><br />
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: colorMarca }}>
                    RCL-2026-00042
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Fecha de registro
                  </span><br />
                  <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                    06/03/2026 14:30
                  </span>
                </div>
              </div>
            )}

            {tipoEvento === 'nuevo_reclamo_empresa' && (
              <div style={{
                backgroundColor: '#fef2f2', borderRadius: '8px',
                border: '1px solid #fecaca', padding: '18px 22px',
              }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
                  fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                  backgroundColor: '#dc2626', textTransform: 'uppercase', marginBottom: '10px',
                }}>RECLAMO</span>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Codigo</span><br />
                  <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>RCL-2026-00042</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Consumidor</span><br />
                  <span style={{ color: '#374151', fontSize: '0.9rem' }}>Juan Perez</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Fecha</span><br />
                  <span style={{ color: '#374151', fontSize: '0.9rem' }}>06/03/2026 14:30</span>
                </div>
              </div>
            )}

            {tipoEvento === 'resolucion' && (
              <div style={{
                borderRadius: '8px', borderLeft: `4px solid ${colorMarca}`,
                backgroundColor: '#f8fafc', padding: '18px 22px',
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151', fontStyle: 'italic', lineHeight: 1.7 }}>
                  Se ha procedido a realizar la devolucion del monto pagado...
                </p>
              </div>
            )}

            {tipoEvento === 'cambio_estado' && (
              <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                <span style={{
                  display: 'inline-block', padding: '12px 32px', borderRadius: '8px',
                  fontSize: '0.95rem', fontWeight: 700, color: ESTADO_PREVIEW.color,
                  backgroundColor: ESTADO_PREVIEW.bg, textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  {ESTADO_PREVIEW.texto}
                </span>
              </div>
            )}

            {tipoEvento === 'nuevo_mensaje' && (
              <>
                <div style={{
                  backgroundColor: '#f0fdf4', borderRadius: '8px',
                  border: '1px solid #bbf7d0', padding: '16px 22px',
                }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                    Mensaje del asesor
                  </p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', fontStyle: 'italic', lineHeight: 1.7 }}>
                    Aqui aparecera el mensaje que el asesor envie desde la seccion de mensajeria del reclamo.
                  </p>
                </div>
                {boton && (
                  <div style={{ textAlign: 'center', marginTop: '28px' }}>
                    <span style={{
                      display: 'inline-block', padding: '14px 32px',
                      backgroundColor: colorMarca, color: '#fff',
                      borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                    }}>
                      {boton}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* FOOTER — padding: 20px 40px 28px, bg: #f9fafb */}
          <div style={{
            padding: '20px 40px 28px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
          }}>
            <p style={{
              margin: 0, fontSize: '0.75rem', color: '#9ca3af',
              textAlign: 'center', lineHeight: 1.6,
            }}>
              {pie}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
