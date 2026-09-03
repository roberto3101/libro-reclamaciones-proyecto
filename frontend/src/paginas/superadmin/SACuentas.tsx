import { usarBloqueoScroll } from '@/ui';
import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { superadminApi } from '@/api/superadmin';
import { consultarRucPSE } from '@/aplicacion/helpers/consultaRuc';
import type { Cuenta, CrearCuentaRequest } from '@/tipos';
import intlTelInput from 'intl-tel-input';
import 'intl-tel-input/build/css/intlTelInput.css';

const LIMITE = 20;

type FormCuenta = CrearCuentaRequest & { id?: string };
type FiltroEstado = 'todos' | 'activos' | 'inactivos';

const formVacio: FormCuenta = { nombre: '', email_contacto: '', telefono: '', ruc: '', direccion: '', notas: '' };

const VALIDACIONES = {
  nombre: { min: 3, max: 100, sinNumeros: true },
  email: { min: 5, max: 100 },
  ruc: { exacto: 11, soloNumeros: true },
  direccion: { max: 200 },
  notas: { max: 500 },
};

function validarCampo(campo: string, valor: string): string | null {
  const v = valor.trim();
  switch (campo) {
    case 'nombre':
      if (v.length < VALIDACIONES.nombre.min) return `Mínimo ${VALIDACIONES.nombre.min} caracteres`;
      if (v.length > VALIDACIONES.nombre.max) return `Máximo ${VALIDACIONES.nombre.max} caracteres`;
      if (/\d/.test(v)) return 'No puede contener números';
      return null;
    case 'email_contacto':
      if (v.length < VALIDACIONES.email.min) return 'Email muy corto';
      if (v.length > VALIDACIONES.email.max) return `Máximo ${VALIDACIONES.email.max} caracteres`;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Formato de email inválido';
      return null;
    case 'ruc':
      if (!v) return null;
      if (!/^\d+$/.test(v)) return 'Solo números';
      if (v.length !== 11) return 'Debe tener 11 dígitos';
      return null;
    case 'direccion':
      if (v.length > VALIDACIONES.direccion.max) return `Máximo ${VALIDACIONES.direccion.max} caracteres`;
      return null;
    case 'notas':
      if (v.length > VALIDACIONES.notas.max) return `Máximo ${VALIDACIONES.notas.max} caracteres`;
      return null;
    default: return null;
  }
}

