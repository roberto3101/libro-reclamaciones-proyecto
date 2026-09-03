import { useState, useEffect, useCallback, useMemo } from 'react';
import { superadminApi } from '@/api/superadmin';

type TabActivo = 'empresas' | 'superadmin' | 'guia';

// Helpers de fecha (YYYY-MM-DD para inputs type=date)
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function restarDias(isoFecha: string, dias: number): string {
  const d = new Date(isoFecha + 'T00:00:00');
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function diferenciaDias(desde: string, hasta: string): number {
  const a = new Date(desde + 'T00:00:00').getTime();
  const b = new Date(hasta + 'T00:00:00').getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// Dispara la descarga de un blob con un nombre de archivo dado.
function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberamos la URL en el siguiente tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Abre una ventana con el HTML del historial y dispara print. Los datos ya
// deben venir cargados — esta función no habla con el backend. El caller es
// responsable de traer todos los registros del rango.
function imprimirPDF(datos: any[], rangoDesde: string, rangoHasta: string) {
  const fecha = new Date().toLocaleString('es-PE');
  const filas = datos.map(e => `<tr>
    <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${new Date(e.fecha).toLocaleString('es-PE')}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;font-weight:bold">${e.usuario_nombre || '—'}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${e.empresa_nombre || '—'}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${e.accion}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${e.entidad}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;font-family:monospace">${e.ip_address || '—'}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Historial de Actividad</title>
    <style>body{font-family:-apple-system,sans-serif;padding:40px;color:#302d27;max-width:1000px;margin:0 auto}
    h1{font-size:20px}
    .sub{color:#857e70;font-size:12px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;padding:6px 8px;border-bottom:2px solid #e5e0d4;font-size:10px;text-transform:uppercase;color:#857e70}
    .footer{margin-top:30px;font-size:10px;color:#aca596;text-align:center}
    @media print{body{padding:20px}}</style></head>
    <body><h1>Historial de Actividad</h1><p class="sub">Generado el ${fecha} · ${datos.length} registros · Rango ${rangoDesde} a ${rangoHasta} · Libro de Reclamaciones</p>
    <table><thead><tr><th>Fecha</th><th>Usuario</th><th>Empresa</th><th>Acción</th><th>Entidad</th><th>IP</th></tr></thead><tbody>${filas}</tbody></table>
    <div class="footer">Libro de Reclamaciones · ${new Date().getFullYear()}</div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

// Acciones realmente cableadas en los controllers del tenant.
// CREAR_RECLAMO no se incluye porque el endpoint público no tiene usuario_id
// y la columna `auditoria_admin.usuario_id` es NOT NULL — ya queda trazado
// vía `reclamos.fecha_registro`.
// ACTIVAR_SUSCRIPCION / CANCELAR_SUSCRIPCION no tienen handler propio en
// el panel del tenant todavía (solo el SA las opera) — añádelos cuando
// integres facturación y crees los endpoints correspondientes.
const ACCIONES_EMPRESA = [
  'LOGIN', 'LOGOUT', 'RESPONDER', 'CAMBIAR_ESTADO', 'ASIGNAR',
  'EXPORTAR', 'CONFIGURAR', 'CREAR_USUARIO', 'DESACTIVAR_USUARIO',
  'CREAR_CHATBOT', 'GENERAR_API_KEY', 'REVOCAR_API_KEY', 'CAMBIAR_PLAN',
];

const ACCIONES_SA = [
  'CREAR_CUENTA', 'EDITAR_CUENTA', 'DESACTIVAR_CUENTA',
  'CREAR_EMPRESA', 'ACTIVAR_EMPRESA', 'DESACTIVAR_EMPRESA', 'CAMBIAR_PLAN',
  'EDITAR_USUARIO', 'DESACTIVAR_USUARIO', 'RESETEAR_PASSWORD', 'IMPERSONAR',
  'CREAR_PLAN', 'EDITAR_PLAN', 'CREAR_STAFF', 'LOGIN', 'BUSCAR',
];

const LIMITE = 30;

function badgeColor(accion: string) {
  if (accion.startsWith('CREAR') || accion === 'ACTIVAR_EMPRESA' || accion === 'ACTIVAR_SUSCRIPCION') return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
  if (accion.startsWith('EDITAR') || accion === 'CONFIGURAR' || accion === 'CAMBIAR_PLAN' || accion === 'ASIGNAR' || accion === 'RESPONDER' || accion === 'CAMBIAR_ESTADO') return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
  if (accion.startsWith('DESACTIVAR') || accion === 'CANCELAR_SUSCRIPCION' || accion === 'REVOCAR_API_KEY') return 'bg-red-600/20 text-red-500';
  if (accion === 'IMPERSONAR') return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
  if (accion === 'LOGIN' || accion === 'LOGOUT') return 'bg-slate-500/20 text-slate-700 dark:text-slate-300';
  if (accion === 'RESETEAR_PASSWORD') return 'bg-orange-500/20 text-orange-400';
  if (accion === 'EXPORTAR') return 'bg-violet-500/20 text-violet-400';
  return 'bg-slate-600/20 text-slate-700 dark:text-slate-300';
}

function fmtFecha(f: string) {
  try { return new Date(f).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return f; }
}

// Máximo rango de días permitido por el backend. Si aumenta allá, hay que
// sincronizarlo aquí.
const MAX_RANGO_LISTADO_DIAS = 365;
const MAX_RANGO_EXPORT_DIAS = 90;

// Un PDF con más de esto es ilegible y tumba el renderer del browser.
// Por encima, obligamos al usuario a usar CSV.
const MAX_FILAS_PDF = 5000;

export default function SAActividad() {
  const [tab, setTab] = useState<TabActivo>('empresas');

  // Shared data
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [empresasPorCuenta, setEmpresasPorCuenta] = useState<any[]>([]);

  // Empresas activity
  const [actEmpresa, setActEmpresa] = useState<any[]>([]);
  const [totalEmpresa, setTotalEmpresa] = useState(0);
  const [offsetEmpresa, setOffsetEmpresa] = useState(0);
  const [filtroCuenta, setFiltroCuenta] = useState('');
  const [filtroTenant, setFiltroTenant] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [cargandoEmpresa, setCargandoEmpresa] = useState(false);

  // Rango de fechas (default: últimos 7 días). El backend exige que siempre
  // se envíe un rango para que el índice por fecha acote el scan.
  const [fechaHasta, setFechaHasta] = useState<string>(() => hoyISO());
  const [fechaDesde, setFechaDesde] = useState<string>(() => restarDias(hoyISO(), 7));
  const [errorRango, setErrorRango] = useState<string>('');

  // Valida el rango seleccionado. Retorna el mensaje de error o cadena vacía.
  const rangoValido = useMemo(() => {
    if (!fechaDesde || !fechaHasta) return 'Selecciona un rango de fechas';
    const dias = diferenciaDias(fechaDesde, fechaHasta);
    if (dias < 0) return 'La fecha inicial debe ser anterior a la final';
    if (dias > MAX_RANGO_LISTADO_DIAS) return `Máximo ${MAX_RANGO_LISTADO_DIAS} días`;
    return '';
  }, [fechaDesde, fechaHasta]);

  // SA activity
  const [actSA, setActSA] = useState<any[]>([]);
  const [totalSA, setTotalSA] = useState(0);
  const [offsetSA, setOffsetSA] = useState(0);
  const [cargandoSA, setCargandoSA] = useState(false);

  // Exportación (streaming desde el backend)
  const [exportando, setExportando] = useState(false);
  const [bytesExportados, setBytesExportados] = useState(0);

  // Modal "Ver detalle" — puede mostrar una entrada de cualquiera de las dos tablas.
  // origen discrimina las columnas a renderizar.
  const [detalleModal, setDetalleModal] = useState<{ origen: 'empresas' | 'superadmin'; entry: any } | null>(null);

  const handleExportar = async (formato: 'csv' | 'json') => {
    if (exportando) return;
    if (rangoValido) { setErrorRango(rangoValido); return; }
    const diasRango = diferenciaDias(fechaDesde, fechaHasta);
    if (diasRango > MAX_RANGO_EXPORT_DIAS) {
      setErrorRango(`Las exportaciones se limitan a ${MAX_RANGO_EXPORT_DIAS} días. Reduce el rango.`);
      return;
    }
    setExportando(true);
    setBytesExportados(0);
    try {
      const filtros: any = { fecha_desde: fechaDesde, fecha_hasta: fechaHasta };
      if (filtroCuenta) filtros.cuenta_id = filtroCuenta;
      if (filtroTenant) filtros.tenant_id = filtroTenant;
      if (filtroAccion) filtros.accion = filtroAccion;
      const { blob, filename } = await superadminApi.descargarActividadEmpresas(
        formato,
        filtros,
        (bytes) => setBytesExportados(bytes),
      );
      descargarBlob(blob, filename);
    } catch (e: any) {
      setErrorRango(e?.message || 'Error exportando');
    } finally {
      setExportando(false);
    }
  };

  // PDF: pide los registros del rango al backend con cap silencioso de
  // MAX_FILAS_PDF. El backend respeta el orden descendente por fecha, así que
  // cuando hay muchos registros se obtienen los más recientes dentro del rango.
  // Reusa el endpoint de streaming JSON para materializar el HTML.
  const handleExportarPDF = async () => {
    if (exportando) return;
    if (rangoValido) { setErrorRango(rangoValido); return; }
    const diasRango = diferenciaDias(fechaDesde, fechaHasta);
    if (diasRango > MAX_RANGO_EXPORT_DIAS) {
      setErrorRango(`Las exportaciones se limitan a ${MAX_RANGO_EXPORT_DIAS} días. Reduce el rango.`);
      return;
    }
    setExportando(true);
    setBytesExportados(0);
    try {
      const filtros: any = {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        limite: MAX_FILAS_PDF,
      };
      if (filtroCuenta) filtros.cuenta_id = filtroCuenta;
      if (filtroTenant) filtros.tenant_id = filtroTenant;
      if (filtroAccion) filtros.accion = filtroAccion;
      const { blob } = await superadminApi.descargarActividadEmpresas(
        'json',
        filtros,
        (bytes) => setBytesExportados(bytes),
      );
      const texto = await blob.text();
      const datos = JSON.parse(texto)?.data ?? [];
      if (datos.length === 0) {
        setErrorRango('No hay registros en el rango seleccionado');
        return;
      }
      imprimirPDF(datos, fechaDesde, fechaHasta);
    } catch (e: any) {
      setErrorRango(e?.message || 'Error generando el PDF');
    } finally {
      setExportando(false);
    }
  };

  // Load cuentas
  useEffect(() => {
    superadminApi.listarCuentas(0, 200).then(r => setCuentas(r.data ?? [])).catch(() => {});
  }, []);

  // Load empresas when cuenta changes
  useEffect(() => {
    if (!filtroCuenta) { setEmpresasPorCuenta([]); setFiltroTenant(''); return; }
    superadminApi.obtenerCuenta(filtroCuenta).then((c: any) => {
      setEmpresasPorCuenta(c?.tenants ?? []);
      setFiltroTenant('');
    }).catch(() => setEmpresasPorCuenta([]));
  }, [filtroCuenta]);

  // Load empresa activity. Siempre envía rango de fecha — si es inválido no
  // hace el fetch para evitar mandarle al backend una petición que va a fallar.
  const cargarEmpresas = useCallback(async () => {
    if (rangoValido) { setActEmpresa([]); setTotalEmpresa(0); return; }
    setCargandoEmpresa(true);
    try {
      const filtros: any = { fecha_desde: fechaDesde, fecha_hasta: fechaHasta };
      if (filtroCuenta) filtros.cuenta_id = filtroCuenta;
      if (filtroTenant) filtros.tenant_id = filtroTenant;
      if (filtroAccion) filtros.accion = filtroAccion;
      const res = await superadminApi.listarActividadEmpresas(offsetEmpresa, LIMITE, filtros);
      setActEmpresa(res.data ?? []); setTotalEmpresa(res.total ?? 0);
    } catch { /* */ }
    setCargandoEmpresa(false);
  }, [offsetEmpresa, filtroCuenta, filtroTenant, filtroAccion, fechaDesde, fechaHasta, rangoValido]);

  useEffect(() => { if (tab === 'empresas') cargarEmpresas(); }, [cargarEmpresas, tab]);

  // Load SA activity
  const cargarSA = useCallback(async () => {
    setCargandoSA(true);
    try {
      const res = await superadminApi.listarAuditoria(offsetSA, LIMITE);
      setActSA(res.data ?? []); setTotalSA(res.total ?? 0);
    } catch { /* */ }
    setCargandoSA(false);
  }, [offsetSA]);

  useEffect(() => { if (tab === 'superadmin') cargarSA(); }, [cargarSA, tab]);

  // Reset offset on filter change (including date range)
  useEffect(() => { setOffsetEmpresa(0); }, [filtroCuenta, filtroTenant, filtroAccion, fechaDesde, fechaHasta]);

  // Limpia el mensaje de error cuando el rango vuelve a ser válido.
  useEffect(() => { if (!rangoValido) setErrorRango(''); }, [rangoValido]);

  const tabs = [
    { key: 'empresas' as const, label: 'Empresas', count: totalEmpresa },
    { key: 'superadmin' as const, label: 'SuperAdmin', count: totalSA },
    { key: 'guia' as const, label: 'Guía' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Historial de actividad</h1>

      {/* Tabs — responsive */}
      <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <nav className="flex gap-0 -mb-px min-w-max">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === t.key
                  ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                  : 'border-transparent text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-400'
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1 text-slate-600 dark:text-slate-400 text-[11px]">({t.count})</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* ═══ Tab: Empresas ═══ */}
      {tab === 'empresas' && (
        <div className="space-y-3">
          {/* Rango de fechas — obligatorio. El backend exige acotar la query por fecha. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                max={fechaHasta || undefined}
                onChange={e => setFechaDesde(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                min={fechaDesde || undefined}
                max={hoyISO()}
                onChange={e => setFechaHasta(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex gap-1">
              {[
                { label: '7d', dias: 7 },
                { label: '30d', dias: 30 },
                { label: '90d', dias: 90 },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => { const h = hoyISO(); setFechaHasta(h); setFechaDesde(restarDias(h, p.dias)); }}
                  className="text-[10px] font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition dark:text-slate-400"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {rangoValido && <span className="text-[11px] text-red-600">{rangoValido}</span>}
          </div>

          {/* Filtros — cuenta → empresa → acción */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={filtroCuenta} onChange={e => setFiltroCuenta(e.target.value)} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none max-w-[160px] sm:max-w-xs truncate">
              <option value="">Cuenta: Todas</option>
              {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {empresasPorCuenta.length > 0 && (
              <select value={filtroTenant} onChange={e => setFiltroTenant(e.target.value)} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none max-w-[160px] sm:max-w-xs truncate">
                <option value="">Empresa: Todas</option>
                {empresasPorCuenta.map((e: any) => <option key={e.tenant_id} value={e.tenant_id}>{e.razon_social}</option>)}
              </select>
            )}
            <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none">
              <option value="">Acción: Todas</option>
              {ACCIONES_EMPRESA.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-600 hidden sm:inline dark:text-slate-400">{totalEmpresa} registros</span>
              <div className="flex gap-1 items-center">
                {exportando && (
                  <span className="text-[10px] text-slate-600 animate-pulse dark:text-slate-400">
                    Descargando {(bytesExportados / 1024).toFixed(0)} KB…
                  </span>
                )}
                <button
                  disabled={exportando || !!rangoValido}
                  onClick={() => handleExportar('csv')}
                  className="text-[10px] font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed dark:text-slate-400"
                  title={`Exportar todos los registros del rango (máx ${MAX_RANGO_EXPORT_DIAS} días) a CSV`}
                >
                  CSV
                </button>
                <button
                  disabled={exportando || !!rangoValido}
                  onClick={() => handleExportar('json')}
                  className="text-[10px] font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed dark:text-slate-400"
                  title={`Exportar todos los registros del rango (máx ${MAX_RANGO_EXPORT_DIAS} días) a JSON`}
                >
                  JSON
                </button>
                <button
                  disabled={exportando || !!rangoValido || totalEmpresa === 0}
                  onClick={handleExportarPDF}
                  className="text-[10px] font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed dark:text-slate-400"
                  title={
                    totalEmpresa > MAX_FILAS_PDF
                      ? `Se exportarán los últimos ${MAX_FILAS_PDF.toLocaleString('es-PE')} movimientos del rango (hay ${totalEmpresa.toLocaleString('es-PE')}). Para el total usa CSV.`
                      : `Exportar los ${totalEmpresa} registros del rango a PDF`
                  }
                >
                  {totalEmpresa > MAX_FILAS_PDF
                    ? `PDF (últimos ${(MAX_FILAS_PDF / 1000).toFixed(0)}k)`
                    : 'PDF'}
                </button>
              </div>
            </div>
          </div>
          {errorRango && !rangoValido && (
            <div className="text-[11px] text-red-600 px-1">{errorRango}</div>
          )}

          {/* Tabla responsive */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
            {/* Desktop table */}
            <table className="w-full text-sm hidden sm:table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Fecha', 'Usuario', 'Empresa', 'Acción', 'Entidad', 'Detalles', 'IP', ''].map(c => (
                    <th key={c} className="text-left py-2 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargandoEmpresa ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 animate-pulse">
                      {Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-3"><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></td>)}
                    </tr>
                  ))
                ) : actEmpresa.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-600 dark:text-slate-400">Sin registros</td></tr>
                ) : actEmpresa.map(e => (
                  <tr
                    key={e.id}
                    onClick={() => setDetalleModal({ origen: 'empresas', entry: e })}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-sm cursor-pointer"
                  >
                    <td className="py-2 px-3 text-xs text-slate-600 whitespace-nowrap tabular-nums dark:text-slate-400">{fmtFecha(e.fecha)}</td>
                    <td className="py-2 px-3 text-xs font-medium text-slate-900 dark:text-white">{e.usuario_nombre || '—'}</td>
                    <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400">{e.empresa_nombre || '—'}</td>
                    <td className="py-2 px-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColor(e.accion)}`}>{e.accion}</span></td>
                    <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400">{e.entidad}</td>
                    <td className="py-2 px-3 text-xs text-slate-600 max-w-[220px] truncate dark:text-slate-400">{e.detalles ? formatearDetallePreview(e.detalles) : '—'}</td>
                    <td className="py-2 px-3 text-xs text-slate-600 font-mono dark:text-slate-400">{e.ip_address || '—'}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); setDetalleModal({ origen: 'empresas', entry: e }); }}
                        className="text-[10px] font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        title="Ver detalle completo"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {cargandoEmpresa ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-3 py-3 animate-pulse"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2" /><div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded" /></div>
                ))
              ) : actEmpresa.length === 0 ? (
                <p className="text-center py-10 text-slate-600 text-sm dark:text-slate-400">Sin registros</p>
              ) : actEmpresa.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDetalleModal({ origen: 'empresas', entry: e })}
                  className="block w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColor(e.accion)}`}>{e.accion}</span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400">{e.entidad}</span>
                    <span className="ml-auto text-[10px] text-slate-600 tabular-nums dark:text-slate-400">{fmtFecha(e.fecha)}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{e.usuario_nombre} — {e.empresa_nombre}</p>
                  {e.detalles && <p className="text-[10px] text-slate-600 truncate mt-0.5 dark:text-slate-400">{formatearDetallePreview(e.detalles)}</p>}
                </button>
              ))}
            </div>
          </div>

          <Paginacion offset={offsetEmpresa} total={totalEmpresa} limite={LIMITE} onChange={setOffsetEmpresa} />
        </div>
      )}

      {/* ═══ Tab: SuperAdmin ═══ */}
      {tab === 'superadmin' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm hidden sm:table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Fecha', 'Acción', 'Entidad', 'ID', 'Detalles', 'IP', ''].map(c => (
                    <th key={c} className="text-left py-2 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargandoSA ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 animate-pulse">
                      {Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-3"><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></td>)}
                    </tr>
                  ))
                ) : actSA.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-600 dark:text-slate-400">Sin acciones registradas</td></tr>
                ) : actSA.map(e => (
                  <tr
                    key={e.id}
                    onClick={() => setDetalleModal({ origen: 'superadmin', entry: e })}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-sm cursor-pointer"
                  >
                    <td className="py-2 px-3 text-xs text-slate-600 whitespace-nowrap tabular-nums dark:text-slate-400">{fmtFecha(e.fecha)}</td>
                    <td className="py-2 px-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColor(e.accion)}`}>{e.accion}</span></td>
                    <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400">{e.entidad}</td>
                    <td className="py-2 px-3 text-xs font-mono text-slate-600 max-w-[100px] truncate dark:text-slate-400">{e.entidad_id || '—'}</td>
                    <td className="py-2 px-3 text-xs text-slate-600 max-w-[220px] truncate dark:text-slate-400">{e.detalles ? formatearDetallePreview(e.detalles) : '—'}</td>
                    <td className="py-2 px-3 text-xs text-slate-600 font-mono dark:text-slate-400">{e.ip_address || '—'}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); setDetalleModal({ origen: 'superadmin', entry: e }); }}
                        className="text-[10px] font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        title="Ver detalle completo"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {cargandoSA ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-3 py-3 animate-pulse"><div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" /></div>)
              ) : actSA.length === 0 ? (
                <p className="text-center py-10 text-slate-600 text-sm dark:text-slate-400">Sin acciones</p>
              ) : actSA.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDetalleModal({ origen: 'superadmin', entry: e })}
                  className="block w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColor(e.accion)}`}>{e.accion}</span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400">{e.entidad}</span>
                    <span className="ml-auto text-[10px] text-slate-600 tabular-nums dark:text-slate-400">{fmtFecha(e.fecha)}</span>
                  </div>
                  {e.detalles && <p className="text-[11px] text-slate-600 truncate dark:text-slate-400">{formatearDetallePreview(e.detalles)}</p>}
                </button>
              ))}
            </div>
          </div>
          <Paginacion offset={offsetSA} total={totalSA} limite={LIMITE} onChange={setOffsetSA} />
        </div>
      )}

      {/* ═══ Tab: Guía ═══ */}
      {tab === 'guia' && (
        <div className="max-w-3xl space-y-5">
          <GuiaSection titulo="Acciones registradas por las empresas" acciones={ACCIONES_EMPRESA} descripcion="Estas acciones se registran automáticamente cuando los usuarios de cada empresa operan su panel." />
          <GuiaSection titulo="Acciones del SuperAdmin" acciones={ACCIONES_SA} descripcion="Se registran cuando el equipo interno opera desde este panel." />
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Cómo usar</h2>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>1. Selecciona una <strong>cuenta</strong> para ver solo sus empresas.</li>
              <li>2. Luego filtra por <strong>empresa</strong> específica dentro de esa cuenta.</li>
              <li>3. Filtra por <strong>acción</strong> (ej: LOGIN) para detectar accesos sospechosos.</li>
              <li>4. La tab "SuperAdmin" muestra qué hizo el equipo interno.</li>
              <li>5. Click en cualquier fila o en el botón <strong>Ver</strong> para inspeccionar el detalle completo.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal de detalle (render condicional) */}
      {detalleModal && (
        <DetalleModal
          origen={detalleModal.origen}
          entry={detalleModal.entry}
          onClose={() => setDetalleModal(null)}
        />
      )}
    </div>
  );
}

