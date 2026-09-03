import { useState, useRef, useEffect, useCallback } from 'react';
import { formatoFechaLarga } from '@/aplicacion/helpers/formato';
import { useParams, useSearchParams } from 'react-router-dom';
import { UiCampoTexto, UiBoton, UiCargando, UiAlerta } from '@/ui';
import { UiIcono, UiIconoEnviar } from '@/ui';
import { publicoApi } from '../api/publico.api';
import { almacenamientoApi } from '../api/almacenamiento.api';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoFechaHora, formatoFecha } from '@/aplicacion/helpers/formato';
import type { ReclamoTracking, Mensaje, Tenant } from '@/tipos';
import { ESTADOS_RECLAMO } from '@/tipos/reclamo';
import { ToggleTema } from '@/aplicacion/componentes/ToggleTema';
import {
  usarWebSocketSeguimientoPublico,
  usarEventoWebSocket,
} from '@/infraestructura/websocket';
import type { DatosSeguimientoPublico } from '@/infraestructura/websocket';

// Extrae el empresaId de la clave del archivo (reclamaciones/{empresaId}/...)
function extraerEmpresaId(clave: string, fallback: string): string {
  const partes = clave.split('/');
  if (partes.length >= 2 && partes[0] === 'reclamaciones') return partes[1];
  return fallback;
}

