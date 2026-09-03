import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Tooltip } from '@mui/material';
import { UiTabla, type MRT_ColumnDef } from '@/ui/datos/Tabla';
import { UiInsignia, type InsigniaColor } from '@/ui';
import { UiPaginacion } from '@/ui';
import type { Reclamo, EstadoReclamo } from '@/tipos';
import { ESTADOS_RECLAMO } from '@/tipos/reclamo';
import { formatoFechaHora, formatoMoneda } from '@/aplicacion/helpers/formato';

interface Props {
  reclamos: Reclamo[];
  total: number;
  pagina: number;
  cargando: boolean;
  alCambiarPagina: (_: unknown, p: number) => void;
}

const obtenerColorEstado = (estado: EstadoReclamo): InsigniaColor => {
  switch (estado) {
    case 'PENDIENTE': return 'advertencia';
    case 'EN_PROCESO': return 'info';
    case 'RESUELTO': return 'exito';
    case 'CERRADO': return 'exito';
    case 'RECHAZADO': return 'error';
    default: return 'primario';
  }
};

/* ── Helper: calcular vencimiento desde fecha_limite_respuesta ── */
const calcularVencimiento = (fechaLimite: string | null | undefined) => {
  if (!fechaLimite) return null;
  const limite = new Date(fechaLimite);
  if (isNaN(limite.getTime())) return null;
  const ahora = new Date();
  const diffMs = limite.getTime() - ahora.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDias;
};

const VencimientoBadge = ({ dias }: { dias: number }) => {
  let texto: string;
  let color: string;

  if (dias < 0) {
    texto = `Vencido hace ${Math.abs(dias)}d`;
    color = '#b83a32';
  } else if (dias === 0) {
    texto = 'Vence hoy';
    color = '#b83a32';
  } else if (dias <= 3) {
    texto = `Vence en ${dias}d`;
    color = '#f97316';
  } else if (dias <= 7) {
    texto = `Vence en ${dias}d`;
    color = '#a67718';
  } else {
    texto = `Vence en ${dias}d`;
    color = '#5c8a4f';
  }

  return (
    <Typography
      variant="caption"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: '11px',
        fontWeight: 600,
        color,
        mt: 0.3,
      }}
    >
      <span style={{ fontSize: '8px' }}>●</span>
      {texto}
    </Typography>
  );
};

