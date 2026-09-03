import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usarAuth } from '@/aplicacion/ganchos/usarAuth';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { EmpresaAccesible } from '@/tipos';
import css from './PaginaSeleccionarEmpresa.module.css';

/* Distintivo de empresa cuando no hay logo.

   Antes eran diez colores saturados —azul, violeta, fucsia, naranja— que
   no pertenecían a ninguna paleta del sistema y convertían la lista en un
   muestrario. Ahora son cuatro tintas apagadas de la misma familia: bastan
   para distinguir una fila de otra, que es lo único que se les pedía. */
const TINTAS = ['#6a655a', '#40613a', '#29585c', '#8a6112'];

function tintaDe(indice: number): string {
  return TINTAS[indice % TINTAS.length];
}

interface EstadoSeleccion {
  empresas: EmpresaAccesible[];
  tokenTemporal: string;
}

export default function PaginaSeleccionarEmpresa() {
  const { autenticado } = usarEstadoAuth();
  const { seleccionarEmpresa } = usarAuth();
  const location = useLocation();
  const state = location.state as EstadoSeleccion | null;

  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Si ya está autenticado, ir al dashboard
  if (autenticado) return <Navigate to="/dashboard" replace />;

  // Si no hay datos de empresas (acceso directo a la URL), volver al login
  if (!state?.empresas || !state?.tokenTemporal) {
    return <Navigate to="/acceso" replace />;
  }

  const { empresas, tokenTemporal } = state;

  const manejarSeleccion = async (empresa: EmpresaAccesible) => {
    if (cargandoId) return;
    setCargandoId(empresa.tenant_id);
    setError('');

    try {
      await seleccionarEmpresa(tokenTemporal, empresa.tenant_id);
    } catch (err) {
      manejarError(err, 'No se pudo ingresar a la empresa');
      setError('No se pudo ingresar. Intenta de nuevo.');
      setCargandoId(null);
    }
  };

  return (
    <div className={css.raiz}>
      <div className={css.columna}>
        {/* El encabezado va alineado a la izquierda, como el resto de la
            columna: centrarlo dejaba los renglones flotando sin eje común
            con la lista que viene debajo. */}
        <header className={css.cabecera}>
          <p className={css.antetitulo}>Acceso</p>
          <h1 className={css.titulo}>Selecciona tu empresa</h1>
          <p className={css.nota}>
            Tu cuenta tiene acceso a {empresas.length}{' '}
            {empresas.length === 1 ? 'empresa' : 'empresas'}. Elige a cuál deseas ingresar.
          </p>
        </header>

        {error && (
          <p className={css.error} role="alert">
            {error}
          </p>
        )}

        {/* Lista, no rejilla de tarjetas: son registros de una misma clase y
            se leen mejor uno debajo de otro, separados por filete. */}
        <ul className={css.lista}>
          {empresas.map((empresa, indice) => (
            <li key={empresa.tenant_id}>
              <button
                type="button"
                className={css.fila}
                onClick={() => manejarSeleccion(empresa)}
                disabled={!!cargandoId}
                aria-busy={cargandoId === empresa.tenant_id}
              >
                {empresa.logo_url ? (
                  <img src={empresa.logo_url} alt="" className={css.logo} />
                ) : (
                  <span className={css.inicial} style={{ background: tintaDe(indice) }} aria-hidden="true">
                    {empresa.razon_social.charAt(0).toUpperCase()}
                  </span>
                )}

                <span className={css.datos}>
                  <span className={css.nombre}>{empresa.razon_social}</span>
                  <span className={css.rol}>{empresa.rol}</span>
                </span>

                {cargandoId === empresa.tenant_id ? (
                  <span className={css.giro} aria-hidden="true" />
                ) : (
                  <svg
                    className={css.flecha}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>

        <p className={css.volver}>
          <a href="/acceso">Volver al inicio de sesión</a>
        </p>
      </div>
    </div>
  );
}
