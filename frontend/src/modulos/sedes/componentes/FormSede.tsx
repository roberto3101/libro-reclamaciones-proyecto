import { useState, useEffect, useCallback } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { sedesApi } from '../api/sedes.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { lazy, Suspense } from 'react';
import type { Sede } from '@/tipos';

const MapaUbicacion = lazy(() => import('@/aplicacion/componentes/MapaUbicacion'));
import type { DatosDireccion } from '@/aplicacion/componentes/MapaUbicacion';

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
  sedeEditar?: Sede | null;
}

interface HorarioDia {
  dia: string;
  inicio: string;
  fin: string;
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const FORM_INICIAL = {
  nombre: '',
  slug: '',
  codigo_sede: '',
  direccion: '',
  departamento: '',
  provincia: '',
  distrito: '',
  referencia: '',
  telefono: '',
  email: '',
  responsable_nombre: '',
  responsable_cargo: '',
  latitud: '',
  longitud: '',
  es_principal: false,
};

// ── Regex ──
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,253}\.[a-zA-Z]{2,10}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOLO_LETRAS_ESPACIOS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
const TELEFONO_REGEX = /^[+]?[\d\s\-()]*$/;
const ALFANUMERICO_REGEX = /^[a-zA-Z0-9\-_]*$/;
const NOMBRE_SEDE_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.\-,()#°]+$/;

// ── Límites por campo ──
const LIMITES = {
  nombre:             { min: 3, max: 100 },
  slug:               { min: 2, max: 50 },
  codigo_sede:        { max: 20 },
  direccion:          { min: 5, max: 250 },
  departamento:       { max: 100 },
  provincia:          { max: 100 },
  distrito:           { max: 100 },
  referencia:         { max: 200 },
  telefono:           { max: 20 },
  email:              { max: 150 },
  responsable_nombre: { max: 100 },
  responsable_cargo:  { max: 100 },
} as const;

type Validacion = { error: boolean; mensaje: string | undefined };

// ── Funciones de validación ──
function validarNombre(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.trim().length;
  if (len < LIMITES.nombre.min) return { error: true, mensaje: `Mínimo ${LIMITES.nombre.min} caracteres (${len}/${LIMITES.nombre.min})` };
  if (len > LIMITES.nombre.max) return { error: true, mensaje: `Máximo ${LIMITES.nombre.max} caracteres (${len}/${LIMITES.nombre.max})` };
  if (!NOMBRE_SEDE_REGEX.test(v.trim())) return { error: true, mensaje: 'Solo letras, números, espacios, puntos, comas y guiones' };
  return { error: false, mensaje: `${len}/${LIMITES.nombre.max} caracteres` };
}

function validarSlug(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.length;
  if (len < LIMITES.slug.min) return { error: true, mensaje: `Mínimo ${LIMITES.slug.min} caracteres (${len}/${LIMITES.slug.min})` };
  if (len > LIMITES.slug.max) return { error: true, mensaje: `Máximo ${LIMITES.slug.max} caracteres (${len}/${LIMITES.slug.max})` };
  if (!SLUG_REGEX.test(v)) return { error: true, mensaje: 'Solo minúsculas, números y guiones (ej: mi-sede-01)' };
  return { error: false, mensaje: `${len}/${LIMITES.slug.max} caracteres` };
}

function validarCodigoSede(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.length;
  if (len > LIMITES.codigo_sede.max) return { error: true, mensaje: `Máximo ${LIMITES.codigo_sede.max} caracteres (${len}/${LIMITES.codigo_sede.max})` };
  if (!ALFANUMERICO_REGEX.test(v)) return { error: true, mensaje: 'Solo letras, números, guiones y guiones bajos' };
  return { error: false, mensaje: `${len}/${LIMITES.codigo_sede.max} caracteres` };
}

function validarDireccion(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.trim().length;
  if (len < LIMITES.direccion.min) return { error: true, mensaje: `Mínimo ${LIMITES.direccion.min} caracteres (${len}/${LIMITES.direccion.min})` };
  if (len > LIMITES.direccion.max) return { error: true, mensaje: `Máximo ${LIMITES.direccion.max} caracteres (${len}/${LIMITES.direccion.max})` };
  return { error: false, mensaje: `${len}/${LIMITES.direccion.max} caracteres` };
}

