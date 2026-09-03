import { useState, useEffect, useMemo } from 'react';
import { UiPila, UiIcono } from '@/ui';
import { UiBoton, UiInsignia, UiAlerta } from '@/ui';
import { UiTabla, type MRT_ColumnDef, MRT_ToggleGlobalFilterButton, MRT_ToggleFiltersButton } from '@/ui/datos/Tabla';
import { UiIconoAnadir, UiIconoEditar, UiIconoBorrar } from '@/ui';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import { usarCanalesWhatsApp } from '../ganchos/usarCanalesWhatsApp';
import { canalesWhatsAppApi } from '../api/canales-whatsapp.api';
import { chatbotsApi } from '../../chatbots/api/chatbots.api';
import { FormCanalWhatsApp } from '../componentes/FormCanalWhatsApp';
import type { CanalWhatsApp } from '@/tipos/canal-whatsapp';
import type { Chatbot } from '@/tipos/chatbot';
import { formatoFechaHora, formatoRelativo } from '@/aplicacion/helpers/formato';
import { confirmarEliminacion } from '@/aplicacion/helpers/confirmar';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaWhatsApp } from '@/componentes/ui/guias-contenido';
import { SolicitudActivacionWhatsApp } from '../componentes/GuiaActivacionWhatsApp';

