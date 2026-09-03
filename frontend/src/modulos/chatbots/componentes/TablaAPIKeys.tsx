import { useState, useMemo } from 'react';
import { UiTabla, type MRT_ColumnDef } from '@/ui/datos/Tabla';
import { UiPaginacion } from '@/ui';
import { UiInsignia } from '@/ui';
import { Box, Typography } from '@mui/material';
import type { APIKey } from '@/tipos/chatbot';
import { chatbotsApi } from '../api/chatbots.api';
import { confirmarEliminacion } from '@/aplicacion/helpers/confirmar';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { formatoFecha } from '@/aplicacion/helpers/formato';

interface Props {
  keys: APIKey[];
  chatbotId: string;
  alRecargar: () => void;
}

const ITEMS_POR_PAGINA = 10;

export function TablaAPIKeys({ keys, chatbotId, alRecargar }: Props) {
  const [pagina, setPagina] = useState(1);

  const datos = keys || [];
  const totalPaginas = Math.ceil(datos.length / ITEMS_POR_PAGINA);
  const datosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return datos.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [datos, pagina]);

  useMemo(() => { if (pagina > 1 && pagina > Math.ceil(datos.length / ITEMS_POR_PAGINA)) setPagina(1); }, [datos.length]);

  const revocar = async (apiKey: APIKey) => {
    // CORREGIDO: Solo enviamos 1 argumento si tu helper no soporta mensaje personalizado
    const ok = await confirmarEliminacion('API Key'); 
    if (!ok) return;
    try {
      await chatbotsApi.revocarKey(chatbotId, apiKey.id);
      notificar.exito('API Key revocada correctamente');
      alRecargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const columnas = useMemo<MRT_ColumnDef<APIKey>[]>(
    () => [
      {
        accessorKey: 'nombre',
        header: 'Nombre',
        size: 180,
        grow: 2,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {cell.getValue<string>()}
          </Typography>
        )
      },
      { 
        accessorKey: 'key_prefix', 
        header: 'Prefijo (Token)',
        size: 160,
        grow: 2,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'var(--ui-hover)', px: 1, borderRadius: 1 }}>
            {cell.getValue<string>()}...
          </Typography>
        )
      },
      { 
        accessorKey: 'entorno', 
        header: 'Entorno',
        size: 100,
        grow: 1,
        Cell: ({ cell }) => (
           cell.getValue<string>() === 'LIVE' 
             ? <UiInsignia contenido="PRODUCCION" color="error" variante="estandar" />
             : <UiInsignia contenido="TEST" color="advertencia" variante="estandar" />
        )
      },
      {
        accessorKey: 'activa',
        header: 'Estado',
        size: 100,
        grow: 1,
        Cell: ({ cell }) =>
          cell.getValue<boolean>() ? (
            <UiInsignia contenido="VIGENTE" color="exito" variante="punto" />
          ) : (
            <UiInsignia contenido="REVOCADA" color="secundario" variante="punto" />
          ),
      },
      {
        accessorKey: 'fecha_expiracion',
        header: 'Expira',
        size: 120,
        grow: 1,
        Cell: ({ cell }) => (
            <Typography variant="caption" color="text.secondary">
                {formatoFecha(cell.getValue<string>())}
            </Typography>
        ),
      },
    ],
    []
  );

  return (
    <>
    <UiTabla
      titulo=""
      columnas={columnas}
      datos={datosPaginados}
      onEliminar={revocar}
      opciones={{
        enableTopToolbar: false,
        enableBottomToolbar: false,
        enablePagination: false,
        enableRowActions: true,
        positionActionsColumn: 'first',
        muiTableHeadCellProps: {
            sx: {
              fontWeight: 700,
              backgroundColor: 'var(--ui-superficie-2)',
              color: 'var(--ui-texto-2)',
              fontSize: '11px',
              textTransform: 'uppercase',
            },
        },
        muiTableBodyRowProps: { hover: true },
        initialState: { density: 'compact' }
      }}
    />

    {totalPaginas > 1 && (
      <Box
        sx={{
          mt: 2.5,
          mb: 1,
          pb: 2,
          display: 'flex',
          justifyContent: 'center',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          '& nav': { flexShrink: 0 },
        }}
      >
        <UiPaginacion
          total={totalPaginas}
          pagina={pagina}
          alCambiar={(_: unknown, p: number) => setPagina(p)}
          centrado
          color="primary"
        />
      </Box>
    )}
    </>
  );
}