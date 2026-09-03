import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { UiCampoTexto, UiBoton } from '@/ui';
import { IoSend } from 'react-icons/io5';
import { solicitudesAsesorApi } from '../api/solicitudes-asesor.api';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { MensajeAtencion, RemitenteMensaje } from '@/tipos/solicitud-asesor';
import {
  usarWebSocketAtencionVivo,
  usarEventoWebSocket,
} from '@/infraestructura/websocket';
import type { DatosMensajeAtencionRecibido } from '@/infraestructura/websocket';

interface Props {
  solicitudId: string;
  estaAbierta: boolean; // Solo permite enviar si la solicitud está abierta
}

const COLORES_REMITENTE: Record<string, { bg: string; color: string; align: string }> = {
  CLIENTE:  { bg: 'var(--ui-hover)', color: 'var(--ui-texto)', align: 'flex-start' },
  ASESOR:   { bg: 'var(--ui-info)', color: '#fffefb', align: 'flex-end' },
  SISTEMA:  { bg: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', align: 'center' },
};

const ETIQUETA_REMITENTE: Record<string, string> = {
  CLIENTE: 'Cliente',
  ASESOR: 'Asesor',
  SISTEMA: 'Sistema',
};

function formatoHora(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function formatoFechaGrupo(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  if (fecha.toDateString() === hoy.toDateString()) return 'Hoy';
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';
  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ChatAtencion({ solicitudId, estaAbierta }: Props) {
  const [mensajes, setMensajes] = useState<MensajeAtencion[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const concentradorWS = usarWebSocketAtencionVivo(solicitudId);

  const cargarMensajes = useCallback(async () => {
    try {
      const datos = await solicitudesAsesorApi.listarMensajes(solicitudId);
      setMensajes(datos || []);
    } catch (error) {
      if (cargando) manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [solicitudId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  useEffect(() => {
    cargarMensajes();
  }, [cargarMensajes]);

  const manejarMensajeWS = useCallback((datos: DatosMensajeAtencionRecibido) => {
    const nuevoMensaje: MensajeAtencion = {
      id: datos.mensaje_id,
      tenant_id: '',
      solicitud_id: datos.solicitud_id,
      remitente: datos.remitente as RemitenteMensaje,
      contenido: datos.contenido,
      fecha_envio: datos.fecha_envio,
      asesor_id: datos.asesor_id ?? null,
    };
    setMensajes((prev) => {
      if (prev.some((m) => m.id === datos.mensaje_id)) return prev;
      return [...prev, nuevoMensaje];
    });
  }, []);

  usarEventoWebSocket<DatosMensajeAtencionRecibido>(
    concentradorWS, 'MENSAJE_ATENCION_CLIENTE_RECIBIDO', manejarMensajeWS,
  );
  usarEventoWebSocket<DatosMensajeAtencionRecibido>(
    concentradorWS, 'MENSAJE_ATENCION_ASESOR_ENVIADO', manejarMensajeWS,
  );

  const enviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando) return;

    setEnviando(true);
    try {
      const nuevo = await solicitudesAsesorApi.enviarMensaje(solicitudId, contenido);
      setMensajes((prev) => {
        if (prev.some((m) => m.id === nuevo.id)) return prev;
        return [...prev, nuevo];
      });
      setTexto('');
    } catch (error) {
      manejarError(error);
    } finally {
      setEnviando(false);
    }
  };

  const manejarEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  // Agrupar mensajes por fecha
  const gruposFecha = mensajes.reduce<Record<string, MensajeAtencion[]>>((acc, msg) => {
    const grupo = formatoFechaGrupo(msg.fecha_envio);
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(msg);
    return acc;
  }, {});

  if (cargando) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 300 }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--ui-borde)', bgcolor: 'var(--ui-superficie-2)' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '13px' }}>
          Chat en vivo
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
          {mensajes.length} mensaje{mensajes.length !== 1 ? 's' : ''} ·{' '}
          {estaAbierta ? (concentradorWS?.conectado ? 'En vivo' : 'Conectando...') : 'Conversación cerrada'}
        </Typography>
      </Box>

      {/* Mensajes */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          maxHeight: 400,
          bgcolor: 'var(--ui-superficie)',
        }}
      >
        {mensajes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '13px' }}>
              No hay mensajes aún. Los mensajes del cliente aparecerán aquí.
            </Typography>
          </Box>
        ) : (
          Object.entries(gruposFecha).map(([fecha, msgs]) => (
            <Box key={fecha}>
              {/* Separador de fecha */}
              <Box sx={{ textAlign: 'center', my: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    bgcolor: 'var(--ui-hover)',
                    px: 1.5,
                    py: 0.3,
                    borderRadius: 'var(--ui-r-xl)',
                    fontSize: '10px',
                    color: 'var(--ui-texto-2)',
                    fontWeight: 600,
                  }}
                >
                  {fecha}
                </Typography>
              </Box>

              {msgs.map((msg) => {
                const estilo = COLORES_REMITENTE[msg.remitente] || COLORES_REMITENTE.SISTEMA;
                const esSistema = msg.remitente === 'SISTEMA';

                return (
                  <Box
                    key={msg.id}
                    sx={{
                      display: 'flex',
                      justifyContent: estilo.align,
                      mb: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: esSistema ? '90%' : '75%',
                        bgcolor: estilo.bg,
                        color: estilo.color,
                        px: 1.5,
                        py: 0.8,
                        borderRadius: esSistema ? '8px' : msg.remitente === 'ASESOR' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        ...(esSistema && {
                          textAlign: 'center',
                          fontStyle: 'italic',
                          border: '1px solid var(--ui-adv-borde)',
                        }),
                      }}
                    >
                      {!esSistema && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            fontSize: '10px',
                            opacity: 0.8,
                            display: 'block',
                            mb: 0.2,
                          }}
                        >
                          {ETIQUETA_REMITENTE[msg.remitente]}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '13px',
                          lineHeight: 1.4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.contenido}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '9px',
                          opacity: 0.6,
                          display: 'block',
                          textAlign: 'right',
                          mt: 0.2,
                        }}
                      >
                        {formatoHora(msg.fecha_envio)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))
        )}
      </Box>

      {/* Input de mensaje */}
      {estaAbierta && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: '1px solid var(--ui-borde)',
            bgcolor: 'var(--ui-superficie-2)',
            display: 'flex',
            gap: 1,
            alignItems: 'flex-end',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <UiCampoTexto
              valor={texto}
              alCambiar={(e) => setTexto(e.target.value)}
              marcador="Escribe un mensaje..."
              multilinea
              filas={1}
              anchoCompleto
              onKeyDown={manejarEnter}
            />
          </Box>
          <IconButton
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            sx={{
              bgcolor: 'var(--ui-info)',
              color: '#fff',
              '&:hover': { bgcolor: '#9a4a24' },
              '&:disabled': { bgcolor: 'var(--ui-borde)', color: 'var(--ui-texto-3)' },
              width: 40,
              height: 40,
            }}
          >
            {enviando ? <CircularProgress size={18} color="inherit" /> : <IoSend size={18} />}
          </IconButton>
        </Box>
      )}
    </Box>
  );
}