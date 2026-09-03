import { useMemo } from 'react';
import { Box, Typography, Tooltip, Chip, IconButton } from '@mui/material';
import { UiTabla, type MRT_ColumnDef, type MRT_Row } from '@/ui/datos/Tabla';
import type { RolTenant } from '@/tipos';
import { UiIconoEditar, UiIconoBorrar } from '@/ui';
import { confirmarEliminacion } from '@/aplicacion/helpers/confirmar';
import { rolesApi } from '../api/roles.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

interface Props {
  roles: RolTenant[];
  cargando: boolean;
  alRecargar: () => void;
  alEditar: (rol: RolTenant) => void;
  esAdmin: boolean;
  rolSlugActual: string;
}

export function TablaRoles({ roles, cargando, alRecargar, alEditar, esAdmin, rolSlugActual }: Props) {

  const manejarEliminar = async (rol: RolTenant) => {
    if (rol.es_base) {
      notificar.advertencia('Los roles base del sistema no se pueden eliminar');
      return;
    }
    if ((rol.cantidad_usuarios ?? 0) > 0) {
      notificar.advertencia(`No se puede eliminar: ${rol.cantidad_usuarios} usuario(s) tienen este rol`);
      return;
    }
    const confirmado = await confirmarEliminacion('rol');
    if (!confirmado) return;
    try {
      await rolesApi.eliminar(rol.id);
      notificar.exito('Rol eliminado');
      alRecargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const columnas = useMemo<MRT_ColumnDef<RolTenant>[]>(
    () => [
      {
        accessorKey: 'nombre',
        header: 'Rol',
        size: 260,
        grow: 2,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 12, height: 12, borderRadius: '3px',
              backgroundColor: row.original.color || '#857e70',
              flexShrink: 0,
              border: '1px solid rgba(0,0,0,0.1)',
            }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  {row.original.nombre}
                </Typography>
                {row.original.es_admin && (
                  <Chip
                    label="Admin"
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.6rem', fontWeight: 700,
                      bgcolor: 'rgba(163, 49, 42, 0.08)',
                      color: 'var(--ui-peligro-texto)',
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                )}
                {row.original.es_base && (
                  <Chip
                    label="Base"
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.6rem', fontWeight: 700,
                      bgcolor: 'rgba(154, 74, 36, 0.08)',
                      color: 'var(--ui-primario-texto)',
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {row.original.slug}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        accessorKey: 'descripcion',
        header: 'Descripción',
        size: 280,
        grow: 3,
        Cell: ({ cell }) => (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '13px' }}>
            {cell.getValue<string>() || '—'}
          </Typography>
        ),
      },
      {
        accessorKey: 'cantidad_usuarios',
        header: 'Usuarios',
        size: 100,
        grow: 1,
        Cell: ({ cell }) => {
          const count = cell.getValue<number>() ?? 0;
          return (
            <Chip
              label={count}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.8rem',
                bgcolor: count > 0 ? 'rgba(92, 138, 79, 0.08)' : 'rgba(133, 126, 112, 0.08)',
                color: count > 0 ? 'var(--ui-exito-texto)' : 'text.secondary',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          );
        },
      },
      {
        accessorKey: 'permisos',
        header: 'Permisos',
        size: 120,
        grow: 1,
        Cell: ({ row }) => {
          const permisos = row.original.permisos || {};
          const totalActivos = Object.values(permisos).reduce((sum, acciones) =>
            sum + Object.values(acciones).filter(Boolean).length, 0);
          return (
            <Chip
              label={`${totalActivos} permisos`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500, fontSize: '0.72rem' }}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <UiTabla
      columnas={columnas}
      datos={roles}
      cargando={cargando}
      habilitarExportacion={false}
      seleccionable={false}
      opciones={{
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }: { row: MRT_Row<RolTenant> }) => {
          const rol = row.original;
          const esRolPropio = rol.slug === rolSlugActual;
          const puedeEditar = esAdmin || (!rol.es_base && !esRolPropio);
          const puedeEliminar = !rol.es_base && (rol.cantidad_usuarios ?? 0) === 0 && !esRolPropio;

          const tooltipEditar = !puedeEditar
            ? (rol.es_base ? 'Solo administradores pueden modificar roles base' : 'No puedes modificar tu propio rol')
            : 'Editar';

          const tooltipEliminar = rol.es_base ? 'Rol base — no eliminable'
            : esRolPropio ? 'No puedes eliminar tu propio rol'
            : (rol.cantidad_usuarios ?? 0) > 0 ? 'Tiene usuarios asignados'
            : 'Eliminar';

          return (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title={tooltipEditar}>
                <span>
                  <IconButton size="small" color="primary" disabled={!puedeEditar} onClick={(e) => { e.stopPropagation(); alEditar(rol); }}>
                    <UiIconoEditar sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={tooltipEliminar}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!puedeEliminar}
                    onClick={(e) => { e.stopPropagation(); manejarEliminar(rol); }}
                    sx={{
                      color: 'var(--ui-peligro-texto)',
                      '&:hover': { bgcolor: 'var(--ui-peligro-suave)', color: 'var(--ui-peligro-texto)' },
                      // Deshabilitado: el rojo fijo no seguía al tema y se
                      // perdía en oscuro. El token de texto desactivado ya
                      // está calibrado para verse apagado pero presente.
                      '&.Mui-disabled': { color: 'var(--ui-texto-desactivado)' },
                    }}
                  >
                    <UiIconoBorrar sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        },
        enableColumnResizing: false,
        enableColumnActions: false,
        enableColumnDragging: false,
        enableColumnOrdering: false,
        enableSorting: false,
        layoutMode: 'grid',
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
            cursor: 'pointer',
            transition: 'background-color 0.15s',
            '&:hover': { bgcolor: 'action.hover' },
          },
          onClick: (e: React.MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, svg, [role="button"]')) return;
            const rol = row.original;
            const esRolPropio = rol.slug === rolSlugActual;
            if (!esAdmin && (rol.es_base || esRolPropio)) return;
            alEditar(rol);
          },
        }),
        muiTableBodyCellProps: {
          sx: { verticalAlign: 'middle', py: 1.2, borderColor: 'divider' },
        },
        muiTableHeadCellProps: {
          sx: {
            fontWeight: 700, bgcolor: 'background.default', color: 'text.secondary',
            fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px',
            borderBottom: 2, borderColor: 'divider',
          },
        },
        initialState: { density: 'compact' },
      }}
    />
  );
}
