import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UiPila, UiCaja, UiContenedor } from '@/ui';
import { UiCargando, UiAlerta, UiBoton } from '@/ui';
import { UiPasos, usarTema } from '@/ui';
import { colorLegible, tokenActual } from '@/ui/color';
import type { Tenant, Sede, CrearReclamoRequest, ArchivoAdjunto } from '@/tipos';
import { publicoApi } from '../api/publico.api';
import { almacenamientoApi } from '../api/almacenamiento.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { PasoConsumidor } from '../componentes/PasoConsumidor';
import { PasoBien } from '../componentes/PasoBien';
import { PasoDetalle } from '../componentes/PasoDetalle';
import { ToggleTema } from '@/aplicacion/componentes/ToggleTema';

const PASOS = [
  { etiqueta: 'Datos Personales', descripcion: 'Información del consumidor' },
  { etiqueta: 'Bien Contratado', descripcion: 'Producto o servicio' },
  { etiqueta: 'Detalle y Firma', descripcion: 'Descripción y firma digital' },
];

const FORM_INICIAL: Partial<CrearReclamoRequest> = {
  tipo_solicitud: 'RECLAMO',
  menor_de_edad: false,
  acepta_terminos: false,
  acepta_copia: true,
};

function leerSesion<T>(clave: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(clave);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function PaginaLibroPublico() {
  const { tenantSlug, sedeSlug } = useParams<{ tenantSlug: string; sedeSlug?: string }>();
  // Se consulta el tema para que el componente vuelva a pintarse al
  // cambiarlo: el color de marca se recalcula contra el nuevo fondo.
  usarTema();
  const navegar = useNavigate();

  const skForm = `libro_form_${tenantSlug}`;
  const skPaso = `libro_paso_${tenantSlug}`;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pasoActivo, setPasoActivo] = useState(() => leerSesion(skPaso, 0));
  const [enviando, setEnviando] = useState(false);
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<ArchivoAdjunto[]>([]);
  const subiendoRef = useRef(false);

  const [form, setForm] = useState<Partial<CrearReclamoRequest>>(() =>
    leerSesion(skForm, FORM_INICIAL),
  );

  useEffect(() => {
    sessionStorage.setItem(skForm, JSON.stringify(form));
  }, [form, skForm]);

  useEffect(() => {
    sessionStorage.setItem(skPaso, JSON.stringify(pasoActivo));
  }, [pasoActivo, skPaso]);

  useEffect(() => {
    if (!tenantSlug) return;

    Promise.all([
      publicoApi.obtenerTenant(tenantSlug),
      publicoApi.obtenerSedes(tenantSlug),
    ])
      .then(([t, s]) => {
        setTenant(t);
        setSedes(s || []);

        const sedeParam = sedeSlug || new URLSearchParams(window.location.search).get('sede');
        if (sedeParam) {
          const sedeExiste = (s || []).some((sede: Sede) => sede.slug === sedeParam);
          if (sedeExiste) {
            setForm((prev) => ({ ...prev, sede_slug: sedeParam }));
          }
        }
      })
      .catch((e) => {
        manejarError(e);
      })
      .finally(() => {
        setCargando(false);
      });
  }, [tenantSlug, sedeSlug]);

  const actualizarForm = (campos: Partial<CrearReclamoRequest>) =>
    setForm((prev) => ({ ...prev, ...campos }));

  const siguiente = () => setPasoActivo((p) => Math.min(p + 1, 2));
  const anterior = () => setPasoActivo((p) => Math.max(p - 1, 0));

  const agregarArchivos = (archivosNuevos: File[]) => {
    if (subiendoRef.current) return;
    subiendoRef.current = true;

    const nuevosAdjuntos: ArchivoAdjunto[] = archivosNuevos.map((archivo) => ({
      archivo,
      estado: 'pendiente' as const,
    }));

    setArchivosAdjuntos((previos) => [...previos, ...nuevosAdjuntos]);

    // Subir cada archivo secuencialmente
    const empresaId = tenant?.ruc || '1';
    const rutaAlmacenamiento = `reclamaciones/${empresaId}`;

    (async () => {
      // Esperar a que React aplique el state
      await new Promise((r) => setTimeout(r, 100));

      for (const adjunto of nuevosAdjuntos) {
        setArchivosAdjuntos((previos) =>
          previos.map((item) =>
            item.archivo === adjunto.archivo ? { ...item, estado: 'subiendo' as const } : item,
          ),
        );

        try {
          const clave = await almacenamientoApi.subirArchivo(adjunto.archivo, empresaId, rutaAlmacenamiento);
          setArchivosAdjuntos((previos) =>
            previos.map((item) =>
              item.archivo === adjunto.archivo ? { ...item, estado: 'completado' as const, clave } : item,
            ),
          );
        } catch (error) {
          const mensajeError = error instanceof Error ? error.message : 'Error al subir archivo';
          setArchivosAdjuntos((previos) =>
            previos.map((item) =>
              item.archivo === adjunto.archivo ? { ...item, estado: 'error' as const, mensajeError } : item,
            ),
          );
        }
      }
      subiendoRef.current = false;
    })();
  };

  const eliminarArchivo = async (indice: number) => {
    const adjunto = archivosAdjuntos[indice];

    if (adjunto.clave) {
      try {
        const empresaId = tenant?.ruc || '1';
        await almacenamientoApi.eliminarArchivo(adjunto.clave, empresaId);
      } catch {
        notificar.error('No se pudo eliminar el archivo del servidor');
      }
    }

    setArchivosAdjuntos((previos) => previos.filter((_, idx) => idx !== indice));
  };

  const enviar = async () => {
    if (!form.acepta_terminos) {
      notificar.advertencia('Debes aceptar los términos y condiciones');
      return;
    }
    if (!tenantSlug) return;
    setEnviando(true);

    const clavesArchivos = archivosAdjuntos
      .filter((adj) => adj.estado === 'completado' && adj.clave)
      .map((adj) => adj.clave!);

    const datosReclamo = {
      ...form,
      archivos_adjuntos: clavesArchivos.length > 0 ? clavesArchivos : undefined,
    } as CrearReclamoRequest;

    try {
      const resultado = await publicoApi.crearReclamo(tenantSlug, datosReclamo);
      sessionStorage.removeItem(skForm);
      sessionStorage.removeItem(skPaso);
      navegar(`/libro/${tenantSlug}/confirmacion`, {
        state: {
          codigo_reclamo: resultado?.codigo_reclamo,
          fecha_registro: resultado?.fecha_registro,
          fecha_limite_respuesta: resultado?.fecha_limite_respuesta,
          fecha_incidente: form.fecha_incidente,
          mensaje: resultado?.mensaje,
        },
      });
    } catch (error) {
      manejarError(error);
    } finally {
      setEnviando(false);
    }
  };

  /* El color de marca lo elige cada empresa, así que puede no contrastar
     con el fondo del tema activo (un azul corporativo oscuro desaparece
     sobre fondo oscuro). Se ajusta al mínimo legible conservando el tono.
     Depende de `tema` para recalcularse al cambiar de claro a oscuro. */
  const marcaLegible = tenant?.color_primario
    ? colorLegible(tenant.color_primario, tokenActual('--ui-fondo'), 4.5)
    : 'var(--ui-primario-texto)';

  if (cargando) {
    return <UiCargando tipo="anillo" etiqueta="Cargando formulario..." pantallaCompleta />;
  }

  if (!tenant) {
    return (
      <UiContenedor anchoMaximo="sm" paginaCentrada>
        <UiAlerta
          variante="peligro"
          titulo="Empresa no encontrada"
          descripcion="El enlace del libro de reclamaciones no es válido."
        />
      </UiContenedor>
    );
  }

  return (
    <UiContenedor anchoMaximo="lg">
      <UiPila direccion="columna" espaciado={3} sx={{ py: 4 }}>
        {/* Toggle tema */}
        <div className="flex justify-end">
          <ToggleTema />
        </div>

        {/* Cabecera: identificacion del proveedor a la izquierda, consulta
            de estado a la derecha. Ver .lr-libro-cabecera en index.css. */}
        <header className="lr-libro-cabecera">
          <div className="lr-libro-identidad">
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt="" className="lr-libro-logo" />
            )}
            <h1 className="lr-libro-titulo">Libro de Reclamaciones</h1>
            <p className="lr-libro-empresa">{tenant.razon_social}</p>
            <p className="lr-libro-registro">
              RUC {tenant.ruc}
              {tenant.direccion_legal ? ' · ' + tenant.direccion_legal : ''}
            </p>
          </div>

          <div className="lr-libro-accion">
            <UiBoton
              texto="Consultar un código"
              variante="contorno"
              anchoCompleto
              alHacerClick={() => navegar(`/libro/${tenantSlug}/seguimiento`)}
              sx={{
                borderColor: tenant.color_primario || 'var(--ui-primario)',
                color: marcaLegible,
                '&:hover': {
                  backgroundColor: 'var(--ui-hover)',
                  borderColor: marcaLegible,
                },
              }}
            />
          </div>
        </header>

        {/* Stepper */}
        <UiPasos
          pasos={PASOS}
          pasoActivo={pasoActivo}
          orientacion="horizontal"
          color={tenant.color_primario ?? undefined}
          sx={{
            '& .MuiStepLabel-label': {
              color: 'var(--ui-texto) !important',
            },
            '& .MuiStepLabel-labelContainer': {
              color: 'var(--ui-texto-2)',
            },
            '& .MuiStepLabel-labelContainer .MuiTypography-caption': {
              color: 'var(--ui-texto-2) !important',
            },
            '& .MuiStepConnector-line': {
              borderColor: 'var(--ui-texto-2)',
            },
          }}
        />

        {/* Pasos del formulario */}
        {pasoActivo === 0 && (
          <PasoConsumidor
            form={form}
            sedes={sedes}
            actualizar={actualizarForm}
            alSiguiente={siguiente}
            colorPrimario={tenant.color_primario ?? undefined}
            tenantSlug={tenantSlug}
          />
        )}
        {pasoActivo === 1 && (
          <PasoBien
            form={form}
            actualizar={actualizarForm}
            alSiguiente={siguiente}
            alAnterior={anterior}
            colorPrimario={tenant.color_primario ?? undefined}
          />
        )}
        {pasoActivo === 2 && (
          <PasoDetalle
            form={form}
            actualizar={actualizarForm}
            alAnterior={anterior}
            alEnviar={enviar}
            enviando={enviando}
            colorPrimario={tenant.color_primario ?? undefined}
            onTurnstileToken={(token) => actualizarForm({ turnstile_token: token })}
            archivosAdjuntos={archivosAdjuntos}
            alAgregarArchivos={agregarArchivos}
            alEliminarArchivo={eliminarArchivo}
          />
        )}
      </UiPila>
    </UiContenedor>
  );
}
