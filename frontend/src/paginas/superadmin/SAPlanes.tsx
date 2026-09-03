import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { superadminApi } from '@/api/superadmin';
import type { Plan } from '@/tipos';
import { formatoLimite } from '@/tipos/plan';

type Vista = 'lista' | 'editar' | 'crear';

const FEATURES: { key: keyof Plan; label: string }[] = [
  { key: 'permite_chatbot', label: 'Chatbot' },
  { key: 'permite_whatsapp', label: 'WhatsApp' },
  { key: 'permite_email', label: 'Email' },
  { key: 'permite_reportes_pdf', label: 'Reportes PDF' },
  { key: 'permite_exportar_excel', label: 'Exportar Excel' },
  { key: 'permite_asistente_ia', label: 'Asistente IA' },
  { key: 'permite_atencion_vivo', label: 'Atención en vivo' },
];

const LIMITES: { key: keyof Plan; label: string; suffix?: string }[] = [
  { key: 'max_sedes', label: 'Sedes' },
  { key: 'max_usuarios', label: 'Usuarios' },
  { key: 'max_chatbots', label: 'Chatbots' },
  { key: 'max_canales_whatsapp', label: 'Canales WhatsApp' },
];

function planVacio(): Partial<Plan> {
  return {
    codigo: '', nombre: '', descripcion: null,
    precio_mensual: 0, precio_anual: null, precio_sede_extra: 0, precio_usuario_extra: 0,
    max_sedes: 1, max_usuarios: 1, max_reclamos_mes: 100, max_chatbots: 0, max_canales_whatsapp: 0, max_storage_mb: 500,
    permite_chatbot: false, permite_whatsapp: false, permite_email: true,
    permite_reportes_pdf: true, permite_exportar_excel: true, permite_api: false,
    permite_marca_blanca: false, permite_multi_idioma: false, permite_asistente_ia: false, permite_atencion_vivo: false,
    orden: 0, activo: true, destacado: false,
  };
}

