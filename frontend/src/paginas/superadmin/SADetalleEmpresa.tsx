import { usarBloqueoScroll } from '@/ui';
import { formatoFechaCorta } from '@/aplicacion/helpers/formato';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { superadminApi } from '@/api/superadmin';
import { ModalAgregarUsuarioExistente } from '@/modulos/usuarios/componentes/ModalAgregarUsuarioExistente';
import type { AccesoUsuarioEnCuenta } from '@/tipos';
import type { UsuarioAuth } from '@/tipos';

type Tab = 'info' | 'sedes' | 'usuarios' | 'reclamos' | 'facturacion';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'info', label: 'Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'sedes', label: 'Sedes', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { key: 'usuarios', label: 'Usuarios', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { key: 'reclamos', label: 'Reclamos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'facturacion', label: 'Facturación', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
];

const ROLES = ['ADMIN', 'SOPORTE'];

// ── Modal wrapper ──
// Nota: el backdrop NO cierra el modal al click. Todos los modales de
// este archivo tienen formularios con datos que se perderían con un click
// accidental. El cierre se hace explícitamente por el botón X del header.
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  // El gancho va ANTES del retorno temprano: las reglas de hooks exigen
  // que se ejecute en todos los renders, tambien cuando el modal esta
  // cerrado (ahi no hace nada).
  usarBloqueoScroll(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={`relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition dark:text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Input field ──
function Campo({ label, value, onChange, type = 'text', disabled, placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; disabled?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Badge ──
function Badge({ activo, size = 'sm' }: { activo: boolean; size?: 'sm' | 'xs' }) {
  const cls = activo
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
  return (
    <span className={`inline-flex items-center font-medium border rounded-full ${size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-[11px] px-2 py-px'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${activo ? 'bg-emerald-500' : 'bg-red-600'}`} />
      <span className={cls.split(' ').filter(c => c.startsWith('text-') || c.startsWith('dark:text-')).join(' ')}>{activo ? 'Activo' : 'Inactivo'}</span>
    </span>
  );
}

export default function SADetalleEmpresa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('info');
  const [empresa, setEmpresa] = useState<any>(null);
  const [sedes, setSedes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [reclamos, setReclamos] = useState<any[]>([]);
  const [totalReclamos, setTotalReclamos] = useState(0);
  const [planes, setPlanes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pagReclamos, setPagReclamos] = useState(0);
  const [suscripcion, setSuscripcion] = useState<any>(null);
  const [filtroSede, setFiltroSede] = useState('');
  const [busquedaReclamos, setBusquedaReclamos] = useState('');
  const [busquedaReclamosAplicada, setBusquedaReclamosAplicada] = useState('');

  // Modal "Ver detalle reclamo"
  const [reclamoDetalle, setReclamoDetalle] = useState<any | null>(null);

  // Modal states
  const [modalEditUsuario, setModalEditUsuario] = useState<any>(null);
  const [modalResetPwd, setModalResetPwd] = useState<any>(null);
  const [nuevoPwd, setNuevoPwd] = useState('');
  const [mostrarNuevoPwd, setMostrarNuevoPwd] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Edit user form
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRol, setEditRol] = useState('ADMIN');
  const [editSedeIds, setEditSedeIds] = useState<string[]>([]);

  // Modal "Agregar usuario existente"
  const [mostrarAgregarExistente, setMostrarAgregarExistente] = useState(false);

  const cargarDatos = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    try {
      const [emp, sds, usrs, recl, pls, sus] = await Promise.all([
        superadminApi.obtenerEmpresa(id),
        superadminApi.obtenerSedesDeEmpresa(id),
        superadminApi.obtenerUsuariosDeEmpresa(id),
        superadminApi.obtenerReclamosDeEmpresaConSede(id, 0, 20),
        superadminApi.listarPlanes(),
        superadminApi.obtenerSuscripcionEmpresa(id).catch(() => null),
      ]);
      setEmpresa(emp);
      setSedes(sds ?? []);
      setUsuarios(usrs ?? []);
      setReclamos(recl.data ?? []);
      setTotalReclamos(recl.total);
      setPlanes(pls ?? []);
      setSuscripcion(sus);
    } catch { toast.error('Error al cargar datos'); }
    setCargando(false);
  }, [id]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const cargarReclamos = async (offset: number, sedeId?: string, busqueda?: string) => {
    if (!id) return;
    const res = await superadminApi.obtenerReclamosDeEmpresaConSede(
      id,
      offset,
      20,
      sedeId || undefined,
      busqueda ?? busquedaReclamosAplicada,
    );
    setReclamos(res.data ?? []);
    setTotalReclamos(res.total);
    setPagReclamos(offset);
  };

  // Debounce para la búsqueda de reclamos — aplica 350ms después de dejar
  // de tipear, reinicia a la primera página y hace un único fetch.
  useEffect(() => {
    if (!id) return;
    const q = busquedaReclamos.trim();
    if (q === busquedaReclamosAplicada) return;
    const t = setTimeout(() => {
      setBusquedaReclamosAplicada(q);
      cargarReclamos(0, filtroSede, q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaReclamos, filtroSede, id]);

  const toggleEstadoEmpresa = async () => {
    if (!id || !empresa) return;
    try {
      await superadminApi.cambiarEstadoEmpresa(id, !empresa.activo);
      setEmpresa({ ...empresa, activo: !empresa.activo });
      toast.success(empresa.activo ? 'Empresa desactivada' : 'Empresa activada');
    } catch { toast.error('Error al cambiar estado'); }
  };

  const abrirEditUsuario = (u: any) => {
    setEditNombre(u.nombre_completo);
    setEditEmail(u.email);
    setEditRol(u.rol);
    setEditSedeIds(u.sede_ids ?? []);
    setModalEditUsuario(u);
  };

  const guardarUsuario = async () => {
    if (!id || !modalEditUsuario) return;
    setGuardando(true);
    try {
      await superadminApi.editarUsuario(id, modalEditUsuario.id, {
        nombre_completo: editNombre, email: editEmail, rol: editRol, sede_ids: editSedeIds,
      });
      setUsuarios(usuarios.map(u => u.id === modalEditUsuario.id
        ? { ...u, nombre_completo: editNombre, email: editEmail, rol: editRol, sede_ids: editSedeIds }
        : u
      ));
      setModalEditUsuario(null);
      toast.success('Usuario actualizado');
    } catch { toast.error('Error al guardar'); }
    setGuardando(false);
  };

  const resetearPassword = async () => {
    if (!id || !modalResetPwd || nuevoPwd.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setGuardando(true);
    try {
      await superadminApi.resetearPassword(id, modalResetPwd.id, nuevoPwd);
      setModalResetPwd(null);
      setNuevoPwd('');
      setMostrarNuevoPwd(false);
      toast.success('Contraseña reseteada. El usuario deberá cambiarla al iniciar sesión.');
    } catch { toast.error('Error al resetear'); }
    setGuardando(false);
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-white" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Cargando empresa...</span>
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="text-center py-32">
        <p className="text-slate-600 mb-4 dark:text-slate-400">Empresa no encontrada.</p>
        <button onClick={() => navigate('/superadmin/empresas')} className="text-sm text-slate-900 dark:text-white underline">Volver</button>
      </div>
    );
  }

  const planActual = planes.find((p: any) => {
    // try matching via suscripcion if we have it
    return false; // We'll show all plans for selection
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <button onClick={() => navigate('/superadmin/empresas')} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:hover:text-white transition mb-3 dark:text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Empresas
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{empresa.razon_social}</h1>
              <Badge activo={empresa.activo} />
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-mono">{empresa.ruc}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>{empresa.slug}</span>
              {empresa.email_contacto && <>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{empresa.email_contacto}</span>
              </>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                try {
                  const res = await superadminApi.impersonar(id!);
                  // Guardar sesión completa para que el nuevo tab pueda autenticarse
                  const usuarioImpersonado: UsuarioAuth = {
                    id: res.user_id,
                    tenant_id: res.tenant_id,
                    tenant_slug: res.tenant_slug,
                    email: res.email,
                    nombre_completo: res.nombre_completo,
                    rol: res.role as any,
                    debe_cambiar_password: res.debe_cambiar_password ?? false,
                  };
                  localStorage.setItem('lr_token', res.token);
                  localStorage.setItem('lr_usuario', JSON.stringify(usuarioImpersonado));
                  localStorage.setItem('lr_sa_impersonando', res.razon_social);
                  window.open('/dashboard', '_blank');
                  toast.success(`Ingresando como ${res.razon_social}`);
                } catch { toast.error('Error al impersonar'); }
              }}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Ingresar como empresa
            </button>
            <button
              onClick={toggleEstadoEmpresa}
              className={`text-sm font-medium px-4 py-2 rounded-lg border transition ${
                empresa.activo
                  ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
              }`}
            >
              {empresa.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === t.key
                  ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                  : 'border-transparent text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 dark:text-slate-400'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} /></svg>
              {t.label}
              {t.key === 'sedes' && <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">({sedes.length})</span>}
              {t.key === 'usuarios' && <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">({usuarios.length})</span>}
              {t.key === 'reclamos' && <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">({totalReclamos})</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* ═══════ TAB: Info ═══════ */}
      {tab === 'info' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Razón Social', value: empresa.razon_social },
              { label: 'RUC', value: empresa.ruc },
              { label: 'Slug público', value: empresa.slug },
              { label: 'Email contacto', value: empresa.email_contacto || '—' },
              { label: 'Teléfono', value: empresa.telefono || '—' },
              { label: 'Dirección legal', value: empresa.direccion_legal || '—' },
              { label: 'Departamento', value: empresa.departamento || '—' },
              { label: 'Provincia', value: empresa.provincia || '—' },
              { label: 'Distrito', value: empresa.distrito || '—' },
              { label: 'Plazo respuesta', value: `${empresa.plazo_respuesta_dias} días` },
              { label: 'Color primario', value: empresa.color_primario || '#9a4a24' },
              { label: 'Notif. WhatsApp', value: empresa.notificar_whatsapp ? 'Sí' : 'No' },
              { label: 'Notif. Email', value: empresa.notificar_email ? 'Sí' : 'No' },
            ].map((c) => (
              <div key={c.label} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{c.label}</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Cambiar plan */}
          {planes.length > 0 && (
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Plan de suscripción</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {planes.filter((p: any) => p.activo).map((plan: any) => (
                  <button
                    key={plan.id}
                    onClick={async () => {
                      try {
                        await superadminApi.cambiarPlanEmpresa(id!, plan.id);
                        toast.success(`Plan cambiado a ${plan.nombre}`);
                      } catch { toast.error('Error al cambiar plan'); }
                    }}
                    className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-sm transition group"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200">{plan.nombre}</p>
                    <p className="text-xs text-slate-600 mt-0.5 dark:text-slate-400">S/ {plan.precio_mensual.toFixed(2)}/mes</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ TAB: Sedes ═══════ */}
      {tab === 'sedes' && (
        <div className="space-y-3">
          {sedes.length === 0 ? (
            <div className="text-center py-16 text-slate-600 dark:text-slate-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              No hay sedes registradas
            </div>
          ) : sedes.map((sede: any) => (
            <div key={sede.id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{sede.nombre}</p>
                  {sede.es_principal && <span className="text-[10px] font-semibold px-1.5 py-px rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900">PRINCIPAL</span>}
                </div>
                <p className="text-xs text-slate-600 truncate dark:text-slate-400">{sede.direccion}{sede.distrito ? ` — ${sede.distrito}` : ''}</p>
                {(sede.email || sede.telefono) && (
                  <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{sede.email || ''}{sede.telefono ? ` · ${sede.telefono}` : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge activo={sede.activo} size="xs" />
                <button
                  onClick={async () => {
                    try {
                      await superadminApi.cambiarEstadoSede(id!, sede.id, !sede.activo);
                      setSedes(sedes.map(s => s.id === sede.id ? { ...s, activo: !s.activo } : s));
                      toast.success(sede.activo ? 'Sede desactivada' : 'Sede activada');
                    } catch { toast.error('Error'); }
                  }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                    sede.activo
                      ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
                  }`}
                >
                  {sede.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ TAB: Usuarios ═══════ */}
      {tab === 'usuarios' && (
        <div>
          {/* Header con acciones */}
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setMostrarAgregarExistente(true)}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar usuario existente
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Usuario</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell dark:text-slate-400">Rol</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell dark:text-slate-400">Sedes</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Estado</th>
                  <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usuarios.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{u.nombre_completo}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        u.rol === 'ADMIN'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>{u.rol}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {u.sede_ids?.length ? `${u.sede_ids.length} sede${u.sede_ids.length > 1 ? 's' : ''}` : 'Global'}
                      </span>
                    </td>
                    <td className="py-3 px-4"><Badge activo={u.activo} size="xs" /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEditUsuario(u)}
                          title="Editar"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-700 transition dark:text-slate-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => { setModalResetPwd(u); setNuevoPwd(''); }}
                          title="Resetear contraseña"
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 transition dark:text-slate-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await superadminApi.cambiarEstadoUsuario(id!, u.id, !u.activo);
                              setUsuarios(usuarios.map(usr => usr.id === u.id ? { ...usr, activo: !usr.activo } : usr));
                              toast.success(u.activo ? 'Desactivado' : 'Activado');
                            } catch { toast.error('Error'); }
                          }}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-md transition ${
                            u.activo
                              ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 dark:text-slate-400'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20 dark:text-slate-400'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.activo ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usuarios.length === 0 && (
              <div className="text-center py-16 text-slate-600 dark:text-slate-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                No hay usuarios
              </div>
            )}
          </div>

          {/* Modal editar usuario */}
          <Modal open={!!modalEditUsuario} onClose={() => setModalEditUsuario(null)} title="Editar usuario" wide>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Nombre completo" value={editNombre} onChange={setEditNombre} />
                <Campo label="Email" value={editEmail} onChange={setEditEmail} type="email" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Rol</label>
                <div className="flex gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => setEditRol(r)}
                      className={`text-sm font-medium px-4 py-2 rounded-lg border transition ${
                        editRol === r
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {sedes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Acceso a sedes</label>
                  <p className="text-xs text-slate-500 mb-2 dark:text-slate-400">Sin selección = acceso global a todas las sedes</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {sedes.filter((s: any) => s.activo).map((s: any) => (
                      <label key={s.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={editSedeIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) setEditSedeIds([...editSedeIds, s.id]);
                            else setEditSedeIds(editSedeIds.filter(x => x !== s.id));
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:text-slate-100"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{s.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setModalEditUsuario(null)} className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancelar</button>
                <button onClick={guardarUsuario} disabled={guardando || !editNombre || !editEmail} className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal resetear password */}
          <Modal
            open={!!modalResetPwd}
            onClose={() => { setModalResetPwd(null); setNuevoPwd(''); setMostrarNuevoPwd(false); }}
            title="Resetear contraseña"
          >
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Se establecerá una nueva contraseña para <strong>{modalResetPwd?.nombre_completo}</strong>. Comunícasela por un canal seguro; el usuario la usará tal cual y podrá cambiarla después desde su perfil si lo desea.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={mostrarNuevoPwd ? 'text' : 'password'}
                    value={nuevoPwd}
                    onChange={(e) => setNuevoPwd(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarNuevoPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition dark:text-slate-400"
                    aria-label={mostrarNuevoPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={mostrarNuevoPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarNuevoPwd ? (
                      // Ojo tachado (ocultar)
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.133 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      // Ojo abierto (mostrar)
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setModalResetPwd(null); setNuevoPwd(''); setMostrarNuevoPwd(false); }}
                  className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={resetearPassword}
                  disabled={guardando || nuevoPwd.length < 8}
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {guardando ? 'Reseteando...' : 'Resetear contraseña'}
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* ═══════ TAB: Reclamos ═══════ */}
      {tab === 'reclamos' && (
        <div>
          {/* Filtros: búsqueda + sede */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none dark:text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 3.5a7.5 7.5 0 0013.15 13.15z" />
              </svg>
              <input
                type="text"
                value={busquedaReclamos}
                onChange={(e) => setBusquedaReclamos(e.target.value)}
                placeholder="Buscar por código, nombre, DNI, email, teléfono..."
                className="w-full text-sm pl-9 pr-9 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 outline-none"
              />
              {busquedaReclamos !== '' && (
                <button
                  type="button"
                  onClick={() => setBusquedaReclamos('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 dark:text-slate-400"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {sedes.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600 shrink-0 dark:text-slate-400">Sede:</label>
                <select
                  value={filtroSede}
                  onChange={(e) => {
                    setFiltroSede(e.target.value);
                    setPagReclamos(0);
                    cargarReclamos(0, e.target.value);
                  }}
                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 outline-none max-w-xs"
                >
                  <option value="">Todas</option>
                  {sedes.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Código</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Tipo</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden sm:table-cell dark:text-slate-400">Consumidor</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Estado</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell dark:text-slate-400">Fecha</th>
                  <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reclamos.map((r: any) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer"
                    onClick={() => setReclamoDetalle(r)}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">{r.codigo_reclamo}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        r.tipo_solicitud === 'RECLAMO'
                          ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                      }`}>{r.tipo_solicitud}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 hidden sm:table-cell truncate max-w-[200px]">{r.nombre_completo}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        r.estado === 'EN_PROCESO' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        r.estado === 'RESUELTO' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>{r.estado}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 hidden md:table-cell tabular-nums dark:text-slate-400">
                      {new Date(r.fecha_registro).toLocaleDateString('es-PE')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReclamoDetalle(r);
                        }}
                        className="text-xs font-medium px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reclamos.length === 0 && (
              <div className="text-center py-16 text-slate-600 dark:text-slate-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {busquedaReclamosAplicada
                  ? `No hay reclamos que coincidan con "${busquedaReclamosAplicada}"`
                  : filtroSede
                    ? 'No hay reclamos para esta sede'
                    : 'No hay reclamos'}
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalReclamos > 20 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
                {pagReclamos + 1}–{Math.min(pagReclamos + 20, totalReclamos)} de {totalReclamos}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagReclamos === 0}
                  onClick={() => cargarReclamos(pagReclamos - 20, filtroSede, busquedaReclamosAplicada)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Anterior
                </button>
                <button
                  disabled={pagReclamos + 20 >= totalReclamos}
                  onClick={() => cargarReclamos(pagReclamos + 20, filtroSede, busquedaReclamosAplicada)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ TAB: Facturación ═══════ */}
      {tab === 'facturacion' && (
        <div className="space-y-6">
          {/* Suscripción actual */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Suscripción actual</h3>
              {suscripcion && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  suscripcion.estado === 'ACTIVA' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  suscripcion.estado === 'TRIAL' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>{suscripcion.estado}{suscripcion.es_trial ? ` · ${suscripcion.dias_trial} días` : ''}</span>
              )}
            </div>
            {suscripcion ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider dark:text-slate-400">Plan</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{suscripcion.plan_nombre}</p>
                  <p className="text-[10px] text-slate-600 font-mono dark:text-slate-400">{suscripcion.plan_codigo}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider dark:text-slate-400">Ciclo</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">{suscripcion.ciclo === 'ANUAL' ? 'Anual' : 'Mensual'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider dark:text-slate-400">Precio</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">S/ {suscripcion.precio_mensual?.toFixed(2)}/mes</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider dark:text-slate-400">Próximo cobro</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">{suscripcion.proximo_cobro ? formatoFechaCorta(suscripcion.proximo_cobro) : 'Pendiente de configurar'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">Sin suscripción activa</p>
            )}
          </div>

          {/* Método de pago */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Método de pago</h3>
            <div className="flex items-center justify-between py-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg px-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Sin método de pago configurado</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Se configurará cuando se integre la pasarela de pagos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Historial de facturas */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Historial de facturas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Fecha</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Concepto</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Total</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Estado</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <svg className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Sin facturas</p>
                      <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Las facturas aparecerán aquí cuando se integre la pasarela de pagos</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cancelación */}
          <div className="bg-white dark:bg-slate-800/50 border border-red-200 dark:border-red-900/30 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Cancelación</h3>
            <p className="text-xs text-slate-600 mb-3 dark:text-slate-400">Cancelar la suscripción desactivará la empresa al final del período de facturación.</p>
            <button disabled className="text-xs font-medium px-4 py-2 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 opacity-50 cursor-not-allowed">
              Cancelar suscripción (requiere pasarela de pagos)
            </button>
          </div>
        </div>
      )}

      {/* Modal "Ver detalle de reclamo" — solo lectura, datos ya cargados en la tabla */}
      <Modal
        open={!!reclamoDetalle}
        onClose={() => setReclamoDetalle(null)}
        title={reclamoDetalle ? `${reclamoDetalle.tipo_solicitud} ${reclamoDetalle.codigo_reclamo}` : ''}
        wide
      >
        {reclamoDetalle && (
          <div className="space-y-5 text-sm">
            {/* Cabecera con estado y metadatos clave */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                reclamoDetalle.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                reclamoDetalle.estado === 'EN_PROCESO' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                reclamoDetalle.estado === 'RESUELTO' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}>{reclamoDetalle.estado}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                reclamoDetalle.tipo_solicitud === 'RECLAMO'
                  ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  : 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              }`}>{reclamoDetalle.tipo_solicitud}</span>
              {reclamoDetalle.canal_origen && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {reclamoDetalle.canal_origen}
                </span>
              )}
              {reclamoDetalle.es_cliente_registrado && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  Cliente registrado
                </span>
              )}
            </div>

            {/* Consumidor */}
            <section>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">Consumidor</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-slate-700 dark:text-slate-300">
                <div><span className="text-slate-500 dark:text-slate-400">Nombre: </span>{reclamoDetalle.nombre_completo || '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">{reclamoDetalle.tipo_documento || 'Documento'}: </span>{reclamoDetalle.numero_documento || '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Email: </span>{reclamoDetalle.email || '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Teléfono: </span>{reclamoDetalle.telefono || '—'}</div>
                {reclamoDetalle.domicilio && (
                  <div className="sm:col-span-2"><span className="text-slate-500 dark:text-slate-400">Domicilio: </span>{reclamoDetalle.domicilio}</div>
                )}
                {reclamoDetalle.menor_de_edad && (
                  <div className="sm:col-span-2"><span className="text-slate-500 dark:text-slate-400">Apoderado (menor de edad): </span>{reclamoDetalle.nombre_apoderado || '—'}</div>
                )}
              </div>
            </section>

            {/* Sede / canal */}
            <section>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">Sede</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-slate-700 dark:text-slate-300">
                <div><span className="text-slate-500 dark:text-slate-400">Nombre: </span>{reclamoDetalle.sede_nombre || '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Dirección: </span>{reclamoDetalle.sede_direccion || '—'}</div>
              </div>
            </section>

            {/* Bien / servicio */}
            <section>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">Bien / Servicio</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-slate-700 dark:text-slate-300">
                <div><span className="text-slate-500 dark:text-slate-400">Tipo: </span>{reclamoDetalle.tipo_bien || '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Monto reclamado: </span>{reclamoDetalle.monto_reclamado != null ? `S/ ${Number(reclamoDetalle.monto_reclamado).toFixed(2)}` : '—'}</div>
                {reclamoDetalle.descripcion_bien && (
                  <div className="sm:col-span-2"><span className="text-slate-500 dark:text-slate-400">Descripción: </span>{reclamoDetalle.descripcion_bien}</div>
                )}
                {reclamoDetalle.numero_pedido && (
                  <div><span className="text-slate-500 dark:text-slate-400">N° pedido: </span>{reclamoDetalle.numero_pedido}</div>
                )}
              </div>
            </section>

            {/* Detalle / descripción */}
            <section>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">Detalle</h4>
              <div className="space-y-2 text-slate-700 dark:text-slate-300">
                {reclamoDetalle.detalle_reclamo && (
                  <div>
                    <div className="text-slate-500 text-xs mb-0.5 dark:text-slate-400">Detalle del {(reclamoDetalle.tipo_solicitud || '').toLowerCase() || 'reclamo'}</div>
                    <div className="whitespace-pre-wrap">{reclamoDetalle.detalle_reclamo}</div>
                  </div>
                )}
                {reclamoDetalle.pedido_consumidor && (
                  <div>
                    <div className="text-slate-500 text-xs mb-0.5 dark:text-slate-400">Pedido del consumidor</div>
                    <div className="whitespace-pre-wrap">{reclamoDetalle.pedido_consumidor}</div>
                  </div>
                )}
                {reclamoDetalle.descripcion_situacion && (
                  <div>
                    <div className="text-slate-500 text-xs mb-0.5 dark:text-slate-400">Descripción de la situación</div>
                    <div className="whitespace-pre-wrap">{reclamoDetalle.descripcion_situacion}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Fechas y asignación */}
            <section>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">Gestión</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-slate-700 dark:text-slate-300 tabular-nums">
                <div><span className="text-slate-500 dark:text-slate-400">Registrado: </span>{reclamoDetalle.fecha_registro ? new Date(reclamoDetalle.fecha_registro).toLocaleString('es-PE') : '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Límite respuesta: </span>{reclamoDetalle.fecha_limite_respuesta ? formatoFechaCorta(reclamoDetalle.fecha_limite_respuesta) : '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Respuesta: </span>{reclamoDetalle.fecha_respuesta ? new Date(reclamoDetalle.fecha_respuesta).toLocaleString('es-PE') : '—'}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Cierre: </span>{reclamoDetalle.fecha_cierre ? new Date(reclamoDetalle.fecha_cierre).toLocaleString('es-PE') : '—'}</div>
                <div className="sm:col-span-2"><span className="text-slate-500 dark:text-slate-400">Atendido por: </span>{reclamoDetalle.nombre_atendido_por || '—'}</div>
              </div>
            </section>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setReclamoDetalle(null)}
                className="text-xs font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal "Agregar usuario existente" — desde panel SA */}
      {id && (
        <ModalAgregarUsuarioExistente
          abierto={mostrarAgregarExistente}
          sedes={sedes}
          roles={[]}
          esAdmin={true}
          alCerrar={() => setMostrarAgregarExistente(false)}
          alAgregado={() => {
            setMostrarAgregarExistente(false);
            cargarDatos();
          }}
          buscarFn={(email) =>
            superadminApi.buscarUsuarioEnCuentaDeEmpresa(id, email) as Promise<AccesoUsuarioEnCuenta[]>
          }
          listarCandidatosFn={() =>
            superadminApi.listarCandidatosCuentaDeEmpresa(id) as Promise<
              import('@/tipos').CandidatoUsuarioCuenta[]
            >
          }
          agregarFn={(datos) => superadminApi.agregarUsuarioExistenteAEmpresa(id, datos)}
        />
      )}
    </div>
  );
}
