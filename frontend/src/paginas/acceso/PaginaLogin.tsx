import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usarAuth } from '@/aplicacion/ganchos/usarAuth';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { usarTema } from '@/ui';
import { AccesoRapidoDev } from '@/componentes/ui/AccesoRapidoDev';
import { guardarSesion } from '@/aplicacion/helpers/sesion';
import { http } from '@/api/http';

/* ── Iconos SVG inline ── */
const IconoCorreo = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const IconoCandado = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const IconoOjoAbierto = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const IconoOjoCerrado = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.27 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

export default function PaginaLogin() {
  const navegar = useNavigate();
  const [entrandoDemo, setEntrandoDemo] = useState(false);

  /* Entrar a la demostración.

     El visitante que llega desde un anuncio no conoce la marca todavía, así
     que pedirle RUC y contraseña antes de enseñarle nada es pedirle una
     confianza que aún no tiene. Esto le crea una empresa desechable —con
     sedes y reclamos dentro, porque un panel vacío no explica nada— y lo
     mete directamente. */
  const entrarDemo = async () => {
    if (entrandoDemo) return;
    setEntrandoDemo(true);
    try {
      const { data } = await http.post('/demo');
      const d = data?.data;
      if (!d?.token) throw new Error('respuesta sin sesión');

      guardarSesion(d.token, {
        id: '',
        tenant_id: d.tenant_id,
        tenant_slug: d.slug,
        email: d.email,
        nombre_completo: 'Administrador de la demostración',
        rol: 'ADMIN',
        sede_ids: [],
        debe_cambiar_password: false,
      });
      // Recarga completa: así el estado de sesión se inicializa desde cero
      // y no arrastra nada de una sesión anterior en la misma pestaña.
      window.location.href = '/dashboard';
    } catch {
      setErrores((prev) => ({
        ...prev,
        general: 'No pudimos abrir la demostración. Intenta de nuevo en un momento.',
      }));
      setEntrandoDemo(false);
    }
  };

  const { autenticado } = usarEstadoAuth();
  const { iniciarSesion } = usarAuth();
  const { tema, alternarTema } = usarTema();
  const esOscuro = tema === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errores, setErrores] = useState({ email: '', password: '', general: '' });

  if (autenticado) return <Navigate to="/dashboard" replace />;

  const validar = (): boolean => {
    const nuevos = { email: '', password: '', general: '' };
    if (!email.trim()) nuevos.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nuevos.email = 'Correo inválido';
    if (!password) nuevos.password = 'La contraseña es obligatoria';
    setErrores(nuevos);
    return !nuevos.email && !nuevos.password;
  };

  const manejarSubmit = async () => {
    if (!validar()) return;
    setCargando(true);
    setErrores((prev) => ({ ...prev, general: '' }));
    try {
      await iniciarSesion(email, password);
    } catch {
      setErrores((prev) => ({ ...prev, general: 'Credenciales incorrectas. Verifica e intenta de nuevo.' }));
    } finally {
      setCargando(false);
    }
  };

  const manejarTecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') manejarSubmit();
  };

  return (
    <div className={`login-root ${esOscuro ? 'login--dark' : 'login--light'}`}>
      {/* ════════════════  PANEL IZQUIERDO: FORMULARIO  ════════════════ */}
      <div className="login-form-panel">
        {/* Toggle tema */}
        <button
          onClick={alternarTema}
          className="login-theme-toggle"
          aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          type="button"
        >
          {esOscuro ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        <div className="login-form-inner">
          {/* ── Branding mobile (solo visible en móvil) ── */}
          <div className="login-mobile-brand">
            <div className="login-hero-logo-mark">LR</div>
            <span className="login-mobile-brand-text">Libro de Reclamaciones</span>
          </div>

          {/* ── Título ── */}
          <h1 className="login-title">Bienvenido</h1>
          <p className="login-subtitle">Inicia sesión en tu panel de administración</p>

          {/* ── Error general ── */}
          {errores.general && (
            <div className="login-error-banner">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errores.general}
            </div>
          )}

          {/* ── Campo: Correo ── */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              Correo electrónico
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon"><IconoCorreo /></span>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={manejarTecla}
                placeholder="admin@empresa.com"
                autoComplete="email"
                className={`login-input ${errores.email ? 'login-input--error' : ''}`}
              />
            </div>
            {errores.email && <p className="login-field-error">{errores.email}</p>}
          </div>

          {/* ── Campo: Contraseña ── */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              Contraseña
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon"><IconoCandado /></span>
              <input
                id="login-password"
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={manejarTecla}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`login-input login-input--password ${errores.password ? 'login-input--error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="login-toggle-password"
                tabIndex={-1}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verPassword ? <IconoOjoCerrado /> : <IconoOjoAbierto />}
              </button>
            </div>
            {errores.password && <p className="login-field-error">{errores.password}</p>}
          </div>

          {/* ── Botón Submit ── */}
          <button
            onClick={manejarSubmit}
            disabled={cargando}
            className="login-submit"
          >
            {cargando && <div className="login-spinner" />}
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>

          {/* Separador y demostración. Va después del acceso normal porque
              quien ya es cliente viene a entrar, no a probar. */}
          <div className="login-separador"><span>o</span></div>

          <button
            type="button"
            onClick={entrarDemo}
            disabled={entrandoDemo || cargando}
            className="login-demo"
          >
            {entrandoDemo && <div className="login-spinner" />}
            {entrandoDemo ? 'Preparando tu demostración…' : 'Probar sin registrarme'}
          </button>
          <p className="login-demo-nota">
            Entras a un negocio de ejemplo con reclamos ya cargados. No pedimos datos.
          </p>

          {/* ── Acceso rápido (solo desarrollo) ── */}
          <AccesoRapidoDev
            tipo="tenant"
            alRellenar={(correo, clave) => {
              setEmail(correo);
              setPassword(clave);
              setErrores({ email: '', password: '', general: '' });
            }}
          />

          {/* ── Footer ── */}
          <div className="login-footer">
            <p>&copy; {new Date().getFullYear()} Libro de Reclamaciones. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>

      {/* ════════════════  PANEL DERECHO: HERO VISUAL  ════════════════ */}
      <div className="login-hero">
        {/* Formas geométricas animadas */}
        <div className="login-hero-shape login-hero-shape--1" />
        <div className="login-hero-shape login-hero-shape--2" />
        <div className="login-hero-shape login-hero-shape--3" />
        <div className="login-hero-grid" />

        <div className="login-hero-content">
          {/* Logotipo */}
          <div className="login-hero-logo">
            <div className="login-hero-logo-mark">LR</div>
            <span className="login-hero-logo-text">Libro de Reclamaciones</span>
          </div>

          <h2 className="login-hero-title">
            Gestión inteligente de<br />reclamos y quejas
          </h2>
          <p className="login-hero-desc">
            Sistema SaaS que simplifica el cumplimiento normativo
            INDECOPI con automatización, IA y reportes en tiempo real.
          </p>

          {/* Feature pills */}
          <div className="login-hero-features">
            <span className="login-hero-pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              Gestión digital
            </span>
            <span className="login-hero-pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Cumple normativas
            </span>
            <span className="login-hero-pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Respuestas ágiles
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
