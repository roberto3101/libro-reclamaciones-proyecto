import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiIcono } from '@/ui';

// Iconos
import { FiSend, FiCheckCircle, FiArrowLeft, FiAlertCircle, FiClock, FiUser, FiFileText, FiMessageSquare, FiRefreshCw, FiInfo, FiPaperclip, FiDownload, FiExternalLink } from 'react-icons/fi';

import { Tooltip } from '@mui/material';

// APIs
import { reclamosApi } from '../api/reclamos.api';
import { mensajesApi } from '@/modulos/mensajes/api/mensajes.api';
import { usuariosApi } from '@/modulos/usuarios/api/usuarios.api';
import { almacenamientoApi } from '@/modulos/libro-publico/api/almacenamiento.api';

// Helpers y Tipos
import { formatoFecha, formatoFechaHora } from '@/aplicacion/helpers/formato';
import { manejarError } from '@/aplicacion/helpers/errores';
import { notificar } from '@/aplicacion/helpers/toast';
import type { Reclamo, Mensaje, EstadoReclamo, TipoMensaje, Usuario } from '@/tipos';
import { ESTADOS_RECLAMO } from '@/tipos/reclamo';

// WebSocket
import {
  usarWebSocketReclamoMensajes,
  usarEventoWebSocket,
} from '@/infraestructura/websocket';
import type { DatosReclamoMensajeRecibido } from '@/infraestructura/websocket';

/* ─── Adaptive theme styles ─────────────────────────────────────────────
   Uses CSS custom properties set on <html> by UiProveedorMui.
   Inline styles guarantee they win over @layer'd Tailwind & MUI cascade. */
const T = {
  page:    { backgroundColor: 'var(--ui-fondo)' } as React.CSSProperties,
  card:    { backgroundColor: 'var(--ui-superficie)', borderColor: 'var(--ui-borde)' } as React.CSSProperties,
  border:  { borderColor: 'var(--ui-borde)' } as React.CSSProperties,
  text:    { color: 'var(--ui-texto)' } as React.CSSProperties,
  textSec: { color: 'var(--ui-texto-2)' } as React.CSSProperties,
  muted:   { color: 'var(--ui-texto-3)' } as React.CSSProperties,
  inset:   { backgroundColor: 'var(--ui-superficie-hundida)' } as React.CSSProperties,
  insetB:  { backgroundColor: 'var(--ui-superficie-hundida)', borderColor: 'var(--ui-borde)' } as React.CSSProperties,
};

// Extrae el empresaId de la clave del archivo (reclamaciones/{empresaId}/...)
function extraerEmpresaId(clave: string, fallback: string): string {
  const partes = clave.split('/');
  if (partes.length >= 2 && partes[0] === 'reclamaciones') return partes[1];
  return fallback;
}

