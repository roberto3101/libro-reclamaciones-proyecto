import { useState } from 'react';
import { UiPila } from '@/ui';
import { UiTarjeta, UiBoton, UiCampoTexto, UiAlerta } from '@/ui';
import { Box, Typography, Tooltip } from '@mui/material';
import type { Chatbot, APIKey } from '@/tipos/chatbot';

// ──────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────

interface Accion {
  id: string;
  metodo: 'GET' | 'POST' | 'PATCH';
  ruta: string;
  nombre: string;
  descripcion: string;
  scope: string;
  tieneBody: boolean;
  tieneParam: boolean;
  bodyEjemplo?: string;
  textoBoton: string;
  sinPermisoTexto: string;
  necesitaReclamoTexto: string;
}

interface ReclamoResumen {
  id: string;
  codigo: string;
  cliente_nombre?: string;
  detalle?: string;
  estado?: string;
}

interface Props {
  chatbot: Chatbot;
  apiKey: APIKey | null;
  onNecesitaKey: () => void;
}

// ──────────────────────────────────────────────────────────────────
// Acciones disponibles (con lenguaje amigable)
// ──────────────────────────────────────────────────────────────────

const ACCIONES: Accion[] = [
  {
    id: 'listar',
    metodo: 'GET',
    ruta: '/api/bot/v1/reclamos',
    nombre: 'Ver todos los reclamos',
    descripcion: 'Muestra la lista completa de reclamos registrados en tu empresa. Es lo primero que debes hacer para ver qué reclamos hay.',
    scope: 'puede_leer_reclamos',
    tieneBody: false,
    tieneParam: false,
    textoBoton: 'Consultar reclamos',
    sinPermisoTexto: 'No tiene permiso para ver reclamos',
    necesitaReclamoTexto: '',
  },
  {
    id: 'detalle',
    metodo: 'GET',
    ruta: '/api/bot/v1/reclamos/:id',
    nombre: 'Ver detalle de un reclamo',
    descripcion: 'Muestra toda la información de un reclamo específico: datos del consumidor, descripción del problema, mensajes anteriores, etc.',
    scope: 'puede_leer_reclamos',
    tieneBody: false,
    tieneParam: true,
    textoBoton: 'Ver detalle',
    sinPermisoTexto: 'No tiene permiso para ver reclamos',
    necesitaReclamoTexto: 'Primero consulta los reclamos',
  },
  {
    id: 'mensaje',
    metodo: 'POST',
    ruta: '/api/bot/v1/reclamos/:id/mensajes',
    nombre: 'Enviar una respuesta',
    descripcion: 'Envía un mensaje de respuesta al consumidor sobre su reclamo. Útil para informar avances, solicitar más datos o dar una solución.',
    scope: 'puede_enviar_mensajes',
    tieneBody: true,
    tieneParam: true,
    textoBoton: 'Enviar respuesta',
    sinPermisoTexto: 'No tiene permiso para enviar mensajes',
    necesitaReclamoTexto: 'Primero consulta los reclamos',
    bodyEjemplo: JSON.stringify({
      tipo_mensaje: 'EMPRESA',
      mensaje: 'Hemos recibido su reclamo y estamos trabajando en una solución.',
    }, null, 2),
  },
  {
    id: 'estado',
    metodo: 'PATCH',
    ruta: '/api/bot/v1/reclamos/:id/estado',
    nombre: 'Cambiar el estado',
    descripcion: 'Actualiza el estado de un reclamo. Por ejemplo: marcarlo como "En proceso" cuando ya se está atendiendo, o "Resuelto" cuando se solucionó.',
    scope: 'puede_cambiar_estado',
    tieneBody: true,
    tieneParam: true,
    textoBoton: 'Cambiar estado',
    sinPermisoTexto: 'No tiene permiso para cambiar estados',
    necesitaReclamoTexto: 'Primero consulta los reclamos',
    bodyEjemplo: JSON.stringify({
      estado: 'EN_PROCESO',
      comentario: 'Caso en revisión por el equipo de soporte.',
    }, null, 2),
  },
];

