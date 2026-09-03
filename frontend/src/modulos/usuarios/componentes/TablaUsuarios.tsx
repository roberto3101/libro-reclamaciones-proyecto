import { useState, useMemo } from 'react';
import { Box, Typography, Tooltip, Chip, Avatar, IconButton } from '@mui/material';
import { UiTabla, type MRT_ColumnDef, type MRT_Row } from '@/ui/datos/Tabla';
import { UiPaginacion } from '@/ui';
import type { Usuario, RolTenant } from '@/tipos';
import type { Sede } from '@/tipos';
import { formatoFechaHora, formatoRelativo } from '@/aplicacion/helpers/formato';
import { UiIconoEditar, UiIconoBorrar } from '@/ui';
import { confirmarEliminacion } from '@/aplicacion/helpers/confirmar';
import { usuariosApi } from '../api/usuarios.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

interface Props {
  usuarios: Usuario[];
  sedes: Sede[];
  roles?: RolTenant[];
  cargando: boolean;
  alRecargar: () => void;
  alEditar: (usuario: Usuario) => void;
  usuarioActualId?: string;
}

/* ── Role config — MUI theme-aware, no emojis ── */
const ROL_CONFIG: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  ADMIN: {
    label: 'Administrador',
    bgColor: 'rgba(163, 49, 42, 0.08)',
    textColor: 'var(--ui-peligro-texto)',
    borderColor: 'rgba(163, 49, 42, 0.2)',
  },
  SOPORTE: {
    label: 'Soporte',
    bgColor: 'rgba(154, 74, 36, 0.08)',
    textColor: 'var(--ui-primario-texto)',
    borderColor: 'rgba(154, 74, 36, 0.2)',
  },
};

/** Genera config visual buscando primero en los roles dinámicos del tenant. */
function obtenerConfigRol(rol: string, roles?: RolTenant[]) {
  // 1. Buscar en roles dinámicos del tenant (slug lowercase vs rol uppercase)
  if (roles && roles.length > 0) {
    const encontrado = roles.find((r) => r.slug.toUpperCase() === rol.toUpperCase());
    if (encontrado) {
      // Usar color del rol si tiene, sino fallback por slug
      const esAdmin = encontrado.slug === 'admin';
      const esSoporte = encontrado.slug === 'soporte';
      return {
        label: encontrado.nombre,
        bgColor: esAdmin
          ? 'rgba(163, 49, 42, 0.08)'
          : esSoporte
            ? 'rgba(154, 74, 36, 0.08)'
            : 'rgba(133, 126, 112, 0.08)',
        textColor: esAdmin ? 'var(--ui-peligro-texto)' : esSoporte ? 'var(--ui-primario-texto)' : 'text.secondary',
        borderColor: esAdmin
          ? 'rgba(163, 49, 42, 0.2)'
          : esSoporte
            ? 'rgba(154, 74, 36, 0.2)'
            : 'rgba(133, 126, 112, 0.2)',
      };
    }
  }

  // 2. Fallback a config estática
  const upper = rol.toUpperCase();
  if (ROL_CONFIG[upper]) return ROL_CONFIG[upper];

  // 3. Rol desconocido → nombre capitalizado con estilo neutro
  const label = rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase();
  return {
    label,
    bgColor: 'rgba(133, 126, 112, 0.08)',
    textColor: 'text.secondary',
    borderColor: 'rgba(133, 126, 112, 0.2)',
  };
}

const ITEMS_POR_PAGINA = 10;

