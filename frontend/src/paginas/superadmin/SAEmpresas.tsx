import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { superadminApi } from '@/api/superadmin';
import type { Cuenta, TenantResumen } from '@/tipos';

const LIMITE = 20;

export default function SAEmpresas() {
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  const [expandida, setExpandida] = useState<string | null>(null);
  const [empresasPorCuenta, setEmpresasPorCuenta] = useState<Record<string, TenantResumen[]>>({});
  const [cargandoEmpresas, setCargandoEmpresas] = useState<string | null>(null);

  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const cargarCuentas = useCallback(async (nuevoOffset: number, q: string) => {
    setCargando(true);
    try {
      const res = await superadminApi.listarCuentas(nuevoOffset, LIMITE, q);
      setCuentas(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { toast.error('Error al cargar cuentas'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargarCuentas(0, ''); }, [cargarCuentas]);

  const buscar = (valor: string) => {
    setBusqueda(valor);
    if (timerRef[0]) clearTimeout(timerRef[0]);
    const t = setTimeout(() => { setOffset(0); cargarCuentas(0, valor); }, 400);
    timerRef[1](t);
  };

  const expandirCuenta = async (cuentaId: string) => {
    if (expandida === cuentaId) { setExpandida(null); return; }
    setExpandida(cuentaId);

    if (empresasPorCuenta[cuentaId]) return;

    setCargandoEmpresas(cuentaId);
    try {
      const detalle = await superadminApi.obtenerCuenta(cuentaId);
      setEmpresasPorCuenta(prev => ({ ...prev, [cuentaId]: detalle?.tenants ?? [] }));
    } catch {
      setEmpresasPorCuenta(prev => ({ ...prev, [cuentaId]: [] }));
    }
    setCargandoEmpresas(null);
  };

  const toggleEstadoEmpresa = async (tenantId: string, activo: boolean, cuentaId: string) => {
    try {
      await superadminApi.cambiarEstadoEmpresa(tenantId, !activo);
      toast.success(activo ? 'Empresa desactivada' : 'Empresa activada');
      setEmpresasPorCuenta(prev => ({
        ...prev,
        [cuentaId]: (prev[cuentaId] ?? []).map(e => e.tenant_id === tenantId ? { ...e, activo: !activo } : e),
      }));
    } catch { toast.error('Error al cambiar estado'); }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Empresas</h1>
          <p className="text-xs text-slate-600 mt-0.5 dark:text-slate-400">{total} cuentas registradas</p>
        </div>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Buscar por nombre de cuenta, email o RUC..." value={busqueda} onChange={e => buscar(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition" />
      </div>

      <div className="space-y-2">
        {cargando ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse"><div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded" /></div>
        )) : cuentas.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-400">No se encontraron cuentas</div>
        ) : cuentas.map(cuenta => (
          <div key={cuenta.id} className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition ${!cuenta.activo ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10' : 'border-slate-200 dark:border-slate-800'}`}>
            <button onClick={() => expandirCuenta(cuenta.id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <div className="flex items-center gap-3 min-w-0">
                <svg className={`w-4 h-4 text-slate-500 shrink-0 transition ${expandida === cuenta.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${!cuenta.activo ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{cuenta.nombre}</span>
                    {!cuenta.activo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">INACTIVA</span>}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">{cuenta.email_contacto}{cuenta.ruc ? ` · RUC: ${cuenta.ruc}` : ''}</p>
                </div>
              </div>
              <span className="text-xs text-slate-500 shrink-0 dark:text-slate-400">
                {cargandoEmpresas === cuenta.id ? 'Cargando...' : empresasPorCuenta[cuenta.id] ? `${empresasPorCuenta[cuenta.id].length} empresa${empresasPorCuenta[cuenta.id].length !== 1 ? 's' : ''}` : 'Click para ver'}
              </span>
            </button>

            {expandida === cuenta.id && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {cargandoEmpresas === cuenta.id ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500 animate-pulse dark:text-slate-400">Cargando empresas...</div>
                ) : (empresasPorCuenta[cuenta.id] ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Sin empresas
                    <button onClick={() => navigate(`/superadmin/cuentas/${cuenta.id}`)} className="ml-2 text-slate-900 dark:text-white underline">Crear una</button>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left py-2 px-4 text-[10px] font-semibold text-slate-600 uppercase pl-12 dark:text-slate-400">Razón Social</th>
                        <th className="text-left py-2 px-4 text-[10px] font-semibold text-slate-600 uppercase hidden sm:table-cell dark:text-slate-400">RUC</th>
                        <th className="text-left py-2 px-4 text-[10px] font-semibold text-slate-600 uppercase hidden md:table-cell dark:text-slate-400">Slug</th>
                        <th className="text-left py-2 px-4 text-[10px] font-semibold text-slate-600 uppercase dark:text-slate-400">Estado</th>
                        <th className="text-right py-2 px-4 text-[10px] font-semibold text-slate-600 uppercase dark:text-slate-400">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(empresasPorCuenta[cuenta.id] ?? []).map(emp => (
                        <tr key={emp.tenant_id} className={`transition ${!emp.activo ? 'bg-red-50/50 dark:bg-red-950/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                          <td className="py-2.5 px-4 pl-12"><span className={`font-medium ${!emp.activo ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{emp.razon_social}</span></td>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-600 hidden sm:table-cell dark:text-slate-400">{emp.ruc}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 hidden md:table-cell dark:text-slate-400">{emp.slug}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${emp.activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>{emp.activo ? 'ACTIVA' : 'INACTIVA'}</span>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => navigate(`/superadmin/empresas/${emp.tenant_id}`)} className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">Ver</button>
                              <button onClick={() => toggleEstadoEmpresa(emp.tenant_id, emp.activo, cuenta.id)} className={`text-xs font-medium transition ${emp.activo ? 'text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300' : 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300'}`}>{emp.activo ? 'Desactivar' : 'Activar'}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-600 dark:text-slate-400">
          <span>{offset + 1}–{Math.min(offset + LIMITE, total)} de {total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => { const n = offset - LIMITE; setOffset(n); cargarCuentas(n, busqueda); }} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Anterior</button>
            <button disabled={offset + LIMITE >= total} onClick={() => { const n = offset + LIMITE; setOffset(n); cargarCuentas(n, busqueda); }} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