export default function PaginaCanalesWhatsApp() {
  const { canales, cargando, recargar } = usarCanalesWhatsApp();
  const [mostrarModal, setMostrarModal] = useState(false);
  const [canalEditar, setCanalEditar] = useState<CanalWhatsApp | null>(null);

  // Mapa chatbot_id → nombre para mostrar en la tabla
  const [mapaChatbots, setMapaChatbots] = useState<Record<string, Chatbot>>({});
  useEffect(() => {
    chatbotsApi.listar()
      .then((lista) => {
        const mapa: Record<string, Chatbot> = {};
        (lista || []).forEach((c) => { mapa[c.id] = c; });
        setMapaChatbots(mapa);
      })
      .catch(() => setMapaChatbots({}));
  }, [canales]); // recarga cuando cambian los canales

  const alDesactivar = async (canal: CanalWhatsApp) => {
    const ok = await confirmarEliminacion('canal WhatsApp');
    if (!ok) return;
    try {
      await canalesWhatsAppApi.desactivar(canal.id);
      notificar.exito('Canal WhatsApp desactivado');
      recargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const columnas = useMemo<MRT_ColumnDef<CanalWhatsApp>[]>(
    () => [
      {
        id: 'acciones',
        header: 'Acciones',
        size: 100,
        grow: false,
        muiTableBodyCellProps: { align: 'left' },
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-start' }}>
            <Tooltip title="Editar">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setCanalEditar(row.original);
                  setMostrarModal(true);
                }}
              >
                <UiIconoEditar sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Desactivar">
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  alDesactivar(row.original);
                }}
              >
                <UiIconoBorrar sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
      {
        accessorKey: 'nombre_canal',
        header: 'Canal',
        size: 200,
        grow: 2,
        Cell: ({ row }) => (
          <Box sx={{ opacity: row.original.activo ? 1 : 0.55 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              {row.original.nombre_canal}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.3, fontSize: '11px', fontFamily: 'monospace' }}
            >
              {row.original.display_phone || row.original.phone_number_id}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: 'phone_number_id',
        header: 'Phone Number ID',
        size: 180,
        grow: 1,
        Cell: ({ cell }) => (
          <Typography
            variant="body2"
            fontFamily="monospace"
            sx={{ bgcolor: 'var(--ui-hover)', px: 1, py: 0.3, borderRadius: 1, fontSize: '12px' }}
          >
            {cell.getValue<string>()}
          </Typography>
        ),
      },
      {
        accessorKey: 'activo',
        header: 'Estado',
        size: 110,
        grow: 1,
        muiTableBodyCellProps: { align: 'center' },
        muiTableHeadCellProps: { align: 'center' },
        Cell: ({ cell }) => (
          <Box sx={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
            <UiInsignia
              contenido={cell.getValue<boolean>() ? 'ACTIVO' : 'INACTIVO'}
              color={cell.getValue<boolean>() ? 'exito' : 'error'}
              variante="estandar"
              superposicion="rectangular"
            />
          </Box>
        ),
      },
      {
        id: 'chatbot',
        header: 'Chatbot',
        size: 180,
        grow: 1,
        Cell: ({ row }) => {
          const cid = row.original.chatbot_id;
          if (!cid) {
            return (
              <Typography variant="body2" sx={{ color: 'var(--ui-texto-3)', fontSize: '12px', fontStyle: 'italic' }}>
                Sin chatbot
              </Typography>
            );
          }
          const bot = mapaChatbots[cid];
          return (
            <Box sx={{ opacity: bot?.activo === false ? 0.5 : 1 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '13px', color: 'var(--ui-texto)' }}>
                {bot?.nombre || cid.slice(0, 8) + '…'}
              </Typography>
              {bot && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                  <Box
                    sx={{
                      width: 6, height: 6, borderRadius: '50%',
                      bgcolor: bot.activo ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave-2)',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontSize: '10px', color: 'var(--ui-texto-2)' }}>
                    {bot.tipo?.replace('_', ' ')} · {bot.activo ? 'Activo' : 'Inactivo'}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        },
      },
      {
        id: 'tokens',
        header: 'Tokens',
        size: 110,
        grow: 1,
        muiTableBodyCellProps: { align: 'center' },
        muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: 0.8, justifyContent: 'center' }}>
            <Tooltip title={row.original.tiene_access_token ? 'Access Token configurado' : 'Sin Access Token'}>
              <Box
                sx={{
                  px: 1,
                  py: 0.2,
                  borderRadius: 1,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: row.original.tiene_access_token ? 'var(--ui-exito-suave-2)' : 'var(--ui-peligro-suave)',
                  color: row.original.tiene_access_token ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
                }}
              >
                {row.original.tiene_access_token ? '✓ Token' : '✗ Token'}
              </Box>
            </Tooltip>
          </Box>
        ),
      },
      {
        accessorKey: 'fecha_creacion',
        header: 'Creado',
        size: 155,
        grow: 1,
        Cell: ({ cell }) => (
          <Box>
            <Typography variant="body2" sx={{ color: 'var(--ui-texto)', fontSize: '13px' }}>
              {formatoFechaHora(cell.getValue<string>())}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontStyle: 'italic', display: 'block', fontSize: '11px' }}
            >
              {formatoRelativo(cell.getValue<string>())}
            </Typography>
          </Box>
        ),
      },
    ],
    [],
  );

  const canalesActivos = canales.filter((c) => c.activo).length;

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* Header */}
      <UiPila
        direccion="fila"
        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}
      >
        <Box>
          <h2 className="m-0 text-xl font-bold" style={{ color: 'var(--ui-texto)' }}>Canales WhatsApp</h2>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configura los números de WhatsApp Business que recibirán mensajes de tus clientes.
          </Typography>
        </Box>
        <UiBoton
          texto="Nuevo Canal"
          variante="primario"
          iconoIzquierda={<UiIconoAnadir />}
          alHacerClick={() => {
            setCanalEditar(null);
            setMostrarModal(true);
          }}
        />
      </UiPila>

      <GuiaModulo {...guiaWhatsApp} />
      <SolicitudActivacionWhatsApp />

      {/* Info */}
      {canales.length === 0 && !cargando && (
        <UiAlerta
          variante="info"
          titulo="Sin canales configurados"
          descripcion="Agrega tu primer número de WhatsApp Business para comenzar a recibir mensajes de tus clientes automáticamente."
        />
      )}

      {canalesActivos > 0 && (
        <Box
          sx={{
            p: 2,
            bgcolor: 'var(--ui-exito-suave)',
            border: '1px solid var(--ui-exito-borde)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <UiIcono nombre="smartphone" tamano={17} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'var(--ui-exito-texto)' }}>
              {canalesActivos} canal{canalesActivos !== 1 ? 'es' : ''} activo{canalesActivos !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--ui-exito-texto)', fontSize: '13px' }}>
              Los mensajes entrantes se resuelven automáticamente al tenant correcto.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Tabla */}
      <UiTabla
        titulo="Mis Canales"
        columnas={columnas}
        datos={canales}
        cargando={cargando}
        opciones={{
          enableRowActions: false,
          enableColumnResizing: false,
          enableColumnActions: false,
          enableColumnDragging: false,
          enableColumnOrdering: false,
          enableDensityToggle: false,
          enableFullScreenToggle: false,
          enableExpandAll: false,
          enableHiding: false,
          renderToolbarInternalActions: ({ table }) => (
            <Box sx={{ display: 'flex', gap: '0.25rem' }}>
              <MRT_ToggleGlobalFilterButton table={table} />
              <MRT_ToggleFiltersButton table={table} />
            </Box>
          ),
          layoutMode: 'grid',
          muiTableBodyCellProps: {
            sx: {
              verticalAlign: 'middle',
              py: 1.2,
              borderBottom: '1px solid var(--ui-borde)',
            },
          },
          muiTableHeadCellProps: {
            sx: {
              fontWeight: 700,
              backgroundColor: 'var(--ui-superficie-2)',
              color: 'var(--ui-texto-2)',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '2px solid var(--ui-borde)',
            },
          },
          muiTableBodyRowProps: {
            sx: {
              transition: 'background-color 0.15s',
              '&:hover': { backgroundColor: 'var(--ui-superficie-2)' },
            },
          },
          initialState: {
            density: 'compact',
            pagination: { pageSize: 10, pageIndex: 0 },
          },
        }}
      />

      {/* Modal crear/editar */}
      <FormCanalWhatsApp
        abierto={mostrarModal}
        canalEditar={canalEditar}
        alCerrar={() => {
          setMostrarModal(false);
          setCanalEditar(null);
        }}
        alGuardar={() => {
          setMostrarModal(false);
          setCanalEditar(null);
          recargar();
        }}
      />
    </UiPila>
  );
}