export function TablaUsuarios({ usuarios, sedes, roles, cargando, alRecargar, alEditar, usuarioActualId }: Props) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.ceil(usuarios.length / ITEMS_POR_PAGINA);
  const datosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return usuarios.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [usuarios, pagina]);

  // Reset pagina si cambian los datos (ej: filtro externo)
  useMemo(() => { if (pagina > 1 && pagina > Math.ceil(usuarios.length / ITEMS_POR_PAGINA)) setPagina(1); }, [usuarios.length]);

  const sedesMap = useMemo(() => {
    const map: Record<string, string> = {};
    sedes.forEach((s) => { map[s.id] = s.nombre; });
    return map;
  }, [sedes]);

  const manejarEliminar = async (fila: Usuario) => {
    if (fila.id === usuarioActualId) {
      notificar.advertencia('No puedes desactivar tu propia cuenta');
      return;
    }
    const confirmado = await confirmarEliminacion('usuario');
    if (!confirmado) return;
    try {
      await usuariosApi.eliminar(fila.id);
      notificar.exito('Usuario desactivado');
      alRecargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const manejarReactivar = async (fila: Usuario) => {
    try {
      await usuariosApi.reactivar(fila.id);
      notificar.exito('Usuario reactivado');
      alRecargar();
    } catch (error) {
      manejarError(error);
    }
  };

  const columnas = useMemo<MRT_ColumnDef<Usuario>[]>(
    () => [
      {
        accessorKey: 'nombre_completo',
        header: 'Usuario',
        size: 280,
        grow: 2,
        Cell: ({ row }) => {
          const esYo = row.original.id === usuarioActualId;
          const iniciales = row.original.nombre_completo
            .split(' ')
            .map((p) => p[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  bgcolor: esYo ? 'primary.main' : 'action.selected',
                  color: esYo ? 'primary.contrastText' : 'text.secondary',
                }}
              >
                {iniciales}
              </Avatar>
              <Box sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Tooltip title={row.original.nombre_completo}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color="text.primary"
                      noWrap
                      sx={{ display: 'block', textTransform: 'capitalize' }}
                    >
                      {row.original.nombre_completo.toLowerCase()}
                    </Typography>
                  </Tooltip>
                  {esYo && (
                    <Chip
                      label="Tu"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  )}
                </Box>
                <Tooltip title={row.original.email}>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {row.original.email}
                  </Typography>
                </Tooltip>
              </Box>
            </Box>
          );
        },
      },
      {
        accessorKey: 'rol',
        header: 'Rol',
        size: 160,
        grow: 1,
        Cell: ({ cell }) => {
          const rol = cell.getValue<string>();
          const config = obtenerConfigRol(rol, roles);
          return (
            <Chip
              label={config.label}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                bgcolor: config.bgColor,
                color: config.textColor,
                border: `1px solid`,
                borderColor: config.borderColor,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          );
        },
      },
      {
        accessorKey: 'sede_ids',
        header: 'Sede',
        size: 160,
        grow: 1,
        Cell: ({ cell }) => {
          const ids = cell.getValue<string[]>() ?? [];
          if (ids.length === 0) {
            return (
              <Typography variant="body2" sx={{ color: 'var(--ui-exito-texto)', fontSize: '13px', fontWeight: 600 }}>
                Acceso global
              </Typography>
            );
          }
          const nombres = ids.map((id) => sedesMap[id]).filter(Boolean);
          return (
            <Typography variant="body2" sx={{ fontSize: '13px' }} title={nombres.join(', ')}>
              {nombres.length <= 2 ? nombres.join(', ') : `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`}
            </Typography>
          );
        },
      },
      {
        accessorKey: 'activo',
        header: 'Estado',
        size: 100,
        grow: 1,
        Cell: ({ row }) => (
          <Chip
            label={row.original.activo ? 'Activo' : 'Inactivo'}
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
        accessorKey: 'ultimo_acceso',
        header: 'Ultimo Acceso',
        size: 160,
        grow: 1,
        Cell: ({ cell }) => {
          const valor = cell.getValue<string>();
          if (!valor) {
            return (
              <Chip
                label="Sin acceso"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 500, fontSize: '0.72rem' }}
              />
            );
          }
          return (
            <Box>
              <Typography variant="body2" color="text.primary" sx={{ fontSize: '13px' }}>
                {formatoFechaHora(valor)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>
                {formatoRelativo(valor)}
              </Typography>
            </Box>
          );
        },
      },
    ],
    [usuarioActualId, sedesMap],
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
        renderRowActions: ({ row }: { row: MRT_Row<Usuario> }) => {
          const esYo = row.original.id === usuarioActualId;
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
                  {!esYo && (
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
                    <span style={{ fontSize: 16 }}>▶</span>
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

        // ── Estilos dark mode (usando tokens del sistema de diseño) ──
        muiTablePaperProps: {
          elevation: 0,
          sx: {
            borderRadius: 'var(--ui-r-xl)',
            border: '1px solid var(--ui-borde)',
            overflow: 'hidden',
            backgroundColor: 'var(--ui-superficie)',
          },
        },
        muiTableBodyRowProps: ({ row }) => ({
          sx: {
            cursor: row.original.activo ? 'pointer' : 'default',
            transition: 'background-color 0.15s',
            opacity: row.original.activo ? 1 : 0.55,
            backgroundColor: row.original.id === usuarioActualId
              ? 'var(--ui-seleccionado)'
              : 'var(--ui-superficie)',
            '&:hover': {
              backgroundColor: row.original.id === usuarioActualId
                ? 'var(--ui-activo)'
                : 'var(--ui-superficie-hundida, rgba(255,255,255,0.04))',
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
            borderColor: 'var(--ui-borde)',
            backgroundColor: 'transparent',
          },
        },
        muiTableHeadCellProps: {
          sx: {
            fontWeight: 700,
            backgroundColor: 'var(--ui-fondo)',
            color: 'var(--ui-texto-2)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderBottom: '2px solid var(--ui-borde)',
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
