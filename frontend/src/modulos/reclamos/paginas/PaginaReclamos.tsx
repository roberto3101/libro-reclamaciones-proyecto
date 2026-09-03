import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { UiPila } from '@/ui';
import { UiBoton } from '@/ui';
import { UiIconoRefrescar, UiIconoBuscar } from '@/ui';
import { usarReclamos } from '../ganchos/usarReclamos';
import { usarSedes } from '@/modulos/sedes/ganchos/usarSedes';
import { TablaReclamos } from '../componentes/TablaReclamos';
import { reclamosApi } from '../api/reclamos.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { usarAuth } from '@/aplicacion/ganchos/usarAuth';
import type { EstadoReclamo } from '@/tipos';
import { ESTADOS_RECLAMO } from '@/tipos/reclamo';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaReclamos } from '@/componentes/ui/guias-contenido';

/* ── Theme tokens ── */
const T = {
  text:    { color: 'var(--ui-texto)' } as CSSProperties,
  textSec: { color: 'var(--ui-texto-2)' } as CSSProperties,
  control: {
    backgroundColor: 'var(--ui-superficie)',
    borderColor: 'var(--ui-borde)',
    color: 'var(--ui-texto)',
  } as CSSProperties,
  badge: {
    backgroundColor: 'var(--ui-superficie-hundida)',
    borderColor: 'var(--ui-borde)',
    color: 'var(--ui-texto-2)',
  } as CSSProperties,
  activeBtn: {
    backgroundColor: 'var(--ui-primario, #b85528)',
    borderColor: 'var(--ui-primario, #b85528)',
    color: '#fffefb',
  } as CSSProperties,
};

type Periodo = '' | 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado';

