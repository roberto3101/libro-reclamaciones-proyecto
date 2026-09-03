import { useState, useEffect, useCallback } from 'react';
import { UiIcono } from '@/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { UiPila } from '@/ui';
import { UiBoton, UiCargando, UiInsignia } from '@/ui';
import { Box, Typography } from '@mui/material';
import type { Chatbot } from '@/tipos/chatbot';
import { chatbotsApi } from '../api/chatbots.api';
import { PanelEstadoBot } from '../componentes/PanelEstadoBot';
import { FormChatbot } from '../componentes/FormChatbot';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import Swal from 'sweetalert2';

const estiloInsigniaSolida = {
  '& .MuiBadge-badge': {
    position: 'relative',
    transform: 'none',
    top: 'auto', right: 'auto', left: 'auto', bottom: 'auto',
    margin: 0,
  }
};

export default function PaginaDetalleChatbot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [toggling, setToggling] = useState(false);

  const cargar = useCallback(async () => {
    if (!id || id === 'undefined') return;
    setCargando(true);
    try {
      const cb = await chatbotsApi.obtener(id);
      setChatbot(cb);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async () => {
    if (!chatbot || !id) return;
    if (chatbot.activo) {
      const result = await Swal.fire({
        title: '¿Desactivar bot?',
        html: '<p style="font-size:14px;color:#6a655a">Se desactivaran <strong>todas las conexiones</strong> y el bot dejara de funcionar.</p>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Desactivar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#8a6112',
      });
      if (!result.isConfirmed) return;
    }
    setToggling(true);
    try {
      if (chatbot.activo) {
        await chatbotsApi.desactivar(id);
        notificar.exito('Bot desactivado correctamente');
      } else {
        await chatbotsApi.reactivar(id);
        notificar.exito('Bot reactivado correctamente');
      }
      cargar();
    } catch (error) {
      manejarError(error);
    } finally {
      setToggling(false);
    }
  };

  const eliminar = async () => {
    if (!chatbot || !id) return;
    const result = await Swal.fire({
      title: '¿Eliminar bot?',
      html: `<p style="font-size:14px;color:#6a655a">Se eliminara <strong>${chatbot.nombre}</strong> de forma permanente.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#a3312a',
    });
    if (!result.isConfirmed) return;
    try {
      await chatbotsApi.eliminar(id);
      notificar.exito('Bot eliminado');
      navigate('/chatbots');
    } catch (error) {
      manejarError(error);
    }
  };

  if (cargando) return <UiCargando tipo="anillo" etiqueta="Cargando..." pantallaCompleta />;
  if (!chatbot) return <Box p={3}>Bot no encontrado.</Box>;

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* ── Header ── */}
      <UiPila direccion="fila" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" fontWeight="bold">{chatbot.nombre}</Typography>
            <UiInsignia
              contenido={chatbot.activo ? "ACTIVO" : "INACTIVO"}
              color={chatbot.activo ? "exito" : "error"}
              variante="estandar"
              superposicion="rectangular"
              sx={estiloInsigniaSolida}
            />
            <UiInsignia
              contenido={chatbot.tipo.replace('_', ' ')}
              color="info"
              variante="estandar"
              superposicion="rectangular"
              sx={estiloInsigniaSolida}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {chatbot.descripcion || 'Sin descripcion'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <UiBoton
            texto={chatbot.activo ? 'Desactivar' : 'Reactivar'}
            variante="contorno"
            tamano="sm"
            estado={toggling ? 'cargando' : 'inactivo'}
            alHacerClick={toggleActivo}
          />
          <UiBoton texto="Eliminar" variante="contorno" tamano="sm" alHacerClick={eliminar} />
          <UiBoton texto="Volver" variante="contorno" tamano="sm" alHacerClick={() => navigate('/chatbots')} />
        </Box>
      </UiPila>

      {/* ── Banner inactivo ── */}
      {!chatbot.activo && (
        <Box sx={{ p: 2, bgcolor: 'var(--ui-adv-suave)', border: '1px solid var(--ui-adv-borde)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <UiIcono nombre="warning" tamano={17} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'var(--ui-adv-texto)' }}>Bot desactivado</Typography>
            <Typography variant="body2" sx={{ color: 'var(--ui-adv-texto)', fontSize: '13px' }}>
              Este bot esta apagado y no puede atender reclamos. Reactivalo para que vuelva a funcionar.
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Estado en tiempo real ── */}
      <PanelEstadoBot
        chatbot={chatbot}
        onIrAConfiguracion={() => setMostrarModalEditar(true)}
        onActivar={toggleActivo}
      />

      <FormChatbot
        abierto={mostrarModalEditar}
        chatbotEditar={chatbot}
        alCerrar={() => setMostrarModalEditar(false)}
        alGuardar={() => { setMostrarModalEditar(false); cargar(); }}
      />
    </UiPila>
  );
}
