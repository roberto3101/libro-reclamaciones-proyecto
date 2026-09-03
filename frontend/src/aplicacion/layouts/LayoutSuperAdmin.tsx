import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { usarEstadoSuperAdmin } from '@/aplicacion/estado/estadoSuperAdmin';
import { superadminApi } from '@/api/superadmin';

/* ── Iconos SVG inline ── */
const IconoDashboard = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
  </svg>
);

const IconoCuentas = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconoEmpresas = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const IconoPlanes = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const IconoStaff = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconoMenu = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const IconoCerrar = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconoSalir = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const IconoActividad = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconoErrores = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconoBuscar = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

/* ── Menu items ── */
const elementosMenu = [
  { etiqueta: 'Dashboard', ruta: '/superadmin/dashboard', icono: <IconoDashboard /> },
  { etiqueta: 'Cuentas', ruta: '/superadmin/cuentas', icono: <IconoCuentas /> },
  { etiqueta: 'Empresas', ruta: '/superadmin/empresas', icono: <IconoEmpresas /> },
  { etiqueta: 'Planes', ruta: '/superadmin/planes', icono: <IconoPlanes /> },
  { etiqueta: 'Staff', ruta: '/superadmin/staff', icono: <IconoStaff /> },
  { etiqueta: 'Actividad', ruta: '/superadmin/actividad', icono: <IconoActividad /> },
  { etiqueta: 'Errores', ruta: '/superadmin/errores', icono: <IconoErrores /> },
];

const SA_TOKEN_KEY = 'lr_sa_token';

export default function LayoutSuperAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sa, autenticado, cargando, inicializar, cerrarSesion } = usarEstadoSuperAdmin();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const [alertasSinVer, setAlertasSinVer] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    superadminApi.contarAlertasSinVer().then(setAlertasSinVer).catch(() => {});
    const token = localStorage.getItem(SA_TOKEN_KEY);
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST ?? window.location.host.replace(':5173', ':8080').replace(':5174', ':8080');
    const ws = new WebSocket(`${proto}//${host}/ws/superadmin/errores?token=${token}`);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.tipo === 'ERROR_ALERTA_NUEVA') setAlertasSinVer(prev => prev + 1);
      } catch {}
    };
    return () => ws.close();
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setResultados(null);
        setBusqueda('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setResultados(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscar = useCallback(async (q: string) => {
    if (q.length < 2) { setResultados(null); return; }
    setBuscando(true);
    try {
      const res = await superadminApi.buscar(q);
      setResultados(res);
    } catch { setResultados(null); }
    setBuscando(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => buscar(busqueda), 300);
    return () => clearTimeout(timer);
  }, [busqueda, buscar]);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  useEffect(() => {
    if (!cargando && !autenticado) {
      navigate('/superadmin/acceso', { replace: true });
    }
  }, [cargando, autenticado, navigate]);

  // Cerrar sidebar al cambiar de ruta en movil
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  const manejarCerrarSesion = async () => {
    try {
      await superadminApi.logout();
    } catch {
      /* ignorar */
    }
    cerrarSesion();
    navigate('/superadmin/acceso', { replace: true });
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-900 dark:border-t-white" />
      </div>
    );
  }

  if (!autenticado) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Overlay movil */}
      {menuAbierto && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#131210' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 shrink-0 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
              <span className="text-slate-900 font-bold text-xs">LR</span>
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Libro de Reclamaciones</span>
            <span className="text-[9px] font-medium uppercase tracking-wider bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
              Admin
            </span>
          </div>
          {/* Boton cerrar en movil */}
          <button
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors dark:text-slate-400"
            onClick={() => setMenuAbierto(false)}
          >
            <IconoCerrar />
          </button>
        </div>

        {/* Navegacion */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          {elementosMenu.map((item) => {
            const activo =
              item.ruta === '/superadmin/dashboard'
                ? location.pathname === '/superadmin/dashboard' || location.pathname === '/superadmin'
                : location.pathname.startsWith(item.ruta);

            return (
              <Link
                key={item.ruta}
                to={item.ruta}
                onClick={() => { if (item.ruta === '/superadmin/errores') setAlertasSinVer(0); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activo
                    ? 'bg-slate-700/70 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 dark:text-slate-400'
                }`}
              >
                {item.icono}
                {item.etiqueta}
                {item.ruta === '/superadmin/errores' && alertasSinVer > 0 && (
                  <span className="ml-auto bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">{alertasSinVer > 99 ? '99+' : alertasSinVer}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pie de sidebar */}
        <div className="px-5 py-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 dark:text-slate-400">Libro de Reclamaciones</p>
        </div>
      </aside>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20 flex items-center justify-between px-4 lg:px-6">
        {/* Hamburguesa movil */}
        <button
          className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          onClick={() => setMenuAbierto(true)}
        >
          <IconoMenu />
        </button>

        {/* Búsqueda global */}
        <div className="relative hidden sm:block flex-1 max-w-md mx-4" ref={dropdownRef}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"><IconoBuscar /></span>
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cuentas, empresas, usuarios... (Ctrl+K)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent outline-none transition"
            />
            {buscando && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />}
          </div>
          {resultados && (busqueda.length >= 2) && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
              {(!resultados.cuentas?.length && !resultados.empresas?.length && !resultados.usuarios?.length) ? (
                <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">Sin resultados</p>
              ) : (
                <>
                  {resultados.cuentas?.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">Cuentas</p>
                      {resultados.cuentas.map((r: any) => (
                        <button key={r.id} onClick={() => { navigate(`/superadmin/cuentas/${r.id}`); setResultados(null); setBusqueda(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition flex justify-between">
                          <span className="font-medium text-slate-900 dark:text-white">{r.titulo}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{r.subtitulo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {resultados.empresas?.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">Empresas</p>
                      {resultados.empresas.map((r: any) => (
                        <button key={r.id} onClick={() => { navigate(`/superadmin/empresas/${r.id}`); setResultados(null); setBusqueda(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition flex justify-between">
                          <span className="font-medium text-slate-900 dark:text-white">{r.titulo}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{r.subtitulo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {resultados.usuarios?.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">Usuarios</p>
                      {resultados.usuarios.map((r: any) => (
                        <button key={r.id} onClick={() => { navigate(`/superadmin/empresas/${r.tenant_id}`); setResultados(null); setBusqueda(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition flex justify-between">
                          <span className="font-medium text-slate-900 dark:text-white">{r.titulo}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{r.subtitulo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Info usuario + logout */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {sa?.nombre?.charAt(0)?.toUpperCase() ?? 'S'}
            </span>
          </div>
          <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
            {sa?.nombre}
          </span>
          <button
            onClick={manejarCerrarSesion}
            title="Cerrar sesion"
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
          >
            <IconoSalir />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* ── Contenido principal ── */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