const descargarBlob = (blob: Blob, nombre: string, tipo: string) => {
  const url = URL.createObjectURL(new Blob([blob], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
};

const construirParams = (
  sedeId: string,
  periodo: Periodo,
  fechaDesde: string,
  fechaHasta: string,
  busqueda: string,
  estado: string,
  proximosAVencer: boolean,
  clienteRegistrado: string,
) => {
  const params: Record<string, string> = {};
  if (sedeId) params.sede_id = sedeId;
  if (periodo && periodo !== 'personalizado') params.periodo = periodo;
  if (periodo === 'personalizado') {
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
  }
  if (busqueda.trim()) params.busqueda = busqueda.trim();
  if (estado) params.estado = estado;
  if (proximosAVencer) params.proximos_a_vencer = 'true';
  if (clienteRegistrado) params.es_cliente_registrado = clienteRegistrado;
  return params;
};

export default function PaginaReclamos() {
  const { usuario } = usarAuth();
  const sedeUsuario = usuario?.sede_ids?.[0] || '';
  const [sedeId, setSedeId] = useState(sedeUsuario);
  const [periodo, setPeriodo] = useState<Periodo>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null);
  const [estado, setEstado] = useState('');
  const [proximosAVencer, setProximosAVencer] = useState(false);
  const [clienteRegistrado, setClienteRegistrado] = useState('');

  // ── Búsqueda con debounce ──
  const [busquedaInput, setBusquedaInput] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setBusqueda(busquedaInput), 400);
    return () => clearTimeout(debounceRef.current);
  }, [busquedaInput]);

  const { sedes } = usarSedes();

  const filtrosTabla = construirParams(sedeId, periodo, fechaDesde, fechaHasta, busqueda, estado, proximosAVencer, clienteRegistrado);
  const { datos, cargando, pagina, cambiarPagina, recargar } = usarReclamos(
    1, 20, Object.keys(filtrosTabla).length > 0 ? filtrosTabla : undefined,
  );

  const exportar = async (formato: 'pdf' | 'excel') => {
    setExportando(formato);
    try {
      const params = construirParams(sedeId, periodo, fechaDesde, fechaHasta, busqueda, estado, proximosAVencer, clienteRegistrado);
      if (formato === 'pdf') {
        const blob = await reclamosApi.exportarPDF(params);
        descargarBlob(blob, `reclamos_${Date.now()}.pdf`, 'application/pdf');
      } else {
        const blob = await reclamosApi.exportarExcel(params);
        descargarBlob(blob, `reclamos_${Date.now()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
      notificar.exito(`${formato.toUpperCase()} descargado`);
    } catch {
      notificar.error(`Error al exportar ${formato.toUpperCase()}`);
    } finally {
      setExportando(null);
    }
  };

  const controlClass = 'py-2 px-3 rounded-lg border text-sm cursor-pointer outline-none transition-colors';
  const btnClass = (disabled: boolean) =>
    `flex items-center gap-1.5 py-2 px-3.5 rounded-lg border text-sm font-medium cursor-pointer transition-all hover-adaptive ${
      disabled ? 'opacity-60 cursor-not-allowed' : ''
    }`;

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="m-0 text-xl font-bold" style={T.text}>
          Gestión de Reclamos
        </h2>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Buscador */}
          <div className="relative flex-1 sm:flex-none sm:min-w-[220px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" style={T.textSec}>
              <UiIconoBuscar sx={{ fontSize: 16 }} />
            </span>
            <input
              type="text"
              value={busquedaInput}
              onChange={(e) => setBusquedaInput(e.target.value)}
              placeholder="Buscar reclamos..."
              className="w-full py-2 pl-8 pr-3 rounded-lg border text-sm outline-none transition-colors"
              style={T.control}
            />
          </div>

          {/* Filtro estado */}
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className={`${controlClass} min-w-[130px]`}
            style={T.control}
          >
            <option value="">Todos los estados</option>
            {(Object.entries(ESTADOS_RECLAMO) as [EstadoReclamo, { etiqueta: string }][]).map(
              ([key, { etiqueta }]) => (
                <option key={key} value={key}>{etiqueta}</option>
              ),
            )}
          </select>

          {/* Filtro de cliente registrado */}
          <select
            value={clienteRegistrado}
            onChange={(e) => setClienteRegistrado(e.target.value)}
            className={`${controlClass} min-w-[150px]`}
            style={T.control}
          >
            <option value="">Cliente registrado</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>

          {/* Filtro sede */}
          {sedeUsuario ? (
            <span
              className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border text-sm"
              style={T.badge}
            >
              {sedes.find((s) => s.id === sedeUsuario)?.nombre ?? 'Tu sede'}
            </span>
          ) : (
            <select
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              className={`${controlClass} min-w-[160px]`}
              style={T.control}
            >
              <option value="">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}

          {/* Filtro periodo */}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className={`${controlClass} min-w-[140px]`}
            style={T.control}
          >
            <option value="">Todo el periodo</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="anio">Este año</option>
            <option value="personalizado">Personalizado</option>
          </select>

          {/* Fechas personalizadas */}
          {periodo === 'personalizado' && (
            <>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="py-[7px] px-2.5 rounded-lg border text-sm outline-none w-[140px] transition-colors"
                style={T.control}
                title="Desde"
              />
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="py-[7px] px-2.5 rounded-lg border text-sm outline-none w-[140px] transition-colors"
                style={T.control}
                title="Hasta"
              />
            </>
          )}

          {/* Próximos a vencer */}
          <button
            onClick={() => setProximosAVencer((v) => !v)}
            className={`${controlClass} font-medium whitespace-nowrap`}
            style={proximosAVencer ? T.activeBtn : T.control}
          >
            Por vencer
          </button>

          {/* Exportar PDF */}
          <button
            onClick={() => exportar('pdf')}
            disabled={!!exportando}
            className={btnClass(!!exportando)}
            style={T.control}
          >
            {exportando === 'pdf' && (
              <div
                className="animate-spin rounded-full h-3.5 w-3.5 border-2"
                style={{ borderColor: 'var(--ui-borde)', borderTopColor: 'var(--ui-texto-2)' }}
              />
            )}
            PDF
          </button>

          {/* Exportar Excel */}
          <button
            onClick={() => exportar('excel')}
            disabled={!!exportando}
            className={btnClass(!!exportando)}
            style={T.control}
          >
            {exportando === 'excel' && (
              <div
                className="animate-spin rounded-full h-3.5 w-3.5 border-2"
                style={{ borderColor: 'var(--ui-borde)', borderTopColor: 'var(--ui-texto-2)' }}
              />
            )}
            Excel
          </button>

          {/* Actualizar */}
          <UiBoton
            texto="Actualizar"
            variante="contorno"
            iconoIzquierda={<UiIconoRefrescar />}
            alHacerClick={recargar}
          />
        </div>
      </div>

      <GuiaModulo {...guiaReclamos} />

      {/* ── Tabla ── */}
      <TablaReclamos
        reclamos={datos?.data ?? []}
        total={datos?.total_pages ?? 0}
        pagina={pagina}
        cargando={cargando}
        alCambiarPagina={cambiarPagina}
      />
    </UiPila>
  );
}