const ESTADOS_INFO: Record<string, { bg: string; color: string; nombre: string }> = {
  PENDIENTE: { bg: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', nombre: 'Pendiente' },
  EN_PROCESO: { bg: 'var(--ui-info-suave-2)', color: 'var(--ui-info-texto)', nombre: 'En proceso' },
  RESUELTO: { bg: 'var(--ui-exito-suave-2)', color: 'var(--ui-exito-texto)', nombre: 'Resuelto' },
  CERRADO: { bg: 'var(--ui-hover)', color: 'var(--ui-texto-2)', nombre: 'Cerrado' },
};

// ──────────────────────────────────────────────────────────────────
// Helper: Mensaje amigable según respuesta del servidor
// ──────────────────────────────────────────────────────────────────

function getMensajeResultado(statusCode: number | null): { tipo: 'exito' | 'error'; titulo: string; texto: string } | null {
  if (statusCode === null) return null;
  if (statusCode >= 200 && statusCode < 300) {
    return {
      tipo: 'exito',
      titulo: 'Prueba exitosa',
      texto: 'Todo funciona correctamente. Tu chatbot puede realizar esta acción sin problemas.',
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      tipo: 'error',
      titulo: 'Clave incorrecta o sin permisos',
      texto: 'Verifica que pegaste la clave de acceso completa y que el chatbot tiene los permisos necesarios.',
    };
  }
  if (statusCode === 404) {
    return {
      tipo: 'error',
      titulo: 'Reclamo no encontrado',
      texto: 'El reclamo que seleccionaste ya no existe o no está disponible. Intenta consultar la lista nuevamente.',
    };
  }
  if (statusCode === 429) {
    return {
      tipo: 'error',
      titulo: 'Demasiadas solicitudes',
      texto: 'Has hecho muchas pruebas en poco tiempo. Espera unos segundos e intenta de nuevo.',
    };
  }
  if (statusCode === 0) {
    return {
      tipo: 'error',
      titulo: 'Sin conexión',
      texto: 'No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta nuevamente.',
    };
  }
  return {
    tipo: 'error',
    titulo: 'Algo salió mal',
    texto: `Ocurrió un error inesperado. Si el problema persiste, contacta al soporte.`,
  };
}

// ──────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────

export function PanelProbarAPI({ chatbot, apiKey, onNecesitaKey }: Props) {
  const [accionActiva, setAccionActiva] = useState<Accion>(ACCIONES[0]);
  const [reclamoId, setReclamoId] = useState('');
  const [body, setBody] = useState('');
  const [claveAcceso, setClaveAcceso] = useState('');
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [verDetalleTecnico, setVerDetalleTecnico] = useState(false);

  const [reclamos, setReclamos] = useState<ReclamoResumen[]>([]);
  const [reclamoSeleccionado, setReclamoSeleccionado] = useState<ReclamoResumen | null>(null);

  const seleccionarAccion = (accion: Accion) => {
    setAccionActiva(accion);
    setBody(accion.bodyEjemplo || '');
    setRespuesta(null);
    setStatusCode(null);
    setDuracion(null);
    setVerDetalleTecnico(false);
  };

  const seleccionarReclamo = (r: ReclamoResumen) => {
    setReclamoSeleccionado(r);
    setReclamoId(r.id);
  };

  const scopeHabilitado = (chatbot as any)[accionActiva.scope] === true;

  const extraerReclamos = (data: any): ReclamoResumen[] => {
    try {
      let lista: any[] = [];
      if (Array.isArray(data?.data?.data)) lista = data.data.data;
      else if (Array.isArray(data?.data)) lista = data.data;
      else if (Array.isArray(data)) lista = data;
      else return [];

      return lista
        .filter((r: any) => r.id)
        .slice(0, 20)
        .map((r: any) => ({
          id: r.id,
          codigo: r.codigo_reclamo || r.codigo || r.code || r.id.substring(0, 8),
          cliente_nombre: r.nombre_completo || r.cliente_nombre || r.nombre_cliente || r.consumidor_nombre || '',
          detalle: r.detalle || r.descripcion || '',
          estado: r.estado || '',
        }));
    } catch {
      return [];
    }
  };

  const ejecutar = async () => {
    if (!apiKey) { onNecesitaKey(); return; }

    if (!claveAcceso.trim()) {
      setRespuesta(JSON.stringify({ error: 'Ingresa tu clave de acceso en el Paso 1 para continuar.' }, null, 2));
      setStatusCode(400);
      return;
    }

    let url = accionActiva.ruta;
    if (accionActiva.tieneParam) {
      if (!reclamoId.trim()) {
        setRespuesta(JSON.stringify({ error: 'Primero selecciona un reclamo. Usa "Ver todos los reclamos" para obtener la lista.' }, null, 2));
        setStatusCode(400);
        return;
      }
      url = url.replace(':id', reclamoId.trim());
    }

    setCargando(true);
    setRespuesta(null);
    setVerDetalleTecnico(false);
    const inicio = performance.now();

    try {
      const opciones: RequestInit = {
        method: accionActiva.metodo,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': claveAcceso.trim(),
        },
      };

      if (accionActiva.tieneBody && body.trim()) {
        opciones.body = body;
      }

      const res = await fetch(url, opciones);
      const fin = performance.now();
      setDuracion(Math.round(fin - inicio));
      setStatusCode(res.status);

      const data = await res.json();
      setRespuesta(JSON.stringify(data, null, 2));

      if (accionActiva.id === 'listar' && res.ok) {
        const lista = extraerReclamos(data);
        setReclamos(lista);
        if (lista.length > 0 && !reclamoSeleccionado) {
          seleccionarReclamo(lista[0]);
        }
      }
    } catch (error: any) {
      const fin = performance.now();
      setDuracion(Math.round(fin - inicio));
      setStatusCode(0);
      setRespuesta(JSON.stringify({ error: error.message }, null, 2));
    } finally {
      setCargando(false);
    }
  };

  // ── Sin clave de acceso generada ──
  if (!apiKey) {
    return (
      <UiTarjeta titulo="Centro de Pruebas">
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Todavia no tienes una clave de acceso
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
            Para probar que tu chatbot funciona correctamente, primero necesitas generar una clave de acceso desde la pestaña "Claves de Acceso".
          </Typography>
          <UiBoton texto="Generar clave de acceso" variante="primario" alHacerClick={onNecesitaKey} />
        </Box>
      </UiTarjeta>
    );
  }

  const mensajeResultado = getMensajeResultado(statusCode);

  return (
    <UiPila direccion="columna" espaciado={2}>
      {/* ── Introducción ── */}
      <Box sx={{
        p: 2, bgcolor: 'var(--ui-superficie-2)', borderRadius: 2,
        border: '1px solid var(--ui-borde)',
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
          Desde aquí puedes verificar que tu chatbot funciona correctamente. Sigue los 3 pasos en orden:
          primero pega tu clave, luego elige qué quieres probar y presiona el botón para ejecutar la prueba.
        </Typography>
      </Box>

      {/* ── Paso 1: Clave de acceso ── */}
      <UiTarjeta titulo="Paso 1: Pega tu clave de acceso">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.7 }}>
          Para probar tu chatbot necesitas una <strong>clave de acceso</strong>. Si aun no la tienes,
          generala desde la pestaña "Claves de Acceso" y copiala en ese momento (solo se muestra una vez).
        </Typography>

        {/* Botón para ir a generar clave si no tiene */}
        <Box sx={{
          mb: 2, p: 1.5, bgcolor: 'var(--ui-superficie-2)', borderRadius: 1.5,
          border: '1px dashed var(--ui-borde)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 1,
        }}>
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '13px' }}>
              {apiKey ? '¿Ya tienes tu clave copiada?' : '¿No tienes una clave de acceso?'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {apiKey
                ? `Tu clave activa empieza con: ${apiKey.key_prefix}... — pegala completa abajo`
                : 'Genera una desde la pestaña "Claves de Acceso"'}
            </Typography>
          </Box>
          <UiBoton
            texto={apiKey ? 'Ir a Claves de Acceso' : 'Generar clave'}
            variante="contorno"
            tamano="sm"
            alHacerClick={onNecesitaKey}
          />
        </Box>

        <UiCampoTexto
          etiqueta=""
          valor={claveAcceso}
          alCambiar={(e) => setClaveAcceso(e.target.value)}
          marcador="Pega aqui tu clave completa (ej: crb_test_abc123...)"
          anchoCompleto
        />
      </UiTarjeta>

      {/* ── Reclamo seleccionado (banner informativo) ── */}
      {reclamoSeleccionado && (
        <Box sx={{
          p: 1.5, bgcolor: 'var(--ui-info-suave-2)', border: '1px solid var(--ui-info-borde)', borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ui-info-texto)' }}>
            Reclamo seleccionado:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{
              px: 1, py: 0.2, bgcolor: 'var(--ui-info-suave-2)', borderRadius: 1,
              fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: 'var(--ui-info-texto)',
            }}>
              {reclamoSeleccionado.codigo}
            </Box>
            {reclamoSeleccionado.cliente_nombre && (
              <Typography variant="body2" color="text.secondary">
                — {reclamoSeleccionado.cliente_nombre}
              </Typography>
            )}
            {reclamoSeleccionado.estado && ESTADOS_INFO[reclamoSeleccionado.estado] && (
              <Box component="span" sx={{
                px: 0.8, py: 0.1, borderRadius: 0.5, fontSize: '10px', fontWeight: 700,
                bgcolor: ESTADOS_INFO[reclamoSeleccionado.estado].bg,
                color: ESTADOS_INFO[reclamoSeleccionado.estado].color,
              }}>
                {ESTADOS_INFO[reclamoSeleccionado.estado].nombre}
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        {/* ── Sidebar: Acciones + Reclamos ── */}
        <Box sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
          <UiPila direccion="columna" espaciado={2}>
            {/* Acciones */}
            <UiTarjeta titulo="Paso 2: ¿Qué quieres probar?">
              <UiPila direccion="columna" espaciado={0.5}>
                {ACCIONES.map((accion) => {
                  const activo = accion.id === accionActiva.id;
                  const tienePermiso = (chatbot as any)[accion.scope] === true;
                  const necesitaReclamo = accion.tieneParam && !reclamoId;
                  return (
                    <Box
                      key={accion.id}
                      onClick={() => tienePermiso && seleccionarAccion(accion)}
                      sx={{
                        p: 1.5, borderRadius: 1.5,
                        cursor: tienePermiso ? 'pointer' : 'not-allowed',
                        bgcolor: activo ? 'var(--ui-info-suave-2)' : 'transparent',
                        border: activo ? '1px solid var(--ui-info-borde)' : '1px solid transparent',
                        opacity: tienePermiso ? 1 : 0.45,
                        '&:hover': tienePermiso
                          ? { bgcolor: activo ? 'var(--ui-info-suave-2)' : 'var(--ui-superficie-2)' }
                          : {},
                        transition: 'all 0.15s',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '13px' }}>
                        {accion.nombre}
                      </Typography>
                      {!tienePermiso && (
                        <Typography variant="caption" color="error" sx={{ fontSize: '10px', mt: 0.3, display: 'block' }}>
                          {accion.sinPermisoTexto}
                        </Typography>
                      )}
                      {tienePermiso && necesitaReclamo && accion.id !== 'listar' && (
                        <Typography variant="caption" sx={{ fontSize: '10px', mt: 0.3, display: 'block', color: '#8a6112' }}>
                          {accion.necesitaReclamoTexto}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </UiPila>
            </UiTarjeta>

            {/* Lista de reclamos encontrados */}
            {reclamos.length > 0 && (
              <UiTarjeta titulo={`Reclamos encontrados (${reclamos.length})`}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Haz clic en un reclamo para usarlo en las siguientes pruebas:
                </Typography>
                <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                  <UiPila direccion="columna" espaciado={0.5}>
                    {reclamos.map((r) => {
                      const seleccionado = reclamoSeleccionado?.id === r.id;
                      const ei = ESTADOS_INFO[r.estado || ''];
                      return (
                        <Box
                          key={r.id}
                          onClick={() => seleccionarReclamo(r)}
                          sx={{
                            p: 1.2, borderRadius: 1.5, cursor: 'pointer',
                            bgcolor: seleccionado ? 'var(--ui-info-suave-2)' : 'var(--ui-superficie-2)',
                            border: seleccionado ? '2px solid #b85528' : '1px solid var(--ui-borde)',
                            '&:hover': { bgcolor: 'var(--ui-info-suave-2)', borderColor: '#e0a988' },
                            transition: 'all 0.15s',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '13px', color: 'var(--ui-texto)' }}>
                              {r.codigo}
                            </Typography>
                            {r.estado && ei && (
                              <Box component="span" sx={{
                                px: 0.6, py: 0.1, borderRadius: 0.5, fontSize: '9px',
                                fontWeight: 700, bgcolor: ei.bg, color: ei.color,
                              }}>
                                {ei.nombre}
                              </Box>
                            )}
                          </Box>
                          {r.cliente_nombre && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', display: 'block', mt: 0.3 }}>
                              {r.cliente_nombre}
                            </Typography>
                          )}
                          <Tooltip title={r.detalle || ''}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '10px', display: 'block', mt: 0.2, maxWidth: 240 }}>
                              {r.detalle ? (r.detalle.length > 60 ? r.detalle.substring(0, 60) + '...' : r.detalle) : ''}
                            </Typography>
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </UiPila>
                </Box>
              </UiTarjeta>
            )}
          </UiPila>
        </Box>

        {/* ── Panel principal: Ejecución y resultado ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <UiTarjeta titulo="Paso 3: Ejecutar y ver resultado">
            <UiPila direccion="columna" espaciado={2}>
              {/* Descripción de la acción */}
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {accionActiva.descripcion}
              </Typography>

              {/* Alerta: sin permiso */}
              {!scopeHabilitado && (
                <UiAlerta
                  variante="peligro"
                  titulo="Accion no permitida"
                  descripcion='Tu chatbot no tiene permiso para realizar esta accion. Ve a la pestaña "Configuracion" para activar los permisos necesarios.'
                />
              )}

              {/* Alerta: necesita seleccionar reclamo primero */}
              {accionActiva.tieneParam && !reclamoId && reclamos.length === 0 && scopeHabilitado && (
                <UiAlerta
                  variante="info"
                  titulo="Primero consulta los reclamos"
                  descripcion='Haz clic en "Ver todos los reclamos" en el paso 2 y ejecuta la prueba. Asi podras seleccionar un reclamo para continuar.'
                />
              )}

              {/* Datos a enviar (solo para acciones que lo requieren) */}
              {accionActiva.tieneBody && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    Datos a enviar
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.6 }}>
                    {accionActiva.id === 'mensaje'
                      ? 'Este es el mensaje que se enviara como respuesta al consumidor. Puedes modificarlo antes de enviar:'
                      : 'Selecciona el nuevo estado haciendo clic en una de las opciones, o edita los datos directamente:'}
                  </Typography>

                  {/* Botones rápidos de estado */}
                  {accionActiva.id === 'estado' && (
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      {[
                        { estado: 'PENDIENTE', nombre: 'Pendiente', color: 'var(--ui-adv-texto)', bg: 'var(--ui-adv-suave)' },
                        { estado: 'EN_PROCESO', nombre: 'En proceso', color: 'var(--ui-info-texto)', bg: 'var(--ui-info-suave-2)' },
                        { estado: 'RESUELTO', nombre: 'Resuelto', color: 'var(--ui-exito-texto)', bg: 'var(--ui-exito-suave-2)' },
                        { estado: 'CERRADO', nombre: 'Cerrado', color: 'var(--ui-texto-2)', bg: 'var(--ui-hover)' },
                      ].map((e) => (
                        <Box
                          key={e.estado}
                          onClick={() => setBody(JSON.stringify({ estado: e.estado, comentario: 'Cambio desde panel de pruebas.' }, null, 2))}
                          sx={{
                            px: 1.5, py: 0.6, borderRadius: 1, cursor: 'pointer',
                            bgcolor: e.bg, color: e.color, fontWeight: 700, fontSize: '12px',
                            border: '2px solid transparent',
                            '&:hover': { borderColor: e.color, opacity: 0.9 },
                            transition: 'all 0.15s',
                          }}
                        >
                          {e.nombre}
                        </Box>
                      ))}
                    </Box>
                  )}

                  <Box
                    component="textarea"
                    value={body}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                    sx={{
                      width: '100%', minHeight: 120, p: 1.5,
                      fontFamily: 'monospace', fontSize: '13px',
                      border: '1px solid var(--ui-borde)', borderRadius: 1.5, bgcolor: 'var(--ui-superficie-2)',
                      resize: 'vertical', outline: 'none',
                      '&:focus': { borderColor: 'var(--ui-info)' },
                    }}
                  />
                </Box>
              )}

              {/* Botón ejecutar */}
              <UiBoton
                texto={accionActiva.textoBoton}
                variante="primario"
                alHacerClick={ejecutar}
                estado={cargando ? 'cargando' : 'inactivo'}
                disabled={!scopeHabilitado || (accionActiva.tieneParam && !reclamoId)}
              />

              {/* Resultado amigable */}
              {mensajeResultado && (
                <Box sx={{
                  p: 2, borderRadius: 2,
                  bgcolor: mensajeResultado.tipo === 'exito' ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave)',
                  border: `1px solid ${mensajeResultado.tipo === 'exito' ? 'var(--ui-exito-borde)' : 'var(--ui-peligro-borde)'}`,
                }}>
                  <Typography variant="body2" fontWeight={700} sx={{
                    color: mensajeResultado.tipo === 'exito' ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
                  }}>
                    {mensajeResultado.titulo}
                  </Typography>
                  <Typography variant="body2" sx={{
                    mt: 0.5,
                    color: mensajeResultado.tipo === 'exito' ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
                    opacity: 0.85,
                  }}>
                    {mensajeResultado.texto}
                  </Typography>
                </Box>
              )}

              {/* Detalle técnico (colapsable) */}
              {respuesta && (
                <Box>
                  <Box
                    onClick={() => setVerDetalleTecnico(!verDetalleTecnico)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                      py: 0.5, '&:hover': { opacity: 0.8 },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      {verDetalleTecnico ? 'Ocultar' : 'Ver'} respuesta completa del servidor
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {verDetalleTecnico ? '▲' : '▼'}
                    </Typography>
                    {duracion !== null && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        Tiempo: {duracion}ms
                      </Typography>
                    )}
                    {statusCode !== null && statusCode > 0 && (
                      <Box component="span" sx={{
                        px: 0.8, py: 0.2, borderRadius: 0.5, fontSize: '11px', fontWeight: 700,
                        bgcolor: statusCode >= 200 && statusCode < 300 ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave)',
                        color: statusCode >= 200 && statusCode < 300 ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
                      }}>
                        Codigo {statusCode}
                      </Box>
                    )}
                  </Box>

                  {verDetalleTecnico && (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{
                        p: 1.5, bgcolor: '#302d27', borderRadius: '8px 8px 0 0',
                        fontFamily: 'monospace', fontSize: '12px', color: '#aca596',
                        borderBottom: '1px solid #55504a',
                      }}>
                        {accionActiva.metodo}{' '}
                        {accionActiva.tieneParam && reclamoId
                          ? accionActiva.ruta.replace(':id', reclamoId)
                          : accionActiva.ruta}
                      </Box>
                      <Box
                        component="pre"
                        sx={{
                          p: 2, bgcolor: '#131210', borderRadius: '0 0 8px 8px',
                          color: '#e5e0d4', fontFamily: 'monospace', fontSize: '12px',
                          overflow: 'auto', maxHeight: 400,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0,
                        }}
                      >
                        {respuesta}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </UiPila>
          </UiTarjeta>
        </Box>
      </Box>
    </UiPila>
  );
}
