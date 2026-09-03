import { useState, useEffect } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiBoton, UiCampoTexto, UiSelector } from '@/ui';
import { UiPila } from '@/ui';
import { Box, Typography, Divider, Tooltip } from '@mui/material';
import { solicitudesAsesorApi } from '../api/solicitudes-asesor.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoFechaHora, formatoRelativo } from '@/aplicacion/helpers/formato';
import type { SolicitudAsesor, PrioridadSolicitud } from '@/tipos/solicitud-asesor';
import type { EventoSelector } from '@/ui';
import Swal from 'sweetalert2';
import { ChatAtencion } from './ChatAtencion';

interface Props {
  abierto: boolean;
  solicitud: SolicitudAsesor | null;
  alCerrar: () => void;
  alActualizar: () => void;
}

const COLORES_ESTADO: Record<string, { bg: string; color: string; label: string }> = {
  PENDIENTE: { bg: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', label: 'Pendiente' },
  EN_ATENCION: { bg: 'var(--ui-info-suave-2)', color: 'var(--ui-info-texto)', label: 'En Atención' },
  RESUELTO: { bg: 'var(--ui-exito-suave-2)', color: 'var(--ui-exito-texto)', label: 'Resuelto' },
  CANCELADO: { bg: 'var(--ui-hover)', color: 'var(--ui-texto-2)', label: 'Cancelado' },
};

const COLORES_PRIORIDAD: Record<string, { bg: string; color: string }> = {
  BAJA: { bg: 'var(--ui-hover)', color: 'var(--ui-texto-2)' },
  NORMAL: { bg: 'var(--ui-info-suave-2)', color: 'var(--ui-info-texto)' },
  ALTA: { bg: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)' },
  URGENTE: { bg: 'var(--ui-peligro-suave)', color: 'var(--ui-peligro-texto)' },
};

const COLORES_CANAL: Record<string, { bg: string; color: string }> = {
  WHATSAPP: { bg: 'var(--ui-exito-suave-2)', color: 'var(--ui-exito-texto)' },
  WEB: { bg: 'var(--ui-info-suave-2)', color: 'var(--ui-info-texto)' },
  TELEFONO: { bg: 'var(--ui-hover)', color: 'var(--ui-texto-2)' },
};

const PRIORIDADES: { valor: PrioridadSolicitud; etiqueta: string }[] = [
  { valor: 'BAJA', etiqueta: 'Baja' },
  { valor: 'NORMAL', etiqueta: 'Normal' },
  { valor: 'ALTA', etiqueta: 'Alta' },
  { valor: 'URGENTE', etiqueta: 'Urgente' },
];

// ── Helpers para campos nullable del backend ──
function extraerValor(campo: unknown): string | null {
  if (campo == null || campo === '') return null;
  if (typeof campo === 'string') return campo;
  if (typeof campo === 'object') {
    const obj = campo as Record<string, unknown>;
    if ('UUID' in obj && obj.Valid === true) return obj.UUID as string;
    if ('String' in obj && obj.Valid === true) return obj.String as string;
    if ('Time' in obj && obj.Valid === true) return obj.Time as string;
    if ('Valid' in obj && obj.Valid === false) return null;
  }
  return String(campo);
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
        {etiqueta}
      </Typography>
      <Box sx={{ mt: 0.3 }}>{children}</Box>
    </Box>
  );
}

function ResumenConversacion({ texto }: { texto: string }) {
  const [expandido, setExpandido] = useState(false);
  const lineas = texto.split('\n');
  const LIMITE_LINEAS = 6;
  const necesitaExpansion = lineas.length > LIMITE_LINEAS;
  const lineasVisibles = expandido ? lineas : lineas.slice(0, LIMITE_LINEAS);

  return (
    <Dato etiqueta="Conversación (WhatsApp)">
      <Box sx={{ p: 1.5, bgcolor: 'var(--ui-exito-suave)', borderRadius: 1.5, border: '1px solid var(--ui-exito-borde)', maxHeight: expandido ? 'none' : '280px', overflow: 'hidden', position: 'relative' }}>
        {lineasVisibles.map((linea, i) => {
          const esCliente = linea.startsWith('[Cliente]');
          const esBot = linea.startsWith('[Bot]');
          const contenido = linea.replace(/^\[(Cliente|Bot)\]\s*/, '');
          if (!contenido.trim()) return null;
          return (
            <Box key={i} sx={{ mb: 1, display: 'flex', gap: 1 }}>
              <Box sx={{
                px: 0.8, py: 0.2, borderRadius: 1, fontSize: '10px', fontWeight: 700, flexShrink: 0, height: 'fit-content', mt: 0.3,
                bgcolor: esCliente ? 'var(--ui-info-suave-2)' : esBot ? 'var(--ui-exito-suave-2)' : 'var(--ui-hover)',
                color: esCliente ? 'var(--ui-info-texto)' : esBot ? 'var(--ui-exito-texto)' : 'var(--ui-texto-2)',
              }}>
                {esCliente ? 'Cliente' : esBot ? 'Bot' : '—'}
              </Box>
              <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.6, wordBreak: 'break-word' }}>
                {contenido}
              </Typography>
            </Box>
          );
        })}
        {!expandido && necesitaExpansion && (
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, var(--ui-exito-suave))' }} />
        )}
      </Box>
      {necesitaExpansion && (
        <Box
          onClick={() => setExpandido(!expandido)}
          sx={{ mt: 0.5, textAlign: 'center', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--ui-exito-texto)', '&:hover': { textDecoration: 'underline' } }}
        >
          {expandido ? 'Mostrar menos ▲' : `Mostrar toda la conversación (${lineas.length} mensajes) ▼`}
        </Box>
      )}
    </Dato>
  );
}