function CampoNum({ label, value, onChange, suffix, ilimitado }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; ilimitado?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={ilimitado ? '' : value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={ilimitado}
          placeholder={ilimitado ? 'Ilimitado' : '0'}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 outline-none transition disabled:opacity-40"
        />
        {suffix && <span className="text-xs text-slate-500 shrink-0 dark:text-slate-400">{suffix}</span>}
        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={value === -1}
            onChange={(e) => onChange(e.target.checked ? -1 : 1)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:text-slate-100"
          />
          <span className="text-[11px] text-slate-600 whitespace-nowrap dark:text-slate-400">Ilimitado</span>
        </label>
      </div>
    </div>
  );
}

export default function SAPlanes() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>('lista');
  const [form, setForm] = useState<Partial<Plan>>(planVacio());
  const [editId, setEditId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      setPlanes(await superadminApi.listarPlanes());
    } catch { toast.error('Error al cargar planes'); }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const abrirEditar = (plan: Plan) => {
    setForm({ ...plan });
    setEditId(plan.id);
    setVista('editar');
  };

  const abrirCrear = () => {
    setForm(planVacio());
    setEditId(null);
    setVista('crear');
  };

  const guardar = async () => {
    if (!form.nombre || !form.codigo) {
      toast.error('Código y nombre son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      if (editId) {
        await superadminApi.actualizarPlan(editId, form);
        toast.success('Plan actualizado');
      } else {
        await superadminApi.crearPlan(form);
        toast.success('Plan creado');
      }
      await cargar();
      setVista('lista');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al guardar');
    }
    setGuardando(false);
  };

  const setField = <K extends keyof Plan>(key: K, val: Plan[K]) => setForm(prev => ({ ...prev, [key]: val }));

  // ── Vista: Formulario (crear/editar) ──
  if (vista !== 'lista') {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setVista('lista')} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:hover:text-white transition mb-4 dark:text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Volver a planes
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
          {editId ? 'Editar plan' : 'Crear plan'}
        </h1>

        <div className="space-y-6">
          {/* Datos base */}
          <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Información general</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Código</label>
                <input
                  value={form.codigo || ''}
                  onChange={(e) => setField('codigo', e.target.value.toUpperCase())}
                  disabled={!!editId}
                  placeholder="EMPRENDEDOR"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-slate-900 outline-none transition disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nombre</label>
                <input
                  value={form.nombre || ''}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder="Plan Emprendedor"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Descripción</label>
                <textarea
                  value={form.descripcion || ''}
                  onChange={(e) => setField('descripcion', e.target.value || null)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Orden</label>
                <input
                  type="number"
                  value={form.orden ?? 0}
                  onChange={(e) => setField('orden', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition"
                />
              </div>
              <div className="flex items-end gap-6 pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activo ?? true} onChange={(e) => setField('activo', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:text-slate-100" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.destacado ?? false} onChange={(e) => setField('destacado', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:text-slate-100" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Destacado</span>
                </label>
              </div>
            </div>
          </section>

          {/* Precios */}
          <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Precios (S/)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Mensual</label>
                <input type="number" step="0.01" value={form.precio_mensual ?? 0} onChange={(e) => setField('precio_mensual', Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Anual</label>
                <input type="number" step="0.01" value={form.precio_anual ?? ''} onChange={(e) => setField('precio_anual', e.target.value ? Number(e.target.value) : null)} placeholder="Opcional" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Sede extra</label>
                <input type="number" step="0.01" value={form.precio_sede_extra ?? 0} onChange={(e) => setField('precio_sede_extra', Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Usuario extra</label>
                <input type="number" step="0.01" value={form.precio_usuario_extra ?? 0} onChange={(e) => setField('precio_usuario_extra', Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 outline-none transition" />
              </div>
            </div>
          </section>

          {/* Límites */}
          <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Límites de recursos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LIMITES.map(l => (
                <CampoNum
                  key={l.key as string}
                  label={l.label}
                  value={(form as any)[l.key] ?? 0}
                  onChange={(v) => setField(l.key as any, v)}
                  suffix={l.suffix}
                  ilimitado={(form as any)[l.key] === -1}
                />
              ))}
            </div>
          </section>

          {/* Funcionalidades */}
          <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Funcionalidades</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {FEATURES.map(f => (
                <label key={f.key as string} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={(form as any)[f.key] ?? false}
                    onChange={(e) => setField(f.key as any, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:text-slate-100"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{f.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pb-8">
            <button onClick={() => setVista('lista')} className="text-sm font-medium px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} className="text-sm font-medium px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50">
              {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista: Lista ──
  if (cargando) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Planes</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5 animate-pulse">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-700/50 rounded" />
                <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-700/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Planes</h1>
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo plan
        </button>
      </div>

      {planes.length === 0 ? (
        <div className="text-center py-20 text-slate-600 dark:text-slate-400">
          <p className="mb-4">No hay planes registrados</p>
          <button onClick={abrirCrear} className="text-sm text-slate-900 dark:text-white underline">Crear el primero</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {planes.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border bg-white dark:bg-slate-800/50 p-5 relative transition hover:shadow-md ${
                plan.destacado
                  ? 'border-slate-900 dark:border-white ring-1 ring-slate-900/10 dark:ring-white/10'
                  : 'border-slate-200 dark:border-slate-700/50'
              } ${!plan.activo ? 'opacity-60' : ''}`}
            >
              {plan.destacado && (
                <span className="absolute -top-2.5 right-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  Destacado
                </span>
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{plan.nombre}</h3>
                  <p className="text-xs text-slate-600 font-mono dark:text-slate-400">{plan.codigo}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  plan.activo ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {plan.activo ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                S/ {plan.precio_mensual.toFixed(2)}
                <span className="text-sm font-normal text-slate-600 dark:text-slate-400">/mes</span>
              </p>
              {plan.precio_anual != null && (
                <p className="text-xs text-slate-600 mb-3 dark:text-slate-400">S/ {plan.precio_anual.toFixed(2)}/anual</p>
              )}

              <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 mt-3 space-y-1.5 text-xs">
                {LIMITES.slice(0, 4).map(l => (
                  <div key={l.key as string} className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>{l.label}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{formatoLimite((plan as any)[l.key])}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                {FEATURES.filter(f => (plan as any)[f.key]).map(f => (
                  <span key={f.key as string} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{f.label}</span>
                ))}
              </div>

              <button
                onClick={() => abrirEditar(plan)}
                className="w-full mt-4 text-sm font-medium py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Editar plan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