function validarTextoUbicacion(v: string, campo: 'departamento' | 'provincia' | 'distrito'): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.trim().length;
  const max = LIMITES[campo].max;
  if (len > max) return { error: true, mensaje: `Máximo ${max} caracteres (${len}/${max})` };
  if (!SOLO_LETRAS_ESPACIOS.test(v)) return { error: true, mensaje: 'Solo letras y espacios' };
  return { error: false, mensaje: `${len}/${max} caracteres` };
}

function validarReferencia(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.trim().length;
  if (len > LIMITES.referencia.max) return { error: true, mensaje: `Máximo ${LIMITES.referencia.max} caracteres (${len}/${LIMITES.referencia.max})` };
  return { error: false, mensaje: `${len}/${LIMITES.referencia.max} caracteres` };
}

function validarTelefono(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.length;
  if (len > LIMITES.telefono.max) return { error: true, mensaje: `Máximo ${LIMITES.telefono.max} caracteres (${len}/${LIMITES.telefono.max})` };
  if (!TELEFONO_REGEX.test(v)) return { error: true, mensaje: 'Solo números, +, espacios, guiones y paréntesis' };
  return { error: false, mensaje: `${len}/${LIMITES.telefono.max} caracteres` };
}

function validarEmail(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.length;
  if (len > LIMITES.email.max) return { error: true, mensaje: `Máximo ${LIMITES.email.max} caracteres (${len}/${LIMITES.email.max})` };
  if (!EMAIL_REGEX.test(v)) return { error: true, mensaje: 'Formato de email inválido (ej: correo@empresa.com)' };
  return { error: false, mensaje: `${len}/${LIMITES.email.max} caracteres` };
}

function validarResponsableNombre(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.trim().length;
  const max = LIMITES.responsable_nombre.max;
  if (len > max) return { error: true, mensaje: `Máximo ${max} caracteres (${len}/${max})` };
  if (!SOLO_LETRAS_ESPACIOS.test(v)) return { error: true, mensaje: 'Solo letras y espacios' };
  return { error: false, mensaje: `${len}/${max} caracteres` };
}

function validarResponsableCargo(v: string): Validacion {
  if (!v) return { error: false, mensaje: undefined };
  const len = v.trim().length;
  const max = LIMITES.responsable_cargo.max;
  if (len > max) return { error: true, mensaje: `Máximo ${max} caracteres (${len}/${max})` };
  return { error: false, mensaje: `${len}/${max} caracteres` };
}

