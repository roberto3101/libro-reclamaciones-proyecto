import { useState, useRef, useEffect } from 'react';
import { usarAuth } from '@/aplicacion/ganchos/usarAuth';
import { usarTenant } from '@/modulos/tenant/ganchos/usarTenant';
import { manejarError } from '@/aplicacion/helpers/errores';

export function SelectorEmpresa() {
  const { empresasAccesibles, cambiarEmpresa, usuario } = usarAuth();
  const { tenant } = usarTenant();
  const [abierto, setAbierto] = useState(false);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const refContenedor = useRef<HTMLDivElement>(null);

  // No mostrar si el usuario solo tiene 1 empresa (o ninguna)
  if (!empresasAccesibles || empresasAccesibles.length <= 1) return null;

  const nombreActual = tenant?.razon_social || 'Mi Empresa';
  const tenantIdActual = usuario?.tenant_id;

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return;
    const cerrarAlClickFuera = (e: MouseEvent) => {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', cerrarAlClickFuera);
    return () => document.removeEventListener('mousedown', cerrarAlClickFuera);
  }, [abierto]);

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [abierto]);

  const manejarCambio = async (tenantId: string) => {
    if (tenantId === tenantIdActual || cambiandoId) return;
    setCambiandoId(tenantId);
    try {
      await cambiarEmpresa(tenantId);
    } catch (err) {
      manejarError(err, 'No se pudo cambiar de empresa');
      setCambiandoId(null);
    }
  };

  return (
    <div ref={refContenedor} className="relative">
      {/* Botón trigger */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
          text-gray-700 dark:text-gray-200
          hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors max-w-[200px] cursor-pointer"
        title={`Empresa actual: ${nombreActual}`}
      >
        <svg className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="truncate">{nombreActual}</span>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {abierto && (
        <div className="absolute top-full right-0 mt-1 w-72 rounded-xl shadow-lg
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          py-1.5 z-[1500]
          animate-[fadeIn_0.15s_ease]"
        >
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Cambiar empresa
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {empresasAccesibles.map((empresa) => {
              const esActual = empresa.tenant_id === tenantIdActual;
              const estaCambiando = cambiandoId === empresa.tenant_id;

              return (
                <button
                  key={empresa.tenant_id}
                  type="button"
                  onClick={() => manejarCambio(empresa.tenant_id)}
                  disabled={esActual || !!cambiandoId}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                    ${esActual
                      ? 'bg-blue-50 dark:bg-blue-900/20 cursor-default'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'}
                    ${cambiandoId && !estaCambiando ? 'opacity-50' : ''}
                  `}
                >
                  {/* Inicial */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0
                    ${esActual ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'}`}
                  >
                    {empresa.razon_social.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate
                      ${esActual ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}
                    >
                      {empresa.razon_social}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{empresa.rol}</p>
                  </div>

                  {/* Indicador */}
                  {estaCambiando ? (
                    <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
                  ) : esActual ? (
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
