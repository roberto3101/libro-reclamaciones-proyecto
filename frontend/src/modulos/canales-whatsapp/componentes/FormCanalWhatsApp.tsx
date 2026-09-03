import { useState, useEffect } from 'react';
import { UiIcono } from '@/ui';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiCampoTexto, UiAlerta } from '@/ui';
import { UiPila } from '@/ui';
import { Box, Typography, Switch, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { canalesWhatsAppApi } from '../api/canales-whatsapp.api';
import { chatbotsApi } from '../../chatbots/api/chatbots.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { GuiaActivacionWhatsApp } from './GuiaActivacionWhatsApp';
import { http } from '@/api/http';
import type { CanalWhatsApp } from '@/tipos/canal-whatsapp';
import type { Chatbot } from '@/tipos/chatbot';

interface Props {
  abierto: boolean;
  canalEditar?: CanalWhatsApp | null;
  alCerrar: () => void;
  alGuardar: () => void;
}

export function FormCanalWhatsApp({ abierto, canalEditar, alCerrar, alGuardar }: Props) {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [nombreCanal, setNombreCanal] = useState('');
  const [chatbotId, setChatbotId] = useState<string>('');
  const [activo, setActivo] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [mostrarGuia, setMostrarGuia] = useState(false);

  // Mobile tab: 'form' | 'guia'
  const [tabMobile, setTabMobile] = useState<'form' | 'guia'>('form');

  // Panel derecho activo: guía
  const panelDerecho = mostrarGuia ? 'guia' : null;

  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [cargandoChatbots, setCargandoChatbots] = useState(false);

  // Confirmación de contraseña
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorPassword, setErrorPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);

  const esEdicion = !!canalEditar;

  useEffect(() => {
    if (!abierto) return;
    setCargandoChatbots(true);
    chatbotsApi.listar()
      .then((data) => setChatbots((data || []).filter((c) => c.activo)))
      .catch(() => setChatbots([]))
      .finally(() => setCargandoChatbots(false));
  }, [abierto]);

  useEffect(() => {
    if (canalEditar) {
      setPhoneNumberId(canalEditar.phone_number_id);
      setDisplayPhone(canalEditar.display_phone || '');
      setAccessToken('');
      setVerifyToken('');
      setNombreCanal(canalEditar.nombre_canal);
      setChatbotId(canalEditar.chatbot_id || '');
      setActivo(canalEditar.activo);
    } else {
      setPhoneNumberId('');
      setDisplayPhone('');
      setAccessToken('');
      setVerifyToken('');
      setNombreCanal('');
      setChatbotId('');
      setActivo(true);
    }
    setMostrarGuia(false);
    setTabMobile('form');
  }, [canalEditar, abierto]);

  // Paso 1: Validar campos y mostrar modal de confirmación
  const solicitarConfirmacion = () => {
    if (!phoneNumberId.trim()) return notificar.advertencia('El Phone Number ID es obligatorio');
    if (!esEdicion && !accessToken.trim()) return notificar.advertencia('El Access Token es obligatorio');
    setPasswordConfirm('');
    setErrorPassword('');
    setMostrarConfirmacion(true);
  };

  // Paso 2: Verificar contraseña y guardar
  const confirmarYGuardar = async () => {
    if (!passwordConfirm.trim()) {
      setErrorPassword('Ingrese su contraseña');
      return;
    }

    setVerificando(true);
    setErrorPassword('');

    try {
      await http.post('/auth/verify-password', { password: passwordConfirm });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Contraseña incorrecta';
      setErrorPassword(msg);
      setVerificando(false);
      return;
    }

    // Contraseña válida → guardar canal
    setCargando(true);
    setMostrarConfirmacion(false);
    setVerificando(false);

    try {
      const chatbotIdValue = chatbotId || null;

      if (esEdicion && canalEditar) {
        await canalesWhatsAppApi.actualizar(canalEditar.id, {
          phone_number_id: phoneNumberId.trim(),
          display_phone: displayPhone.trim(),
          access_token: accessToken.trim(),
          verify_token: verifyToken.trim(),
          nombre_canal: nombreCanal.trim() || 'WhatsApp Principal',
          chatbot_id: chatbotIdValue,
          activo,
        });
        notificar.exito('Canal WhatsApp actualizado');
      } else {
        await canalesWhatsAppApi.crear({
          phone_number_id: phoneNumberId.trim(),
          display_phone: displayPhone.trim(),
          access_token: accessToken.trim(),
          verify_token: verifyToken.trim(),
          nombre_canal: nombreCanal.trim() || 'WhatsApp Principal',
          chatbot_id: chatbotIdValue,
        });
        notificar.exito('Canal WhatsApp creado exitosamente');
      }
      alGuardar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  if (!abierto) return null;

  /* ── Formulario (contenido del panel izquierdo) ── */
  const formulario = (
    <UiPila direccion="columna" espaciado={2}>
      <UiAlerta
        variante="info"
        titulo="¿Dónde encuentro estos datos?"
        descripcion="Ingresa a Meta for Developers → Tu App → WhatsApp → API Setup. Ahí encontrarás el Phone Number ID y el Access Token, tambien puedes generar el access token desde el meta business manager."
      />

      <UiCampoTexto
        etiqueta="Phone Number ID *"
        valor={phoneNumberId}
        alCambiar={(e) => setPhoneNumberId(e.target.value)}
        marcador="Ej: 1016419754888111"
        textoAyuda="ID del número en Meta (no es el teléfono, es el identificador)"
        anchoCompleto
      />

      <UiCampoTexto
        etiqueta="Número visible"
        valor={displayPhone}
        alCambiar={(e) => setDisplayPhone(e.target.value)}
        marcador="Ej: +51 999 888 777"
        textoAyuda="Teléfono para mostrar en el panel (solo referencia)"
        anchoCompleto
      />

      <UiCampoTexto
        etiqueta={esEdicion ? "Access Token (dejar vacío para mantener el actual)" : "Access Token *"}
        valor={accessToken}
        alCambiar={(e) => setAccessToken(e.target.value)}
        marcador={esEdicion ? 'Dejar vacío para mantener el token actual' : 'Pega aquí el token de Meta'}
        textoAyuda={esEdicion ? "Solo llena este campo si quieres cambiar el token. Si lo dejas vacío, se mantiene el actual." : "Token temporal (24h) o permanente de Meta Business"}
        anchoCompleto
      />

      <UiCampoTexto
        etiqueta="Verify Token"
        valor={verifyToken}
        alCambiar={(e) => setVerifyToken(e.target.value)}
        marcador="Ej: libro_reclamos_2026"
        textoAyuda="Token de verificación del webhook (opcional si usas el global)"
        anchoCompleto
      />

      <UiCampoTexto
        etiqueta="Nombre del canal"
        valor={nombreCanal}
        alCambiar={(e) => setNombreCanal(e.target.value)}
        marcador="Ej: WhatsApp Principal"
        textoAyuda="Nombre descriptivo para identificar este número"
        anchoCompleto
      />

      {/* ── Selector de Chatbot vinculado ── */}
      <Box sx={{
        p: 2, bgcolor: 'var(--ui-info-suave-2)', borderRadius: 2, border: '1px solid var(--ui-info-borde)',
      }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: 'var(--ui-info-texto)' }}>
          Chatbot vinculado (IA)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '11px' }}>
          Selecciona el chatbot que definirá el prompt, modelo de IA y comportamiento de este canal.
          Si no seleccionas ninguno, se usará la configuración por defecto.
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel id="chatbot-select-label">Chatbot</InputLabel>
          <Select
            labelId="chatbot-select-label"
            value={chatbotId}
            label="Chatbot"
            onChange={(e) => setChatbotId(e.target.value)}
            disabled={cargandoChatbots}
            sx={{ bgcolor: 'var(--ui-superficie)' }}
          >
            <MenuItem value="">
              <em>Sin chatbot (usar config por defecto)</em>
            </MenuItem>
            {chatbots.map((cb) => (
              <MenuItem key={cb.id} value={cb.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{
                    px: 0.6, py: 0.1, borderRadius: 0.5, fontSize: '9px', fontWeight: 700,
                    bgcolor: cb.tipo === 'WHATSAPP_BOT' ? 'var(--ui-exito-suave-2)' : 'var(--ui-info-suave-2)',
                    color: cb.tipo === 'WHATSAPP_BOT' ? 'var(--ui-exito-texto)' : 'var(--ui-info-texto)',
                  }}>
                    {cb.tipo.replace('_', ' ')}
                  </Box>
                  <span>{cb.nombre}</span>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {chatbots.length === 0 && !cargandoChatbots && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'var(--ui-adv-texto)', fontSize: '11px' }}>
            No tienes chatbots activos. Crea uno en Gestión de Chatbots para vincular.
          </Typography>
        )}
      </Box>

      {esEdicion && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, py: 1.2,
            bgcolor: activo ? 'var(--ui-exito-suave)' : 'var(--ui-peligro-suave)',
            borderRadius: 2,
            border: `1px solid ${activo ? 'var(--ui-exito-borde)' : 'var(--ui-peligro-borde)'}`,
          }}
        >
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ color: activo ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)' }}>
              {activo ? 'Canal activo' : 'Canal desactivado'}
            </Typography>
            <Typography variant="caption" sx={{ color: activo ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)', fontSize: '11px' }}>
              {activo
                ? 'Este número está recibiendo mensajes de WhatsApp.'
                : 'Los mensajes a este número serán ignorados.'}
            </Typography>
          </Box>
          <Switch
            checked={activo}
            onChange={() => setActivo(!activo)}
            size="small"
            color={activo ? 'success' : 'error'}
          />
        </Box>
      )}
    </UiPila>
  );

  return (
    /* ── Overlay (estilos unificados con ModalBase) ── */
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 mb-overlay"
      style={{ zIndex: 1400 }}
      onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}
    >
      {/* ── Container ── */}
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] border-0 sm:border border-gray-200 dark:border-gray-700 sm:mx-auto mb-panel overflow-hidden"
        style={{ width: mostrarGuia ? 'min(1100px, 95vw)' : 'min(520px, 95vw)', transition: 'width 0.3s ease' }}
      >
        {/* ── Handle movil ── */}
        <div className="flex justify-center pt-2 pb-0 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* ── Header ── */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
            {esEdicion ? 'Editar Canal WhatsApp' : 'Nuevo Canal WhatsApp'}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const nuevo = !mostrarGuia;
                setMostrarGuia(nuevo);
                setTabMobile(nuevo ? 'guia' : 'form');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                mostrarGuia
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <UiIcono nombre="menu_book" tamano={17} />
              {mostrarGuia ? 'Ocultar guía' : 'Guía de activación'}
            </button>
            <button
              type="button"
              onClick={alCerrar}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 -mr-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Mobile tabs (solo visible < 768px cuando panel derecho está abierto) ── */}
        {panelDerecho && (
          <div className="wa-modal-tabs" style={{
            display: 'none', borderBottom: '1px solid var(--ui-borde)',
            flexShrink: 0,
          }}>
            {(['form', 'guia'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabMobile(tab)}
                style={{
                  flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 600,
                  background: tabMobile === tab ? 'var(--ui-info-suave)' : 'transparent',
                  color: tabMobile === tab ? 'var(--ui-primario)' : 'var(--ui-texto-2)',
                  borderBottom: tabMobile === tab ? '2px solid var(--ui-primario)' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {tab === 'form' ? 'Formulario' : 'Guía'}
              </button>
            ))}
          </div>
        )}

        {/* ── Body: split layout ── */}
        <div style={{
          display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0,
        }}>
          {/* Panel izquierdo: formulario */}
          <div
            className={panelDerecho ? 'wa-modal-form-panel' : ''}
            style={{
              flex: panelDerecho ? '0 0 50%' : '1',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {formulario}
            </div>
            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/30">
              <BotonModal texto="Cancelar" variante="secundario" onClick={alCerrar} />
              <BotonModal
                texto={esEdicion ? 'Guardar Cambios' : 'Crear Canal'}
                onClick={solicitarConfirmacion}
                cargando={cargando}
              />
            </div>
          </div>

          {/* Panel derecho: guía o solicitud */}
          {panelDerecho && (
            <div
              className="wa-modal-guia-panel"
              style={{
                flex: '0 0 50%', borderLeft: '1px solid var(--ui-borde)',
                overflow: 'hidden', backgroundColor: 'var(--ui-superficie-2)',
              }}
            >
              {panelDerecho === 'guia' && (
                <GuiaActivacionWhatsApp alCerrar={() => { setMostrarGuia(false); setTabMobile('form'); }} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal confirmación de contraseña ── */}
      <ModalBase
        abierto={mostrarConfirmacion}
        alCerrar={() => setMostrarConfirmacion(false)}
        titulo="Confirmar identidad"
        maxAncho="xs"
        zIndex={1500}
        pie={
          <>
            <BotonModal texto="Cancelar" variante="secundario" onClick={() => setMostrarConfirmacion(false)} />
            <BotonModal texto="Confirmar" onClick={confirmarYGuardar} cargando={verificando} />
          </>
        }
      >
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          Ingrese su contraseña para aplicar los cambios
        </p>
        <div className="relative">
          <input
            type={verPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            autoFocus
            value={passwordConfirm}
            onChange={(e) => { setPasswordConfirm(e.target.value); setErrorPassword(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmarYGuardar(); }}
            className={`w-full py-2.5 px-3 pr-10 rounded-lg border text-sm outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 ${
              errorPassword ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <button
            type="button"
            onClick={() => setVerPassword(!verPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <UiIcono nombre={verPassword ? 'visibility_off' : 'visibility'} tamano={18} />
          </button>
        </div>
        {errorPassword && (
          <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {errorPassword}
          </p>
        )}
      </ModalBase>

      {/* ── Responsive styles ── */}
      <style>{`
        @media (max-width: 767px) {
          .wa-modal-tabs { display: flex !important; }
          .wa-modal-form-panel { display: ${tabMobile === 'form' ? 'flex' : 'none'} !important; flex: 1 !important; }
          .wa-modal-guia-panel { display: ${tabMobile === 'guia' ? 'block' : 'none'} !important; flex: 1 !important; border-left: none !important; }
        }
      `}</style>
    </div>
  );
}
