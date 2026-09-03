import { useMemo, useCallback } from 'react';
import { obtenerToken } from '@/aplicacion/helpers/sesion';
import type { MensajeUI } from '@/tipos';

interface BurbujaMensajeProps {
  mensaje: MensajeUI;
}

// ──────────────────────────────────────────────────────────────────────────────
// Parser de markdown ligero (sin dependencias externas)
// ──────────────────────────────────────────────────────────────────────────────

function parsearMarkdown(texto: string): string {
  let html = texto
    // Escapar HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Encabezados
    .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    // Negritas e itálicas
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links markdown [texto](url) — solo URLs internas /api/, descarga con auth via JS
    .replace(/\[([^\]]+)\]\((\/api\/[^)]+)\)/g, '<a class="md-link" href="$2">$1</a>')
    // Código inline
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    // Líneas horizontales
    .replace(/^---$/gm, '<hr class="md-hr"/>')
    // Listas con viñetas (*, -, •)
    .replace(/^[\s]*[*\-•]\s+(.+)$/gm, '<li class="md-li">$1</li>')
    // Listas numeradas
    .replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="md-li-num">$1</li>')
    // Agrupar <li> consecutivos en <ul> o <ol>
    .replace(/((?:<li class="md-li">.*<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>')
    .replace(/((?:<li class="md-li-num">.*<\/li>\n?)+)/g, '<ol class="md-ol">$1</ol>')
    // Párrafos (líneas dobles)
    .replace(/\n\n/g, '</p><p class="md-p">')
    // Saltos simples dentro de párrafos
    .replace(/\n/g, '<br/>');

  // Envolver en párrafo si no empieza con tag de bloque
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol')) {
    html = '<p class="md-p">' + html + '</p>';
  }

  return html;
}

// ──────────────────────────────────────────────────────────────────────────────
// Estilos CSS para el markdown renderizado
// ──────────────────────────────────────────────────────────────────────────────

const estilosMarkdown = `
  .md-assistant .md-h2 {
    font-size: 16px;
    font-weight: 700;
    color: #9a4a24;
    margin: 12px 0 6px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--ui-borde);
  }
  .md-assistant .md-h3 {
    font-size: 15px;
    font-weight: 700;
    color: #29585c;
    margin: 10px 0 4px 0;
  }
  .md-assistant .md-h4 {
    font-size: 14px;
    font-weight: 600;
    color: #b85528;
    margin: 8px 0 4px 0;
  }
  .md-assistant .md-p {
    margin: 6px 0;
    line-height: 1.6;
  }
  .md-assistant .md-ul,
  .md-assistant .md-ol {
    margin: 6px 0;
    padding-left: 20px;
  }
  .md-assistant .md-li,
  .md-assistant .md-li-num {
    margin: 4px 0;
    line-height: 1.5;
  }
  .md-assistant .md-li::marker {
    color: #b85528;
  }
  .md-assistant .md-li-num::marker {
    color: #29585c;
    font-weight: 600;
  }
  .md-assistant strong {
    color: var(--ui-texto);
    font-weight: 600;
  }
  .md-assistant em {
    color: #8a4120;
    font-style: italic;
  }
  .md-assistant .md-code {
    background: var(--ui-hover);
    border: 1px solid var(--ui-borde);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    color: #a3312a;
  }
  .md-assistant .md-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    margin: 4px 0;
    border-radius: var(--ui-r-lg);
    background: var(--ui-primario-suave);
    border: 1px solid var(--ui-primario-suave-borde);
    color: var(--ui-primario-texto) !important;
    text-decoration: none;
    font-weight: 500;
    font-size: 13px;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .md-assistant .md-link:hover {
    background: var(--ui-primario-suave-hover);
    border-color: var(--ui-primario);
  }
  .md-assistant .md-hr {
    border: none;
    border-top: 1px solid var(--ui-borde);
    margin: 10px 0;
  }
  /* Dark mode overrides */
  .dark .md-assistant .md-h2 { color: #cd7f52; }
  .dark .md-assistant .md-h3 { color: #5c908f; }
  .dark .md-assistant .md-h4 { color: #cd7f52; }
  .dark .md-assistant .md-li::marker { color: #cd7f52; }
  .dark .md-assistant .md-li-num::marker { color: #5c908f; }
  .dark .md-assistant em { color: #e0a988; }
  .dark .md-assistant .md-code { color: #d1584f; }
`;

// ──────────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────────

export default function BurbujaMensaje({ mensaje: m }: BurbujaMensajeProps) {
  const esUsuario = m.role === 'user';

  const htmlContent = useMemo(() => {
    if (esUsuario) return '';
    return parsearMarkdown(m.content);
  }, [m.content, esUsuario]);

  const descargarConAutenticacion = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const enlace = (e.target as HTMLElement).closest('a.md-link');
    if (!enlace) return;
    e.preventDefault();
    const url = enlace.getAttribute('href');
    if (!url || !url.startsWith('/api/')) return;
    const token = obtenerToken();
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((resp) => {
        if (!resp.ok) throw new Error('Error al descargar');
        const nombreArchivo = resp.headers.get('Content-Disposition')?.split('filename=')[1] || 'reporte.pdf';
        return resp.blob().then((blob) => ({ blob, nombreArchivo }));
      })
      .then(({ blob, nombreArchivo }) => {
        const urlBlob = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = nombreArchivo;
        a.click();
        URL.revokeObjectURL(urlBlob);
      })
      .catch(() => alert('Error al descargar el archivo. Verifica tu sesión.'));
  }, []);

  return (
    <>
      {!esUsuario && <style>{estilosMarkdown}</style>}

      <div
        style={{
          display: 'flex',
          justifyContent: esUsuario ? 'flex-end' : 'flex-start',
          marginBottom: 12,
        }}
      >
        {/* Avatar del asistente */}
        {!esUsuario && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--ui-r-sm)',
              background: 'var(--ui-primario)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
              marginRight: 10,
              marginTop: 2,
            }}
          >
            IA
          </div>
        )}

        <div
          style={{
            maxWidth: '85%',
            padding: esUsuario ? '10px 16px' : '12px 18px',
            fontSize: 14,
            lineHeight: 1.6,
            borderRadius: esUsuario ? '16px 16px 4px 16px' : '2px 16px 16px 16px',
            backgroundColor: esUsuario ? '#9a4a24' : 'var(--ui-superficie, #fffefb)',
            color: esUsuario ? '#fffefb' : 'var(--ui-texto)',
            border: esUsuario ? 'none' : '1px solid var(--ui-borde)',
            boxShadow: esUsuario
              ? '0 1px 3px rgba(154,74,36,0.3)'
              : '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          {esUsuario ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
          ) : (
            <div
              className="md-assistant"
              onClick={descargarConAutenticacion}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}

          {/* Footer: hora + provider + tokens */}
          <div
            style={{
              fontSize: 10,
              marginTop: 8,
              textAlign: 'right',
              color: esUsuario ? 'rgba(255,255,255,0.6)' : 'var(--ui-texto-2)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {m.tokens && (
              <span
                style={{
                  background: esUsuario ? 'rgba(255,255,255,0.15)' : 'var(--ui-hover)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 9,
                }}
              >
                {m.tokens.prompt + m.tokens.output} tokens
              </span>
            )}
            <span>
              {m.timestamp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              {m.provider && ` · ${m.provider}`}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}