import { useState, useEffect } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import {
  UiCampoTexto,
  UiAlerta
} from '@/ui';
import { UiPila } from '@/ui';
import { Box, Typography, Switch, Divider, Slider, CircularProgress } from '@mui/material';
import { chatbotsApi, type AIProviderInfo } from '../api/chatbots.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { Chatbot, TipoChatbot } from '@/tipos/chatbot';

interface Props {
  abierto: boolean;
  chatbotEditar?: Chatbot | null;
  alCerrar: () => void;
  alGuardar: () => void;
}

const PERMISOS = [
  {
    key: 'puede_leer_reclamos',
    label: 'Leer reclamos',
    desc: 'Puede consultar la lista y detalle de reclamos',
  },
  {
    key: 'puede_cambiar_estado',
    label: 'Cambiar estado',
    desc: 'Puede cambiar el estado de un reclamo (Pendiente → En Proceso → Resuelto)',
  },
  {
    key: 'puede_enviar_mensajes',
    label: 'Enviar mensajes',
    desc: 'Puede enviar mensajes de seguimiento al consumidor',
  },
];

// Opciones de tipo de bot
const OPCIONES_TIPO: { value: TipoChatbot; label: string; desc: string; disponible: boolean }[] = [
  { value: 'WHATSAPP_BOT', label: 'WhatsApp Bot', desc: 'Bot con IA para atender reclamos por WhatsApp', disponible: true },
  { value: 'ASISTENTE_IA', label: 'Asistente IA', desc: 'Asistente interno para el equipo admin', disponible: false },
  { value: 'TELEGRAM_BOT', label: 'Telegram Bot', desc: 'Bot para atender reclamos por Telegram', disponible: false },
  { value: 'CUSTOM', label: 'Custom', desc: 'Integración personalizada vía API', disponible: false },
];

// Config IA solo para WhatsApp Bot
const TIPOS_CON_IA: TipoChatbot[] = ['WHATSAPP_BOT'];