// ── Componente de archivo en burbuja ──
function ArchivoMensajePublico({ archivoUrl, archivoNombre, esImagen, empresaId, esCliente, colorMarca }: {
  archivoUrl: string; archivoNombre: string; esImagen: boolean; empresaId: string; esCliente: boolean; colorMarca: string;
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
          className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-lg transition-colors text-xs cursor-pointer"
          style={{
            backgroundColor: esCliente ? `${colorMarca}33` : 'rgba(0,0,0,0.05)',
            color: esCliente ? 'white' : 'inherit',
          }}
        >
          <UiIcono nombre="description" tamano={17} />
          <span className="truncate flex-1">{archivoNombre}</span>
          <span className="shrink-0 opacity-60 text-sm">↗</span>
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
                className="bg-white/90 hover:bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors border-none cursor-pointer dark:text-gray-300"
                title="Abrir en nueva pestaña"
              >
                ↗
              </button>
              <button
                onClick={() => setPreviewing(false)}
                className="bg-white/90 hover:bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors border-none cursor-pointer dark:text-gray-300"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PaginaSeguimiento() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [codigoBusqueda, setCodigoBusqueda] = useState(searchParams.get('codigo') || '');
  const [reclamo, setReclamo] = useState<ReclamoTracking | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');

  const [cargandoReclamo, setCargandoReclamo] = useState(false);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);

  // Archivo adjunto en chat
  const [archivoChat, setArchivoChat] = useState<File | null>(null);
  const [previewArchivo, setPreviewArchivo] = useState<string | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const CHAT_MAX_SIZE = 5 * 1024 * 1024;
  const CHAT_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const esImagenChat = (nombre: string) => /\.(jpe?g|png|webp)$/i.test(nombre);

  const seleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!CHAT_TIPOS_PERMITIDOS.includes(file.type)) {
      manejarError(new Error('Solo se permiten imágenes (JPG, PNG, WEBP) y PDF'));
      return;
    }
    if (file.size > CHAT_MAX_SIZE) {
      manejarError(new Error('El archivo no puede superar 5 MB'));
      return;
    }
    setArchivoChat(file);
    setPreviewArchivo(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const quitarArchivo = () => {
    if (previewArchivo) URL.revokeObjectURL(previewArchivo);
    setArchivoChat(null);
    setPreviewArchivo(null);
  };

  const chatRef = useRef<HTMLDivElement>(null);

  const concentradorWS = usarWebSocketSeguimientoPublico(
    tenantSlug ?? '',
    reclamo?.codigo_reclamo ?? '',
  );

  usarEventoWebSocket<DatosSeguimientoPublico>(concentradorWS, 'SEGUIMIENTO_ESTADO_ACTUALIZADO', (datos) => {
    if (datos.estado_nuevo && reclamo) {
      setReclamo({ ...reclamo, estado: datos.estado_nuevo as ReclamoTracking['estado'] });
    }
  });

  usarEventoWebSocket<DatosSeguimientoPublico>(concentradorWS, 'SEGUIMIENTO_MENSAJE_NUEVO', () => {
    if (reclamo?.codigo_reclamo && tenantSlug) {
      cargarMensajes(reclamo.codigo_reclamo);
    }
  });

  usarEventoWebSocket<DatosSeguimientoPublico>(concentradorWS, 'RECLAMO_RESUELTO_CON_RESPUESTA', () => {
    if (reclamo?.codigo_reclamo && tenantSlug) {
      buscarReclamo(reclamo.codigo_reclamo);
    }
  });

  useEffect(() => {
    if (tenantSlug) {
      publicoApi
        .obtenerTenant(tenantSlug)
        .then((data) => setTenant(data))
        .catch((err) => console.error('Error cargando tenant:', err));
    }
  }, [tenantSlug]);

  const buscarReclamo = useCallback(async (codigo?: string) => {
    const codigoFinal = (codigo || codigoBusqueda).trim();
    if (!codigoFinal || !tenantSlug) return;
    setCargandoReclamo(true);
    setReclamo(null);
    setMensajes([]);
    try {
      const data = await publicoApi.consultarSeguimiento(tenantSlug, codigoFinal);
      if (!data) throw new Error('No se encontró el reclamo');
      setReclamo(data);
      cargarMensajes(data.codigo_reclamo);
      // Guardar código en la URL para persistir al recargar
      setSearchParams({ codigo: codigoFinal }, { replace: true });
    } catch (error) {
      manejarError(error, 'No se encontró el reclamo con ese código.');
      // Limpiar la URL si el código no es válido
      setSearchParams({}, { replace: true });
    } finally {
      setCargandoReclamo(false);
    }
  }, [codigoBusqueda, tenantSlug, setSearchParams]);

  // Auto-buscar si hay código en la URL (al recargar página)
  useEffect(() => {
    const codigoUrl = searchParams.get('codigo');
    if (codigoUrl && tenantSlug && !reclamo) {
      setCodigoBusqueda(codigoUrl);
      buscarReclamo(codigoUrl);
    }
  }, [tenantSlug]); // Solo al montar y cuando tenantSlug esté listo

  const cargarMensajes = useCallback(async (codigo: string) => {
    if (!tenantSlug) return;
    setCargandoMensajes(true);
    try {
      const data = await publicoApi.listarMensajes(tenantSlug, codigo);
      setMensajes(Array.isArray(data) ? data : []);
      scrollToBottom();
    } catch (error) {
      console.error(error);
      setMensajes([]);
    } finally {
      setCargandoMensajes(false);
    }
  }, [tenantSlug]);

  const enviarMensaje = async () => {
    const codigo = reclamo?.codigo_reclamo;
    if ((!nuevoMensaje.trim() && !archivoChat) || !codigo || !tenantSlug) return;
    setEnviandoMensaje(true);
    try {
      let archivoUrl: string | undefined;
      let archivoNombre: string | undefined;

      if (archivoChat && tenant) {
        setSubiendoArchivo(true);
        const empresaId = tenant.ruc || tenant.id;
        const ruta = `reclamaciones/${empresaId}/mensajes`;
        archivoUrl = await almacenamientoApi.subirArchivo(archivoChat, empresaId, ruta);
        archivoNombre = archivoChat.name;
        setSubiendoArchivo(false);
      }

      await publicoApi.enviarMensaje(tenantSlug, codigo, {
        tipo_mensaje: 'CLIENTE',
        mensaje: nuevoMensaje.trim() || (archivoNombre ? `${archivoNombre}` : ''),
        ...(archivoUrl && { archivo_url: archivoUrl }),
        ...(archivoNombre && { archivo_nombre: archivoNombre }),
      });
      setNuevoMensaje('');
      quitarArchivo();
      await cargarMensajes(codigo);
    } catch (error: any) {
      setSubiendoArchivo(false);
      if (error?.response?.status === 403 && codigo) {
        try {
          const actualizado = await publicoApi.consultarSeguimiento(tenantSlug, codigo);
          if (actualizado) setReclamo(actualizado);
        } catch { /* silenciar */ }
      }
      manejarError(error);
    } finally {
      setEnviandoMensaje(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, 100);
  };

  useEffect(() => {
    if ((mensajes || []).length > 0) scrollToBottom();
  }, [mensajes]);

  const estadoInfo = reclamo ? ESTADOS_RECLAMO[reclamo.estado] : null;
  const colorMarca = tenant?.color_primario || '#9a4a24';
  const reclamoCerrado = reclamo?.estado === 'CERRADO' || reclamo?.estado === 'RESUELTO';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--ui-fondo)] text-[var(--ui-texto)] pb-12">
      {/* HEADER */}
      <div className="bg-[var(--ui-superficie)] border-b border-[var(--ui-borde)] sticky top-0 z-10">
        <div className="max-w-[1100px] w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.razon_social} className="h-8 sm:h-9 max-w-[100px] object-contain shrink-0" />
            ) : (
              <div
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-[3px] flex items-center justify-center text-white font-semibold text-base sm:text-lg shrink-0"
                style={{ background: colorMarca }}
              >
                {tenant?.razon_social?.charAt(0) || 'C'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[14px] sm:text-[17px] font-bold text-gray-900 dark:text-gray-100 m-0 leading-tight truncate">
                {tenant?.razon_social || 'Cargando...'}
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium m-0 truncate">Centro de Atención al Cliente</p>
            </div>
          </div>
          <ToggleTema className="shrink-0" />
        </div>
      </div>

      {/* MAIN */}
      <main className="max-w-[1100px] w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 overflow-hidden">
        {/* BÚSQUEDA */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 sm:p-8 mb-6 sm:mb-8 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 m-0 mb-1">Consultar Estado de Trámite</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 m-0 mb-1">
            Ingresa el código que recibiste al registrar tu reclamo o queja.
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 m-0 mb-4 sm:mb-6">El código fue enviado a tu correo y se mostró al finalizar el registro. Tiene el formato: <span className="font-mono font-semibold text-gray-600 dark:text-gray-400">AÑO-EMPRESA-CÓDIGO</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 min-w-0">
              <UiCampoTexto
                etiqueta="Código de Seguimiento"
                valor={codigoBusqueda}
                alCambiar={(e) => setCodigoBusqueda(e.target.value.toUpperCase())}
                marcador="Ej: 2026-DEMO-A3F5B2"
                sx={{ width: '100%', minWidth: 0 }}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && buscarReclamo()}
              />
            </div>
            <UiBoton
              texto="Rastrear Solicitud"
              variante="primario"
              alHacerClick={() => buscarReclamo()}
              estado={cargandoReclamo ? 'cargando' : 'inactivo'}
              sx={{ height: 56, borderRadius: 'var(--ui-r-xl)', width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 180 }, mt: { sm: '4px' } }}
            />
          </div>
        </div>

        {/* Explicacion previa a la busqueda.

            Aqui habia una ilustracion de 220x200 con cuatro animaciones en
            bucle: el documento subia y bajaba, la lupa flotaba con retardo,
            una linea recorria la hoja como un escaner y la sombra latia.
            Debajo, tres columnas centradas con un icono cada una.

            Se retiro entero. Quien llega a esta pagina viene con un codigo
            en la mano y lo unico que quiere es escribirlo; el movimiento
            perpetuo competia con el unico campo de la pantalla. Ademas ese
            conjunto —ilustracion flotante y tres ventajas en columnas— es
            de los patrones que mas delatan una plantilla.

            Queda lo que si aporta: que se puede hacer una vez dentro. Va
            como lista numerada, alineada a la izquierda y con medida de
            lectura.                                                     */}
        {!reclamo && (
          <div className="mx-auto w-full max-w-[640px] px-5 pt-8 pb-4">
            <h2
              className="m-0 mb-2 text-[1.375rem] font-semibold leading-tight"
              style={{ fontFamily: 'var(--ui-fuente-titulo)', color: 'var(--ui-texto)' }}
            >
              Rastrea tu solicitud
            </h2>
            <p className="m-0 mb-6 text-sm leading-relaxed" style={{ maxWidth: '54ch', color: 'var(--ui-texto-2)' }}>
              Escribe arriba el código que recibiste al registrar tu reclamo. Con él puedes:
            </p>

            <ol className="lr-pasos-seguimiento">
              <li>
                <span className="lr-paso-titulo">Consultar el estado</span>
                <span className="lr-paso-nota">En qué punto está tu caso, actualizado en tiempo real.</span>
              </li>
              <li>
                <span className="lr-paso-titulo">Comunicarte con la empresa</span>
                <span className="lr-paso-nota">Escribir y recibir mensajes sobre tu reclamo.</span>
              </li>
              <li>
                <span className="lr-paso-titulo">Descargar la resolución</span>
                <span className="lr-paso-nota">El documento oficial, en PDF, cuando el caso se cierre.</span>
              </li>
            </ol>
          </div>
        )}

        {/* RESULTADO */}
        {reclamo && estadoInfo && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-5 lg:gap-7 items-start">
            {/* COLUMNA IZQUIERDA: DETALLES */}
            <div className="flex flex-col gap-5 min-w-0">
              {/* Card principal */}
              <div className="bg-[var(--ui-superficie)] rounded-[6px] border border-[var(--ui-borde)] overflow-hidden">
                {/* Header del card */}
                <div className="bg-[var(--ui-superficie-2)] px-4 sm:px-6 py-4 sm:py-5 border-b border-[var(--ui-borde)] flex justify-between items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Detalles del Caso
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shrink-0 whitespace-nowrap"
                    style={{ backgroundColor: estadoInfo.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-white/60"
                    />
                    {estadoInfo.etiqueta}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6">
                  <div className="mb-5">
                    <label className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold uppercase block mb-1">
                      Nº Expediente
                    </label>
                    <p className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 m-0 break-all leading-tight">
                      {reclamo.codigo_reclamo}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-col gap-3.5">
                    <DetailRow label="Fecha Registro" value={formatoFecha(reclamo.fecha_registro)} />
                    <DetailRow label="Tipo" value={reclamo.tipo_solicitud === 'RECLAMO' ? 'Reclamo' : reclamo.tipo_solicitud === 'QUEJA' ? 'Queja' : reclamo.tipo_solicitud} />
                    {reclamo.sede_nombre && <DetailRow label="Sede" value={reclamo.sede_nombre} />}
                    {reclamo.descripcion_bien && <DetailRow label="Bien/Servicio" value={reclamo.descripcion_bien} />}
                  </div>

                  {/* Indicador de plazo */}
                  {reclamo.fecha_limite_respuesta && !reclamoCerrado && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <DeadlineIndicator fechaLimite={reclamo.fecha_limite_respuesta} colorMarca={colorMarca} />
                    </div>
                  )}

                  {reclamo.respuesta_empresa && (
                    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <UiAlerta variante="exito" titulo="Resolución Final" descripcion={reclamo.respuesta_empresa} />
                    </div>
                  )}
                </div>
              </div>

              {/* Línea de tiempo de estados */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-5">
                <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide m-0 mb-4">
                  Progreso del trámite
                </p>
                <div className="flex flex-col">
                  {(['PENDIENTE', 'EN_PROCESO', 'CERRADO'] as const).map((estado, i) => {
                    const info = ESTADOS_RECLAMO[estado];
                    const esRechazado = reclamo.estado === 'RECHAZADO';
                    const estadoActual = reclamo.estado === 'RESUELTO' ? 'CERRADO' : reclamo.estado;
                    const alcanzado = !esRechazado && ['PENDIENTE', 'EN_PROCESO', 'CERRADO'].indexOf(estadoActual) >= i;
                    // Para rechazado: solo primer paso alcanzado
                    const alcanzadoRechazado = esRechazado && i === 0;
                    const activo = alcanzado || alcanzadoRechazado;
                    return (
                      <div key={estado} className="flex items-start gap-3.5">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 transition-all duration-300 ${
                              activo
                                ? 'text-white'
                                : 'text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700'
                            }`}
                            style={activo ? { background: esRechazado ? '#b83a32' : colorMarca } : undefined}
                          >
                            {activo ? '✓' : i + 1}
                          </div>
                          {i < 2 && (
                            <div
                              className={`w-0.5 h-7 transition-all duration-300 ${
                                !activo ? 'bg-gray-200 dark:bg-gray-700' : ''
                              }`}
                              style={activo ? { background: esRechazado ? '#b83a32' : colorMarca } : undefined}
                            />
                          )}
                        </div>
                        <div className={`pt-0.5 ${i < 2 ? 'pb-3' : ''}`}>
                          <p className={`text-[13px] m-0 ${
                            activo
                              ? 'font-bold text-gray-900 dark:text-gray-100'
                              : 'font-medium text-gray-600 dark:text-gray-400'
                          }`}>
                            {info?.etiqueta || estado.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {reclamo.estado === 'RECHAZADO' && (
                    <div className="mt-2 pt-2 border-t border-red-100 dark:border-red-900/30">
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium m-0">Este reclamo fue rechazado por la empresa.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: CHAT */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[500px] lg:h-[650px] overflow-hidden min-w-0">
              {/* Header del chat */}
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <h3 className="font-bold text-gray-700 dark:text-gray-300 m-0 text-[15px] flex items-center gap-2.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(92,138,79,0.5)]" />
                  Comunicación Directa
                </h3>
                <span className="text-[11px] text-gray-600 dark:text-gray-400">
                  {concentradorWS?.conectado ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      En vivo
                    </span>
                  ) : 'Historial actualizado'}
                </span>
              </div>

              {/* Mensajes */}
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--ui-fondo)] flex flex-col gap-4"
              >
                {cargandoMensajes && (mensajes || []).length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <UiCargando tipo="puntos" />
                  </div>
                ) : (mensajes || []).length === 0 ? (
                  <div className="flex flex-col h-full items-center justify-center text-gray-600 dark:text-gray-400">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full w-14 h-14 flex items-center justify-center mb-3 text-2xl"></div>
                    <p className="font-semibold m-0 mb-1 text-gray-600 dark:text-gray-400">No hay mensajes aún</p>
                    <p className="text-[13px] m-0">Envía un mensaje para iniciar la conversación.</p>
                  </div>
                ) : (
                  (mensajes || []).map((m) => {
                    const esCliente = m.tipo_mensaje === 'CLIENTE';
                    const tieneArchivo = !!m.archivo_url;
                    const esImagen = tieneArchivo && esImagenChat(m.archivo_url || '');
                    return (
                      <div key={m.id} className={`flex w-full ${esCliente ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex flex-col max-w-[75%] min-w-0 ${esCliente ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`px-4 py-3 text-sm leading-relaxed shadow-sm overflow-hidden ${
                              esCliente
                                ? 'rounded-[18px_4px_18px_18px] text-white'
                                : 'rounded-[4px_18px_18px_18px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                            }`}
                            style={esCliente ? { background: colorMarca } : undefined}
                          >
                            {tieneArchivo && (
                              <ArchivoMensajePublico
                                archivoUrl={m.archivo_url!}
                                archivoNombre={m.archivo_nombre || 'Archivo'}
                                esImagen={esImagen}
                                empresaId={tenant?.ruc || tenant?.id || ''}
                                esCliente={esCliente}
                                colorMarca={colorMarca}
                              />
                            )}
                            {m.mensaje && m.mensaje !== m.archivo_nombre && m.mensaje !== `${m.archivo_nombre}` && (
                              <p className="m-0 whitespace-pre-wrap break-all">{m.mensaje}</p>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 px-1 font-medium">
                            {esCliente ? 'Tú' : tenant?.razon_social || 'Soporte'} • {formatoFechaHora(m.fecha_mensaje)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input de mensaje */}
              <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                {reclamoCerrado ? (
                  <div className="text-center py-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 m-0 font-medium">
                      Este reclamo ya fue atendido. No es posible enviar más mensajes.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Preview archivo adjunto */}
                    {archivoChat && (
                      <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        {previewArchivo ? (
                          <img src={previewArchivo} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-[3px] flex items-center justify-center shrink-0" style={{ background: "var(--ui-superficie-2)", color: "var(--ui-texto-3)" }}><UiIcono nombre="draft" tamano={20} /></div>
                        )}
                        <span className="text-xs truncate flex-1 text-gray-700 dark:text-gray-300">{archivoChat.name}</span>
                        <span className="text-[10px] shrink-0 text-gray-600 dark:text-gray-400">{(archivoChat.size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={quitarArchivo} aria-label="Quitar archivo" className="shrink-0 text-gray-600 hover:text-red-500 transition-colors p-0.5 bg-transparent border-none cursor-pointer"><UiIcono nombre="close" tamano={15} /></button>
                      </div>
                    )}
                    <input ref={inputArchivoRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={seleccionarArchivo} />
                    <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-[10px] border border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => inputArchivoRef.current?.click()}
                        disabled={enviandoMensaje || subiendoArchivo}
                        className="p-1.5 rounded-lg transition-all shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700 bg-transparent border-none cursor-pointer self-center"
                        style={{ color: archivoChat ? colorMarca : 'var(--ui-texto-2, #aca596)' }}
                        title="Adjuntar archivo"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      </button>
                      <div className="flex-1">
                        <UiCampoTexto
                          etiqueta=""
                          valor={nuevoMensaje}
                          alCambiar={(e) => {
                            if (e.target.value.length <= 1500) setNuevoMensaje(e.target.value);
                          }}
                          marcador={subiendoArchivo ? 'Subiendo archivo...' : 'Escribe tu mensaje aquí...'}
                          inputProps={{ maxLength: 1500 }}
                          deshabilitado={subiendoArchivo}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': { border: 'none', boxShadow: 'none', background: 'transparent', padding: 0 },
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                            '& .MuiInputBase-input': { padding: '10px' },
                          }}
                          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && enviarMensaje()}
                        />
                      </div>
                      <div className="pb-1 pr-0.5">
                        <UiBoton
                          variante="primario"
                          soloIcono
                          iconoIzquierda={<UiIconoEnviar />}
                          alHacerClick={enviarMensaje}
                          estado={(enviandoMensaje || subiendoArchivo || (!nuevoMensaje.trim() && !archivoChat)) ? 'cargando' : 'inactivo'}
                          sx={{ height: 40, width: 40, borderRadius: 'var(--ui-r-lg)', boxShadow: `0 4px 12px ${colorMarca}44` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 px-1">
                      <p className="text-center text-[10px] text-gray-600 dark:text-gray-400 m-0 flex-1">
                        Los mensajes son monitoreados por {tenant?.razon_social || 'la empresa'} para calidad de servicio.
                      </p>
                      {nuevoMensaje.length > 0 && (
                        <span className={`text-[11px] ml-2 shrink-0 ${nuevoMensaje.length >= 1500 ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                          {nuevoMensaje.length}/1500
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* Componente helper para filas de detalle */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-[13px] text-gray-600 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 text-right break-words max-w-[60%]">{value}</span>
    </div>
  );
}

/* Indicador de plazo de respuesta */
function DeadlineIndicator({ fechaLimite, colorMarca }: { fechaLimite: string; colorMarca: string }) {
  const ahora = new Date();
  const limite = new Date(fechaLimite);
  const diffMs = limite.getTime() - ahora.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Calcular progreso (15 días hábiles = plazo legal INDECOPI)
  const plazoTotal = 15;
  const diasTranscurridos = plazoTotal - diasRestantes;
  const progreso = Math.min(Math.max((diasTranscurridos / plazoTotal) * 100, 0), 100);

  const vencido = diasRestantes <= 0;
  const urgente = diasRestantes > 0 && diasRestantes <= 5;

  const colorBarra = vencido ? '#b83a32' : urgente ? '#a67718' : colorMarca;
  const textoEstado = vencido
    ? 'Plazo vencido'
    : diasRestantes === 1
      ? '1 día restante'
      : `${diasRestantes} días restantes`;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Plazo de respuesta
        </span>
        <span
          className={`text-xs font-bold ${
            vencido
              ? 'text-red-600 dark:text-red-400'
              : urgente
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {textoEstado}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progreso}%`, backgroundColor: colorBarra }}
        />
      </div>
      <p className="text-[11px] text-gray-600 dark:text-gray-400 m-0 mt-1.5">
        Fecha límite: {formatoFechaLarga(fechaLimite)}
      </p>
    </div>
  );
}
