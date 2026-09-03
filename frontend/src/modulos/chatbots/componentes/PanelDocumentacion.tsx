import { useState } from 'react';
import { UiPila } from '@/ui';
import { UiTarjeta } from '@/ui';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import type { Chatbot, APIKey } from '@/tipos/chatbot';

interface Props {
  chatbot: Chatbot;
  apiKey: APIKey | null;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function BloqueCode({ codigo, lenguaje }: { codigo: string; lenguaje: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Box sx={{ position: 'relative', mt: 1 }}>
      <Box
        onClick={copiar}
        sx={{
          position: 'absolute', top: 8, right: 8, cursor: 'pointer',
          px: 1, py: 0.3, borderRadius: 0.5, fontSize: '11px', fontWeight: 600,
          bgcolor: copiado ? 'var(--ui-exito-suave-2)' : '#55504a', color: copiado ? 'var(--ui-exito-texto)' : '#aca596',
          '&:hover': { bgcolor: copiado ? 'var(--ui-exito-suave-2)' : '#6a655a' },
          transition: 'all 0.15s',
        }}
      >
        {copiado ? 'Copiado' : 'Copiar'}
      </Box>
      <Box
        component="pre"
        sx={{
          p: 2, bgcolor: '#131210', borderRadius: 1.5, color: '#e5e0d4',
          fontFamily: 'monospace', fontSize: '12px', overflow: 'auto',
          maxHeight: 350, whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0,
          lineHeight: 1.7,
        }}
      >
        {codigo}
      </Box>
    </Box>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: 'var(--ui-texto)' }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────

export function PanelDocumentacion({ chatbot, apiKey }: Props) {
  const [tabEjemplo, setTabEjemplo] = useState(0);
  const keyDisplay = apiKey ? `${apiKey.key_prefix}...TU_KEY_COMPLETA` : 'crb_live_TU_API_KEY_AQUI';
  const baseURL = `${window.location.origin}/api/bot/v1`;

  // ── Ejemplos por lenguaje ──
  const ejemploCurl = `# Listar reclamos
curl -X GET "${baseURL}/reclamos" \\
  -H "X-API-Key: ${keyDisplay}"

# Ver detalle de un reclamo
curl -X GET "${baseURL}/reclamos/UUID_DEL_RECLAMO" \\
  -H "X-API-Key: ${keyDisplay}"

# Enviar mensaje
curl -X POST "${baseURL}/reclamos/UUID_DEL_RECLAMO/mensajes" \\
  -H "X-API-Key: ${keyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{"tipo_mensaje":"EMPRESA","mensaje":"Estamos revisando su caso."}'

# Cambiar estado
curl -X PATCH "${baseURL}/reclamos/UUID_DEL_RECLAMO/estado" \\
  -H "X-API-Key: ${keyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{"estado":"EN_PROCESO","comentario":"Caso en revisión"}'`;

  const ejemploJS = `const API_KEY = '${keyDisplay}';
const BASE = '${baseURL}';

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
};

// Listar reclamos
const reclamos = await fetch(\`\${BASE}/reclamos\`, { headers })
  .then(r => r.json());
console.log(reclamos);

// Enviar mensaje a un reclamo
const reclamoId = 'UUID_DEL_RECLAMO';
await fetch(\`\${BASE}/reclamos/\${reclamoId}/mensajes\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tipo_mensaje: 'EMPRESA',
    mensaje: 'Estamos revisando su caso.',
  }),
});

// Cambiar estado
await fetch(\`\${BASE}/reclamos/\${reclamoId}/estado\`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    estado: 'EN_PROCESO',
    comentario: 'Caso en revisión',
  }),
});`;

  const ejemploPython = `import requests

API_KEY = '${keyDisplay}'
BASE = '${baseURL}'
HEADERS = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
}

# Listar reclamos
reclamos = requests.get(f'{BASE}/reclamos', headers=HEADERS)
print(reclamos.json())

# Enviar mensaje
reclamo_id = 'UUID_DEL_RECLAMO'
requests.post(
    f'{BASE}/reclamos/{reclamo_id}/mensajes',
    headers=HEADERS,
    json={
        'tipo_mensaje': 'EMPRESA',
        'mensaje': 'Estamos revisando su caso.',
    },
)

# Cambiar estado
requests.patch(
    f'{BASE}/reclamos/{reclamo_id}/estado',
    headers=HEADERS,
    json={
        'estado': 'EN_PROCESO',
        'comentario': 'Caso en revisión',
    },
)`;

  return (
    <UiPila direccion="columna" espaciado={2}>
      {/* ── Inicio rápido ── */}
      <UiTarjeta titulo="Guía de Integración">
        <Seccion titulo="1. Autenticación">
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Todas las llamadas requieren el header <code style={{ background: 'var(--ui-hover)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>X-API-Key</code> con 
            tu token completo. La key solo se muestra una vez al generarla — si la perdiste, revócala y genera una nueva.
          </Typography>
          <BloqueCode
            lenguaje="http"
            codigo={`GET /api/bot/v1/reclamos HTTP/1.1
Host: ${window.location.host}
X-API-Key: ${keyDisplay}`}
          />
        </Seccion>

        <Seccion titulo="2. Endpoints Disponibles">
          <Box component="table" sx={{
            width: '100%', borderCollapse: 'collapse', fontSize: '13px',
            '& th': { textAlign: 'left', p: 1, borderBottom: '2px solid var(--ui-borde)', color: 'var(--ui-texto-2)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' },
            '& td': { p: 1, borderBottom: '1px solid var(--ui-borde)', color: 'var(--ui-texto)' },
          }}>
            <thead>
              <tr>
                <th>Método</th>
                <th>Endpoint</th>
                <th>Descripción</th>
                <th>Scope Requerido</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code style={{ color: 'var(--ui-exito-texto)', fontWeight: 700 }}>GET</code></td>
                <td><code>/reclamos</code></td>
                <td>Listar reclamos (paginado)</td>
                <td><code>puede_leer_reclamos</code></td>
              </tr>
              <tr>
                <td><code style={{ color: 'var(--ui-exito-texto)', fontWeight: 700 }}>GET</code></td>
                <td><code>/reclamos/:id</code></td>
                <td>Detalle de un reclamo</td>
                <td><code>puede_leer_reclamos</code></td>
              </tr>
              <tr>
                <td><code style={{ color: 'var(--ui-info-texto)', fontWeight: 700 }}>POST</code></td>
                <td><code>/reclamos/:id/mensajes</code></td>
                <td>Enviar mensaje de seguimiento</td>
                <td><code>puede_enviar_mensajes</code></td>
              </tr>
              <tr>
                <td><code style={{ color: 'var(--ui-adv-texto)', fontWeight: 700 }}>PATCH</code></td>
                <td><code>/reclamos/:id/estado</code></td>
                <td>Cambiar estado del reclamo</td>
                <td><code>puede_cambiar_estado</code></td>
              </tr>
            </tbody>
          </Box>
        </Seccion>

        <Seccion titulo="3. Permisos de este Chatbot">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {[
              { key: 'puede_leer_reclamos', label: 'Leer Reclamos' },
              { key: 'puede_responder', label: 'Crear Respuestas' },
              { key: 'puede_cambiar_estado', label: 'Cambiar Estado' },
              { key: 'puede_enviar_mensajes', label: 'Enviar Mensajes' },
              { key: 'puede_leer_metricas', label: 'Leer Métricas' },
            ].map(({ key, label }) => {
              const activo = (chatbot as any)[key] === true;
              return (
                <Box key={key} sx={{
                  px: 1.5, py: 0.5, borderRadius: 2, fontSize: '12px', fontWeight: 600,
                  bgcolor: activo ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave)',
                  color: activo ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
                  border: activo ? '1px solid var(--ui-exito-borde)' : '1px solid var(--ui-peligro-borde)',
                }}>
                  {activo ? '✓' : '✗'} {label}
                </Box>
              );
            })}
          </Box>
        </Seccion>

        <Seccion titulo="4. Límites">
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Rate limit: <strong>60 requests/minuto</strong> por API key, <strong>5,000 requests/día</strong> por tenant.
            Si excedes el límite, recibirás un <code style={{ background: 'var(--ui-peligro-suave)', padding: '1px 4px', borderRadius: 3 }}>429 Too Many Requests</code>.
            Los logs de cada request se almacenan por 90 días.
          </Typography>
        </Seccion>
      </UiTarjeta>

      {/* ── Ejemplos de código ── */}
      <UiTarjeta titulo="Ejemplos de Código">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabEjemplo}
            onChange={(_, v) => setTabEjemplo(v)}
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '13px', minHeight: 40 } }}
          >
            <Tab label="cURL" />
            <Tab label="JavaScript" />
            <Tab label="Python" />
          </Tabs>
        </Box>
        {tabEjemplo === 0 && <BloqueCode lenguaje="bash" codigo={ejemploCurl} />}
        {tabEjemplo === 1 && <BloqueCode lenguaje="javascript" codigo={ejemploJS} />}
        {tabEjemplo === 2 && <BloqueCode lenguaje="python" codigo={ejemploPython} />}
      </UiTarjeta>

      {/* ── Estados válidos ── */}
      <UiTarjeta titulo="Referencia: Estados de Reclamo">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {[
            { estado: 'PENDIENTE', color: 'var(--ui-adv-texto)', bg: 'var(--ui-adv-suave)' },
            { estado: 'EN_PROCESO', color: 'var(--ui-info-texto)', bg: 'var(--ui-info-suave-2)' },
            { estado: 'RESUELTO', color: 'var(--ui-exito-texto)', bg: 'var(--ui-exito-suave-2)' },
            { estado: 'CERRADO', color: 'var(--ui-texto-2)', bg: 'var(--ui-hover)' },
          ].map(({ estado, color, bg }) => (
            <Box key={estado} sx={{
              px: 2, py: 0.8, borderRadius: 2, fontSize: '13px', fontWeight: 700,
              bgcolor: bg, color, border: `1px solid ${color}30`,
            }}>
              {estado}
            </Box>
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Transiciones válidas: PENDIENTE → EN_PROCESO → RESUELTO → CERRADO
        </Typography>
      </UiTarjeta>
    </UiPila>
  );
}