export function FormSede({ abierto, alCerrar, alGuardar, sedeEditar }: Props) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [horarios, setHorarios] = useState<HorarioDia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);

  const esEdicion = !!sedeEditar;

  // Poblar formulario al editar
  useEffect(() => {
    if (abierto && sedeEditar) {
      setForm({
        nombre: sedeEditar.nombre || '',
        slug: sedeEditar.slug || '',
        codigo_sede: sedeEditar.codigo_sede || '',
        direccion: sedeEditar.direccion || '',
        departamento: sedeEditar.departamento || '',
        provincia: sedeEditar.provincia || '',
        distrito: sedeEditar.distrito || '',
        referencia: sedeEditar.referencia || '',
        telefono: sedeEditar.telefono || '',
        email: sedeEditar.email || '',
        responsable_nombre: sedeEditar.responsable_nombre || '',
        responsable_cargo: sedeEditar.responsable_cargo || '',
        latitud: sedeEditar.latitud != null ? String(sedeEditar.latitud) : '',
        longitud: sedeEditar.longitud != null ? String(sedeEditar.longitud) : '',
        es_principal: sedeEditar.es_principal || false,
      });
      try {
        const h = sedeEditar.horario_atencion;
        // Go sql.NullString serializa como {String: "...", Valid: true}
        const raw = h && typeof h === 'object' && !Array.isArray(h) && 'String' in (h as any)
          ? (h as any).String
          : h;
        if (raw && typeof raw === 'string') {
          const parsed = JSON.parse(raw);
          setHorarios(Array.isArray(parsed) ? parsed : []);
        } else if (Array.isArray(raw)) {
          setHorarios(raw as HorarioDia[]);
        } else {
          setHorarios([]);
        }
      } catch {
        setHorarios([]);
      }
      setAutoSlug(false);
    } else if (abierto) {
      setForm(FORM_INICIAL);
      setHorarios([]);
      setAutoSlug(true);
    }
  }, [abierto, sedeEditar]);

  const generarSlug = useCallback((texto: string) => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  const actualizar = (campo: string, valor: string | boolean) => {
    setForm((p) => {
      const next = { ...p, [campo]: valor };
      if (campo === 'nombre' && autoSlug && typeof valor === 'string') {
        next.slug = generarSlug(valor);
      }
      if (campo === 'slug') setAutoSlug(false);
      return next;
    });
  };

  // ── Horarios ──
  const agregarHorario = () => {
    if (horarios.length >= 7) return;
    const diasUsados = new Set(horarios.map((h) => h.dia));
    const siguienteDia = DIAS_SEMANA.find((d) => !diasUsados.has(d)) || DIAS_SEMANA[0];
    setHorarios([...horarios, { dia: siguienteDia, inicio: '08:00', fin: '18:00' }]);
  };

  const actualizarHorario = (index: number, campo: keyof HorarioDia, valor: string) => {
    setHorarios((prev) => prev.map((h, i) => (i === index ? { ...h, [campo]: valor } : h)));
  };

  const eliminarHorario = (index: number) => {
    setHorarios((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Validaciones en tiempo real ──
  const vNombre = validarNombre(form.nombre);
  const vSlug = validarSlug(form.slug);
  const vCodigo = validarCodigoSede(form.codigo_sede);
  const vDireccion = validarDireccion(form.direccion);
  const vDepartamento = validarTextoUbicacion(form.departamento, 'departamento');
  const vProvincia = validarTextoUbicacion(form.provincia, 'provincia');
  const vDistrito = validarTextoUbicacion(form.distrito, 'distrito');
  const vReferencia = validarReferencia(form.referencia);
  const vTelefono = validarTelefono(form.telefono);
  const vEmail = validarEmail(form.email);
  const vResponsable = validarResponsableNombre(form.responsable_nombre);
  const vCargo = validarResponsableCargo(form.responsable_cargo);

  const hayErrores =
    vNombre.error || vSlug.error || vCodigo.error || vDireccion.error ||
    vDepartamento.error || vProvincia.error || vDistrito.error || vReferencia.error ||
    vTelefono.error || vEmail.error || vResponsable.error || vCargo.error;

  // ── Guardar ──
  const manejarGuardar = async () => {
    if (!form.nombre.trim()) {
      notificar.advertencia('El nombre de la sede es obligatorio');
      return;
    }
    if (!form.slug.trim()) {
      notificar.advertencia('El slug es obligatorio');
      return;
    }
    if (!SLUG_REGEX.test(form.slug)) {
      notificar.advertencia('El slug solo puede contener letras minúsculas, números y guiones');
      return;
    }
    if (!form.direccion.trim()) {
      notificar.advertencia('La dirección es obligatoria');
      return;
    }
    if (form.email && !EMAIL_REGEX.test(form.email)) {
      notificar.advertencia('El formato del email no es válido');
      return;
    }
    if (hayErrores) {
      notificar.advertencia('Corrige los errores antes de guardar');
      return;
    }

    setCargando(true);
    try {
      const lat = form.latitud ? parseFloat(form.latitud) : null;
      const lon = form.longitud ? parseFloat(form.longitud) : null;

      const payload: any = {
        ...form,
        latitud: lat && !isNaN(lat) ? Math.round(lat * 10000000) / 10000000 : null,
        longitud: lon && !isNaN(lon) ? Math.round(lon * 10000000) / 10000000 : null,
        horario_atencion: horarios.length > 0 ? horarios : [],
      };

      if (esEdicion && sedeEditar) {
        await sedesApi.actualizar(sedeEditar.id, payload);
        notificar.exito('Sede actualizada exitosamente');
      } else {
        await sedesApi.crear(payload);
        notificar.exito('Sede creada exitosamente');
      }
      alGuardar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  if (!abierto) return null;

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={esEdicion ? 'Editar Sede' : 'Nueva Sede'}
      maxAncho="lg"
      pie={
        <>
          <BotonModal texto="Cancelar" variante="secundario" onClick={alCerrar} />
          <BotonModal
            texto={esEdicion ? 'Guardar cambios' : 'Crear Sede'}
            onClick={manejarGuardar}
            cargando={cargando}
            deshabilitado={hayErrores}
          />
        </>
      }
    >
      <div className="space-y-5 sm:space-y-6">
          {/* ── Sección: Información básica ── */}
          <Seccion titulo="Información básica">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo
                etiqueta="Nombre"
                valor={form.nombre}
                onChange={(v) => actualizar('nombre', v)}
                placeholder="Sede Miraflores"
                requerido
                error={vNombre.error}
                mensajeValidacion={vNombre.mensaje}
                maxLength={LIMITES.nombre.max}
              />
              <Campo
                etiqueta="Slug"
                valor={form.slug}
                onChange={(v) => actualizar('slug', v)}
                placeholder="miraflores"
                mono
                requerido
                ayuda="Se usa en la URL del libro público"
                error={vSlug.error}
                mensajeValidacion={vSlug.mensaje}
                maxLength={LIMITES.slug.max}
              />
              <Campo
                etiqueta="Código de sede"
                valor={form.codigo_sede}
                onChange={(v) => actualizar('codigo_sede', v)}
                placeholder="S001"
                ayuda="Identificador interno (opcional)"
                error={vCodigo.error}
                mensajeValidacion={vCodigo.mensaje}
                maxLength={LIMITES.codigo_sede.max}
              />
              <div className="flex items-center gap-3 sm:pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.es_principal}
                    onChange={(e) => actualizar('es_principal', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                  <span className="ms-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sede principal
                  </span>
                </label>
              </div>
            </div>
          </Seccion>

          {/* ── Sección: Geolocalización (arriba para autocompletar dirección) ── */}
          <Seccion titulo="Ubicación en el mapa">
            <Suspense
              fallback={
                <div className="h-[180px] sm:h-[280px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm">
                  Cargando mapa...
                </div>
              }
            >
              <MapaUbicacion
                latitud={form.latitud ? parseFloat(form.latitud) : null}
                longitud={form.longitud ? parseFloat(form.longitud) : null}
                editable={true}
                altura={window.innerWidth < 640 ? 180 : 280}
                alCambiar={(lat, lng) => {
                  actualizar('latitud', String(lat));
                  actualizar('longitud', String(lng));
                }}
                alCambiarDireccion={(datos) => {
                  setForm((p) => ({
                    ...p,
                    departamento: datos.departamento || p.departamento,
                    provincia: datos.provincia || p.provincia,
                    distrito: datos.distrito || p.distrito,
                    direccion: datos.direccion || p.direccion,
                  }));
                  notificar.exito('Dirección actualizada desde el mapa');
                }}
              />
            </Suspense>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">
              Haz click en el mapa para autocompletar los campos de dirección
            </p>
          </Seccion>

          {/* ── Sección: Dirección ── */}
          <Seccion titulo="Dirección">
            <div className="space-y-4">
              <Campo
                etiqueta="Dirección completa"
                valor={form.direccion}
                onChange={(v) => actualizar('direccion', v)}
                placeholder="Av. Larco 1234"
                requerido
                error={vDireccion.error}
                mensajeValidacion={vDireccion.mensaje}
                maxLength={LIMITES.direccion.max}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Campo
                  etiqueta="Departamento"
                  valor={form.departamento}
                  onChange={(v) => actualizar('departamento', v)}
                  placeholder="Lima"
                  error={vDepartamento.error}
                  mensajeValidacion={vDepartamento.mensaje}
                  maxLength={LIMITES.departamento.max}
                />
                <Campo
                  etiqueta="Provincia"
                  valor={form.provincia}
                  onChange={(v) => actualizar('provincia', v)}
                  placeholder="Lima"
                  error={vProvincia.error}
                  mensajeValidacion={vProvincia.mensaje}
                  maxLength={LIMITES.provincia.max}
                />
                <Campo
                  etiqueta="Distrito"
                  valor={form.distrito}
                  onChange={(v) => actualizar('distrito', v)}
                  placeholder="Miraflores"
                  error={vDistrito.error}
                  mensajeValidacion={vDistrito.mensaje}
                  maxLength={LIMITES.distrito.max}
                />
              </div>
              <Campo
                etiqueta="Referencia"
                valor={form.referencia}
                onChange={(v) => actualizar('referencia', v)}
                placeholder="Frente al parque Kennedy"
                error={vReferencia.error}
                mensajeValidacion={vReferencia.mensaje}
                maxLength={LIMITES.referencia.max}
              />
            </div>
          </Seccion>

          {/* ── Sección: Contacto ── */}
          <Seccion titulo="Contacto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo
                etiqueta="Teléfono"
                valor={form.telefono}
                onChange={(v) => actualizar('telefono', v)}
                placeholder="+51 999 888 777"
                tipo="tel"
                error={vTelefono.error}
                mensajeValidacion={vTelefono.mensaje}
                maxLength={LIMITES.telefono.max}
              />
              <Campo
                etiqueta="Email"
                valor={form.email}
                onChange={(v) => actualizar('email', v)}
                placeholder="sede@empresa.com"
                tipo="email"
                error={vEmail.error}
                mensajeValidacion={vEmail.mensaje}
                maxLength={LIMITES.email.max}
              />
              <Campo
                etiqueta="Responsable"
                valor={form.responsable_nombre}
                onChange={(v) => actualizar('responsable_nombre', v)}
                placeholder="Juan Pérez"
                error={vResponsable.error}
                mensajeValidacion={vResponsable.mensaje}
                maxLength={LIMITES.responsable_nombre.max}
              />
              <Campo
                etiqueta="Cargo"
                valor={form.responsable_cargo}
                onChange={(v) => actualizar('responsable_cargo', v)}
                placeholder="Administrador"
                error={vCargo.error}
                mensajeValidacion={vCargo.mensaje}
                maxLength={LIMITES.responsable_cargo.max}
              />
            </div>
          </Seccion>

          {/* ── Sección: Horario de atención ── */}
          <Seccion titulo="Horario de atención">
            {horarios.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                No hay horarios configurados.
              </p>
            ) : (
              <div className="space-y-2 mb-3">
                {horarios.map((h, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50"
                  >
                    <select
                      value={h.dia}
                      onChange={(e) => actualizarHorario(i, 'dia', e.target.value)}
                      className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 outline-none w-full sm:w-auto sm:flex-1 sm:min-w-[120px]"
                    >
                      {DIAS_SEMANA.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.inicio}
                        onChange={(e) => actualizarHorario(i, 'inicio', e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 outline-none flex-1 min-w-0"
                      />
                      <span className="text-gray-600 dark:text-gray-400 text-sm">a</span>
                      <input
                        type="time"
                        value={h.fin}
                        onChange={(e) => actualizarHorario(i, 'fin', e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 outline-none flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarHorario(i)}
                        className="text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {horarios.length < 7 && (
              <button
                type="button"
                onClick={agregarHorario}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors px-2 py-1 -mx-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar horario
              </button>
            )}
          </Seccion>
      </div>
    </ModalBase>
  );
}

// ── Sección con título ──
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

// ── Campo reutilizable con validación en vivo ──
function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
  tipo = 'text',
  mono = false,
  requerido = false,
  ayuda,
  error,
  mensajeValidacion,
  maxLength,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
  mono?: boolean;
  requerido?: boolean;
  ayuda?: string;
  error?: boolean;
  mensajeValidacion?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {etiqueta}
        {requerido && <span className="text-red-600 dark:text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none transition-shadow ${
          mono ? 'font-mono' : ''
        } ${
          error
            ? 'border-red-500 dark:border-red-400 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400'
            : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400'
        }`}
      />
      {mensajeValidacion && (
        <p className={`mt-1 text-xs font-medium ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {mensajeValidacion}
        </p>
      )}
      {ayuda && !mensajeValidacion && (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{ayuda}</p>
      )}
    </div>
  );
}
