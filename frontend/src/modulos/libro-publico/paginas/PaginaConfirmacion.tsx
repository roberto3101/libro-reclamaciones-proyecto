import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { formatoFechaLarga } from '@/aplicacion/helpers/formato';
import { UiCaja, UiContenedor, UiPila } from '@/ui';
import { UiBoton } from '@/ui';
import { UiIconoExito } from '@/ui';
import { ToggleTema } from '@/aplicacion/componentes/ToggleTema';

interface ConfirmacionState {
  codigo_reclamo?: string;
  fecha_registro?: string;
  fecha_limite_respuesta?: string;
  fecha_incidente?: string;
  mensaje?: string;
}

export default function PaginaConfirmacion() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navegar = useNavigate();
  const location = useLocation();
  const state = (location.state as ConfirmacionState) || {};

  /* Se usa el helper compartido: `new Date('2026-08-30')` se interpreta
     como medianoche UTC y en Perú retrocedía un día, así que el reclamo
     mostraba una fecha de incidente distinta a la que puso el consumidor. */
  const formatearFecha = (iso?: string) => formatoFechaLarga(iso);

  return (
    <UiContenedor anchoMaximo="sm" paginaCentrada>
      <div className="flex justify-end py-3">
        <ToggleTema />
      </div>
      <UiCaja variante="sombreado" relleno={5} sx={{ borderRadius: 3, textAlign: 'center' }}>
        <UiPila direccion="columna" espaciado={2} sx={{ alignItems: 'center' }}>
          <UiIconoExito sx={{ fontSize: 64, color: 'var(--ui-exito-texto)' }} />
          <h2 className="m-0 text-gray-900 dark:text-gray-100">¡Reclamo Registrado!</h2>

          {state.codigo_reclamo && (
            <div className="w-full rounded-lg px-5 py-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <p className="text-gray-600 dark:text-gray-400 m-0 text-sm">
                Código de reclamo
              </p>
              <p className="text-green-800 dark:text-green-300 mt-1 mb-0 text-xl font-bold font-mono tracking-wide">
                {state.codigo_reclamo}
              </p>
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400 m-0 text-[0.9rem] leading-relaxed">
            {state.mensaje ||
              'Tu reclamo ha sido registrado exitosamente. Recibirás una respuesta dentro del plazo legal establecido.'}
          </p>

          {(state.fecha_incidente || state.fecha_registro || state.fecha_limite_respuesta) && (
            <div className="flex gap-6 justify-center flex-wrap w-full">
              {state.fecha_incidente && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 m-0 text-xs">Fecha del incidente</p>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5 mb-0 text-[0.9rem] font-medium">
                    {formatearFecha(state.fecha_incidente)}
                  </p>
                </div>
              )}
              {state.fecha_registro && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 m-0 text-xs">Fecha de registro</p>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5 mb-0 text-[0.9rem] font-medium">
                    {formatearFecha(state.fecha_registro)}
                  </p>
                </div>
              )}
              {state.fecha_limite_respuesta && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 m-0 text-xs">Fecha límite de respuesta</p>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5 mb-0 text-[0.9rem] font-medium">
                    {formatearFecha(state.fecha_limite_respuesta)}
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400 m-0 text-xs">
            Guarda tu código de reclamo para hacer seguimiento.
          </p>

          <UiPila direccion="columna" espaciado={1} sx={{ width: '100%' }}>
            <UiBoton
              texto="Hacer seguimiento de mi reclamo"
              variante="primario"
              alHacerClick={() => navegar(tenantSlug ? `/libro/${tenantSlug}/seguimiento` : '/')}
            />
            <UiBoton
              texto="Registrar otro reclamo"
              variante="enlace"
              alHacerClick={() => navegar(tenantSlug ? `/libro/${tenantSlug}` : '/')}
            />
          </UiPila>
        </UiPila>
      </UiCaja>
    </UiContenedor>
  );
}
