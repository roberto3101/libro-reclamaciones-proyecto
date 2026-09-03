import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usarEstadoSuperAdmin } from '@/aplicacion/estado/estadoSuperAdmin';
import { superadminApi } from '@/api/superadmin';
import { AccesoRapidoDev } from '@/componentes/ui/AccesoRapidoDev';

export default function SALogin() {
  const navigate = useNavigate();
  const { autenticado, cargando, inicializar, establecerSesion } = usarEstadoSuperAdmin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { inicializar(); }, [inicializar]);

  useEffect(() => {
    if (!cargando && autenticado) {
      navigate('/superadmin/dashboard', { replace: true });
    }
  }, [cargando, autenticado, navigate]);

  const manejarEnvio = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contrasena');
      return;
    }

    setEnviando(true);
    try {
      const res = await superadminApi.login({ email: email.trim(), password });
      establecerSesion(res.token, res.user);
      toast.success(`Bienvenido, ${res.user.nombre}`);
      navigate('/superadmin/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message || 'Credenciales incorrectas';
      setError(msg);
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Panel izquierdo — formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                <span className="text-slate-900 font-bold text-sm dark:text-slate-100">LR</span>
              </div>
              <span className="text-white font-semibold text-lg tracking-tight">Libro de Reclamaciones</span>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Consola de administracion
            </h1>
            <p className="text-slate-500 text-sm mt-2 dark:text-slate-400">
              Acceso interno del equipo
            </p>
          </div>

          {/* Las credenciales de prueba ya no se imprimen aquí: el botón de
              acceso rápido del pie del formulario hace lo mismo sin dejarlas
              a la vista de quien mire la pantalla. */}

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-600/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={manejarEnvio} className="space-y-5" noValidate>
            <div>
              <label htmlFor="sa-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo
              </label>
              <input
                id="sa-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
                placeholder="admin@libroreclamaciones.pe"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="sa-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Contrasena
              </label>
              <div className="relative">
                <input
                  id="sa-password"
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition dark:text-slate-400"
                  tabIndex={-1}
                >
                  {verPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-white hover:bg-slate-100 disabled:bg-slate-300 disabled:cursor-not-allowed text-slate-900 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer dark:text-slate-100"
            >
              {enviando && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {enviando ? 'Ingresando...' : 'Iniciar sesion'}
            </button>

            {/* Acceso rápido (solo desarrollo) */}
            <AccesoRapidoDev
              tipo="superadmin"
              oscuro
              alRellenar={(correo, clave) => {
                setEmail(correo);
                setPassword(clave);
                setError('');
              }}
            />
          </form>

          <p className="text-center text-xs text-slate-500 mt-8 dark:text-slate-400">
            &copy; 2026 Libro de Reclamaciones. Uso interno.
          </p>
        </div>
      </div>

      {/* Panel derecho — contexto (solo escritorio)

          Aqui habia tres cifras en tarjetas: «5.000+ Empresas», «24/7
          Monitoreo», «99.9% Uptime». Ninguna salia de un dato real; eran
          texto fijo. Poner metricas inventadas en la pantalla de acceso de
          la propia herramienta interna no informa a nadie y afirma cosas
          que no se han medido, asi que se retiran.

          Queda lo que si es cierto y util: que administra esta consola. */}
      <div className="hidden lg:flex flex-1 items-center px-12" style={{ background: '#131210', borderLeft: '1px solid #302d27' }}>
        <div className="max-w-md">
          <p
            className="m-0 mb-3 text-[0.625rem] font-semibold uppercase"
            style={{ letterSpacing: '0.1em', color: '#857e70' }}
          >
            Consola interna
          </p>
          <h2
            className="m-0 mb-4 text-[1.75rem] font-semibold leading-tight"
            style={{ fontFamily: 'var(--ui-fuente-titulo)', letterSpacing: '-0.02em', color: '#f6f1e7' }}
          >
            Gestión centralizada
          </h2>
          <p className="m-0 mb-8 text-sm leading-relaxed" style={{ maxWidth: '38ch', color: '#b3aa98' }}>
            Cuentas, empresas, planes y suscripciones de toda la plataforma, desde un solo lugar.
          </p>

          <ul className="m-0 p-0 list-none" style={{ borderTop: '1px solid #332f27' }}>
            {['Altas y bajas de cuentas', 'Planes y suscripciones', 'Registro de actividad y errores'].map((x) => (
              <li
                key={x}
                className="py-[11px] text-[0.8125rem]"
                style={{ borderBottom: '1px solid #332f27', color: '#cfc6b3' }}
              >
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
