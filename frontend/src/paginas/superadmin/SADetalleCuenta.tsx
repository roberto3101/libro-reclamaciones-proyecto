import { usarBloqueoScroll } from '@/ui';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { superadminApi } from '@/api/superadmin';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { consultarRucPSE } from '@/aplicacion/helpers/consultaRuc';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { CuentaConTenants, CrearEmpresaRequest, ActualizarCuentaRequest } from '@/tipos';

/* ── Tipos locales ── */
interface FactorSalud {
  nombre: string;
  puntos: number;
  max_puntos: number;
  detalle: string;
}
interface HealthScore {
  puntuacion: number;
  factores: FactorSalud[];
}
interface SuscripcionFactura {
  empresa_nombre: string;
  plan_nombre: string;
  estado: string;
  ciclo: string;
  precio: number;
  proximo_cobro: string;
}
interface Facturacion {
  total_mensual: number;
  proximo_cobro: string;
  total_activas: number;
  total_trials: number;
  suscripciones: SuscripcionFactura[];
}
interface NotaCuenta {
  id: string;
  contenido: string;
  autor_nombre: string;
  fecha: string;
}

/* ── Helpers ── */
function tiempoRelativo(fecha: string): string {
  const ahora = Date.now();
  const objetivo = new Date(fecha).getTime();
  const diff = ahora - objetivo;
  const segs = Math.floor(diff / 1000);
  if (segs < 60) return 'hace un momento';
  const mins = Math.floor(segs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} mes${meses > 1 ? 'es' : ''}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} año${anios > 1 ? 's' : ''}`;
}

function colorPuntuacion(p: number): { bg: string; text: string; ring: string } {
  if (p >= 80) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/30' };
  if (p >= 50) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-500/30' };
  return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-500/30' };
}

function formatearFecha(fecha: string): string {
  if (!fecha) return '\u2014';
  try {
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return fecha;
  }
}

const emptyEmpresaForm: CrearEmpresaRequest = {
  razon_social: '',
  ruc: '',
  email: '',
  password: '',
  nombre_admin: '',
  telefono: '',
  direccion_legal: '',
};

/* ════════════════════════════════════════════════════════════════════ */
export default function SADetalleCuenta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cuenta, setCuenta] = useState<CuentaConTenants | null>(null);
  const [cargando, setCargando] = useState(true);

  // Modal editar cuenta
  const [editarOpen, setEditarOpen] = useState(false);
  const [editForm, setEditForm] = useState<ActualizarCuentaRequest>({});
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // Modal crear empresa
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<CrearEmpresaRequest>(emptyEmpresaForm);
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [planes, setPlanes] = useState<any[]>([]);
  const [planSeleccionado, setPlanSeleccionado] = useState('');
  const [esTrial, setEsTrial] = useState(false);
  const [diasTrial, setDiasTrial] = useState(30);
  const [erroresEmpresa, setErroresEmpresa] = useState<Record<string, string | null>>({});
  const [mostrarPasswordEmpresa, setMostrarPasswordEmpresa] = useState(false);
  const [consultandoRucEmpresa, setConsultandoRucEmpresa] = useState(false);

  // Health Score
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  // Congela el fondo mientras haya cualquiera de los modales abierto.
  usarBloqueoScroll(editarOpen || empresaOpen || healthOpen);
  const healthRef = useRef<HTMLDivElement>(null);

  // Facturacion
  const [facturacion, setFacturacion] = useState<Facturacion | null>(null);

  // Notas / historial
  const [notas, setNotas] = useState<NotaCuenta[]>([]);
  const [nuevaNota, setNuevaNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  /* ── Data loading ── */
  const cargar = async () => {
    if (!id) return;
    setCargando(true);
    try {
      const data = await superadminApi.obtenerCuenta(id);
      setCuenta(data);
    } catch {
      toast.error('Error al cargar la cuenta');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    superadminApi.listarPlanes().then(p => setPlanes(p ?? [])).catch(() => {});
    if (id) {
      superadminApi.healthScoreCuenta(id).then(d => setHealthScore(d ?? null)).catch(() => {});
      superadminApi.facturacionCuenta(id).then(d => setFacturacion(d ?? null)).catch(() => {});
      superadminApi.listarNotasCuenta(id).then(d => setNotas(d ?? [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Close health popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (healthRef.current && !healthRef.current.contains(e.target as Node)) {
        setHealthOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Handlers ── */
  const abrirEditar = () => {
    if (!cuenta) return;
    setEditForm({
      nombre: cuenta.nombre,
      email_contacto: cuenta.email_contacto,
      telefono: cuenta.telefono ?? '',
      ruc: cuenta.ruc ?? '',
      direccion: cuenta.direccion ?? '',
      notas: cuenta.notas ?? '',
    });
    setEditarOpen(true);
  };

  const handleGuardarEdicion = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setGuardandoEdit(true);
    try {
      await superadminApi.actualizarCuenta(id, editForm);
      toast.success('Cuenta actualizada correctamente');
      setEditarOpen(false);
      cargar();
    } catch {
      toast.error('Error al actualizar la cuenta');
    } finally {
      setGuardandoEdit(false);
    }
  };

  const consultarRucEmpresa = async () => {
    const ruc = (empresaForm.ruc || '').trim();
    if (ruc.length !== 11) {
      toast.error('Ingresa un RUC válido de 11 dígitos');
      return;
    }
    setConsultandoRucEmpresa(true);
    try {
      const datos = await consultarRucPSE(ruc);
      if (!datos) {
        toast.error('No se encontraron datos para este RUC');
        return;
      }
      // Autocompleta razón social y dirección (no tocamos teléfono/email
      // porque no vienen del servicio).
      setEmpresaForm((p) => ({
        ...p,
        razon_social: datos.nombrerazon || p.razon_social,
        direccion_legal: datos.direccion || p.direccion_legal,
      }));
      toast.success('Datos de SUNAT cargados');
    } catch {
      toast.error('Error consultando SUNAT. Intenta de nuevo.');
    } finally {
      setConsultandoRucEmpresa(false);
    }
  };

  const handleCrearEmpresa = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    // Guard contra doble submit: si ya estamos guardando, ignoramos el
    // evento. El botón ya tiene `disabled={guardandoEmpresa}` pero si el
    // usuario clickea muy rápido (o presiona Enter repetidamente) el
    // handler puede dispararse antes de que React re-renderice. Este
    // check a nivel de handler lo corta limpio.
    if (guardandoEmpresa) return;
    setGuardandoEmpresa(true);
    try {
      await superadminApi.crearEmpresaBajoCuenta(id, { ...empresaForm, plan_id: planSeleccionado, es_trial: esTrial, dias_trial: esTrial ? diasTrial : 0 } as any);
      toast.success('Empresa creada correctamente');
      setEmpresaOpen(false);
      setEmpresaForm(emptyEmpresaForm);
      setMostrarPasswordEmpresa(false);
      cargar();
    } catch (err) {
      // Propagamos el mensaje real del backend: acá es donde viene el
      // AppError con código semántico (RUC_DUPLICADO, SLUG_DUPLICADO,
      // CUENTA_INACTIVA, etc.). manejarError ya extrae el mensaje del
      // response.data.error.message y dispara el toast.
      manejarError(err, 'Error al crear la empresa');
    } finally {
      setGuardandoEmpresa(false);
    }
  };

  const toggleEmpresa = async (tenantId: string, activo: boolean) => {
    try {
      await superadminApi.cambiarEstadoEmpresa(tenantId, !activo);
      toast.success(activo ? 'Empresa desactivada' : 'Empresa activada');
      cargar();
    } catch {
      toast.error('Error al cambiar estado de la empresa');
    }
  };

  const handleAgregarNota = async () => {
    if (!id || !nuevaNota.trim()) return;
    setGuardandoNota(true);
    try {
      const nota = await superadminApi.crearNotaCuenta(id, nuevaNota.trim());
      setNotas(prev => [nota, ...prev]);
      setNuevaNota('');
      toast.success('Nota agregada');
    } catch {
      toast.error('Error al agregar nota');
    } finally {
      setGuardandoNota(false);
    }
  };

  /* ── Loading state ── */
  if (cargando) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-60 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    );
  }

  if (!cuenta) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 dark:text-slate-400">Cuenta no encontrada</p>
        <button
          onClick={() => navigate('/superadmin/cuentas')}
          className="mt-4 text-slate-600 hover:text-slate-800 dark:text-slate-400 font-medium text-sm"
        >
          Volver a cuentas
        </button>
      </div>
    );
  }

  const hc = colorPuntuacion(healthScore?.puntuacion ?? 0);

  return (
    <div>
      {/* Boton volver */}
      <button
        onClick={() => navigate('/superadmin/cuentas')}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a cuentas
      </button>

      {/* ══════════════ Tarjeta info de cuenta ══════════════ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{cuenta.nombre}</h1>

            {/* ── Health Score badge ── */}
            {healthScore && (
              <div className="relative" ref={healthRef}>
                <button
                  type="button"
                  onClick={() => setHealthOpen(o => !o)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ring-2 ${hc.bg} ${hc.text} ${hc.ring} transition hover:scale-105`}
                  title={`Health Score: ${healthScore.puntuacion}`}
                >
                  {healthScore.puntuacion}
                </button>

                {healthOpen && (
                  <div className="absolute left-0 top-12 z-40 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 animate-in fade-in-0 zoom-in-95">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Health Score</p>
                    <div className="space-y-2">
                      {(healthScore.factores ?? []).map((f, i) => {
                        const pct = f.max_puntos > 0 ? Math.round((f.puntos / f.max_puntos) * 100) : 0;
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{f.nombre}</span>
                              <span className="text-slate-600 dark:text-slate-400">{f.puntos}/{f.max_puntos}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-600'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {f.detalle && <p className="text-[11px] text-slate-500 mt-0.5 dark:text-slate-400">{f.detalle}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <span
              className={
                cuenta.activo
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full text-xs font-medium'
              }
            >
              {cuenta.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <button
            onClick={abrirEditar}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Editar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-600 dark:text-slate-400">Email:</span>
            <p className="font-medium text-slate-900 dark:text-white">{cuenta.email_contacto}</p>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400">RUC:</span>
            <p className="font-medium text-slate-900 dark:text-white">{cuenta.ruc || '\u2014'}</p>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400">Telefono:</span>
            <p className="font-medium text-slate-900 dark:text-white">{cuenta.telefono || '\u2014'}</p>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400">Direccion:</span>
            <p className="font-medium text-slate-900 dark:text-white">{cuenta.direccion || '\u2014'}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-600 dark:text-slate-400">Notas:</span>
            <p className="font-medium text-slate-900 dark:text-white">{cuenta.notas || '\u2014'}</p>
          </div>
        </div>
      </div>

      {/* ══════════════ Facturacion ══════════════ */}
      {facturacion && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Facturación</h2>
              <p className="text-xs text-slate-600 mt-0.5 dark:text-slate-400">Resumen de suscripciones activas de esta cuenta</p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Ingreso mensual</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">S/ {(facturacion.total_mensual ?? 0).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Próximo cobro</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatearFecha(facturacion.proximo_cobro ?? '')}</p>
            </div>
            <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Suscripciones activas</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{facturacion.total_activas ?? 0}</p>
              {(facturacion.total_trials ?? 0) > 0 && (
                <p className="text-xs text-amber-500 mt-0.5">{facturacion.total_trials} en trial</p>
              )}
            </div>
          </div>

          {/* Tabla suscripciones */}
          {(facturacion.suscripciones ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Empresa</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Plan</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Precio</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Próximo cobro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(facturacion.suscripciones ?? []).map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{s.empresa_nombre}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{s.plan_nombre}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.estado === 'ACTIVA'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : s.estado === 'TRIAL'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : s.estado === 'VENCIDA' || s.estado === 'CANCELADA'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {s.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white">S/ {(s.precio ?? 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{formatearFecha(s.proximo_cobro ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ Seccion empresas ══════════════ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Empresas de esta cuenta</h2>
        {cuenta.activo ? (
          <button
            onClick={() => {
              setEmpresaForm(emptyEmpresaForm);
              setPlanSeleccionado('');
              setEsTrial(false);
              setMostrarPasswordEmpresa(false);
              setEmpresaOpen(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Crear Empresa
          </button>
        ) : (
          <span className="text-xs text-red-600 font-medium">Cuenta inactiva — no se pueden crear empresas</span>
        )}
      </div>

      {(cuenta.tenants ?? []).length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm text-center mb-6">
          <p className="text-slate-600 dark:text-slate-400">Esta cuenta no tiene empresas aun</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {(cuenta.tenants ?? []).map((t) => (
            <div
              key={t.tenant_id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-slate-900 dark:text-white text-sm">{t.razon_social}</h3>
                <span
                  className={
                    t.activo
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full text-xs font-medium'
                  }
                >
                  {t.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">RUC: {t.ruc}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Slug: {t.slug}</p>
              <button
                onClick={() => toggleEmpresa(t.tenant_id, t.activo)}
                className={`text-xs font-medium ${
                  t.activo
                    ? 'text-red-700 hover:text-red-800 dark:text-red-400'
                    : 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-400'
                }`}
              >
                {t.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════ Historial de interacciones ══════════════ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Historial de interacciones</h2>

        {/* Input nueva nota */}
        <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700/50">
          <textarea
            rows={2}
            value={nuevaNota}
            onChange={e => setNuevaNota(e.target.value.slice(0, 500))}
            placeholder="Ej: Llamada con el cliente, acordamos migrar al plan PYME el próximo mes..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{nuevaNota.length}/500</span>
            <button
              type="button"
              onClick={handleAgregarNota}
              disabled={guardandoNota || !nuevaNota.trim()}
              className="text-xs font-medium px-4 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50"
            >
              {guardandoNota ? 'Guardando...' : 'Agregar nota'}
            </button>
          </div>
        </div>

        {/* Timeline */}
        {(notas ?? []).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin notas registradas</p>
            <p className="text-xs text-slate-500/70 mt-0.5">Agrega la primera nota sobre esta cuenta</p>
          </div>
        ) : (
          <div className="relative pl-7">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-4">
              {(notas ?? []).map(nota => (
                <div key={nota.id} className="relative group">
                  <div className="absolute -left-7 top-2 w-[9px] h-[9px] rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-slate-500 dark:group-hover:border-slate-400 transition" />
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition">
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{nota.contenido}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{nota.autor_nombre?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{nota.autor_nombre}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">·</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400" title={nota.fecha}>{tiempoRelativo(nota.fecha)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════ Modal editar cuenta ══════════════ */}
      <ModalBase
        abierto={editarOpen}
        alCerrar={() => setEditarOpen(false)}
        titulo="Editar Cuenta"
        maxAncho="md"
        bloqueado={guardandoEdit}
        pie={
          <>
            <BotonModal
              texto={guardandoEdit ? 'Guardando...' : 'Guardar'}
              variante="primario"
              onClick={() => {
                const fakeEvent = { preventDefault: () => {} } as FormEvent;
                handleGuardarEdicion(fakeEvent);
              }}
              cargando={guardandoEdit}
            />
            <BotonModal
              texto="Cancelar"
              variante="secundario"
              onClick={() => setEditarOpen(false)}
              deshabilitado={guardandoEdit}
            />
          </>
        }
      >
        <form id="form-editar-cuenta" onSubmit={handleGuardarEdicion} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
            <input
              type="text"
              value={editForm.nombre ?? ''}
              onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email contacto</label>
            <input
              type="email"
              value={editForm.email_contacto ?? ''}
              onChange={(e) => setEditForm({ ...editForm, email_contacto: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefono</label>
              <input
                type="text"
                value={editForm.telefono ?? ''}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">RUC</label>
              <input
                type="text"
                value={editForm.ruc ?? ''}
                onChange={(e) => setEditForm({ ...editForm, ruc: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Direccion</label>
            <input
              type="text"
              value={editForm.direccion ?? ''}
              onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas</label>
            <textarea
              rows={2}
              value={editForm.notas ?? ''}
              onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition resize-none"
            />
          </div>
        </form>
      </ModalBase>

      {/* ══════════════ Modal crear empresa ══════════════ */}
      {empresaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop: NO cierra al click para evitar perder el formulario
              por un click accidental. El cierre se hace por el botón X o Cancelar. */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Crear Empresa</h3>
              <button onClick={() => !guardandoEmpresa && setEmpresaOpen(false)} className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition dark:text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCrearEmpresa} className="p-6 space-y-4">
              {/* Datos de la empresa */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Datos de la empresa</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* RUC primero: al consultar rellena razón social + dirección */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">RUC <span className="text-red-600">*</span></label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={empresaForm.ruc}
                      onChange={e => setEmpresaForm({ ...empresaForm, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                      placeholder="20123456789"
                      maxLength={11}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={consultarRucEmpresa}
                      disabled={empresaForm.ruc.length !== 11 || consultandoRucEmpresa}
                      title="Consultar SUNAT via PSE Peru"
                      className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {consultandoRucEmpresa ? 'Consultando...' : 'Consultar'}
                    </button>
                  </div>
                  {empresaForm.ruc && empresaForm.ruc.length !== 11 && <p className="text-[11px] text-amber-500 mt-0.5">{empresaForm.ruc.length}/11 dígitos</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Razón Social <span className="text-red-600">*</span></label>
                  <input type="text" required value={empresaForm.razon_social} onChange={e => setEmpresaForm({ ...empresaForm, razon_social: e.target.value })} placeholder="Empresa S.A.C." maxLength={150}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Dirección Legal</label>
                  <input type="text" value={empresaForm.direccion_legal ?? ''} onChange={e => setEmpresaForm({ ...empresaForm, direccion_legal: e.target.value })} placeholder="Av. Los Próceres 123, Lima" maxLength={200}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Teléfono</label>
                  <input type="text" value={empresaForm.telefono ?? ''} onChange={e => setEmpresaForm({ ...empresaForm, telefono: e.target.value })} placeholder="987654321"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
                </div>
              </div>

              {/* Plan */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2 dark:text-slate-400">Plan de suscripción</p>
              <div className="grid grid-cols-2 gap-2">
                {planes.filter((p: any) => p.activo).map((plan: any) => (
                  <button type="button" key={plan.id} onClick={() => setPlanSeleccionado(plan.id)}
                    className={`text-left p-3 rounded-lg border transition ${planSeleccionado === plan.id ? 'border-slate-900 dark:border-white ring-1 ring-slate-900/20 dark:ring-white/20 bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{plan.nombre}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">S/ {plan.precio_mensual}/mes</p>
                  </button>
                ))}
              </div>

              {/* Trial */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={esTrial} onChange={e => setEsTrial(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:text-slate-100" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Iniciar con período de prueba</span>
                </label>
                {esTrial && (
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={1} max={90} value={diasTrial} onChange={e => setDiasTrial(Number(e.target.value))} className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none text-center" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">días</span>
                  </div>
                )}
              </div>

              {/* Usuario administrador */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2 dark:text-slate-400">Usuario administrador</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nombre completo <span className="text-red-600">*</span></label>
                  <input type="text" required value={empresaForm.nombre_admin} onChange={e => setEmpresaForm({ ...empresaForm, nombre_admin: e.target.value })} placeholder="Juan Pérez"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email <span className="text-red-600">*</span></label>
                  <input type="email" required value={empresaForm.email} onChange={e => setEmpresaForm({ ...empresaForm, email: e.target.value })} placeholder="admin@empresa.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Contraseña <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <input
                      type={mostrarPasswordEmpresa ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={empresaForm.password}
                      onChange={e => setEmpresaForm({ ...empresaForm, password: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPasswordEmpresa(v => !v)}
                      tabIndex={-1}
                      aria-label={mostrarPasswordEmpresa ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      title={mostrarPasswordEmpresa ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 transition dark:text-slate-400"
                    >
                      {mostrarPasswordEmpresa ? (
                        // Ojo tachado (ocultar)
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      ) : (
                        // Ojo abierto (mostrar)
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {empresaForm.password && empresaForm.password.length < 8 && <p className="text-[11px] text-red-600 mt-0.5">Mínimo 8 caracteres</p>}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setEmpresaOpen(false)} disabled={guardandoEmpresa} className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={guardandoEmpresa} className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50">
                  {guardandoEmpresa ? 'Creando...' : 'Crear empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