function GuiaSection({ titulo, acciones, descripcion }: { titulo: string; acciones: string[]; descripcion: string }) {
  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{titulo}</h2>
      <div className="flex flex-wrap gap-1.5">
        {acciones.map(a => <span key={a} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor(a)}`}>{a}</span>)}
      </div>
      <p className="text-xs text-slate-600 mt-3 dark:text-slate-400">{descripcion}</p>
    </div>
  );
}

function Paginacion({ offset, total, limite, onChange }: { offset: number; total: number; limite: number; onChange: (n: number) => void }) {
  if (total <= limite) return null;
  return (
    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
      <span className="hidden sm:inline">{offset + 1}–{Math.min(offset + limite, total)} de {total}</span>
      <span className="sm:hidden text-[11px]">{Math.floor(offset / limite) + 1}/{Math.ceil(total / limite)}</span>
      <div className="flex gap-2">
        <button disabled={offset === 0} onClick={() => onChange(offset - limite)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Ant</button>
        <button disabled={offset + limite >= total} onClick={() => onChange(offset + limite)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Sig</button>
      </div>
    </div>
  );
}

function safeParse(s: string) {
  try { return JSON.stringify(JSON.parse(s)).slice(0, 60); } catch { return s?.slice(0, 60) || '—'; }
}

// formatearDetallePreview convierte un JSON serializado en una línea legible
// "clave: valor · clave: valor" para mostrar como preview en la tabla.
// Si falla el parseo o viene vacío, devuelve '—'.
function formatearDetallePreview(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return String(raw).slice(0, 80);
    // Preferimos claves legibles si están presentes — eso mejora la lectura
    // del preview para las acciones auditadas con helpers enriquecedores.
    const prefs = [
      'codigo_reclamo', 'razon_social', 'cuenta_nombre', 'plan_nombre', 'plan_codigo',
      'usuario_objetivo_email', 'usuario_objetivo_nombre', 'email', 'nombre',
      'chatbot_nombre', 'staff_email', 'staff_nombre', 'accion_real', 'formato', 'registros',
      'nuevo_estado', 'rol_nuevo', 'rol', 'activo',
    ];
    const pares: string[] = [];
    for (const k of prefs) {
      if (k in obj && obj[k] !== null && obj[k] !== '') {
        pares.push(`${k}: ${String(obj[k])}`);
      }
    }
    // Rellenar con el resto de claves hasta completar un par más (máx 4)
    if (pares.length < 3) {
      for (const k of Object.keys(obj)) {
        if (prefs.includes(k)) continue;
        if (obj[k] === null || obj[k] === '' || typeof obj[k] === 'object') continue;
        pares.push(`${k}: ${String(obj[k])}`);
        if (pares.length >= 3) break;
      }
    }
    if (pares.length === 0) return safeParse(raw);
    const linea = pares.slice(0, 3).join(' · ');
    return linea.length > 140 ? linea.slice(0, 140) + '…' : linea;
  } catch {
    return String(raw).slice(0, 80);
  }
}

// formatearDetalleJSON pretty-prints el detalle JSONB serializado para
// mostrarlo dentro del modal. Si no es JSON válido devuelve el raw tal cual.
function formatearDetalleJSON(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function fmtFechaLarga(f: string) {
  try {
    return new Date(f).toLocaleString('es-PE', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return f;
  }
}

// DetalleModal renderiza el panel flotante con toda la información de una
// entrada de auditoría. Funciona tanto para auditoria_admin (tab Empresas)
// como para auditoria_superadmin (tab SuperAdmin) — usa `origen` para
// decidir qué campos mostrar.
function DetalleModal({
  origen,
  entry,
  onClose,
}: {
  origen: 'empresas' | 'superadmin';
  entry: any;
  onClose: () => void;
}) {
  // Cerrar con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const [copiado, setCopiado] = useState(false);
  const detallesJSON = formatearDetalleJSON(entry.detalles);

  const copiarJSON = async () => {
    if (!detallesJSON) return;
    try {
      await navigator.clipboard.writeText(detallesJSON);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* noop */ }
  };

  const campos: { label: string; value: string | null }[] = origen === 'empresas'
    ? [
        { label: 'Fecha', value: fmtFechaLarga(entry.fecha) },
        { label: 'Usuario', value: entry.usuario_nombre || '—' },
        { label: 'ID Usuario', value: entry.usuario_id || null },
        { label: 'Empresa', value: entry.empresa_nombre || '—' },
        { label: 'Tenant ID', value: entry.tenant_id || null },
        { label: 'Acción', value: entry.accion },
        { label: 'Entidad', value: entry.entidad },
        { label: 'ID Entidad', value: entry.entidad_id || null },
        { label: 'Dirección IP', value: entry.ip_address || '—' },
      ]
    : [
        { label: 'Fecha', value: fmtFechaLarga(entry.fecha) },
        { label: 'SuperAdmin ID', value: entry.superadmin_id || null },
        { label: 'Acción', value: entry.accion },
        { label: 'Entidad', value: entry.entidad },
        { label: 'ID Entidad', value: entry.entidad_id || null },
        { label: 'Dirección IP', value: entry.ip_address || '—' },
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeColor(entry.accion)}`}>
                {entry.accion}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">sobre {entry.entidad}</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Detalle de actividad
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 -m-1 dark:text-slate-400"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body scrolleable */}
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {/* Campos básicos en grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            {campos.map(f => (
              <div key={f.label}>
                <dt className="font-medium text-slate-600 uppercase tracking-wider text-[10px] dark:text-slate-400">{f.label}</dt>
                <dd className={`mt-0.5 text-slate-900 dark:text-white break-all ${f.label.includes('ID') || f.label === 'Dirección IP' ? 'font-mono text-[11px]' : ''}`}>
                  {f.value || <span className="text-slate-500 dark:text-slate-400">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          {/* Detalles JSONB */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Detalles (JSON)</span>
              {detallesJSON && (
                <button
                  type="button"
                  onClick={copiarJSON}
                  className="text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition dark:text-slate-400"
                >
                  {copiado ? 'Copiado ✓' : 'Copiar'}
                </button>
              )}
            </div>
            {detallesJSON ? (
              <pre className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap break-words">
                {detallesJSON}
              </pre>
            ) : (
              <p className="text-xs text-slate-500 italic dark:text-slate-400">Sin detalles adicionales</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
