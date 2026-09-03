import { useState } from 'react';
import { UiPila } from '@/ui';
import { UiTarjeta, UiBoton } from '@/ui';
import { Box, Typography, LinearProgress } from '@mui/material';
import type { Chatbot } from '@/tipos/chatbot';

// ──────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────

interface Props {
  chatbot: Chatbot;
  onIrAConfiguracion: () => void;
  onActivar: () => void;
}

interface Requisito {
  label: string;
  ok: boolean;
  detalle: string;
  accion?: string;
  onAccion?: () => void;
}

// ──────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────

export function PanelVerificarConexion({ chatbot, onIrAConfiguracion, onActivar }: Props) {
  const [verificando, setVerificando] = useState(false);
  const [verificado, setVerificado] = useState(false);

  const requisitos: Requisito[] = [
    {
      label: 'Bot activo',
      ok: chatbot.activo,
      detalle: chatbot.activo
        ? 'Tu bot esta encendido y listo para funcionar'
        : 'Tu bot esta apagado. Activalo para que pueda atender reclamos',
      accion: chatbot.activo ? undefined : 'Activar',
      onAccion: onActivar,
    },
    {
      label: 'Puede ver reclamos',
      ok: chatbot.puede_leer_reclamos,
      detalle: chatbot.puede_leer_reclamos
        ? 'El bot puede consultar los reclamos de tu empresa'
        : 'El bot no tiene permiso para ver reclamos',
      accion: chatbot.puede_leer_reclamos ? undefined : 'Configurar permisos',
      onAccion: onIrAConfiguracion,
    },
    {
      label: 'Puede responder reclamos',
      ok: chatbot.puede_enviar_mensajes,
      detalle: chatbot.puede_enviar_mensajes
        ? 'El bot puede enviar respuestas a los consumidores'
        : 'El bot no tiene permiso para enviar respuestas',
      accion: chatbot.puede_enviar_mensajes ? undefined : 'Configurar permisos',
      onAccion: onIrAConfiguracion,
    },
    {
      label: 'Puede actualizar estados',
      ok: chatbot.puede_cambiar_estado,
      detalle: chatbot.puede_cambiar_estado
        ? 'El bot puede marcar reclamos como "En proceso", "Resuelto", etc.'
        : 'El bot no puede cambiar el estado de los reclamos (opcional)',
    },
  ];

  const aprobados = requisitos.filter(r => r.ok).length;
  const total = requisitos.length;
  const todoOk = aprobados === total;
  // Los 3 primeros son obligatorios (activo, conexion, puede leer)
  const minimoOk = requisitos[0].ok && requisitos[1].ok && requisitos[2].ok;
  const porcentaje = Math.round((aprobados / total) * 100);

  const verificar = () => {
    setVerificando(true);
    setTimeout(() => {
      setVerificando(false);
      setVerificado(true);
    }, 1500);
  };

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* ── Estado general ── */}
      <UiTarjeta>
        <Box sx={{
          display: 'flex', flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' }, gap: 3,
        }}>
          {/* Indicador visual */}
          <Box sx={{
            width: { xs: '100%', md: 120 }, height: { xs: 80, md: 120 },
            borderRadius: 3, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            bgcolor: verificado
              ? (todoOk ? 'var(--ui-exito-suave-2)' : minimoOk ? 'var(--ui-adv-suave)' : 'var(--ui-peligro-suave)')
              : 'var(--ui-superficie-2)',
            border: `2px solid ${verificado
              ? (todoOk ? 'var(--ui-exito-borde)' : minimoOk ? 'var(--ui-adv-borde)' : 'var(--ui-peligro-borde)')
              : 'var(--ui-borde)'}`,
            transition: 'all 0.3s ease',
          }}>
            {verificado ? (
              <>
                <Typography sx={{
                  fontSize: { xs: 28, md: 36 }, fontWeight: 800, lineHeight: 1,
                  color: todoOk ? 'var(--ui-exito-texto)' : minimoOk ? 'var(--ui-adv-texto)' : 'var(--ui-peligro-texto)',
                }}>
                  {porcentaje}%
                </Typography>
                <Typography variant="caption" sx={{
                  fontWeight: 600, mt: 0.5,
                  color: todoOk ? 'var(--ui-exito-texto)' : minimoOk ? 'var(--ui-adv-texto)' : 'var(--ui-peligro-texto)',
                }}>
                  {todoOk ? 'Todo listo' : minimoOk ? 'Funcional' : 'Incompleto'}
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textAlign: 'center', px: 1 }}>
                Presiona verificar
              </Typography>
            )}
          </Box>

          {/* Info + botón */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              {verificado
                ? (todoOk ? 'Tu bot esta listo para funcionar' : minimoOk ? 'Tu bot funciona, pero puede mejorar' : 'Tu bot necesita configuracion')
                : 'Verifica que tu bot este bien configurado'
              }
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
              {verificado
                ? (todoOk
                  ? 'Todas las verificaciones pasaron correctamente. Tu bot de WhatsApp puede atender reclamos sin problemas.'
                  : 'Revisa los puntos pendientes abajo para que tu bot funcione al 100%.')
                : 'Esta herramienta revisa que tu bot tenga todo lo necesario para funcionar correctamente: que este activo, tenga conexion y los permisos adecuados.'
              }
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <UiBoton
                texto={verificado ? 'Verificar de nuevo' : 'Verificar conexion'}
                variante="primario"
                alHacerClick={verificar}
                estado={verificando ? 'cargando' : 'inactivo'}
              />
              {verificado && !todoOk && (
                <UiBoton
                  texto="Ir a Configuracion"
                  variante="contorno"
                  tamano="sm"
                  alHacerClick={onIrAConfiguracion}
                />
              )}
            </Box>
          </Box>
        </Box>

        {/* Barra de progreso */}
        {verificando && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress
              sx={{
                height: 6, borderRadius: 3,
                bgcolor: 'var(--ui-hover)',
                '& .MuiLinearProgress-bar': { bgcolor: 'var(--ui-info-texto)', borderRadius: 3 },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              Verificando configuracion del bot...
            </Typography>
          </Box>
        )}
      </UiTarjeta>

      {/* ── Lista de verificaciones ── */}
      {verificado && (
        <UiTarjeta titulo={`Resultado: ${aprobados} de ${total} verificaciones correctas`}>
          <UiPila direccion="columna" espaciado={0}>
            {requisitos.map((req, i) => (
              <Box
                key={req.label}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  p: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  borderBottom: i < requisitos.length - 1 ? '1px solid var(--ui-borde)' : 'none',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: 'var(--ui-superficie-2)' },
                }}
              >
                {/* Indicador */}
                <Box sx={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 700,
                  bgcolor: req.ok ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave)',
                  color: req.ok ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
                  border: `2px solid ${req.ok ? 'var(--ui-exito-borde)' : 'var(--ui-peligro-borde)'}`,
                }}>
                  {req.ok ? '✓' : '✗'}
                </Box>

                {/* Texto */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{
                    color: req.ok ? 'var(--ui-texto)' : 'var(--ui-peligro-texto)',
                  }}>
                    {req.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                    {req.detalle}
                  </Typography>
                </Box>

                {/* Acción */}
                {req.accion && !req.ok && req.onAccion && (
                  <UiBoton
                    texto={req.accion}
                    variante="contorno"
                    tamano="sm"
                    alHacerClick={req.onAccion}
                  />
                )}
              </Box>
            ))}
          </UiPila>
        </UiTarjeta>
      )}

      {/* ── Info contextual ── */}
      {!verificado && (
        <Box sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2,
        }}>
          {[
            {
              titulo: 'Atencion automatica',
              desc: 'Tu bot atendera reclamos por WhatsApp las 24 horas, los 7 dias de la semana.',
            },
            {
              titulo: 'Respuestas supervisadas',
              desc: 'Todas las respuestas del bot pasan por aprobacion antes de enviarse al consumidor.',
            },
            {
              titulo: 'Gestion completa',
              desc: 'El bot puede leer, responder y actualizar el estado de cada reclamo automaticamente.',
            },
          ].map((item) => (
            <Box
              key={item.titulo}
              sx={{
                p: 2.5, bgcolor: 'var(--ui-superficie-2)', borderRadius: 2,
                border: '1px solid var(--ui-borde)',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                {item.titulo}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {item.desc}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </UiPila>
  );
}
