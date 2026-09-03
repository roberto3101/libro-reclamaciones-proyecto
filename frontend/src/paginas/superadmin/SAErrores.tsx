import { useState, useEffect, useCallback, useRef } from 'react';
import { superadminApi } from '@/api/superadmin';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const POR_PAGINA = 30;
const SA_TOKEN_KEY = 'lr_sa_token';

type Tab = 'resumen' | 'consola' | 'rendimiento';

function exportarRendimientoPDF(datos: any[]) {
  const fecha = new Date().toLocaleString('es-PE');
  const filas = datos.map(r => {
    const estado = r.p95_ms < 200 ? 'OK' : r.p95_ms < 500 ? 'LENTO' : 'CRITICO';
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e0d4;font-family:monospace;font-size:11px">${r.metodo} ${r.ruta}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e0d4;text-align:right">${r.peticiones}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e0d4;text-align:right">${r.promedio_ms}ms</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e0d4;text-align:right;font-weight:bold;color:${r.p95_ms < 200 ? '#40613a' : r.p95_ms < 500 ? '#8a6112' : '#a3312a'}">${r.p95_ms}ms</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e0d4;text-align:right">${r.p99_ms}ms</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e0d4;text-align:center;color:${r.p95_ms < 200 ? '#40613a' : r.p95_ms < 500 ? '#8a6112' : '#a3312a'};font-weight:bold">${estado}</td>
    </tr>`;
  }).join('');

  const totalPeticiones = datos.reduce((s, r) => s + r.peticiones, 0);
  const promedioGlobal = datos.length > 0 ? Math.round(datos.reduce((s, r) => s + r.promedio_ms * r.peticiones, 0) / totalPeticiones) : 0;
  const rutasCriticas = datos.filter(r => r.p95_ms >= 500).length;
  const rutasLentas = datos.filter(r => r.p95_ms >= 200 && r.p95_ms < 500).length;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Rendimiento API</title>
    <style>body{font-family:-apple-system,sans-serif;padding:40px;color:#302d27;max-width:900px;margin:0 auto}
    h1{font-size:20px;margin-bottom:4px}
    .sub{color:#857e70;font-size:12px;margin-bottom:24px}
    .stats{display:flex;gap:16px;margin-bottom:24px}
    .stat{flex:1;border:1px solid #e5e0d4;border-radius: var(--ui-r-lg);padding:12px}
    .stat-label{font-size:10px;text-transform:uppercase;color:#857e70;letter-spacing:0.05em}
    .stat-value{font-size:22px;font-weight:bold;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;padding:8px 10px;border-bottom:2px solid #e5e0d4;font-size:10px;text-transform:uppercase;color:#857e70}
    .legend{margin-top:16px;font-size:11px;color:#857e70}
    @media print{body{padding:20px}}</style></head>
    <body>
      <h1>Reporte de Rendimiento API</h1>
      <p class="sub">Generado el ${fecha} · Datos de las últimas 24 horas</p>
      <div class="stats">
        <div class="stat"><div class="stat-label">Total peticiones</div><div class="stat-value">${totalPeticiones.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">Promedio global</div><div class="stat-value">${promedioGlobal}ms</div></div>
        <div class="stat"><div class="stat-label">Rutas lentas</div><div class="stat-value" style="color:#8a6112">${rutasLentas}</div></div>
        <div class="stat"><div class="stat-label">Rutas críticas</div><div class="stat-value" style="color:#a3312a">${rutasCriticas}</div></div>
      </div>
      <table>
        <thead><tr><th>Endpoint</th><th style="text-align:right">Peticiones</th><th style="text-align:right">Promedio</th><th style="text-align:right">Tiempo normal</th><th style="text-align:right">Peor caso</th><th style="text-align:center">Estado</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="legend"><strong>Tiempo normal</strong> = lo que tarda la mayoría de veces (95 de cada 100). <strong>Peor caso</strong> = lo máximo que puede tardar. Verde = rápido · Amarillo = lento · Rojo = crítico</div>
    </body></html>`;

  const ventana = window.open('', '_blank');
  if (!ventana) return;
  ventana.document.write(html);
  ventana.document.close();
  setTimeout(() => ventana.print(), 300);
}

function exportarResumenPDF(resumen: any, periodo: string, empresas: any[]) {
  const fecha = new Date().toLocaleString('es-PE');
  const nombreEmp = (tid: string) => empresas.find((e: any) => e.tenant_id === tid)?.razon_social || tid?.slice(0, 12);

  const filasRutas = (resumen.top_rutas ?? []).map((t: any) => `
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${t.ruta}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#a3312a">${t.count}</td></tr>`).join('');

  const filasEmpresas = (resumen.top_empresas ?? []).map((t: any) => `
    <tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${nombreEmp(t.tenant_id)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#a3312a">${t.count}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen de Errores</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#302d27;max-width:800px;margin:0 auto}
      h1{font-size:22px;margin-bottom:2px;color:#131210}
      .sub{color:#857e70;font-size:12px;margin-bottom:30px}
      .periodo{display:inline-block;background:#f1eee6;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;color:#55504a;margin-bottom:24px}
      .stats{display:flex;gap:16px;margin-bottom:30px}
      .stat{flex:1;border:1px solid #e5e0d4;border-radius: var(--ui-r-lg);padding:16px;text-align:center}
      .stat.alerta{border-color:#e5c2bc;background:#fbf0ee}
      .stat-label{font-size:10px;text-transform:uppercase;color:#857e70;letter-spacing:0.05em;margin-bottom:6px}
      .stat-value{font-size:28px;font-weight:800}
      .stat.alerta .stat-value{color:#a3312a}
      .section{margin-top:28px}
      .section h2{font-size:13px;text-transform:uppercase;color:#857e70;letter-spacing:0.05em;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e0d4}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{text-align:left;padding:8px 12px;border-bottom:2px solid #e5e0d4;font-size:10px;text-transform:uppercase;color:#857e70}
      .grid{display:flex;gap:20px}
      .grid>div{flex:1}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e0d4;font-size:10px;color:#aca596;text-align:center}
      @media print{body{padding:20px}}
    </style></head>
    <body>
      <h1>Resumen de Errores</h1>
      <p class="sub">Generado el ${fecha} · Libro de Reclamaciones</p>
      <div class="periodo">${periodo}</div>

      <div class="stats">
        <div class="stat ${resumen.errores_24h > 0 ? 'alerta' : ''}">
          <div class="stat-label">Errores en el período</div>
          <div class="stat-value">${resumen.errores_24h}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Rutas afectadas</div>
          <div class="stat-value">${resumen.top_rutas?.length ?? 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Empresas afectadas</div>
          <div class="stat-value">${resumen.top_empresas?.length ?? 0}</div>
        </div>
      </div>

      <div class="grid">
        <div class="section">
          <h2>Rutas con más errores</h2>
          ${filasRutas ? `<table><thead><tr><th>Ruta</th><th style="text-align:right">Errores</th></tr></thead><tbody>${filasRutas}</tbody></table>` : '<p style="color:#aca596;font-size:12px">Sin datos</p>'}
        </div>
        <div class="section">
          <h2>Empresas con más errores</h2>
          ${filasEmpresas ? `<table><thead><tr><th>Empresa</th><th style="text-align:right">Errores</th></tr></thead><tbody>${filasEmpresas}</tbody></table>` : '<p style="color:#aca596;font-size:12px">Sin datos</p>'}
        </div>
      </div>

      <div class="footer">Reporte generado automáticamente · Libro de Reclamaciones · ${new Date().getFullYear()}</div>
    </body></html>`;

  const ventana = window.open('', '_blank');
  if (!ventana) return;
  ventana.document.write(html);
  ventana.document.close();
  setTimeout(() => ventana.print(), 300);
}

export default function SAErrores() {
  const [tab, setTab] = useState<Tab>('resumen');

  const [resumen, setResumen] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineIntervalo, setTimelineIntervalo] = useState<'hora' | 'dia'>('hora');
  const [agrupados, setAgrupados] = useState<any[]>([]);
  const [totalAgrupados, setTotalAgrupados] = useState(0);
  const [errores, setErrores] = useState<any[]>([]);
  const [totalErrores, setTotalErrores] = useState(0);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [rendimiento, setRendimiento] = useState<any[]>([]);
  const [todasEmpresas, setTodasEmpresas] = useState<any[]>([]);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [empresasPorCuenta, setEmpresasPorCuenta] = useState<any[]>([]);

  const [pagina, setPagina] = useState(0);
  const [nivel, setNivel] = useState('');
  const [origen, setOrigen] = useState('');
  const [filtroCuenta, setFiltroCuenta] = useState('');
  const [filtroTenant, setFiltroTenant] = useState('');
  const [filtroFingerprint, setFiltroFingerprint] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [ordenAsc, setOrdenAsc] = useState(false);
  const [fechaResumen, setFechaResumen] = useState('hoy');
  const [fechaCustom, setFechaCustom] = useState('');

  const [expandido, setExpandido] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [wsConectado, setWsConectado] = useState(false);
  const [erroresVivo, setErroresVivo] = useState<any[]>([]);
  const [alertasAbiertas, setAlertasAbiertas] = useState(true);
  const [resaltando, setResaltando] = useState(false);

  const tablaRef = useRef<HTMLDivElement>(null);

  // ── Carga inicial ──
  useEffect(() => {
    superadminApi.listarCuentas(0, 200).then(r => setCuentas(r.data ?? [])).catch(() => {});
    superadminApi.listarEmpresas(0, 500).then(r => setTodasEmpresas(r.data ?? [])).catch(() => {});
    superadminApi.listarAlertasErrores().then(a => setAlertas(a ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!filtroCuenta) { setEmpresasPorCuenta([]); setFiltroTenant(''); return; }
    superadminApi.obtenerCuenta(filtroCuenta).then((c: any) => setEmpresasPorCuenta(c?.tenants ?? [])).catch(() => setEmpresasPorCuenta([]));
  }, [filtroCuenta]);

  // ── WebSocket ──
  useEffect(() => {
    const token = localStorage.getItem(SA_TOKEN_KEY);
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST ?? window.location.host.replace(':5173', ':8080').replace(':5174', ':8080');
    let ws: WebSocket; let intentos = 0; let timer: ReturnType<typeof setTimeout>;
    const conectar = () => {
      ws = new WebSocket(`${proto}//${host}/ws/superadmin/errores?token=${token}`);
      ws.onopen = () => { setWsConectado(true); intentos = 0; };
      ws.onclose = () => { setWsConectado(false); if (intentos < 10) { timer = setTimeout(conectar, Math.min(1000 * Math.pow(2, intentos++), 15000)); } };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => { try { const msg = JSON.parse(evt.data); if (msg.tipo === 'ERROR_LOG_NUEVO') setErroresVivo(prev => [msg.datos, ...prev].slice(0, 50)); if (msg.tipo === 'ERROR_ALERTA_NUEVA') setAlertas(prev => [msg.datos, ...prev]); } catch {} };
    };
    conectar();
    return () => { clearTimeout(timer); ws?.close(); };
  }, []);

  // ── Resumen + Timeline ──
  const rangoFechaResumen = useCallback(() => {
    const hoy = new Date();
    if (fechaCustom) {
      const desde = new Date(fechaCustom + 'T00:00:00');
      const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 1);
      return { desde: desde.toISOString(), hasta: hasta.toISOString() };
    }
    switch (fechaResumen) {
      case 'hoy': { const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); const h = new Date(d); h.setDate(h.getDate() + 1); return { desde: d.toISOString(), hasta: h.toISOString() }; }
      case 'ayer': { const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1); const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); return { desde: d.toISOString(), hasta: h.toISOString() }; }
      case '7d': { const d = new Date(hoy.getTime() - 7 * 86400000); return { desde: d.toISOString(), hasta: '' }; }
      case '30d': { const d = new Date(hoy.getTime() - 30 * 86400000); return { desde: d.toISOString(), hasta: '' }; }
      default: return { desde: '', hasta: '' };
    }
  }, [fechaResumen, fechaCustom]);

  const cargarResumen = useCallback(async () => {
    try {
      const { desde, hasta } = rangoFechaResumen();
      // Los mismos filtros que la consola/agrupados aplican al resumen y al
      // timeline para que las tarjetas y el gráfico se muevan en sincronía
      // con la lista de errores debajo.
      const filtrosGraficas: any = {};
      if (nivel) filtrosGraficas.nivel = nivel;
      if (origen) filtrosGraficas.origen = origen;
      if (filtroCuenta) filtrosGraficas.cuenta_id = filtroCuenta;
      if (filtroTenant) filtrosGraficas.tenant_id = filtroTenant;
      const [r, t] = await Promise.all([
        superadminApi.resumenErrores(desde, hasta, filtrosGraficas),
        superadminApi.timelineErrores(timelineIntervalo, timelineIntervalo === 'hora' ? 1 : 7, filtrosGraficas),
      ]);
      setResumen({ errores_24h: r?.errores_24h ?? 0, errores_7d: r?.errores_7d ?? 0, errores_30d: r?.errores_30d ?? 0, top_rutas: r?.top_rutas ?? [], top_empresas: r?.top_empresas ?? [] });
      setTimeline((t ?? []).map((p: any) => ({ ...p, hora: fmtPeriodo(p.periodo, timelineIntervalo) })));
    } catch {}
  }, [timelineIntervalo, rangoFechaResumen, nivel, origen, filtroCuenta, filtroTenant]);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  // ── Cargar datos por tab ──
  const filtrosAPI = useCallback(() => {
    const f: any = {};
    if (nivel) f.nivel = nivel;
    if (origen) f.origen = origen;
    if (filtroCuenta) f.cuenta_id = filtroCuenta;
    if (filtroTenant) f.tenant_id = filtroTenant;
    return f;
  }, [nivel, origen, filtroCuenta, filtroTenant]);

  const cargarErrores = useCallback(async () => {
    setCargando(true);
    try {
      if (tab === 'resumen') {
        const res = await superadminApi.listarErroresAgrupados(pagina * POR_PAGINA, POR_PAGINA, filtrosAPI());
        setAgrupados(res.data ?? []); setTotalAgrupados(res.total ?? 0);
      } else if (tab === 'consola') {
        const f = filtrosAPI();
        if (filtroFingerprint) f.fingerprint = filtroFingerprint;
        if (filtroDesde) {
          f.desde = filtroDesde;
          const hasta = new Date(new Date(filtroDesde).getTime() + (timelineIntervalo === 'hora' ? 3600000 : 86400000));
          f.hasta = hasta.toISOString();
        }
        const res = await superadminApi.listarErrores(pagina * POR_PAGINA, POR_PAGINA, f);
        const data = res.data ?? [];
        setErrores(ordenAsc ? [...data].reverse() : data);
        setTotalErrores(res.total ?? 0);
      }
    } catch {}
    setCargando(false);
  }, [pagina, tab, filtroFingerprint, filtroDesde, ordenAsc, filtrosAPI, timelineIntervalo]);
  useEffect(() => { if (tab !== 'rendimiento') cargarErrores(); }, [cargarErrores, tab]);
  useEffect(() => { setPagina(0); }, [nivel, origen, filtroCuenta, filtroTenant, tab, filtroFingerprint, filtroDesde]);

  useEffect(() => {
    if (tab === 'rendimiento') superadminApi.rendimientoAPI().then(r => setRendimiento(r ?? [])).catch(() => {});
  }, [tab]);

  const nombreEmpresa = (tid: string | null) => todasEmpresas.find((e: any) => e.tenant_id === tid)?.razon_social || null;
  const totalActual = tab === 'resumen' ? totalAgrupados : totalErrores;
  const totalPaginas = Math.max(1, Math.ceil(totalActual / POR_PAGINA));

  const alertasSinVer = alertas.filter(a => !a.visto);

  const etiquetaFechaResumen = () => {
    if (fechaCustom) return new Date(fechaCustom + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const hoy = new Date();
    switch (fechaResumen) {
      case 'hoy': return hoy.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
      case 'ayer': { const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1); return ayer.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }); }
      case '7d': return 'Últimos 7 días';
      case '30d': return 'Últimos 30 días';
      default: return '';
    }
  };

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Monitoreo</h1>
          <span className={`inline-flex items-center gap-1.5 text-xs mt-1 ${wsConectado ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${wsConectado ? 'bg-emerald-500 animate-pulse' : 'bg-red-600'}`} />
            {wsConectado ? 'En vivo' : 'Desconectado'}
            {erroresVivo.length > 0 && <span className="text-emerald-700 dark:text-emerald-400 font-medium ml-2">+{erroresVivo.length} nuevos</span>}
          </span>
        </div>
        <button onClick={() => { cargarErrores(); cargarResumen(); setErroresVivo([]); }} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Actualizar</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {[{ k: 'resumen' as Tab, l: 'Resumen' }, { k: 'consola' as Tab, l: 'Consola' }, { k: 'rendimiento' as Tab, l: 'Rendimiento' }].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); setFiltroFingerprint(''); }} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${tab === t.k ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-400'}`}>{t.l}</button>
        ))}
      </div>

      {/* ═══════════ TAB RESUMEN (dashboard ejecutivo) ═══════════ */}
      {tab === 'resumen' && (
        <>
          {/* Selector de fecha + exportar */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-600 dark:text-slate-400">Viendo errores de:</span>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {[
                { v: 'hoy', l: 'Hoy' },
                { v: 'ayer', l: 'Ayer' },
                { v: '7d', l: '7 días' },
                { v: '30d', l: '30 días' },
              ].map(d => (
                <button key={d.v} onClick={() => { setFechaResumen(d.v); setFechaCustom(''); }} className={`px-3 py-1 text-xs font-medium rounded-md transition ${fechaResumen === d.v && !fechaCustom ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-400'}`}>{d.l}</button>
              ))}
            </div>
            <input
              type="date"
              value={fechaCustom}
              onChange={(e) => { setFechaCustom(e.target.value); if (e.target.value) setFechaResumen('custom'); }}
              max={new Date().toISOString().split('T')[0]}
              className={`text-xs px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-800 outline-none transition ${fechaCustom ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">{etiquetaFechaResumen()}</span>
            {resumen && (
              <button onClick={() => exportarResumenPDF(resumen, etiquetaFechaResumen(), todasEmpresas)} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                Exportar PDF
              </button>
            )}
          </div>

          {/* Stats */}
          {resumen && (
            <div className="grid grid-cols-3 gap-4">
              {(fechaResumen === 'hoy' || fechaResumen === 'ayer' || fechaCustom) ? (
                <>
                  <CardStat etiqueta="Total del día" valor={resumen.errores_24h} alerta={resumen.errores_24h > 0} />
                  <CardStat etiqueta="Rutas afectadas" valor={resumen.top_rutas?.length ?? 0} />
                  <CardStat etiqueta="Empresas afectadas" valor={resumen.top_empresas?.length ?? 0} />
                </>
              ) : (
                <>
                  <CardStat etiqueta="Últimas 24 horas" valor={resumen.errores_24h} alerta={resumen.errores_24h > 0} />
                  <CardStat etiqueta="Últimos 7 días" valor={resumen.errores_7d} />
                  <CardStat etiqueta="Últimos 30 días" valor={resumen.errores_30d} />
                </>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Frecuencia de errores</h3>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                {(['hora', 'dia'] as const).map(i => (
                  <button key={i} onClick={() => setTimelineIntervalo(i)} className={`px-2.5 py-1 text-[11px] font-medium rounded transition ${timelineIntervalo === i ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>{i === 'hora' ? 'Por hora' : 'Por día'}</button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mb-2 dark:text-slate-400">Click en una barra para ver los errores de ese período en la consola</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={timeline} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d4" className="dark:stroke-slate-800" vertical={false} />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#857e70' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#857e70' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: '#131210', border: '1px solid #302d27', borderRadius: 'var(--ui-r-lg)', fontSize: 12, color: '#e5e0d4' }} labelStyle={{ color: '#aca596' }} itemStyle={{ color: '#e5e0d4' }} cursor={{ fill: 'rgba(184,58,50,0.08)' }} />
                <Bar
                  dataKey="conteo"
                  fill="#b83a32"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  name="Errores"
                  cursor="pointer"
                  onClick={(_data: any, _index: number, e: any) => {
                    const payload = e?.payload ?? _data;
                    if (payload?.periodo) {
                      setTab('consola');
                      setFiltroDesde(payload.periodo);
                      setPagina(0);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top errores + empresas */}
          {resumen && (resumen.top_rutas?.length > 0 || resumen.top_empresas?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {resumen.top_rutas?.length > 0 && <TopCard titulo="Rutas con más errores (7d)" items={resumen.top_rutas.map((t: any) => ({ label: t.ruta, count: t.count }))} />}
              {resumen.top_empresas?.length > 0 && <TopCard titulo="Empresas con más errores (7d)" items={resumen.top_empresas.map((t: any) => ({ label: nombreEmpresa(t.tenant_id) || t.tenant_id?.slice(0, 12), count: t.count }))} />}
            </div>
          )}

          {/* Acceso rápido */}
          {resumen && resumen.errores_24h > 0 && (
            <button onClick={() => setTab('consola')} className="w-full text-center py-3 text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 transition dark:text-slate-400">
              Ir a la consola para investigar errores →
            </button>
          )}
        </>
      )}

      {/* ═══════════ TAB CONSOLA (terminal oscuro) ═══════════ */}
      {tab === 'consola' && (
        <>
          {/* Alertas */}
          {alertasSinVer.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl overflow-hidden">
              <button onClick={() => setAlertasAbiertas(!alertasAbiertas)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />{alertasSinVer.length} alertas sin revisar</span>
                <svg className={`w-4 h-4 transition ${alertasAbiertas ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {alertasAbiertas && (
                <div className="px-4 pb-3 space-y-1">
                  <div className="flex justify-end"><button onClick={async () => { await superadminApi.marcarTodasAlertasVistas(); setAlertas(alertas.map(a => ({ ...a, visto: true }))); }} className="text-[11px] text-amber-600 hover:underline">Marcar todas</button></div>
                  {alertasSinVer.slice(0, 8).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-1.5 border-t border-amber-200/50 dark:border-amber-900/30 group">
                      <button onClick={() => { setFiltroFingerprint(a.fingerprint); setAlertasAbiertas(false); setTimeout(() => { setResaltando(true); tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400); setTimeout(() => setResaltando(false), 4000); }} className="flex items-start gap-2 min-w-0 text-left hover:opacity-80 transition" title="Filtrar por este error">
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${a.tipo === 'SPIKE' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>{a.tipo === 'SPIKE' ? 'PICO' : 'NUEVO'}</span>
                        <div className="min-w-0">
                          <p className="text-xs text-amber-900 dark:text-amber-200 truncate">{a.mensaje}</p>
                          <p className="text-[10px] text-amber-600/70">{a.tipo === 'SPIKE' ? 'Pico de ocurrencias' : 'Error nuevo'} · {tiempoRelativo(a.fecha)} · Click para filtrar</p>
                        </div>
                      </button>
                      <button onClick={async (ev) => { ev.stopPropagation(); await superadminApi.marcarAlertaVista(a.id); setAlertas(alertas.map(x => x.id === a.id ? { ...x, visto: true } : x)); }} className="text-[10px] text-amber-600 hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition">Descartar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {filtroFingerprint && (
              <button onClick={() => setFiltroFingerprint('')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Filtrado por grupo ×</button>
            )}
            <Sel value={nivel} onChange={setNivel} opciones={[{ v: '', l: 'Nivel: Todos' }, { v: 'ERROR', l: 'ERROR' }, { v: 'WARN', l: 'WARN' }, { v: 'PANIC', l: 'PANIC' }]} />
            <Sel value={origen} onChange={setOrigen} opciones={[{ v: '', l: 'Donde: Todos' }, { v: 'BACKEND', l: 'Backend' }, { v: 'FRONTEND', l: 'Frontend' }]} />
            <SelBuscable value={filtroCuenta} onChange={v => { setFiltroCuenta(v); setFiltroTenant(''); }} opciones={[{ v: '', l: 'Todas las cuentas' }, ...cuentas.map((c: any) => ({ v: c.id, l: c.nombre }))]} placeholder="Cuenta: Todas" />
            {empresasPorCuenta.length > 0 && <Sel value={filtroTenant} onChange={setFiltroTenant} opciones={[{ v: '', l: 'Empresa: Todas' }, ...empresasPorCuenta.map((e: any) => ({ v: e.tenant_id, l: e.razon_social }))]} />}
            {filtroDesde && (
              <button onClick={() => setFiltroDesde('')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {fmtPeriodo(filtroDesde, timelineIntervalo)} ×
              </button>
            )}
            <button onClick={() => setOrdenAsc(!ordenAsc)} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition" title="Cambiar orden">
              {ordenAsc ? '↑ Antiguos primero' : '↓ Recientes primero'}
            </button>
            <span className="ml-auto text-xs text-slate-600 tabular-nums dark:text-slate-400">{totalErrores} errores</span>
          </div>

          {/* Terminal */}
          <div ref={tablaRef} className={`bg-slate-950 rounded-xl border overflow-hidden font-mono text-xs transition-all duration-700 ${resaltando ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-[0_0_30px_rgba(195,148,51,0.15)]' : 'border-slate-800'}`}>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
              <span className="w-3 h-3 rounded-full bg-red-600" /><span className="w-3 h-3 rounded-full bg-amber-500" /><span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-slate-600 ml-2 dark:text-slate-400">Consola de errores — en vivo</span>
              {wsConectado && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-auto" />}
            </div>
            <div className="divide-y divide-slate-800/50 max-h-[60vh] overflow-y-auto">
              {cargando ? <div className="py-8 text-center text-slate-600 dark:text-slate-400">Cargando...</div>
              : errores.length === 0 ? <div className="py-8 text-center text-slate-600 dark:text-slate-400">Sin errores</div>
              : errores.map((e: any) => (
                <div key={e.id}>
                  <div onClick={() => setExpandido(expandido === e.id ? null : e.id)} className={`px-4 py-2.5 cursor-pointer transition hover:bg-slate-900/80 ${erroresVivo.find((v: any) => v.id === e.id) ? 'border-l-2 border-l-emerald-500' : ''} ${e.nivel === 'PANIC' ? 'bg-red-950/20' : ''}`}>
                    {/* Desktop */}
                    <div className="hidden sm:flex items-center gap-3">
                      <span className="text-slate-600 text-[11px] tabular-nums shrink-0 w-[65px] dark:text-slate-400">{fmtHora(e.fecha)}</span>
                      <BadgeNivel nivel={e.nivel} />
                      <span className={`text-[10px] font-medium shrink-0 ${e.origen === 'BACKEND' ? 'text-blue-400' : 'text-purple-400'}`}>{e.origen === 'BACKEND' ? 'BACK' : 'FRONT'}</span>
                      {e.status_code && <span className={`text-[11px] shrink-0 ${(e.status_code ?? 0) >= 500 ? 'text-red-500' : 'text-amber-400'}`}>{e.status_code}</span>}
                      <span className="text-slate-500 truncate dark:text-slate-400">{e.ruta && <span className="text-cyan-400 mr-1.5">{e.ruta}</span>}{e.mensaje}</span>
                    </div>
                    {/* Móvil */}
                    <div className="sm:hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-slate-600 text-[10px] tabular-nums dark:text-slate-400">{fmtHora(e.fecha)}</span>
                        <BadgeNivel nivel={e.nivel} />
                        <span className={`text-[10px] font-medium ${e.origen === 'BACKEND' ? 'text-blue-400' : 'text-purple-400'}`}>{e.origen === 'BACKEND' ? 'BACK' : 'FRONT'}</span>
                        {e.status_code && <span className={`text-[10px] ${(e.status_code ?? 0) >= 500 ? 'text-red-500' : 'text-amber-400'}`}>{e.status_code}</span>}
                      </div>
                      <p className="text-slate-500 text-[11px] truncate dark:text-slate-400">{e.ruta && <span className="text-cyan-400 mr-1">{e.ruta}</span>}{e.mensaje}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5 dark:text-slate-400">{new Date(e.fecha).toLocaleDateString('es-PE')}</p>
                    </div>
                  </div>

                  {expandido === e.id && (
                    <div className="bg-slate-900/60 border-t border-slate-800 px-4 py-4 space-y-4 font-sans text-sm">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <CampoDet etiqueta="Fecha completa" valor={new Date(e.fecha).toLocaleString('es-PE')} />
                        <CampoDet etiqueta="Ocurrió en" valor={e.origen === 'BACKEND' ? 'Backend (servidor Go)' : 'Frontend (navegador del usuario)'} />
                        {e.metodo && <CampoDet etiqueta="Petición HTTP" valor={`${e.metodo} ${e.ruta || ''} → ${e.status_code || ''}`} />}
                        {!e.metodo && e.ruta && <CampoDet etiqueta="Página del usuario" valor={e.ruta} />}
                        <CampoDet etiqueta="IP del usuario" valor={e.ip_address || 'Desconocida'} />
                        {e.tenant_id && <CampoDet etiqueta="Empresa afectada" valor={nombreEmpresa(e.tenant_id) || e.tenant_id} destacado />}
                      </div>
                      <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                        <p className="text-[11px] font-semibold text-red-500 uppercase mb-1">Mensaje de error</p>
                        <p className="text-sm text-red-300 leading-relaxed break-all">{e.mensaje}</p>
                      </div>
                      {e.breadcrumbs && <TimelineBreadcrumbs json={e.breadcrumbs} />}
                      {e.stack_trace && <div><p className="text-[11px] font-semibold text-slate-600 uppercase mb-1 dark:text-slate-400">Traza técnica</p><pre className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-red-500/80 text-[11px] font-mono max-h-48 overflow-auto whitespace-pre-wrap">{e.stack_trace}</pre></div>}
                      {e.request_body && <div><p className="text-[11px] font-semibold text-slate-600 uppercase mb-1 dark:text-slate-400">Datos enviados</p><pre className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-amber-400/80 text-[11px] font-mono max-h-32 overflow-auto whitespace-pre-wrap">{fmtJSON(e.request_body)}</pre></div>}
                      {e.user_agent && <p className="text-[11px] text-slate-600 dark:text-slate-400">Navegador: <span className="text-slate-600 dark:text-slate-400">{e.user_agent}</span></p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Paginacion pagina={pagina} totalPaginas={totalPaginas} setPagina={setPagina} />
        </>
      )}

      {/* ═══════════ TAB RENDIMIENTO ═══════════ */}
      {tab === 'rendimiento' && (
        <div className="space-y-5">
          {rendimiento.length > 0 && (
            <div className="flex justify-end">
              <button onClick={() => exportarRendimientoPDF(rendimiento)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                Exportar PDF
              </button>
            </div>
          )}
          {rendimiento.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Velocidad de respuesta por ruta (ms)</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, rendimiento.length * 32)}>
                <BarChart data={rendimiento.slice(0, 15)} layout="vertical" margin={{ left: 150 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#302d27" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#857e70' }} axisLine={false} tickLine={false} unit="ms" />
                  <YAxis dataKey="ruta" type="category" tick={{ fontSize: 10, fill: '#aca596' }} axisLine={false} tickLine={false} width={145} />
                  <Tooltip contentStyle={{ background: '#131210', border: '1px solid #302d27', borderRadius: 'var(--ui-r-lg)', fontSize: 12, color: '#e5e0d4' }} labelStyle={{ color: '#aca596' }} itemStyle={{ color: '#e5e0d4' }} formatter={(v) => [`${v} ms`, 'Tiempo normal']} />
                  <Bar dataKey="p95_ms" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {rendimiento.slice(0, 15).map((r: any, i: number) => <Cell key={i} fill={r.p95_ms < 200 ? '#5c8a4f' : r.p95_ms < 500 ? '#a67718' : '#b83a32'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Ruta</th>
                <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-600 uppercase hidden sm:table-cell dark:text-slate-400">Método</th>
                <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Peticiones</th>
                <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Promedio</th>
                <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Tiempo normal</th>
                <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-600 uppercase hidden md:table-cell dark:text-slate-400">Peor caso</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rendimiento.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-600 dark:text-slate-400">Sin datos (se necesitan al menos 3 peticiones por ruta)</td></tr>
                : rendimiento.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 truncate max-w-[250px]">{r.ruta}</td>
                    <td className="py-2.5 px-4 hidden sm:table-cell"><span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{r.metodo}</span></td>
                    <td className="py-2.5 px-4 text-right text-xs tabular-nums">{r.peticiones}</td>
                    <td className="py-2.5 px-4 text-right text-xs tabular-nums">{r.promedio_ms}ms</td>
                    <td className="py-2.5 px-4 text-right"><span className={`text-xs font-semibold tabular-nums ${r.p95_ms < 200 ? 'text-emerald-600' : r.p95_ms < 500 ? 'text-amber-600' : 'text-red-600'}`}>{r.p95_ms}ms</span></td>
                    <td className="py-2.5 px-4 text-right hidden md:table-cell text-xs text-slate-600 tabular-nums dark:text-slate-400">{r.p99_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-400">
            <strong>Tiempo normal</strong> = lo que tarda la mayoría de veces (95 de cada 100 peticiones). <strong>Peor caso</strong> = lo máximo que puede tardar. <span className="text-emerald-600">Verde = rápido (&lt;200ms)</span>, <span className="text-amber-600">Amarillo = lento (200-500ms)</span>, <span className="text-red-600">Rojo = crítico (&gt;500ms)</span>.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════ COMPONENTES ═══════════

function CardStat({ etiqueta, valor, alerta }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alerta ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <p className="text-[11px] font-medium text-slate-600 uppercase tracking-wider dark:text-slate-400">{etiqueta}</p>
      <p className={`text-2xl font-bold mt-1 ${alerta ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{valor.toLocaleString()}</p>
    </div>
  );
}

function BadgeNivel({ nivel }: { nivel: string }) {
  const cls = nivel === 'PANIC' ? 'bg-red-600 text-white' : nivel === 'ERROR' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{nivel}</span>;
}

function Sel({ value, onChange, opciones }: { value: string; onChange: (v: string) => void; opciones: { v: string; l: string }[] }) {
  return <select value={value} onChange={e => onChange(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none max-w-[170px] truncate">{opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
}

function SelBuscable({ value, onChange, opciones, placeholder }: { value: string; onChange: (v: string) => void; opciones: { v: string; l: string }[]; placeholder: string }) {
  const [abierto, setAbierto] = useState(false);
  const [busq, setBusq] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const filtradas = busq ? opciones.filter(o => o.l.toLowerCase().includes(busq.toLowerCase())) : opciones;
  const seleccionada = opciones.find(o => o.v === value);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setAbierto(!abierto); setBusq(''); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 max-w-[200px] truncate flex items-center gap-1">
        {seleccionada?.l || placeholder}
        <svg className="w-3 h-3 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {abierto && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <input type="text" value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar..." className="w-full px-3 py-2 text-xs border-b border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white outline-none" autoFocus />
          <div className="max-h-48 overflow-y-auto">
            {filtradas.map(o => (
              <button key={o.v} onClick={() => { onChange(o.v); setAbierto(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition ${value === o.v ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''}`}>{o.l}</button>
            ))}
            {filtradas.length === 0 && <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CampoDet({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return <div><p className="text-[10px] font-semibold text-slate-600 uppercase dark:text-slate-400">{etiqueta}</p><p className={`text-xs mt-0.5 break-all ${destacado ? 'text-amber-400 font-semibold' : 'text-slate-300'}`}>{valor || '—'}</p></div>;
}

function TopCard({ titulo, items }: { titulo: string; items: { label: string; count: number }[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-600 uppercase mb-3 dark:text-slate-400">{titulo}</h3>
      {items.map((t, i) => <div key={i} className="flex justify-between py-1.5 text-xs"><span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[70%]">{t.label}</span><span className="font-bold text-red-600">{t.count}</span></div>)}
    </div>
  );
}

function Paginacion({ pagina, totalPaginas, setPagina }: { pagina: number; totalPaginas: number; setPagina: (f: (p: number) => number) => void }) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
      <span>Página {pagina + 1} de {totalPaginas}</span>
      <div className="flex gap-2">
        <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Anterior</button>
        <button disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Siguiente</button>
      </div>
    </div>
  );
}

function TimelineBreadcrumbs({ json }: { json: string }) {
  let items: any[];
  try { items = JSON.parse(json); } catch { return null; }
  if (!items?.length) return null;
  const iconos: Record<string, string> = { navegacion: 'M9 5l7 7-7 7', click: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122', api: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9', error: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' };
  const colores: Record<string, string> = { navegacion: 'text-blue-400', click: 'text-slate-500 dark:text-slate-400', api: 'text-cyan-400', error: 'text-red-500' };
  return (
    <div><p className="text-[11px] font-semibold text-slate-600 uppercase mb-2 dark:text-slate-400">Ruta del usuario antes del error</p>
      <div className="relative pl-5 space-y-1.5"><div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-700" />
        {items.slice(-10).map((b: any, i: number) => (
          <div key={i} className="flex items-start gap-2 relative">
            <div className={`absolute left-[-13px] top-1 w-3 h-3 rounded-full border-2 border-slate-800 ${b.tipo === 'error' ? 'bg-red-600' : 'bg-slate-600'}`} />
            <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${colores[b.tipo] || 'text-slate-600 dark:text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconos[b.tipo] || iconos.click} /></svg>
            <div className="min-w-0"><span className="text-[11px] text-slate-300">{b.descripcion}</span><span className="text-[10px] text-slate-600 ml-2">{tiempoRelativo(b.timestamp)}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtPeriodo(iso: string, intervalo: string) { try { const d = new Date(iso); return intervalo === 'hora' ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }); } catch { return iso; } }
function fmtHora(iso: string) { try { return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return iso; } }
function fmtJSON(s: string) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } }
function tiempoRelativo(iso: string) { try { const d = Date.now() - new Date(iso).getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'ahora'; if (m < 60) return `hace ${m}m`; const h = Math.floor(m / 60); if (h < 24) return `hace ${h}h`; return `hace ${Math.floor(h / 24)}d`; } catch { return iso; } }
