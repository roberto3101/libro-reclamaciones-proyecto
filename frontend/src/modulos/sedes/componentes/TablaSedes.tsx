import { useState, useMemo } from 'react';
import { Box, Typography, Tooltip, IconButton, Chip } from '@mui/material';
import { UiTabla, type MRT_ColumnDef, type MRT_Row } from '@/ui/datos/Tabla';
import { UiPaginacion } from '@/ui';
import { UiInsignia } from '@/ui';
import { UiIconoEditar, UiIconoBorrar } from '@/ui';
import type { Sede } from '@/tipos';
import { confirmar } from '@/aplicacion/helpers/confirmar';
import { sedesApi } from '../api/sedes.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

interface Props {
  sedes: Sede[];
  cargando: boolean;
  alRecargar: () => void;
  alEditar: (sede: Sede) => void;
  tenantSlug: string;
}

const ITEMS_POR_PAGINA = 10;

export function TablaSedes({ sedes, cargando, alRecargar, alEditar, tenantSlug }: Props) {
  const [pagina, setPagina] = useState(1);
  const [copiado, setCopiado] = useState<string | null>(null);

  const totalPaginas = Math.ceil(sedes.length / ITEMS_POR_PAGINA);
  const datosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return sedes.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [sedes, pagina]);

  useMemo(() => { if (pagina > 1 && pagina > Math.ceil(sedes.length / ITEMS_POR_PAGINA)) setPagina(1); }, [sedes.length]);

  const obtenerUrlLibro = (sede: Sede): string => {
    if (!tenantSlug) return '';
    return `${window.location.origin}/libro/${tenantSlug}?sede=${sede.slug}`;
  };

  const copiarUrl = async (sede: Sede) => {
    const url = obtenerUrlLibro(sede);
    if (!url) {
      notificar.advertencia('No se pudo obtener la URL del libro');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(sede.id);
      notificar.exito('URL copiada al portapapeles');
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      notificar.error('No se pudo copiar la URL');
    }
  };

  const manejarEliminar = async (sede: Sede) => {
    if (sede.es_principal) {
      notificar.advertencia('No puedes desactivar la sede principal');
      return;
    }
    const confirmado = await confirmar({
      titulo: '¿Desactivar sede?',
      texto: 'La sede quedará inactiva. Podrás reactivarla en cualquier momento.',
      textoConfirmar: 'Sí, desactivar',
      icono: 'warning',
    });
    if (!confirmado) return;

    try {
      await sedesApi.eliminar(sede.id);
      notificar.exito('Sede desactivada correctamente');
      alRecargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const manejarReactivar = async (sede: Sede) => {
    try {
      await sedesApi.reactivar(sede.id);
      notificar.exito('Sede reactivada correctamente');
      alRecargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const columnas = useMemo<MRT_ColumnDef<Sede>[]>(
    () => [
      {
        accessorKey: 'nombre',
        header: 'Sede',
        size: 200,
        grow: 2,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
              {row.original.nombre}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap>
              {row.original.slug}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: 'direccion',
        header: 'Ubicación',
        size: 220,
        grow: 2,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Tooltip title={row.original.direccion}>
              <Typography variant="body2" color="text.primary" noWrap sx={{ display: 'block' }}>
                {row.original.direccion}
              </Typography>
            </Tooltip>
            {row.original.distrito && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                {[row.original.distrito, row.original.provincia].filter(Boolean).join(', ')}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: 'responsable_nombre',
        header: 'Responsable',
        size: 180,
        grow: 1,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Typography variant="body2" color="text.primary" noWrap>
              {row.original.responsable_nombre || '—'}
            </Typography>
            {row.original.responsable_cargo && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.original.responsable_cargo}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: 'activo',
        header: 'Estado',
        size: 100,
        grow: 1,
        Cell: ({ row }) => (
          <Chip
            label={row.original.activo ? 'Activa' : 'Inactiva'}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: '0.72rem',
              bgcolor: row.original.activo ? 'rgba(92, 138, 79, 0.08)' : 'rgba(184, 58, 50, 0.08)',
              color: row.original.activo ? 'var(--ui-exito-texto)' : 'var(--ui-peligro-texto)',
              border: '1px solid',
              borderColor: row.original.activo ? 'rgba(92, 138, 79, 0.2)' : 'rgba(184, 58, 50, 0.2)',
              '& .MuiChip-label': { px: 1 },
            }}
          />
        ),
      },
      {
        accessorKey: 'es_principal',
        header: 'Principal',
        size: 90,
        grow: 1,
        muiTableBodyCellProps: { align: 'center' },
        muiTableHeadCellProps: { align: 'center' },
        Cell: ({ cell }) => {
          const esPrincipal = cell.getValue<boolean>();
          return (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <UiInsignia
                contenido={esPrincipal ? 'Sí' : 'No'}
                color={esPrincipal ? 'exito' : 'secundario'}
                variante="estandar"
                superposicion="rectangular"
              />
            </Box>
          );
        },
      },
      {
        id: 'url_libro',
        header: 'Libro Público',
        size: 160,
        grow: 1,
        Cell: ({ row }) => {
          const isCopied = copiado === row.original.id;

          if (!tenantSlug || !row.original.activo) return <Typography variant="caption" color="text.disabled">—</Typography>;

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                fontFamily="monospace"
                noWrap
                sx={{ maxWidth: 120, display: 'block' }}
                title={obtenerUrlLibro(row.original)}
              >
                ?sede={row.original.slug}
              </Typography>

              <Tooltip title={isCopied ? 'Copiado' : 'Copiar URL'}>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    copiarUrl(row.original);
                  }}
                  size="small"
                  sx={{
                    color: isCopied ? 'var(--ui-exito-texto)' : 'action.active',
                    bgcolor: isCopied ? 'rgba(92, 138, 79, 0.08)' : 'transparent',
                    '&:hover': { bgcolor: isCopied ? 'rgba(92, 138, 79, 0.12)' : 'action.hover' },
                  }}
                >
                  {isCopied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    [tenantSlug, copiado],
  );

  return (
    <>
    <UiTabla
      columnas={columnas}
      datos={datosPaginados}
      cargando={cargando}
      habilitarExportacion={false}
      seleccionable={false}
      opciones={{
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }: { row: MRT_Row<Sede> }) => {
          const activo = row.original.activo;
          return (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {activo ? (
                <>
                  <Tooltip title="Editar">
                    <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); alEditar(row.original); }}>
                      <UiIconoEditar sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  {!row.original.es_principal && (
                    <Tooltip title="Desactivar">
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); manejarEliminar(row.original); }}>
                        <UiIconoBorrar sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              ) : (
                <Tooltip title="Reactivar">
                  <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); manejarReactivar(row.original); }}>
                    <span style={{ fontSize: 16 }}>&#9654;</span>
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        },
        enableColumnResizing: false,
        enableColumnActions: false,
        enableColumnDragging: false,
        enableColumnOrdering: false,
        enableSorting: true,
        layoutMode: 'grid',
        // ── Toolbar: completamente oculto ──
        enableTopToolbar: false,
        enableBottomToolbar: false,
        enablePagination: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        enableHiding: false,
        enableGlobalFilter: false,
        enableColumnFilters: false,
        enableFilters: false,
        renderToolbarInternalActions: () => null,
        renderTopToolbarCustomActions: () => null,
        muiTopToolbarProps: { sx: { display: 'none' } },
        // ── Estilos dark mode (MUI theme system) ──
        muiTablePaperProps: {
          elevation: 0,
          sx: {
            borderRadius: 'var(--ui-r-xl)',
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          },
        },
        muiTableBodyRowProps: ({ row }) => ({
          sx: {
            cursor: row.original.activo ? 'pointer' : 'default',
            transition: 'background-color 0.15s',
            opacity: row.original.activo ? 1 : 0.55,
            ...(row.original.es_principal && row.original.activo && {
              bgcolor: (theme: any) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(92, 138, 79, 0.06)'
                  : 'rgba(92, 138, 79, 0.04)',
            }),
            '&:hover': {
              bgcolor: 'action.hover',
            },
          },
          onClick: (e: React.MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, svg, [role="button"]')) return;
            if (!row.original.activo) return;
            alEditar(row.original);
          },
        }),
        muiTableBodyCellProps: {
          sx: {
            verticalAlign: 'middle',
            py: 1.2,
            borderColor: 'divider',
          },
        },
        muiTableHeadCellProps: {
          sx: {
            fontWeight: 700,
            bgcolor: 'background.default',
            color: 'text.secondary',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderBottom: 2,
            borderColor: 'divider',
          },
        },
        initialState: {
          density: 'compact',
        },
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