export function DetalleSolicitud({ abierto, solicitud, alCerrar, alActualizar }: Props) {
  const [notaInterna, setNotaInterna] = useState('');
  const [notaResolver, setNotaResolver] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadSolicitud>('NORMAL');
  const [cargando, setCargando] = useState('');

  // Reasignación
  const [asesores, setAsesores] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState('');
  const [mostrarReasignar, setMostrarReasignar] = useState(false);

  // Estado local para mantener datos frescos en el modal
  const [solLocal, setSolLocal] = useState<SolicitudAsesor | null>(null);

  // Sincronizar con prop padre
  useEffect(() => {
    if (solicitud) {
      setSolLocal(solicitud);
      setNotaInterna(extraerValor(solicitud.nota_interna) || '');
      setPrioridad(solicitud.prioridad);
      setNotaResolver('');
      setAsesorSeleccionado('');
      setMostrarReasignar(false);
    }
  }, [solicitud]);

  // Re-fetch para mantener datos actualizados en el modal
  const refrescar = async () => {
    alActualizar();
    if (solicitud) {
      try {
        const actualizada = await solicitudesAsesorApi.obtener(solicitud.id);
        setSolLocal(actualizada);
        setNotaInterna(extraerValor(actualizada.nota_interna) || '');
        setPrioridad(actualizada.prioridad);
      } catch {
        /* si falla, el modal se cerrará */
      }
    }
  };

  // Cargar asesores al abrir reasignación
  useEffect(() => {
    if (!mostrarReasignar) return;
    solicitudesAsesorApi.listarAsesores()
      .then((usuarios) => {
        const opciones = usuarios
          .filter((u: { id: string; activo?: boolean }) => u.activo !== false)
          .map((u: { id: string; nombre_completo: string; rol: string }) => ({
            valor: u.id,
            etiqueta: `${u.nombre_completo} (${u.rol})`,
          }));
        setAsesores(opciones);
      })
      .catch(() => notificar.error('No se pudieron cargar los asesores'));
  }, [mostrarReasignar]);

  const sol = solLocal || solicitud;
  if (!sol) return null;

  const estaAbierta = sol.estado === 'PENDIENTE' || sol.estado === 'EN_ATENCION';
  const ce = COLORES_ESTADO[sol.estado];
  const cp = COLORES_PRIORIDAD[sol.prioridad];
  const cc = COLORES_CANAL[sol.canal_origen];

  const tomar = async () => {
    setCargando('tomar');
    try {
      await solicitudesAsesorApi.tomar(sol.id);
      notificar.exito('Solicitud tomada — ahora estás a cargo');
      refrescar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando('');
    }
  };

  const reasignar = async () => {
    if (!asesorSeleccionado) return notificar.advertencia('Selecciona un asesor');
    setCargando('reasignar');
    try {
      await solicitudesAsesorApi.asignar(sol.id, { asignado_a: asesorSeleccionado });
      notificar.exito('Solicitud reasignada');
      setMostrarReasignar(false);
      refrescar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando('');
    }
  };

  const resolver = async () => {
    const result = await Swal.fire({
      title: '¿Marcar como resuelta?',
      html: '<p style="font-size:14px;color:#6a655a">La solicitud se cerrará como resuelta.</p>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Resolver',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#40613a',
      didOpen: (el) => { if (el.parentElement) el.parentElement.style.zIndex = '9999'; },
    });
    if (!result.isConfirmed) return;

    setCargando('resolver');
    try {
      await solicitudesAsesorApi.resolver(sol.id, {
        nota_interna: notaResolver.trim() || undefined,
      });
      notificar.exito('Solicitud resuelta');
      refrescar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando('');
    }
  };

  const cancelar = async () => {
    const result = await Swal.fire({
      title: '¿Cancelar solicitud?',
      html: '<p style="font-size:14px;color:#6a655a">La solicitud se cerrará como cancelada.</p>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancelar solicitud',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#a3312a',
      didOpen: (el) => { if (el.parentElement) el.parentElement.style.zIndex = '9999'; },
    });
    if (!result.isConfirmed) return;

    setCargando('cancelar');
    try {
      await solicitudesAsesorApi.cancelar(sol.id);
      notificar.exito('Solicitud cancelada');
      refrescar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando('');
    }
  };

  const guardarPrioridad = async () => {
    if (prioridad === sol.prioridad) return;
    setCargando('prioridad');
    try {
      await solicitudesAsesorApi.actualizarPrioridad(sol.id, { prioridad });
      notificar.exito('Prioridad actualizada');
      refrescar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando('');
    }
  };

  const guardarNota = async () => {
    setCargando('nota');
    try {
      await solicitudesAsesorApi.actualizarNota(sol.id, { nota_interna: notaInterna });
      notificar.exito('Nota interna guardada');
      refrescar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando('');
    }
  };

  const abrirWhatsApp = () => {
    const tel = sol.telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Detalle de Solicitud"
      maxAncho="md"
      pie={
        <BotonModal texto="Cerrar" variante="secundario" onClick={alCerrar} />
      }
    >
      <UiPila direccion="columna" espaciado={2.5}>
        {/* ── Badges de estado ── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ px: 1.5, py: 0.4, borderRadius: 2, fontSize: '12px', fontWeight: 700, bgcolor: ce.bg, color: ce.color }}>
            {ce.label}
          </Box>
          <Box sx={{ px: 1.5, py: 0.4, borderRadius: 2, fontSize: '12px', fontWeight: 700, bgcolor: cp.bg, color: cp.color }}>
            {sol.prioridad}
          </Box>
          <Box sx={{ px: 1.5, py: 0.4, borderRadius: 2, fontSize: '12px', fontWeight: 700, bgcolor: cc.bg, color: cc.color }}>
            {sol.canal_origen}
          </Box>
        </Box>

        {/* ── Datos del solicitante ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Dato etiqueta="Nombre">
            <Typography variant="body1" fontWeight={600}>{sol.nombre}</Typography>
          </Dato>
          <Dato etiqueta="Teléfono">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" fontWeight={600} fontFamily="monospace">
                {sol.telefono}
              </Typography>
              <Box
                onClick={abrirWhatsApp}
                sx={{
                  px: 1, py: 0.2, borderRadius: 1, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  bgcolor: 'var(--ui-exito-suave-2)', color: 'var(--ui-exito-texto)', '&:hover': { bgcolor: 'var(--ui-exito-borde)' }, transition: 'all 0.15s',
                }}
              >
                Abrir WhatsApp
              </Box>
            </Box>
          </Dato>
          <Dato etiqueta="Creado">
            <Typography variant="body2">{formatoFechaHora(sol.fecha_creacion)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {formatoRelativo(sol.fecha_creacion)}
            </Typography>
          </Dato>
          {extraerValor(sol.asignado_a) && (
            <Dato etiqueta="Asignado a">
              <Tooltip
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                      {sol.nombre_asesor || 'Asesor asignado'}
                    </Typography>
                    {extraerValor(sol.fecha_asignacion) && (
                      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', mt: 0.3 }}>
                        Asignado el {formatoFechaHora(extraerValor(sol.fecha_asignacion) as string)}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', mt: 0.3 }}>
                      ID: {(extraerValor(sol.asignado_a) as string)?.slice(0, 8)}…
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
                slotProps={{
                  tooltip: {
                    sx: {
                      bgcolor: '#302d27',
                      borderRadius: 'var(--ui-r-lg)',
                      px: 1.5,
                      py: 1,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    },
                  },
                  arrow: { sx: { color: '#302d27' } },
                }}
              >
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, cursor: 'pointer', px: 1, py: 0.4, borderRadius: 1.5, transition: 'all 0.15s', '&:hover': { bgcolor: 'var(--ui-exito-suave)' } }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#40613a', flexShrink: 0, boxShadow: '0 0 0 3px rgba(64,97,58,0.15)' }} />
                  <Typography variant="body2" fontWeight={600}>
                    {sol.nombre_asesor || 'Asesor asignado'}
                  </Typography>
                </Box>
              </Tooltip>
              {extraerValor(sol.fecha_asignacion) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                  Tomada el {formatoFechaHora(extraerValor(sol.fecha_asignacion) as string)}
                </Typography>
              )}
            </Dato>
          )}
          {extraerValor(sol.fecha_resolucion) && (
            <Dato etiqueta="Fecha resolución">
              <Typography variant="body2">{formatoFechaHora(extraerValor(sol.fecha_resolucion) as string)}</Typography>
            </Dato>
          )}
        </Box>

        {/* ── Motivo ── */}
        <Dato etiqueta="Motivo">
          <Box sx={{ p: 1.5, bgcolor: 'var(--ui-superficie-2)', borderRadius: 1.5, border: '1px solid var(--ui-borde)' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {sol.motivo}
            </Typography>
          </Box>
        </Dato>

        {/* ── Resumen conversación ── */}
        {extraerValor(sol.resumen_conversacion) && (
          <ResumenConversacion texto={extraerValor(sol.resumen_conversacion) as string} />
        )}

        {/* ── Chat en vivo (visible en EN_ATENCION, RESUELTO y CANCELADO) ── */}
        {sol.estado !== 'PENDIENTE' && (
          <>
            <Divider />
            <Box sx={{ border: '1px solid var(--ui-borde)', borderRadius: 2, overflow: 'hidden' }}>
              <ChatAtencion
                solicitudId={sol.id}
                estaAbierta={estaAbierta}
              />
            </Box>
          </>
        )}

        {/* ── Acciones (solo si está abierta) ── */}
        {estaAbierta && (
          <>
            <Divider />
            <Typography variant="subtitle2" fontWeight={700}>Acciones</Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {sol.estado === 'PENDIENTE' && (
                <UiBoton
                  texto="Tomar Solicitud"
                  variante="primario"
                  alHacerClick={tomar}
                  estado={cargando === 'tomar' ? 'cargando' : 'inactivo'}
                />
              )}
              <UiBoton
                texto="Reasignar"
                variante="contorno"
                alHacerClick={() => setMostrarReasignar(!mostrarReasignar)}
              />
              <UiBoton
                texto="Marcar Resuelta"
                variante="primario"
                alHacerClick={resolver}
                estado={cargando === 'resolver' ? 'cargando' : 'inactivo'}
              />
              <UiBoton
                texto="Cancelar Solicitud"
                variante="contorno"
                alHacerClick={cancelar}
                estado={cargando === 'cancelar' ? 'cargando' : 'inactivo'}
              />
            </Box>

            {/* Reasignar asesor */}
            {mostrarReasignar && (
              <Box sx={{ p: 1.5, bgcolor: 'var(--ui-superficie-2)', borderRadius: 1.5, border: '1px solid var(--ui-borde)' }}>
                <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', color: 'text.secondary' }}>
                  Derivar a otro asesor
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <UiSelector
                    etiqueta="Asesor"
                    opciones={asesores}
                    value={asesorSeleccionado}
                    alCambiar={(e: EventoSelector) => setAsesorSeleccionado(e.target.value as string)}
                  />
                  <UiBoton
                    texto="Reasignar"
                    variante="primario"
                    tamano="sm"
                    alHacerClick={reasignar}
                    estado={cargando === 'reasignar' ? 'cargando' : 'inactivo'}
                  />
                </Box>
              </Box>
            )}

            {/* Nota al resolver */}
            <UiCampoTexto
              etiqueta="Nota al resolver (opcional)"
              valor={notaResolver}
              alCambiar={(e) => setNotaResolver(e.target.value)}
              multilinea
              filas={2}
              marcador="Agrega una nota antes de resolver..."
              anchoCompleto
            />

            {/* Cambiar prioridad */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <UiSelector
                etiqueta="Prioridad"
                opciones={PRIORIDADES}
                value={prioridad}
                alCambiar={(e: EventoSelector) => setPrioridad(e.target.value as PrioridadSolicitud)}
              />
              {prioridad !== sol.prioridad && (
                <UiBoton
                  texto="Guardar"
                  variante="primario"
                  tamano="sm"
                  alHacerClick={guardarPrioridad}
                  estado={cargando === 'prioridad' ? 'cargando' : 'inactivo'}
                />
              )}
            </Box>
          </>
        )}

        {/* ── Nota interna (siempre visible y editable) ── */}
        <Divider />
        <Box>
          <UiCampoTexto
            etiqueta="Nota interna"
            valor={notaInterna}
            alCambiar={(e) => setNotaInterna(e.target.value)}
            multilinea
            filas={3}
            marcador="Notas internas del equipo (no visibles para el solicitante)..."
            anchoCompleto
          />
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <UiBoton
              texto="Guardar Nota"
              variante="contorno"
              tamano="sm"
              alHacerClick={guardarNota}
              estado={cargando === 'nota' ? 'cargando' : 'inactivo'}
            />
          </Box>
        </Box>
      </UiPila>
    </ModalBase>
  );
}