export default function SACuentas() {
  const navigate = useNavigate();

  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  // Congela el fondo mientras el modal esta abierto.
  usarBloqueoScroll(modalAbierto);
  const [form, setForm] = useState<FormCuenta>(formVacio);
  const [errores, setErrores] = useState<Record<string, string | null>>({});
  const [guardando, setGuardando] = useState(false);
  const [consultandoRuc, setConsultandoRuc] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<any>(null);

  const cargar = useCallback(async (nuevoOffset: number, q: string) => {
    setCargando(true);
    try {
      const res = await superadminApi.listarCuentas(nuevoOffset, LIMITE, q);
      setCuentas(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { toast.error('Error al cargar cuentas'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(0, ''); }, [cargar]);

  const buscar = (valor: string) => {
    setBusqueda(valor);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setOffset(0); cargar(0, valor); }, 400);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const telefonoParaCargar = useRef('');

  useEffect(() => {
    if (modalAbierto && phoneRef.current && !itiRef.current) {
      const iti = intlTelInput(phoneRef.current, {
        initialCountry: 'pe',
        countryOrder: ['pe', 'co', 'ec', 'cl', 'mx', 'us'],
        separateDialCode: true,
        autoPlaceholder: 'polite' as any,
        ...(({ utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@26.1.1/build/js/utils.js' }) as any),
      } as any);
      itiRef.current = iti;

      if (telefonoParaCargar.current) {
        setTimeout(() => {
          try { iti.setNumber(telefonoParaCargar.current); } catch {}
        }, 500);
      }
    }
    if (!modalAbierto && itiRef.current) {
      itiRef.current.destroy();
      itiRef.current = null;
    }
  }, [modalAbierto]);

  const abrirCrear = () => { setForm(formVacio); setErrores({}); telefonoParaCargar.current = ''; setModalAbierto(true); };
  const abrirEditar = (c: Cuenta) => {
    setForm({ id: c.id, nombre: c.nombre, email_contacto: c.email_contacto, telefono: c.telefono ?? '', ruc: c.ruc ?? '', direccion: c.direccion ?? '', notas: c.notas ?? '' });
    setErrores({});
    telefonoParaCargar.current = c.telefono ?? '';
    setModalAbierto(true);
  };

  const validarTodo = (): boolean => {
    const e: Record<string, string | null> = {};
    e.nombre = validarCampo('nombre', form.nombre);
    e.email_contacto = validarCampo('email_contacto', form.email_contacto);
    e.ruc = validarCampo('ruc', form.ruc || '');
    e.direccion = validarCampo('direccion', form.direccion || '');
    e.notas = validarCampo('notas', form.notas || '');
    if (itiRef.current) {
      const num = itiRef.current.getNumber();
      if (num && !itiRef.current.isValidNumber()) e.telefono = 'Número de teléfono inválido';
    }
    setErrores(e);
    return !Object.values(e).some(v => v !== null);
  };

  // Autocompletar nombre + dirección a partir del RUC consultado a SUNAT via PSE Peru.
  // No toca email_contacto ni teléfono porque el servicio no los provee.
  const consultarRuc = async () => {
    const ruc = (form.ruc || '').trim();
    if (ruc.length !== 11) {
      toast.error('Ingresa un RUC válido de 11 dígitos');
      return;
    }
    setConsultandoRuc(true);
    try {
      const datos = await consultarRucPSE(ruc);
      if (!datos) {
        toast.error('No se encontraron datos para este RUC');
        return;
      }
      setForm((p) => ({
        ...p,
        nombre: datos.nombrerazon || p.nombre,
        direccion: datos.direccion || p.direccion,
      }));
      toast.success('Datos de SUNAT cargados');
    } catch {
      toast.error('Error consultando SUNAT. Intenta de nuevo.');
    } finally {
      setConsultandoRuc(false);
    }
  };

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validarTodo()) return;

    let telefono = form.telefono;
    if (itiRef.current) {
      try {
        const num = itiRef.current.getNumber();
        if (num) telefono = num;
        else if (phoneRef.current?.value) {
          const countryData = itiRef.current.getSelectedCountryData();
          telefono = '+' + countryData.dialCode + phoneRef.current.value.replace(/\D/g, '');
        }
      } catch {
        if (phoneRef.current?.value) telefono = phoneRef.current.value;
      }
    }
    const datos = { ...form, telefono };

    setGuardando(true);
    try {
      if (form.id) {
        const { id, ...rest } = datos;
        await superadminApi.actualizarCuenta(id!, rest);
        toast.success('Cuenta actualizada');
      } else {
        await superadminApi.crearCuenta(datos);
        toast.success('Cuenta creada');
      }
      setModalAbierto(false);
      cargar(offset, busqueda);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Error al guardar');
    }
    setGuardando(false);
  };

  const toggleEstado = async (c: Cuenta) => {
    try {
      await superadminApi.cambiarEstadoCuenta(c.id, !c.activo);
      toast.success(c.activo ? 'Cuenta desactivada' : 'Cuenta activada');
      cargar(offset, busqueda);
    } catch { toast.error('Error al cambiar estado'); }
  };

  const cuentasFiltradas = cuentas.filter(c => {
    if (filtroEstado === 'activos') return c.activo;
    if (filtroEstado === 'inactivos') return !c.activo;
    return true;
  });

  const totalPaginas = Math.ceil(total / LIMITE);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestión de Cuentas</h1>
        <button onClick={abrirCrear} className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition">
          + Nueva Cuenta
        </button>
      </div>

      {/* Buscador + Filtro estado */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, email o RUC..."
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition"
        />
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {([['todos', 'Todos'], ['activos', 'Activos'], ['inactivos', 'Inactivos']] as [FiltroEstado, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setFiltroEstado(v)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filtroEstado === v ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Nombre</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase hidden sm:table-cell dark:text-slate-400">Email</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase hidden md:table-cell dark:text-slate-400">RUC</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Estado</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cargando ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse"><td colSpan={5} className="py-4 px-4"><div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" /></td></tr>
            )) : cuentasFiltradas.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-600 dark:text-slate-400">No se encontraron cuentas</td></tr>
            ) : cuentasFiltradas.map(c => (
              <tr key={c.id} className={`transition ${!c.activo ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <td className="py-3 px-4">
                  <button onClick={() => navigate(`/superadmin/cuentas/${c.id}`)} className={`font-medium text-left hover:underline ${!c.activo ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                    {c.nombre}
                  </button>
                  <p className="text-[11px] text-slate-600 sm:hidden dark:text-slate-400">{c.email_contacto}</p>
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 hidden sm:table-cell">{c.email_contacto}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600 hidden md:table-cell dark:text-slate-400">{c.ruc || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {c.activo ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => abrirEditar(c)} className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">Editar</button>
                    <button onClick={() => toggleEstado(c)} className={`text-xs font-medium transition ${c.activo ? 'text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300' : 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300'}`}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-600 dark:text-slate-400">
          <span>{offset + 1}–{Math.min(offset + LIMITE, total)} de {total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => { const n = offset - LIMITE; setOffset(n); cargar(n, busqueda); }} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Anterior</button>
            <button disabled={offset + LIMITE >= total} onClick={() => { const n = offset + LIMITE; setOffset(n); cargar(n, busqueda); }} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Siguiente</button>
          </div>
        </div>
      )}

      {/* ══════ Modal Crear/Editar ══════ */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop: NO cierra al click para evitar perder el formulario
              por un click accidental. El cierre se hace por el botón X o Cancelar. */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{form.id ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
              <button onClick={() => !guardando && setModalAbierto(false)} className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition dark:text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={guardar} className="p-6 space-y-4">
              {/* RUC primero: al consultar autocompleta nombre y dirección */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">RUC</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.ruc || ''}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    onBlur={() => setErrores({ ...errores, ruc: validarCampo('ruc', form.ruc || '') })}
                    placeholder="20123456789"
                    maxLength={11}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={consultarRuc}
                    disabled={(form.ruc || '').length !== 11 || consultandoRuc}
                    title="Consultar SUNAT via PSE Peru"
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {consultandoRuc ? 'Consultando...' : 'Consultar'}
                  </button>
                </div>
                {errores.ruc && <p className="text-xs text-red-600 mt-1">{errores.ruc}</p>}
              </div>

              {/* Nombre */}
              <CampoTexto label="Nombre de la cuenta" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} error={errores.nombre} required placeholder="Ej: Grupo Quma SAC" maxLength={100} onBlur={() => setErrores({ ...errores, nombre: validarCampo('nombre', form.nombre) })} />

              {/* Email */}
              <CampoTexto label="Email de contacto" value={form.email_contacto} onChange={v => setForm({ ...form, email_contacto: v })} error={errores.email_contacto} required type="email" placeholder="contacto@empresa.com" maxLength={100} onBlur={() => setErrores({ ...errores, email_contacto: validarCampo('email_contacto', form.email_contacto) })} />

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Teléfono</label>
                <input ref={phoneRef} type="tel" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
                {errores.telefono && <p className="text-xs text-red-600 mt-1">{errores.telefono}</p>}
              </div>

              {/* Dirección */}
              <CampoTexto label="Dirección" value={form.direccion || ''} onChange={v => setForm({ ...form, direccion: v })} error={errores.direccion} placeholder="Av. Los Próceres 123" maxLength={200} onBlur={() => setErrores({ ...errores, direccion: validarCampo('direccion', form.direccion || '') })} contador />

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notas internas</label>
                <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} onBlur={() => setErrores({ ...errores, notas: validarCampo('notas', form.notas || '') })} rows={2} maxLength={500} placeholder="Notas visibles solo para el equipo interno..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition resize-none" />
                <div className="flex justify-between mt-0.5">
                  {errores.notas ? <p className="text-xs text-red-600">{errores.notas}</p> : <span />}
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{(form.notas || '').length}/500</span>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setModalAbierto(false)} disabled={guardando} className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={guardando} className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50">
                  {guardando ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoTexto({ label, value, onChange, error, required, type, placeholder, maxLength, onBlur, contador }: {
  label: string; value: string; onChange: (v: string) => void; error?: string | null; required?: boolean; type?: string; placeholder?: string; maxLength?: number; onBlur?: () => void; contador?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{label}{required && <span className="text-red-600 ml-0.5">*</span>}</label>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} required={required} placeholder={placeholder} maxLength={maxLength}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 transition ${error ? 'border-red-300 dark:border-red-700 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-slate-900 dark:focus:ring-slate-400'}`} />
      <div className="flex justify-between mt-0.5">
        {error ? <p className="text-xs text-red-600">{error}</p> : <span />}
        {contador && maxLength && <span className="text-[10px] text-slate-500 dark:text-slate-400">{value.length}/{maxLength}</span>}
      </div>
    </div>
  );
}