export function FormChatbot({ abierto, chatbotEditar, alCerrar, alGuardar }: Props) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoChatbot>('WHATSAPP_BOT');
  const [descripcion, setDescripcion] = useState('');

  // Campos IA
  const [modelIA, setModelIA] = useState('');
  const [prompt, setPrompt] = useState('');
  const [temperatura, setTemperatura] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(600);

  // Permisos (scopes)
  const [permisos, setPermisos] = useState<Record<string, boolean>>({
    puede_leer_reclamos: true,
    puede_responder: false,
    puede_cambiar_estado: false,
    puede_enviar_mensajes: true,
    puede_leer_metricas: false,
  });

  // Proveedores IA
  const [proveedores, setProveedores] = useState<AIProviderInfo[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(false);

  // Reglas de negocio — aprobación humana siempre obligatoria
  const requiereAprobacion = true;

  const [cargando, setCargando] = useState(false);

  const muestraConfigIA = TIPOS_CON_IA.includes(tipo);

  // Cargar proveedores IA al abrir el modal
  useEffect(() => {
    if (abierto && muestraConfigIA) {
      setCargandoProveedores(true);
      chatbotsApi.obtenerProveedoresIA()
        .then((data) => {
          setProveedores(data || []);
          // Si no hay modelo seleccionado, usar el default
          if (!modelIA) {
            const defProvider = (data || []).find(p => p.es_default && p.ok);
            if (defProvider) setModelIA(defProvider.model);
          }
        })
        .catch(() => setProveedores([]))
        .finally(() => setCargandoProveedores(false));
    }
  }, [abierto, muestraConfigIA]);

  useEffect(() => {
    if (chatbotEditar) {
      setNombre(chatbotEditar.nombre);
      setTipo(chatbotEditar.tipo);
      setDescripcion(chatbotEditar.descripcion || '');
      setModelIA(chatbotEditar.modelo_ia || '');
      setPrompt(chatbotEditar.prompt_sistema || '');
      setTemperatura(chatbotEditar.temperatura ?? 0.3);
      setMaxTokens(chatbotEditar.max_tokens_respuesta ?? 600);
      setPermisos({
        puede_leer_reclamos: chatbotEditar.puede_leer_reclamos ?? true,
        puede_responder: chatbotEditar.puede_responder ?? false,
        puede_cambiar_estado: chatbotEditar.puede_cambiar_estado ?? false,
        puede_enviar_mensajes: chatbotEditar.puede_enviar_mensajes ?? true,
        puede_leer_metricas: chatbotEditar.puede_leer_metricas ?? false,
      });
    } else {
      setNombre('');
      setTipo('WHATSAPP_BOT');
      setDescripcion('');
      setModelIA('');
      setPrompt('');
      setTemperatura(0.3);
      setMaxTokens(600);
      setPermisos({
        puede_leer_reclamos: true,
        puede_responder: false,
        puede_cambiar_estado: false,
        puede_enviar_mensajes: true,
        puede_leer_metricas: false,
      });
    }
  }, [chatbotEditar, abierto]);

  const togglePermiso = (key: string) => {
    setPermisos(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const guardar = async () => {
    if (!nombre.trim()) return notificar.advertencia('El nombre es obligatorio');

    setCargando(true);
    try {
      const payload = {
        nombre,
        tipo,
        descripcion,
        // Config IA (solo si el tipo lo soporta)
        modelo_ia: muestraConfigIA ? modelIA : undefined,
        prompt_sistema: muestraConfigIA ? prompt : undefined,
        temperatura: muestraConfigIA ? temperatura : undefined,
        max_tokens_respuesta: muestraConfigIA ? maxTokens : undefined,
        // Permisos
        puede_leer_reclamos: permisos.puede_leer_reclamos,
        puede_responder: permisos.puede_responder,
        puede_cambiar_estado: permisos.puede_cambiar_estado,
        puede_enviar_mensajes: permisos.puede_enviar_mensajes,
        puede_leer_metricas: permisos.puede_leer_metricas,
        // Reglas
        requiere_aprobacion: requiereAprobacion,
      };

      if (chatbotEditar) {
        await chatbotsApi.actualizar(chatbotEditar.id, payload);
        notificar.exito('Chatbot actualizado');
      } else {
        await chatbotsApi.crear(payload);
        notificar.exito('Chatbot creado exitosamente');
      }
      alGuardar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={chatbotEditar ? "Editar Chatbot" : "Nuevo Chatbot"}
      maxAncho="md"
      pie={
        <>
          <BotonModal texto="Cancelar" variante="secundario" onClick={alCerrar} />
          <BotonModal
            texto={chatbotEditar ? "Guardar Cambios" : "Crear Chatbot"}
            onClick={guardar}
            cargando={cargando}
          />
        </>
      }
    >
      <UiPila direccion="columna" espaciado={2}>
        {/* ── Info básica ── */}
        <UiCampoTexto
          etiqueta="Nombre *"
          valor={nombre}
          alCambiar={(e) => setNombre(e.target.value)}
          anchoCompleto
        />

        {/* ── Tipo de bot ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Tipo de bot
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {OPCIONES_TIPO.map((op) => {
              const seleccionado = tipo === op.value;
              const deshabilitado = !op.disponible;
              return (
                <Box
                  key={op.value}
                  onClick={() => { if (!deshabilitado) setTipo(op.value); }}
                  sx={{
                    position: 'relative',
                    p: 1.5,
                    borderRadius: 2,
                    border: seleccionado
                      ? '2px solid var(--ui-primario, #9a4a24)'
                      : '1px solid var(--ui-borde)',
                    bgcolor: deshabilitado
                      ? 'var(--ui-hover, #f1eee6)'
                      : seleccionado
                        ? 'var(--ui-info-suave-2, #fbf2ec)'
                        : 'var(--ui-superficie-2, #fff)',
                    cursor: deshabilitado ? 'not-allowed' : 'pointer',
                    opacity: deshabilitado ? 0.55 : 1,
                    transition: 'all 0.15s',
                    ...(!deshabilitado && !seleccionado && {
                      '&:hover': { borderColor: 'var(--ui-primario, #9a4a24)', bgcolor: 'var(--ui-hover)' },
                    }),
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ui-texto)', fontSize: '13px' }}>
                    {op.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--ui-texto-2)', fontSize: '11px', lineHeight: 1.3 }}>
                    {op.desc}
                  </Typography>
                  {deshabilitado && (
                    <Box sx={{
                      position: 'absolute', top: 6, right: 6,
                      px: 0.8, py: 0.2, borderRadius: 1,
                      bgcolor: 'var(--ui-texto-2, #857e70)',
                      color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}>
                      Pronto
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        <UiCampoTexto
          etiqueta="Descripción"
          valor={descripcion}
          alCambiar={(e) => setDescripcion(e.target.value)}
          multilinea
          filas={2}
        />

        {/* ── Permisos ── */}
        <Divider />
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Permisos del Bot
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Define qué puede hacer este chatbot con tu sistema de reclamos.
          </Typography>
        </Box>

        <Box sx={{
          display: 'flex', flexDirection: 'column', gap: 0,
          bgcolor: 'var(--ui-superficie-2)', borderRadius: 2, border: '1px solid var(--ui-borde)', overflow: 'hidden',
        }}>
          {PERMISOS.map((p, i) => (
            <Box
              key={p.key}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 2, py: 1.2,
                borderBottom: i < PERMISOS.length - 1 ? '1px solid var(--ui-borde)' : 'none',
                '&:hover': { bgcolor: 'var(--ui-hover)' },
                transition: 'background 0.15s',
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ui-texto)' }}>
                  {p.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                  {p.desc}
                </Typography>
              </Box>
              <Switch
                checked={permisos[p.key] || false}
                onChange={() => togglePermiso(p.key)}
                size="small"
                color="primary"
              />
            </Box>
          ))}
        </Box>

        {/* ── Regla: Requiere aprobación (obligatorio) ── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.2, bgcolor: 'var(--ui-adv-suave)', borderRadius: 2, border: '1px solid var(--ui-adv-borde)',
        }}>
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ui-adv-texto)' }}>
              Aprobación humana obligatoria
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--ui-adv-texto)', fontSize: '11px' }}>
              Las respuestas del bot siempre quedan en borrador hasta que un admin las apruebe.
            </Typography>
          </Box>
          <Switch
            checked
            disabled
            size="small"
            color="warning"
          />
        </Box>

        {/* ── Config IA (para ASISTENTE_IA y WHATSAPP_BOT) ── */}
        {muestraConfigIA && (
          <>
            <Divider />
            <UiPila direccion="columna" espaciado={2} sx={{ p: 2, bgcolor: 'var(--ui-info-suave-2)', borderRadius: 2, border: '1px solid var(--ui-info-borde)' }}>
              <UiAlerta
                variante="info"
                titulo="Configuración de IA"
                descripcion="Agrega instrucciones propias del negocio (tono, horarios, reglas). El flujo de registro de reclamos esta protegido y no se puede modificar."
              />
              <UiCampoTexto
                etiqueta="Instrucciones adicionales del negocio"

                valor={prompt}
                alCambiar={(e) => setPrompt(e.target.value)}
                multilinea
                filas={6}
                textoAyuda="Instrucciones complementarias: tono, horarios, reglas del negocio, etc. El flujo de registro y las reglas base del bot no se pueden modificar."
              />
              {/* Selector de proveedor/modelo IA */}
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, color: 'var(--ui-texto)' }}>
                  Modelo de IA
                </Typography>
                {cargandoProveedores ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">Verificando proveedores...</Typography>
                  </Box>
                ) : proveedores.length === 0 ? (
                  <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'var(--ui-adv-suave)', border: '1px solid var(--ui-adv-borde)' }}>
                    <Typography variant="caption" sx={{ color: 'var(--ui-adv-texto)' }}>
                      No hay proveedores de IA configurados. Configura AI_PROVIDER en el .env del backend.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {proveedores.map((prov) => {
                      const seleccionado = modelIA === prov.model;
                      return (
                        <Box
                          key={prov.id}
                          onClick={() => { if (prov.ok) setModelIA(prov.model); }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            p: 1.2, borderRadius: 1.5,
                            border: seleccionado ? '2px solid var(--ui-primario, #9a4a24)' : '1px solid var(--ui-borde)',
                            bgcolor: !prov.ok
                              ? 'var(--ui-hover, #f1eee6)'
                              : seleccionado
                                ? 'var(--ui-info-suave-2, #fbf2ec)'
                                : 'transparent',
                            cursor: prov.ok ? 'pointer' : 'not-allowed',
                            opacity: prov.ok ? 1 : 0.5,
                            transition: 'all 0.15s',
                            ...(prov.ok && !seleccionado && {
                              '&:hover': { borderColor: 'var(--ui-primario, #9a4a24)', bgcolor: 'var(--ui-hover)' },
                            }),
                          }}
                        >
                          {/* Dot de estado */}
                          <Box sx={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            bgcolor: prov.ok ? '#5c8a4f' : '#b83a32',
                          }} />
                          {/* Info */}
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '13px', color: 'var(--ui-texto)' }}>
                              {prov.label}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '11px', color: prov.ok ? 'var(--ui-texto-2)' : '#b83a32' }}>
                              {prov.detalle}
                              {prov.es_default && prov.ok && ' · Default'}
                            </Typography>
                          </Box>
                          {/* Badge seleccionado */}
                          {seleccionado && (
                            <Box sx={{
                              px: 0.8, py: 0.2, borderRadius: 1,
                              bgcolor: 'var(--ui-primario, #9a4a24)',
                              color: '#fff', fontSize: '9px', fontWeight: 700,
                              textTransform: 'uppercase', flexShrink: 0,
                            }}>
                              Activo
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>

              {/* Temperatura */}
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, color: 'var(--ui-texto)' }}>
                  Temperatura: {temperatura}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '11px' }}>
                  0 = respuestas precisas y consistentes · 1 = respuestas más creativas y variadas
                </Typography>
                <Slider
                  value={temperatura}
                  onChange={(_, v) => setTemperatura(v as number)}
                  min={0}
                  max={1}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.3, label: '0.3' },
                    { value: 0.7, label: '0.7' },
                    { value: 1, label: '1' },
                  ]}
                  sx={{ maxWidth: 400 }}
                />
              </Box>

              {/* Max Tokens */}
              <UiCampoTexto
                etiqueta="Máximo de tokens por respuesta"
                valor={String(maxTokens)}
                alCambiar={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) setMaxTokens(val);
                }}
                marcador="600"
                textoAyuda="Se recomienda 400-800 para respuestas concisas."
              />
            </UiPila>
          </>
        )}
      </UiPila>
    </ModalBase>
  );
}