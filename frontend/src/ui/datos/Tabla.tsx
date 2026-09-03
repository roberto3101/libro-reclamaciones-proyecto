import type { ReactNode } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableOptions,
} from 'material-react-table';
import { MRT_Localization_ES } from 'material-react-table/locales/es';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';

/* La tabla se apoya en material-react-table, que es pública. Aquí solo se
   fijan los valores por defecto de la casa y se traduce al español. Se
   reexporta la librería entera para que las páginas sigan importando sus
   tipos (MRT_ColumnDef, MRT_Row…) desde un único sitio. */
export * from 'material-react-table';

export interface TablaProps<TData extends MRT_RowData> {
  columnas: MRT_ColumnDef<TData>[];
  datos: TData[];
  /** Opciones de material-react-table; tienen prioridad sobre los defectos. */
  opciones?: Partial<MRT_TableOptions<TData>>;
  titulo?: string;
  cargando?: boolean;
  /** Añade una descarga en CSV a la barra de herramientas. */
  habilitarExportacion?: boolean;
  onEditar?: (fila: TData) => void;
  onEliminar?: (fila: TData) => void;
  seleccionable?: boolean;
  detalleFila?: (props: { row: MRT_Row<TData> }) => ReactNode;
  filtrosAvanzados?: boolean;
  fijarColumnas?: boolean;
}

/** Escapa un valor para CSV: comillas dobladas y campo entrecomillado. */
function celdaCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function UiTabla<TData extends MRT_RowData>({
  columnas, datos, opciones, titulo, cargando, habilitarExportacion,
  onEditar, onEliminar, seleccionable = true, detalleFila,
  filtrosAvanzados = false, fijarColumnas = false,
}: TablaProps<TData>) {
  const hayAcciones = !!onEditar || !!onEliminar;

  const exportar = () => {
    const cabeceras = columnas.map((c) => String(c.header ?? ''));
    const claves = columnas.map((c) => (c as { accessorKey?: string }).accessorKey);
    const filas = datos.map((d) =>
      claves.map((k) => celdaCsv(k ? (d as Record<string, unknown>)[k] : '')).join(','),
    );
    const csv = [cabeceras.map(celdaCsv).join(','), ...filas].join('\r\n');
    // El BOM hace que Excel abra el archivo en UTF-8 y no rompa las tildes.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titulo || 'datos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabla = useMaterialReactTable({
    columns: columnas,
    data: datos,
    localization: MRT_Localization_ES,

    enableRowSelection: seleccionable,
    enableRowActions: hayAcciones,
    enableColumnFilters: filtrosAvanzados,
    enableColumnPinning: fijarColumnas,
    enableExpanding: !!detalleFila,
    renderDetailPanel: detalleFila,

    state: { isLoading: !!cargando },

    muiTablePaperProps: {
      elevation: 0,
      sx: {
        border: '1px solid var(--ui-borde)',
        borderRadius: 'var(--ui-r-lg)',
        overflow: 'hidden',
        backgroundColor: 'var(--ui-superficie)',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: 'var(--ui-superficie-2)',
        color: 'var(--ui-texto-2)',
        fontWeight: 600,
        borderBottom: '1px solid var(--ui-borde)',
      },
    },
    muiTableBodyCellProps: {
      sx: { color: 'var(--ui-texto)', borderColor: 'var(--ui-borde-sutil)' },
    },
    muiTableBodyRowProps: { hover: true },

    renderRowActions: hayAcciones
      ? ({ row }) => (
          <Box sx={{ display: 'flex', gap: '2px' }}>
            {onEditar && (
              <Tooltip title="Editar">
                <IconButton size="small" onClick={() => onEditar(row.original)}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                </IconButton>
              </Tooltip>
            )}
            {onEliminar && (
              <Tooltip title="Eliminar">
                <IconButton
                  size="small"
                  sx={{ color: 'var(--ui-peligro)' }}
                  onClick={() => onEliminar(row.original)}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )
      : undefined,

    renderTopToolbarCustomActions: titulo || habilitarExportacion
      ? () => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            {titulo && (
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ui-texto)' }}>
                {titulo}
              </span>
            )}
            {habilitarExportacion && (
              <Tooltip title="Descargar CSV">
                <IconButton size="small" onClick={exportar} aria-label="Descargar CSV">
                  <span className="material-symbols-rounded" style={{ fontSize: 19 }}>download</span>
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )
      : undefined,

    // Lo que llegue en `opciones` manda: es la vía de escape por página.
    ...(opciones as object),
  });

  return <MaterialReactTable table={tabla} />;
}

/* Los tipos MRT_* no se reexportan aquí: ya llegan por el `export *` de
   arriba, y repetirlos daría un conflicto de exportación duplicada. */