export function TablaReclamos({ reclamos, total, pagina, cargando, alCambiarPagina }: Props) {
  const navegar = useNavigate();

  const columnas = useMemo<MRT_ColumnDef<Reclamo>[]>(
    () => [
      {
        accessorKey: 'codigo_reclamo',
        header: 'Código',
        minSize: 180,
        size: 200,
        grow: 1,
        enableClickToCopy: true,
        Cell: ({ row }) => (
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'var(--ui-primario-texto)', letterSpacing: '-0.2px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
            {row.original.codigo_reclamo}
          </Typography>
        ),
      },
      {
        accessorKey: 'nombre_completo',
        header: 'Consumidor',
        minSize: 180,
        size: 220,
        grow: 2,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Tooltip title={row.original.nombre_completo} placement="top">
              <Typography
                variant="body2"
                fontWeight={500}
                sx={{
                  color: 'text.primary',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: 1.3,
                }}
              >
                {row.original.nombre_completo}
              </Typography>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
              {row.original.tipo_documento}: {row.original.numero_documento}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: 'sede_nombre',
        header: 'Sede',
        minSize: 80,
        size: 110,
        grow: 1,
        Cell: ({ row }) => (
          <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
            {row.original.sede_nombre || 'Principal'}
          </Typography>
        ),
      },
      {
        accessorKey: 'monto_reclamado',
        header: 'Monto',
        minSize: 90,
        size: 100,
        grow: 1,
        muiTableBodyCellProps: { align: 'right' },
        muiTableHeadCellProps: { align: 'right' },
        Cell: ({ cell }) => {
          const valor = cell.getValue<any>();
          const montoReal = valor?.Float64 !== undefined ? valor.Float64 : valor;
          return (
            <Typography variant="body2" fontFamily="'JetBrains Mono', monospace" fontWeight={500} sx={{ color: 'text.primary', whiteSpace: 'nowrap' }}>
              {formatoMoneda(montoReal)}
            </Typography>
          );
        },
      },
      {
        accessorKey: 'estado',
        header: 'Estado',
        minSize: 100,
        size: 110,
        grow: 1,
        muiTableBodyCellProps: { align: 'center', sx: { px: '0 !important' } },
        muiTableHeadCellProps: { align: 'center' },
        Cell: ({ cell }) => {
          const estado = cell.getValue<EstadoReclamo>();
          const info = ESTADOS_RECLAMO[estado];
          return (
            <Box sx={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
              <UiInsignia
                contenido={info?.etiqueta ?? estado}
                color={obtenerColorEstado(estado)}
                variante="estandar"
                superposicion="rectangular"
              />
            </Box>
          );
        },
      },
      {
        accessorKey: 'fecha_registro',
        header: 'Fecha / Venc.',
        minSize: 140,
        size: 155,
        grow: 1,
        Cell: ({ row }) => {
          const diasRestantes = calcularVencimiento(row.original.fecha_limite_respuesta);
          const estaAbierto = ['PENDIENTE', 'EN_PROCESO'].includes(row.original.estado);

          return (
            <Box>
              <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '13px', whiteSpace: 'nowrap' }}>
                {formatoFechaHora(row.original.fecha_registro)}
              </Typography>
              {estaAbierto && diasRestantes !== null ? (
                <VencimientoBadge dias={diasRestantes} />
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', mt: 0.3, display: 'block' }}>
                  {(row.original.estado === 'RESUELTO' || row.original.estado === 'CERRADO') ? 'Cerrado' : '—'}
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: 'nombre_atendido_por',
        header: 'Atendido por',
        minSize: 110,
        size: 140,
        grow: 1,
        Cell: ({ cell }) => {
          const nombre = cell.getValue<string>();
          return (
            <Typography variant="body2" sx={{ color: nombre ? 'text.primary' : 'text.secondary', fontSize: '13px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {nombre || '—'}
            </Typography>
          );
        },
      },
    ],
    []
  );

  return (
    <Box
      sx={{
        borderRadius: 'var(--ui-r-xl)',
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <UiTabla
        columnas={columnas}
        datos={reclamos}
        cargando={cargando}
        habilitarExportacion={false}
        seleccionable={false}
        opciones={{
          enableRowActions: true,
          positionActionsColumn: 'first',
          enableColumnResizing: false,
          enableSorting: true,
          enableColumnActions: false,
          enableColumnDragging: false,
          enableColumnOrdering: false,
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

          // ── Estilos ──
          muiTablePaperProps: {
            elevation: 0,
            sx: {
              borderRadius: 0,
              border: 'none',
            },
          },
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
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              borderBottom: 2,
              borderColor: 'divider',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              '& .Mui-TableHeadCell-Content-Labels': {
                overflow: 'visible',
              },
              '& .Mui-TableHeadCell-Content-Wrapper': {
                overflow: 'visible',
                whiteSpace: 'nowrap',
              },
            },
          },
          muiTableBodyRowProps: ({ row }) => ({
            sx: {
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            },
            onClick: () => navegar(`/reclamos/${row.original.id}`),
          }),
          initialState: {
            density: 'compact',
          },
        }}
        onEditar={(fila) => navegar(`/reclamos/${fila.id}`)}
      />

      {total > 1 && (
        <Box
          sx={{
            py: 1.5,
            display: 'flex',
            justifyContent: 'center',
            borderTop: 1,
            borderColor: 'divider',
            '& .MuiPaginationItem-root': {
              color: 'text.primary',
            },
          }}
        >
          <UiPaginacion
            total={total}
            pagina={pagina}
            alCambiar={alCambiarPagina}
            centrado
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