// ── Componente de archivo en burbuja de mensaje ──
function ArchivoMensaje({ archivoUrl, archivoNombre, esImagen, empresaId, soyAdmin }: {
  archivoUrl: string; archivoNombre: string; esImagen: boolean; empresaId: string; soyAdmin: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const idReal = extraerEmpresaId(archivoUrl, empresaId);

  useEffect(() => {
    let cancelado = false;
    almacenamientoApi.obtenerUrlFirmada(archivoUrl, idReal)
      .then((u) => { if (!cancelado) setUrl(u); })
      .catch(() => {
        // Fallback: intentar con descarga directa
        if (!cancelado) {
          setUrl(`/storage-api/almacenamiento/descargar?clave=${encodeURIComponent(archivoUrl)}&empresa_id=${encodeURIComponent(idReal)}`);
        }
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [archivoUrl, empresaId]);

  const abrirArchivo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url) return;
    if (esImagen) {
      setPreviewing(true);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (cargando) {
    return <div className="h-8 flex items-center gap-2 opacity-60 text-xs"><div className="animate-spin rounded-full h-3.5 w-3.5 border border-current border-t-transparent" /> Cargando...</div>;
  }

  if (!url) return null;

  return (
    <>
      {esImagen ? (
        <div className="mb-1.5 cursor-pointer" onClick={abrirArchivo}>
          <img src={url} alt={archivoNombre} className="max-w-full max-h-[200px] rounded-lg object-cover" />
        </div>
      ) : (
        <div
          onClick={abrirArchivo}
          className={`flex items-center gap-2 mb-1.5 px-3 py-2 rounded-lg transition-colors text-xs cursor-pointer ${
            soyAdmin ? 'bg-blue-700/40 hover:bg-blue-700/60 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          style={!soyAdmin ? { color: 'var(--ui-texto)' } : undefined}
        >
          <FiFileText size={16} className="shrink-0" />
          <span className="truncate flex-1">{archivoNombre}</span>
          <FiExternalLink size={14} className="shrink-0 opacity-60" />
        </div>
      )}

      {/* Lightbox preview */}
      {previewing && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewing(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={url} alt={archivoNombre} className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                className="bg-white/90 hover:bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors dark:text-gray-300"
                title="Abrir en nueva pestaña"
              >
                <FiExternalLink size={16} />
              </button>
              <button
                onClick={() => setPreviewing(false)}
                className="w-8 h-8 flex items-center justify-center rounded-[3px] border transition-colors"
                style={{ background: 'var(--ui-superficie)', borderColor: 'var(--ui-borde)', color: 'var(--ui-texto-2)' }}
                title="Cerrar"
                aria-label="Cerrar vista previa"
              >
                <UiIcono nombre="close" tamano={17} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PaginaDetalleReclamo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const chatRef = useRef<HTMLDivElement>(null);

  // --- ESTADOS ---
  const [reclamo, setReclamo] = useState<Reclamo | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);

  // Inputs
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [textoResolucion, setTextoResolucion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<EstadoReclamo | ''>('');

  // Chat archivo adjunto
  const [archivoChat, setArchivoChat] = useState<File | null>(null);
  const [previewArchivo, setPreviewArchivo] = useState<string | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  // Loading States
  const [cargando, setCargando] = useState(true);
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [enviandoResolucion, setEnviandoResolucion] = useState(false);

  // Asignar asesor
  const [modalAsignar, setModalAsignar] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState('');
  const [asignando, setAsignando] = useState(false);

  // --- WEBSOCKET PARA MENSAJES EN TIEMPO REAL ---
  const concentradorWS = usarWebSocketReclamoMensajes(id ?? '');

  const manejarMensajeWSRecibido = useCallback((datos: DatosReclamoMensajeRecibido) => {
    setMensajes((prev) => {
      if (prev.some((m) => m.id === datos.mensaje_id)) return prev;
      const nuevo: Mensaje = {
        id: datos.mensaje_id,
        tenant_id: '',
        reclamo_id: datos.reclamo_id,
        tipo_mensaje: datos.tipo_mensaje as TipoMensaje,
        mensaje: datos.contenido,
        fecha_mensaje: new Date().toISOString(),
        leido: false,
        archivo_url: null,
        archivo_nombre: null,
        fecha_lectura: null,
        chatbot_id: null,
      };
      return [...prev, nuevo];
    });
  }, []);

  usarEventoWebSocket<DatosReclamoMensajeRecibido>(concentradorWS, 'RECLAMO_MENSAJE_CLIENTE_RECIBIDO', manejarMensajeWSRecibido);
  usarEventoWebSocket<DatosReclamoMensajeRecibido>(concentradorWS, 'RECLAMO_MENSAJE_EMPRESA_ENVIADO', manejarMensajeWSRecibido);

  // --- CARGA INICIAL ---
  useEffect(() => {
    if (id) cargarExpediente();
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensajes]);

  const cargarExpediente = async () => {
    if (!id) return;
    setCargando(true);
    try {
      const [dataReclamo, dataMensajes] = await Promise.all([
        reclamosApi.obtenerPorId(id),
        mensajesApi.listarPorReclamo(id)
      ]);
      setReclamo(dataReclamo);
      setMensajes(dataMensajes || []);
      setNuevoEstado(dataReclamo.estado);
    } catch (error) {
      manejarError(error, "No se pudo cargar el expediente");
      navigate('/panel/reclamos');
    } finally {
      setCargando(false);
    }
  };

  // --- ACCION 1: CAMBIAR ESTADO ---
  const actualizarEstado = async () => {
    if (!id || !nuevoEstado || nuevoEstado === reclamo?.estado) return;

    const confirm = await Swal.fire({
      title: '¿Cambiar estado?',
      html: `<p style="color:#6a655a;font-size:15px;">El estado pasará a <strong>${ESTADOS_RECLAMO[nuevoEstado].etiqueta}</strong>.<br/>El cliente recibirá una notificación por correo electrónico.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#9a4a24',
      cancelButtonColor: '#857e70',
    });

    if (!confirm.isConfirmed) return;

    setGuardandoEstado(true);
    try {
      await reclamosApi.cambiarEstado(id, { estado: nuevoEstado });
      const data = await reclamosApi.obtenerPorId(id);
      setReclamo(data);
      Swal.fire({ title: 'Actualizado', text: 'Estado modificado y cliente notificado.', icon: 'success', confirmButtonColor: '#9a4a24' });
    } catch (error) {
      manejarError(error);
    } finally {
      setGuardandoEstado(false);
    }
  };

  // --- CHAT: Archivo adjunto helpers ---
  const CHAT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const CHAT_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const esImagenChat = (nombre: string) => /\.(jpe?g|png|webp)$/i.test(nombre);

  const seleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!CHAT_TIPOS_PERMITIDOS.includes(file.type)) {
      notificar.error('Solo se permiten imágenes (JPG, PNG, WEBP) y PDF');
      return;
    }
    if (file.size > CHAT_MAX_SIZE) {
      notificar.error('El archivo no puede superar 5 MB');
      return;
    }
    setArchivoChat(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewArchivo(url);
    } else {
      setPreviewArchivo(null);
    }
  };

  const quitarArchivo = () => {
    if (previewArchivo) URL.revokeObjectURL(previewArchivo);
    setArchivoChat(null);
    setPreviewArchivo(null);
  };

  // --- ACCION 2: CHAT (ADMIN -> CLIENTE) ---
  const enviarMensaje = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!nuevoMensaje.trim() && !archivoChat) || !id) return;

    setEnviandoChat(true);
    try {
      let archivoUrl: string | undefined;
      let archivoNombre: string | undefined;

      if (archivoChat && reclamo) {
        setSubiendoArchivo(true);
        const empresaId = reclamo.ruc_proveedor || reclamo.tenant_id;
        const ruta = `reclamaciones/${empresaId}/mensajes`;
        archivoUrl = await almacenamientoApi.subirArchivo(archivoChat, empresaId, ruta);
        archivoNombre = archivoChat.name;
        setSubiendoArchivo(false);
      }

      const textoMensaje = nuevoMensaje.trim() || (archivoNombre ? `${archivoNombre}` : '');
      await mensajesApi.enviar(id, textoMensaje, archivoUrl, archivoNombre);
      setNuevoMensaje('');
      quitarArchivo();
      const msgs = await mensajesApi.listarPorReclamo(id);
      setMensajes(msgs);
    } catch (error) {
      setSubiendoArchivo(false);
      manejarError(error);
    } finally {
      setEnviandoChat(false);
    }
  };

  // --- ACCION 3: RESOLUCION FINAL ---
  const emitirResolucion = async () => {
    if (!id || !textoResolucion.trim()) {
      return Swal.fire({ title: 'Atención', text: 'Debe escribir la respuesta final para el cliente.', icon: 'warning', confirmButtonColor: '#9a4a24' });
    }

    const confirm = await Swal.fire({
      title: '¿Emitir Resolución Final?',
      html: '<p style="color:#6a655a;font-size:15px;">Esta acción marcará el caso como <strong>CERRADO</strong>, generará un PDF oficial y lo enviará al correo del cliente.</p>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Emitir y Resolver',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--ui-exito)',
      cancelButtonColor: '#857e70',
    });

    if (!confirm.isConfirmed) return;

    setEnviandoResolucion(true);
    try {
      await reclamosApi.emitirRespuesta(id, {
        respuesta_empresa: textoResolucion,
        accion_tomada: 'Resolución vía Panel Web',
      });
      await Swal.fire({ title: 'Resolución emitida', text: 'El caso ha sido cerrado y el cliente notificado con el PDF adjunto.', icon: 'success', confirmButtonColor: 'var(--ui-exito)' });
      cargarExpediente();
    } catch (error) {
      manejarError(error);
    } finally {
      setEnviandoResolucion(false);
    }
  };

  // --- ACCION 4: ASIGNAR ASESOR ---
  const abrirModalAsignar = async () => {
    try {
      const lista = await usuariosApi.listar();
      setUsuarios((lista || []).filter((u) => u.activo));
    } catch { /* silencioso */ }
    setAsesorSeleccionado(reclamo?.atendido_por || '');
    setModalAsignar(true);
  };

  const asignarAsesor = async () => {
    if (!id || !asesorSeleccionado) return;
    setAsignando(true);
    try {
      await reclamosApi.asignar(id, { admin_id: asesorSeleccionado });
      await cargarExpediente();
      setModalAsignar(false);
      Swal.fire({ title: 'Asignado', text: 'El asesor ha sido asignado al reclamo.', icon: 'success', confirmButtonColor: '#9a4a24', timer: 2000 });
    } catch (error) {
      manejarError(error);
    } finally {
      setAsignando(false);
    }
  };

  // --- RENDERIZADO ---
  if (cargando) return (
    <div className="h-screen flex items-center justify-center" style={T.page}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="animate-spin rounded-full h-10 w-10 border-[3px]"
          style={{ borderColor: 'var(--ui-borde)', borderTopColor: 'var(--ui-primario)' }}
        />
        <span className="text-sm font-medium" style={T.textSec}>Cargando expediente...</span>
      </div>
    </div>
  );

  if (!reclamo) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3" style={T.textSec}>
      <FiFileText size={48} className="opacity-40" />
      <p className="text-lg font-medium">No se encontró el reclamo</p>
      <button onClick={() => navigate('/reclamos')} className="text-sm hover:underline mt-2" style={{ color: 'var(--ui-primario)' }}>
        Volver al listado
      </button>
    </div>
  );

  const estadoInfo = ESTADOS_RECLAMO[reclamo.estado];
  const estaResuelto = reclamo.estado === 'RESUELTO' || reclamo.estado === 'CERRADO';
  const diasRestantes = reclamo.dias_restantes ?? 0;
  const esVencido = diasRestantes < 0;
  const esUrgente = diasRestantes >= 0 && diasRestantes <= 3;

  // GOD MODE: El admin SIEMPRE puede cambiar estado y enviar mensajes.
  const esFinalizado = false;

  return (
    <div className="min-h-screen pb-20 p-4 md:p-8 font-sans" style={T.page}>

      {/* ─── HEADER ─── */}
      <div className="p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border mb-6" style={T.card}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => navigate('/reclamos')}
              className="p-2.5 hover-adaptive rounded-lg transition-colors shrink-0"
              style={T.textSec}
              title="Volver al listado"
            >
              <FiArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate" style={T.text}>
                  {reclamo.codigo_reclamo}
                </h1>
                <span
                  className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0"
                  style={{ backgroundColor: `${estadoInfo.color}15`, color: estadoInfo.color, border: `1px solid ${estadoInfo.color}30` }}
                >
                  {estadoInfo.etiqueta}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs sm:text-sm flex-wrap" style={T.textSec}>
                <FiClock size={13} className="shrink-0" />
                <span>Registrado: {formatoFecha(reclamo.fecha_registro)}</span>
                <span style={{ color: 'var(--ui-borde)' }}>|</span>
                <span
                  className="flex items-center gap-1"
                  style={esVencido ? { color: 'var(--ui-peligro)', fontWeight: 600 } : esUrgente ? { color: 'var(--ui-adv)', fontWeight: 500 } : {}}
                >
                  {esVencido && <FiAlertCircle size={13} className="shrink-0" />}
                  Vence: {formatoFecha(reclamo.fecha_limite_respuesta)}
                  {esVencido && (
                    <span
                      className="text-[10px] ml-1 uppercase px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: 'rgba(184,58,50,0.1)', color: 'var(--ui-peligro)' }}
                    >
                      Vencido
                    </span>
                  )}
                  {esUrgente && !esVencido && (
                    <span
                      className="text-[10px] ml-1 uppercase px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: 'rgba(166,119,24,0.1)', color: 'var(--ui-adv)' }}
                    >
                      Urgente
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* ACCIONES: ASIGNAR + ESTADO */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <button
              onClick={abrirModalAsignar}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-all hover:shadow-sm"
              style={{ borderColor: 'var(--ui-borde)', color: 'var(--ui-texto)', backgroundColor: 'var(--ui-superficie)' }}
            >
              <FiUser size={14} />
              {reclamo.nombre_atendido_por || 'Asignar'}
            </button>

          <div
            className="flex items-center gap-2 p-1.5 rounded-lg border flex-1 md:flex-initial"
            style={{ backgroundColor: 'var(--ui-superficie-hundida)', borderColor: 'var(--ui-borde)' }}
          >
            <select
              className="border-none text-sm font-semibold focus:ring-0 cursor-pointer py-2 pl-3 pr-8 outline-none rounded-md flex-1 md:flex-initial"
              style={{ color: 'var(--ui-texto)', backgroundColor: 'var(--ui-superficie)' }}
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value as EstadoReclamo)}
              disabled={guardandoEstado}
            >
              {Object.keys(ESTADOS_RECLAMO).map((k) => (
                <option key={k} value={k} style={{ backgroundColor: 'var(--ui-superficie)', color: 'var(--ui-texto)' }}>{ESTADOS_RECLAMO[k as EstadoReclamo].etiqueta}</option>
              ))}
            </select>
            <button
              onClick={actualizarEstado}
              disabled={nuevoEstado === reclamo.estado || guardandoEstado}
              className={`text-xs px-4 py-2 rounded-md font-semibold transition-all shrink-0
                ${nuevoEstado === reclamo.estado ? 'opacity-40 cursor-not-allowed' : 'shadow-sm active:scale-[0.97]'}
              `}
              style={{
                backgroundColor: nuevoEstado === reclamo.estado ? 'var(--ui-borde)' : 'var(--ui-primario)',
                color: nuevoEstado === reclamo.estado ? 'var(--ui-texto-desactivado)' : '#fff',
              }}
            >
              {guardandoEstado ? (
                <span className="flex items-center gap-1.5">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                  Guardando...
                </span>
              ) : 'Actualizar'}
            </button>
          </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* ─── COLUMNA IZQUIERDA (Datos) ─── */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">

          {/* Tarjeta Consumidor */}
          <div className="rounded-xl shadow-sm border overflow-hidden" style={T.card}>
            <div className="px-4 sm:px-6 py-4 border-b" style={{ ...T.card, borderColor: 'var(--ui-borde)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={T.text}>
                <FiUser size={15} style={{ color: 'var(--ui-primario)' }} />
                Datos del Consumidor
              </h3>
            </div>
            <div className="p-4 sm:p-6 space-y-4 text-sm">
              <InfoRow label="Nombre" value={reclamo.nombre_completo} />
              <InfoRow label="Documento" value={`${reclamo.tipo_documento}: ${reclamo.numero_documento}`} />
              <InfoRow label="Email" value={reclamo.email} isEmail />
              <InfoRow label="Teléfono" value={reclamo.telefono} />
              <InfoRow label="Dirección" value={reclamo.domicilio} />
              <div className="flex flex-col border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: 'color-mix(in srgb, var(--ui-borde), transparent 50%)' }}>
                <span className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--ui-texto-3)' }}>¿Es cliente registrado?</span>
                <span
                  className="inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: reclamo.es_cliente_registrado ? 'var(--ui-exito-texto)' : 'var(--ui-texto-2)' }}
                >
                  <span style={{ fontSize: '8px' }}>●</span>
                  {reclamo.es_cliente_registrado ? 'Sí' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta Incidente */}
          <div className="rounded-xl shadow-sm border overflow-hidden" style={T.card}>
            <div className="px-4 sm:px-6 py-4 border-b" style={{ ...T.card, borderColor: 'var(--ui-borde)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={T.text}>
                <FiFileText size={15} style={{ color: 'var(--ui-primario)' }} />
                Detalle del Incidente
              </h3>
            </div>
            <div className="p-4 sm:p-6 space-y-5 text-sm">
              {/* Bien Contratado */}
              <div
                className="p-4 rounded-lg border"
                style={{ backgroundColor: 'var(--ui-info-suave)', borderColor: 'var(--ui-info-borde)' }}
              >
                <p className="text-[10px] font-bold uppercase mb-1.5 tracking-wider" style={{ color: 'var(--ui-info-etiqueta)' }}>
                  Bien Contratado
                </p>
                <p className="font-semibold" style={T.text}>{reclamo.tipo_bien || 'No especificado'}</p>
                <p className="mt-1 leading-relaxed" style={T.textSec}>{reclamo.descripcion_bien}</p>
              </div>

              {/* Detalle del Reclamo */}
              <div>
                <p className="text-[10px] font-bold uppercase mb-2 tracking-wider" style={T.muted}>Detalle del Reclamo</p>
                <div
                  className="border p-4 rounded-lg whitespace-pre-wrap leading-relaxed text-[13px]"
                  style={T.insetB}
                >
                  <span style={T.text}>{reclamo.detalle_reclamo}</span>
                </div>
              </div>

              {/* Pedido del Cliente */}
              <div>
                <p className="text-[10px] font-bold uppercase mb-2 tracking-wider" style={T.muted}>Pedido del Cliente</p>
                <div
                  className="border p-4 rounded-lg whitespace-pre-wrap leading-relaxed text-[13px]"
                  style={T.insetB}
                >
                  <span style={T.text}>{reclamo.pedido_consumidor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta Firma Digital */}
          {reclamo.firma_digital && (
            <div className="rounded-xl shadow-sm border overflow-hidden" style={T.card}>
              <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between" style={{ ...T.card, borderColor: 'var(--ui-borde)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={T.text}>
                  <FiFileText size={15} style={{ color: 'var(--ui-primario)' }} />
                  Firma Digital
                </h3>
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = reclamo.firma_digital!;
                    a.download = `firma-${reclamo.codigo_reclamo}.png`;
                    a.click();
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                  style={{ color: 'var(--ui-primario)', borderColor: 'var(--ui-borde)' }}
                >
                  Descargar
                </button>
              </div>
              <div className="p-4 sm:p-6 flex justify-center">
                <img
                  src={reclamo.firma_digital}
                  alt={`Firma digital - ${reclamo.codigo_reclamo}`}
                  className="max-h-32 w-auto rounded border"
                  style={{ borderColor: 'var(--ui-borde)', backgroundColor: 'var(--ui-fondo)' }}
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Tarjeta Archivos Adjuntos */}
          {reclamo.archivos_adjuntos && reclamo.archivos_adjuntos.length > 0 && (
            <TarjetaArchivosAdjuntos
              archivos={reclamo.archivos_adjuntos}
              empresaId={reclamo.ruc_proveedor || reclamo.tenant_id}
            />
          )}
        </div>

        {/* ─── COLUMNA DERECHA (Gestion) ─── */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">

          {/* BANNER DE CASO CERRADO */}
          {estaResuelto && (
            <div
              className="rounded-xl p-4 sm:p-5 shadow-sm border"
              style={{ background: 'var(--ui-exito-suave)', borderColor: 'var(--ui-exito-borde)' }}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: 'var(--ui-exito-suave-2)' }}
                >
                  <FiCheckCircle size={18} style={{ color: 'var(--ui-exito-texto-2)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold mb-1" style={{ color: 'var(--ui-exito-texto)' }}>Caso Cerrado</h3>
                  <p className="text-sm" style={{ color: 'var(--ui-exito-texto-2)' }}>
                    Atendido el{' '}
                    <span className="font-semibold">{reclamo.fecha_respuesta ? formatoFecha(reclamo.fecha_respuesta) : 'N/A'}</span>.
                    {' '}Puede reabrir el caso cambiando el estado desde el selector superior.
                  </p>
                  {reclamo.respuesta_empresa && (
                    <div className="mt-3 backdrop-blur-sm rounded-lg border p-4" style={{ backgroundColor: 'var(--ui-superficie)', borderColor: 'var(--ui-exito-borde)' }}>
                      <p className="text-[10px] uppercase font-bold mb-1.5 tracking-wider" style={T.muted}>Respuesta emitida</p>
                      <p className="whitespace-pre-wrap leading-relaxed text-sm line-clamp-4" style={T.text}>{reclamo.respuesta_empresa}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RESOLUCION */}
          <div
            className="rounded-xl shadow-sm border overflow-hidden border-l-4"
            style={{ ...T.card, borderLeftColor: 'var(--ui-primario)' }}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2" style={T.text}>
                  {estaResuelto
                    ? <FiRefreshCw className="shrink-0" style={{ color: 'var(--ui-adv)' }} />
                    : <FiCheckCircle className="shrink-0" style={{ color: 'var(--ui-primario)' }} />
                  }
                  {estaResuelto ? 'Emitir Nueva Resolución' : 'Resolución y Cierre'}
                </h3>
              </div>
              <p className="text-sm mb-5" style={T.textSec}>
                {estaResuelto
                  ? 'Este caso ya fue cerrado. Puede emitir una nueva resolución si es necesario — se generará un nuevo PDF y se enviará al cliente.'
                  : 'Redacte la respuesta final. Al emitir, se generará un PDF oficial y se enviará al correo del cliente.'
                }
              </p>
              <textarea
                className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-h-[120px] sm:min-h-[140px] text-sm outline-none transition-all resize-y"
                style={{ backgroundColor: 'var(--ui-superficie-hundida)', borderColor: 'var(--ui-borde)', color: 'var(--ui-texto)' }}
                placeholder="Estimado cliente, tras revisar su caso hemos determinado..."
                value={textoResolucion}
                onChange={(e) => setTextoResolucion(e.target.value)}
              />
              <div className="flex items-center justify-between mt-4 gap-3">
                <p className="text-xs" style={T.muted}>
                  {textoResolucion.length > 0 && `${textoResolucion.length} caracteres`}
                </p>
                <button
                  onClick={emitirResolucion}
                  disabled={enviandoResolucion || !textoResolucion.trim()}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm shrink-0
                    ${enviandoResolucion || !textoResolucion.trim()
                      ? 'opacity-40 cursor-not-allowed'
                      : 'active:scale-[0.97]'}
                  `}
                  style={{
                    backgroundColor: enviandoResolucion || !textoResolucion.trim() ? 'var(--ui-borde)' : 'var(--ui-primario)',
                    color: enviandoResolucion || !textoResolucion.trim() ? 'var(--ui-texto-desactivado)' : '#fff',
                  }}
                >
                  {enviandoResolucion ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Procesando...
                    </span>
                  ) : (
                    <>
                      <FiCheckCircle size={16} />
                      <span className="hidden sm:inline">{estaResuelto ? 'Emitir Nueva Resolución' : 'Emitir Resolución Final'}</span>
                      <span className="sm:hidden">Emitir</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CHAT */}
          <div className="rounded-xl shadow-sm border overflow-hidden flex flex-col h-[400px] sm:h-[480px] lg:h-[560px]" style={T.card}>
            {/* Header Chat */}
            <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center shrink-0" style={{ ...T.card, borderColor: 'var(--ui-borde)' }}>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold flex items-center gap-2" style={T.text}>
                  <FiMessageSquare size={15} style={{ color: 'var(--ui-primario)' }} />
                  Mensajería
                </h3>
                <Tooltip
                  title="Los mensajes que envies aqui llegaran como notificacion al correo del cliente. Para evitar saturar su bandeja, se envia maximo 1 correo cada 5 minutos por reclamo."
                  arrow
                  placement="bottom"
                  slotProps={{
                    tooltip: {
                      sx: { maxWidth: 300, fontSize: '0.78rem', lineHeight: 1.5, padding: '10px 14px', backgroundColor: '#302d27' },
                    },
                  }}
                >
                  <span style={{ display: 'inline-flex', cursor: 'help' }}>
                    <FiInfo size={14} style={{ color: '#aca596' }} />
                  </span>
                </Tooltip>
              </div>
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ color: 'var(--ui-texto-3)', backgroundColor: 'var(--ui-superficie-hundida)' }}
              >
                {mensajes.length} {mensajes.length === 1 ? 'mensaje' : 'mensajes'}
              </span>
            </div>

            {/* Area de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3" style={T.inset} ref={chatRef}>
              {mensajes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center" style={T.muted}>
                  <FiMessageSquare size={36} className="mb-3 opacity-40" />
                  <p className="text-sm font-medium">Sin mensajes previos</p>
                  <p className="text-xs mt-1 text-center max-w-[280px]">
                    Los mensajes que envies llegaran al correo del cliente.
                    Se envia maximo 1 notificacion cada 5 min para no saturar su bandeja.
                  </p>
                </div>
              ) : (
                mensajes.map((m) => {
                  const soyAdmin = m.tipo_mensaje === 'EMPRESA';
                  const tieneArchivo = !!m.archivo_url;
                  const esImagen = tieneArchivo && esImagenChat(m.archivo_url || '');
                  return (
                    <div key={m.id} className={`flex w-full ${soyAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 text-sm shadow-sm overflow-hidden ${
                          soyAdmin
                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                            : 'border rounded-2xl rounded-bl-md'
                        }`}
                        style={soyAdmin ? undefined : { backgroundColor: 'var(--ui-superficie)', borderColor: 'var(--ui-borde)', color: 'var(--ui-texto)' }}
                      >
                        {/* Archivo adjunto */}
                        {tieneArchivo && (
                          <ArchivoMensaje
                            archivoUrl={m.archivo_url!}
                            archivoNombre={m.archivo_nombre || 'Archivo'}
                            esImagen={esImagen}
                            empresaId={reclamo?.ruc_proveedor || reclamo?.tenant_id || ''}
                            soyAdmin={soyAdmin}
                          />
                        )}
                        {m.mensaje && m.mensaje !== m.archivo_nombre && m.mensaje !== `${m.archivo_nombre}` && (
                          <p className="whitespace-pre-wrap leading-relaxed break-all">{m.mensaje}</p>
                        )}
                        <div
                          className="text-[10px] mt-2 flex justify-end gap-1.5"
                          style={soyAdmin ? { color: 'rgba(240,220,205,0.8)' } : T.muted}
                        >
                          <span>{soyAdmin ? 'Empresa' : 'Cliente'}</span>
                          <span>&middot;</span>
                          <span>{formatoFechaHora(m.fecha_mensaje)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-4 border-t shrink-0" style={{ backgroundColor: 'var(--ui-superficie)', borderColor: 'var(--ui-borde)' }}>
              {/* Preview de archivo adjunto */}
              {archivoChat && (
                <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg border" style={{ backgroundColor: 'var(--ui-superficie-hundida)', borderColor: 'var(--ui-borde)' }}>
                  {previewArchivo ? (
                    <img src={previewArchivo} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-900/20">
                      <FiFileText size={18} className="text-red-600" />
                    </div>
                  )}
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--ui-texto)' }}>{archivoChat.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--ui-texto-2)' }}>{(archivoChat.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={quitarArchivo} aria-label="Quitar archivo" className="shrink-0 text-gray-600 hover:text-red-500 transition-colors p-0.5"><UiIcono nombre="close" tamano={16} /></button>
                </div>
              )}
              <form onSubmit={enviarMensaje} className="flex flex-col gap-1.5">
                <div className="flex gap-2 sm:gap-3 items-center">
                  <input ref={inputArchivoRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={seleccionarArchivo} />
                  <button
                    type="button"
                    onClick={() => inputArchivoRef.current?.click()}
                    disabled={enviandoChat || subiendoArchivo}
                    className="p-2.5 rounded-lg transition-all shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{ color: archivoChat ? '#9a4a24' : 'var(--ui-texto-2)' }}
                    title="Adjuntar archivo"
                  >
                    <FiPaperclip size={18} />
                  </button>
                  <input
                    type="text"
                    maxLength={1500}
                    className="flex-1 min-w-0 border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all text-sm"
                    style={{ backgroundColor: 'var(--ui-superficie-hundida)', borderColor: 'var(--ui-borde)', color: 'var(--ui-texto)' }}
                    placeholder={subiendoArchivo ? 'Subiendo archivo...' : 'Escriba un mensaje...'}
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    disabled={subiendoArchivo}
                  />
                  <button
                    type="submit"
                    disabled={enviandoChat || subiendoArchivo || (!nuevoMensaje.trim() && !archivoChat)}
                    className={`px-3 sm:px-4 rounded-lg flex items-center justify-center transition-all shrink-0
                      ${enviandoChat || subiendoArchivo || (!nuevoMensaje.trim() && !archivoChat)
                        ? 'cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-95'}
                    `}
                    style={enviandoChat || subiendoArchivo || (!nuevoMensaje.trim() && !archivoChat) ? { backgroundColor: 'var(--ui-hover)', color: 'var(--ui-texto-3)' } : undefined}
                  >
                    {enviandoChat || subiendoArchivo
                      ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                      : <FiSend size={18} />
                    }
                  </button>
                </div>
                {nuevoMensaje.length > 0 && (
                  <span className={`text-[11px] text-right ${nuevoMensaje.length >= 1500 ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                    {nuevoMensaje.length}/1500
                  </span>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL ASIGNAR ASESOR ─── */}
      <ModalBase
        abierto={modalAsignar}
        alCerrar={() => setModalAsignar(false)}
        titulo="Asignar Asesor"
        maxAncho="xs"
        pie={
          <>
            <BotonModal texto="Cancelar" variante="secundario" onClick={() => setModalAsignar(false)} />
            <BotonModal
              texto={asignando ? 'Asignando...' : 'Asignar'}
              onClick={asignarAsesor}
              deshabilitado={!asesorSeleccionado}
              cargando={asignando}
            />
          </>
        }
      >
        <div>
          <p className="text-xs mb-4 text-gray-600 dark:text-gray-400">
            Selecciona quién atenderá este reclamo.
          </p>
          <select
            value={asesorSeleccionado}
            onChange={(e) => setAsesorSeleccionado(e.target.value)}
            className="w-full py-2.5 px-3 rounded-lg border text-sm outline-none border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Seleccionar asesor —</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo} ({u.rol})
              </option>
            ))}
          </select>
        </div>
      </ModalBase>
    </div>
  );
}

// ─── Helper Component ─────────────────────────────────────────────────────

function InfoRow({ label, value, isEmail }: { label: string; value?: string | null; isEmail?: boolean }) {
  return (
    <div className="flex flex-col border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: 'color-mix(in srgb, var(--ui-borde), transparent 50%)' }}>
      <span className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--ui-texto-3)' }}>{label}</span>
      {isEmail && value ? (
        <a href={`mailto:${value}`} className="hover:underline font-medium text-sm truncate" style={{ color: 'var(--ui-primario)' }} title={value}>
          {value}
        </a>
      ) : (
        <span className="font-medium truncate text-sm" style={{ color: 'var(--ui-texto)' }} title={value || ''}>{value || '—'}</span>
      )}
    </div>
  );
}

// ─── Archivos Adjuntos Component ──────────────────────────────────────────

/* Ligaduras de Material Symbols, no emojis: el emoji lo dibuja la fuente
   del sistema operativo, cambia de aspecto en cada plataforma y no hereda
   el color del texto. */
const ICONOS_EXTENSION: Record<string, string> = {
  pdf: 'picture_as_pdf', jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
  doc: 'description', docx: 'description', xls: 'table', xlsx: 'table', ppt: 'slideshow', pptx: 'slideshow',
  zip: 'folder_zip', rar: 'folder_zip', '7z': 'folder_zip', txt: 'article', csv: 'article', xml: 'code',
};

function obtenerNombreArchivo(clave: string): string {
  return clave.split('/').pop() || clave;
}

function obtenerIcono(nombre: string): string {
  const ext = nombre.split('.').pop()?.toLowerCase() || '';
  return ICONOS_EXTENSION[ext] || 'attach_file';
}

function TarjetaArchivosAdjuntos({ archivos, empresaId }: { archivos: string[]; empresaId: string }) {
  const [cargando, setCargando] = React.useState<Record<string, boolean>>({});

  const descargarArchivo = async (clave: string) => {
    setCargando((prev) => ({ ...prev, [clave]: true }));
    try {
      const url = await almacenamientoApi.obtenerUrlFirmada(clave, empresaId);
      window.open(url, '_blank');
    } catch {
      // Si falla la URL firmada, intentar descarga directa
      const urlDirecta = `/storage-api/almacenamiento/descargar?clave=${encodeURIComponent(clave)}&empresa_id=${encodeURIComponent(empresaId)}`;
      window.open(urlDirecta, '_blank');
    } finally {
      setCargando((prev) => ({ ...prev, [clave]: false }));
    }
  };

  return (
    <div className="rounded-xl shadow-sm border overflow-hidden" style={T.card}>
      <div className="px-4 sm:px-6 py-4 border-b" style={{ ...T.card, borderColor: 'var(--ui-borde)' }}>
        <h3 className="font-semibold flex items-center gap-2" style={T.text}>
          <FiPaperclip size={15} style={{ color: 'var(--ui-primario)' }} />
          Archivos Adjuntos
          <span
            className="text-xs font-normal px-2 py-0.5 rounded-full"
            style={{ color: 'var(--ui-texto-3)', backgroundColor: 'var(--ui-superficie-hundida)' }}
          >
            {archivos.length}
          </span>
        </h3>
      </div>
      <div className="p-4 sm:p-6 space-y-2">
        {archivos.map((clave) => {
          const nombre = obtenerNombreArchivo(clave);
          const icono = obtenerIcono(nombre);
          const estaCargando = cargando[clave];

          return (
            <div
              key={clave}
              className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--ui-borde)', backgroundColor: 'var(--ui-superficie-hundida)' }}
            >
              <UiIcono nombre={icono} tamano={20} sx={{ flex: 'none', color: 'var(--ui-texto-3)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={T.text} title={nombre}>
                  {nombre}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => descargarArchivo(clave)}
                  disabled={estaCargando}
                  className="p-2 rounded-lg border text-xs font-medium transition-all hover:shadow-sm disabled:opacity-50"
                  style={{ color: 'var(--ui-primario)', borderColor: 'var(--ui-borde)', backgroundColor: 'var(--ui-superficie)' }}
                  title="Ver / Descargar"
                >
                  {estaCargando ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  ) : (
                    <FiExternalLink size={14} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
