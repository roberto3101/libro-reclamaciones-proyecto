import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UiPila } from '@/ui';
import { UiBoton, UiInsignia, UiAlerta, type InsigniaColor } from '@/ui';
import { UiTabla, type MRT_ColumnDef, MRT_ToggleGlobalFilterButton, MRT_ToggleFiltersButton } from '@/ui/datos/Tabla';
import { Box, Typography, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { usarSolicitudesAsesor } from '../ganchos/usarSolicitudesAsesor';
import { solicitudesAsesorApi } from '../api/solicitudes-asesor.api';
import { DetalleSolicitud } from '../componentes/DetalleSolicitud';
import type { SolicitudAsesor, EstadoSolicitud, PrioridadSolicitud } from '@/tipos/solicitud-asesor';
import { formatoFechaHora, formatoRelativo } from '@/aplicacion/helpers/formato';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaAtencionVivo } from '@/componentes/ui/guias-contenido';

// ── Colores de dominio ──

const COLORES_ESTADO: Record<EstadoSolicitud, { bg: string; color: string; label: string; insignia: InsigniaColor }> = {
  PENDIENTE: { bg: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', label: 'Pendiente', insignia: 'advertencia' },
  EN_ATENCION: { bg: 'var(--ui-info-suave-2)', color: 'var(--ui-info-texto)', label: 'En Atención', insignia: 'info' },
  RESUELTO: { bg: 'var(--ui-exito-suave-2)', color: 'var(--ui-exito-texto)', label: 'Resuelto', insignia: 'exito' },
  CANCELADO: { bg: 'var(--ui-hover)', color: 'var(--ui-texto-2)', label: 'Cancelado', insignia: 'secundario' },
};

const COLORES_PRIORIDAD: Record<PrioridadSolicitud, { bg: string; color: string; insignia: InsigniaColor }> = {
  BAJA: { bg: 'var(--ui-hover)', color: 'var(--ui-texto-2)', insignia: 'secundario' },
  NORMAL: { bg: 'var(--ui-info-suave-2)', color: 'var(--ui-info-texto)', insignia: 'info' },
  ALTA: { bg: 'var(--ui-adv-suave)', color: 'var(--ui-adv-texto)', insignia: 'advertencia' },
  URGENTE: { bg: 'var(--ui-peligro-suave)', color: 'var(--ui-peligro-texto)', insignia: 'error' },
};

const COLORES_CANAL: Record<string, InsigniaColor> = {
  WHATSAPP: 'exito',
  WEB: 'info',
  TELEFONO: 'secundario',
};

type FiltroVista = 'abiertas' | 'resueltas' | 'canceladas' | 'mis';

export default function PaginaSolicitudesAsesor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { solicitudes, cargando, pendientes, recargar } = usarSolicitudesAsesor();
  const [solicitudDetalle, setSolicitudDetalle] = useState<SolicitudAsesor | null>(null);

  useEffect(() => {
    const solicitudIdParam = searchParams.get('solicitud');
    if (solicitudIdParam && solicitudes.length > 0 && !solicitudDetalle) {
      const encontrada = solicitudes.find((s) => s.id === solicitudIdParam);
      if (encontrada) {
        setSolicitudDetalle(encontrada);
        setSearchParams({}, { replace: true });
      } else {
        solicitudesAsesorApi.obtener(solicitudIdParam)
          .then((sol) => { if (sol) setSolicitudDetalle(sol); })
          .catch(() => {})
          .finally(() => setSearchParams({}, { replace: true }));
      }
    }
  }, [searchParams, solicitudes, solicitudDetalle, setSearchParams]);
  const [filtro, setFiltro] = useState<FiltroVista>('abiertas');
  const [datosExtra, setDatosExtra] = useState<SolicitudAsesor[]>([]);
  const [cargandoExtra, setCargandoExtra] = useState(false);

  // Cargar datos según filtro
  const cambiarFiltro = async (nuevoFiltro: FiltroVista) => {
    setFiltro(nuevoFiltro);
    if (nuevoFiltro === 'abiertas') {
      recargar();
      return;
    }

    setCargandoExtra(true);
    try {
      let datos: SolicitudAsesor[] = [];
      if (nuevoFiltro === 'resueltas') datos = await solicitudesAsesorApi.listarPorEstado('RESUELTO');
      else if (nuevoFiltro === 'canceladas') datos = await solicitudesAsesorApi.listarPorEstado('CANCELADO');
      else if (nuevoFiltro === 'mis') datos = await solicitudesAsesorApi.misSolicitudes();
      setDatosExtra(datos || []);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargandoExtra(false);
    }
  };

  const datosTabla = filtro === 'abiertas' ? solicitudes : datosExtra;
  const estaCargando = filtro === 'abiertas' ? cargando : cargandoExtra;

  // Contadores
  const contadores = useMemo(() => ({
    pendientes: solicitudes.filter(s => s.estado === 'PENDIENTE').length,
    enAtencion: solicitudes.filter(s => s.estado === 'EN_ATENCION').length,
  }), [solicitudes]);

  // Tomar rápido desde la tabla
  const tomarRapido = async (solicitud: SolicitudAsesor) => {
    try {
      await solicitudesAsesorApi.tomar(solicitud.id);
      notificar.exito(`Solicitud de ${solicitud.nombre} tomada`);
      recargar();
    } catch (error) {
      manejarError(error);
    }
  };

const columnas = useMemo<MRT_ColumnDef<SolicitudAsesor>[]>(
    () => [
      {
        accessorKey: 'nombre',
        header: 'Solicitante',
        size: 200,
        grow: 1,
        Cell: ({ row }) => {
          const cp = COLORES_PRIORIDAD[row.original.prioridad];
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Tooltip title={`Prioridad: ${row.original.prioridad}`}>
                <Box sx={{ width: 4, minHeight: 36, borderRadius: 1, bgcolor: cp.color, flexShrink: 0 }} />
              </Tooltip>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
                  {row.original.nombre}
                </Typography>
                <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ fontSize: '11px' }}>
                  {row.original.telefono}
                </Typography>
              </Box>
            </Box>
          );
        },
      },
      {
        accessorKey: 'motivo',
        header: 'Motivo',
        size: 220,
        grow: 2,
        Cell: ({ cell }) => (
          <Tooltip title={cell.getValue<string>()}>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '100%', display: 'block', fontSize: '13px' }}>
              {cell.getValue<string>()}
            </Typography>
          </Tooltip>
        ),
      },
      {
        accessorKey: 'canal_origen',
        header: 'Canal',
        size: 110,
        grow: 1,
        muiTableBodyCellProps: { align: 'center' },
        muiTableHeadCellProps: { align: 'center' },
        Cell: ({ cell }) => {
          const valor = cell.getValue<string>();
          return (
            <Box sx={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
              <UiInsignia
                contenido={valor}
                color={COLORES_CANAL[valor] || 'secundario'}
                variante="estandar"
                superposicion="rectangular"
              />
            </Box>
          );
        },
      },
      {
        accessorKey: 'estado',
        header: 'Estado',
        size: 130,
        grow: 1,
        muiTableBodyCellProps: { align: 'center' },
        muiTableHeadCellProps: { align: 'center' },
        Cell: ({ cell }) => {
          const valor = cell.getValue<EstadoSolicitud>();
          const ce = COLORES_ESTADO[valor];
          return (
            <Box sx={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
              <UiInsignia
                contenido={ce.label}
                color={ce.insignia}
                variante="estandar"
                superposicion="rectangular"
              />
            </Box>
          );
        },
      },
      {
        id: 'asignado',
        accessorKey: 'nombre_asesor',
        header: 'Asignado',
        size: 155,
        grow: 1,
        Cell: ({ row }) => {
          const nombre = row.original.nombre_asesor;
          if (!nombre) {
            return (
              <Typography variant="caption" sx={{ color: 'var(--ui-texto-3)', fontStyle: 'italic', fontSize: '12px' }}>
                Sin asignar
              </Typography>
            );
          }
          const iniciales = nombre.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();
          return (
            <Tooltip
              title={
                <Box sx={{ p: 0.8, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>
                    {nombre}
                  </Typography>
                  <Box sx={{ width: 32, height: 2, bgcolor: 'rgba(92,138,79,0.6)', borderRadius: 1, mx: 'auto', my: 0.6 }} />
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                    Asesor asignado
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
              enterDelay={200}
              leaveDelay={100}
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: '#131210',
                    borderRadius: 'var(--ui-r-xl)',
                    px: 2,
                    py: 1.2,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    animation: 'tooltipEntrada 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  },
                },
                arrow: {
                  sx: {
                    color: '#131210',
                    '&::before': { border: '1px solid rgba(255,255,255,0.08)' },
                  },
                },
              }}
            >
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
                px: 0.8, py: 0.4, borderRadius: 2,
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                '&:hover': { bgcolor: 'var(--ui-exito-suave)' },
              }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%',
                  bgcolor: 'var(--ui-exito-suave-2)', color: 'var(--ui-exito-texto)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px',
                  border: '2px solid var(--ui-exito-borde)', flexShrink: 0,
                }}>
                  {iniciales}
                </Box>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui-texto)' }} noWrap>
                    {nombre}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'fecha_creacion',
        header: 'Creado',
        size: 160,
        grow: 1,
        Cell: ({ cell }) => (
          <Box>
            <Typography variant="body2" sx={{ color: 'var(--ui-texto)', fontSize: '13px' }}>
              {formatoFechaHora(cell.getValue<string>())}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', fontSize: '11px', mt: 0.3 }}>
              {formatoRelativo(cell.getValue<string>())}
            </Typography>
          </Box>
        ),
      },
    ],
    [],
  );

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* ── Header ── */}
      <UiPila direccion="fila" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <h2 className="m-0 text-xl font-bold" style={{ color: 'var(--ui-texto)' }}>Atención en Vivo</h2>
            {pendientes > 0 && (
              <Box sx={{
                px: 1.2, py: 0.3, borderRadius: 3, bgcolor: 'var(--ui-peligro-suave)', color: 'var(--ui-peligro-texto)',
                fontWeight: 800, fontSize: '13px', animation: 'pulse 2s infinite',
              }}>
                {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Gestiona las solicitudes de atención personalizada de tus clientes.
          </Typography>
        </Box>
      </UiPila>

      <GuiaModulo {...guiaAtencionVivo} />

      {/* ── KPI cards ── */}
      {solicitudes.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ px: 3, py: 1.5, bgcolor: 'var(--ui-adv-suave)', borderRadius: 2, border: '1px solid var(--ui-adv-borde)', flex: '1 1 140px', minWidth: 140 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: 'var(--ui-adv-texto)', textTransform: 'uppercase', fontSize: '10px' }}>
              Pendientes
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: 'var(--ui-adv-texto)' }}>{contadores.pendientes}</Typography>
          </Box>
          <Box sx={{ px: 3, py: 1.5, bgcolor: 'var(--ui-info-suave-2)', borderRadius: 2, border: '1px solid var(--ui-info-borde)', flex: '1 1 140px', minWidth: 140 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: 'var(--ui-info-texto)', textTransform: 'uppercase', fontSize: '10px' }}>
              En Atención
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: 'var(--ui-info-texto)' }}>{contadores.enAtencion}</Typography>
          </Box>
          <Box sx={{ px: 3, py: 1.5, bgcolor: 'var(--ui-exito-suave)', borderRadius: 2, border: '1px solid var(--ui-exito-borde)', flex: '1 1 140px', minWidth: 140 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: 'var(--ui-exito-texto)', textTransform: 'uppercase', fontSize: '10px' }}>
              Total Abiertas
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: 'var(--ui-exito-texto)' }}>{solicitudes.length}</Typography>
          </Box>
        </Box>
      )}

      {/* ── Filtros ── */}
      <Box>
        <ToggleButtonGroup
          value={filtro}
          exclusive
          onChange={(_, val) => val && cambiarFiltro(val as FiltroVista)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none', fontSize: '13px', fontWeight: 600,
              px: 2, py: 0.6, borderColor: 'var(--ui-borde)',
              '&.Mui-selected': { bgcolor: 'var(--ui-hover)', color: 'var(--ui-info-texto)' },
            },
          }}
        >
          <ToggleButton value="abiertas">Abiertas ({solicitudes.length})</ToggleButton>
          <ToggleButton value="mis">Mis Solicitudes</ToggleButton>
          <ToggleButton value="resueltas">Resueltas</ToggleButton>
          <ToggleButton value="canceladas">Canceladas</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Sin datos ── */}
      {datosTabla.length === 0 && !estaCargando && (
        <UiAlerta
          variante="info"
          titulo={filtro === 'abiertas' ? 'Sin solicitudes pendientes' : 'Sin resultados'}
          descripcion={
            filtro === 'abiertas'
              ? 'No hay solicitudes de atención abiertas. Las nuevas llegarán automáticamente desde WhatsApp o puedes crear una manualmente.'
              : 'No se encontraron solicitudes con este filtro.'
          }
        />
      )}

      {/* ── Tabla ── */}
      <UiTabla
        titulo="Solicitudes"
        columnas={columnas}
        datos={datosTabla}
        cargando={estaCargando}
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
          muiTableBodyRowProps: ({ row }) => ({
            sx: {
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              '&:hover': { backgroundColor: 'var(--ui-superficie-2)' },
              // Highlight urgentes
              ...(row.original.prioridad === 'URGENTE' && row.original.estado === 'PENDIENTE'
                ? { backgroundColor: 'var(--ui-peligro-suave)' }
                : {}),
            },
            onClick: () => setSolicitudDetalle(row.original),
          }),
          initialState: {
            density: 'compact',
            pagination: { pageSize: 15, pageIndex: 0 },
            sorting: [{ id: 'fecha_creacion', desc: true }],
          },
        }}
      />


      {/* ── Modal detalle ── */}
      <DetalleSolicitud
        abierto={!!solicitudDetalle}
        solicitud={solicitudDetalle}
        alCerrar={() => setSolicitudDetalle(null)}
        alActualizar={() => {
          setSolicitudDetalle(null);
          recargar();
        }}
      />

      {/* ── Pulse animation for pending badge ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes tooltipEntrada {
          from { opacity: 0; transform: scale(0.92) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </UiPila>
  );
}