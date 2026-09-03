import { useState, useEffect, useRef, useCallback } from 'react';
import { UiPila, UiCuadricula, UiCaja, UiIcono } from '@/ui';
import {
  UiCampoTexto,
  UiBoton,
  UiInterruptor,
  UiCargando,
  UiTarjeta
} from '@/ui';
import { Tooltip } from '@mui/material';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { usarTenant } from '../ganchos/usarTenant';
import { tenantApi } from '../api/tenant.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { consultarRucPSE } from '@/aplicacion/helpers/consultaRuc';
import type { ActualizarTenantRequest } from '@/tipos';
import { resolverUbigeo } from '@/datos/ubigeos';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaConfiguracion } from '@/componentes/ui/guias-contenido';
import { usarTema } from '@/ui';

// ── Validaciones ──
type Errores = Partial<Record<keyof ActualizarTenantRequest, string>>;

const RE_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,6})+$/;
const RE_URL = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/;
const RE_SOLO_LETRAS_NUMEROS_ESPACIOS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.\-&]+$/;
const RE_SOLO_LETRAS_ESPACIOS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
const RE_TELEFONO = /^[+\d\s\-()]+$/;

function validarCampo(campo: keyof ActualizarTenantRequest, valor: any): string {
  const v = typeof valor === 'string' ? valor.trim() : valor;

  switch (campo) {
    case 'razon_social':
      if (!v) return 'La razón social es obligatoria.';
      if (v.length > 200) return 'Máximo 200 caracteres.';
      return '';
    case 'ruc':
      if (!v) return 'El RUC es obligatorio.';
      if (!/^\d{11}$/.test(v)) return 'El RUC debe tener exactamente 11 dígitos.';
      return '';
    case 'nombre_comercial':
      if (v && !RE_SOLO_LETRAS_NUMEROS_ESPACIOS.test(v)) return 'Solo letras, números y espacios.';
      if (v && v.length > 100) return 'Máximo 100 caracteres.';
      return '';
    case 'sitio_web':
      if (v && !RE_URL.test(v)) return 'URL inválida. Ej: https://miempresa.com';
      if (v && v.length > 255) return 'Máximo 255 caracteres.';
      return '';
    case 'email_contacto':
      if (v && !RE_EMAIL.test(v)) return 'Formato de email inválido.';
      if (v && v.length > 150) return 'Máximo 150 caracteres.';
      return '';
    case 'telefono':
      if (v && !RE_TELEFONO.test(v)) return 'Solo dígitos, +, espacios, guiones y paréntesis.';
      if (v && v.length > 20) return 'Máximo 20 caracteres.';
      return '';
    case 'direccion_legal':
      if (v && v.length > 300) return 'Máximo 300 caracteres.';
      return '';
    case 'departamento':
    case 'provincia':
    case 'distrito':
      if (v && !RE_SOLO_LETRAS_ESPACIOS.test(v)) return 'Solo letras y espacios.';
      if (v && v.length > 100) return 'Máximo 100 caracteres.';
      return '';
    case 'logo_url':
      if (!v) return 'El logo de la empresa es obligatorio.';
      return '';
    default:
      return '';
  }
}

const CAMPOS_VALIDABLES: (keyof ActualizarTenantRequest)[] = [
  'razon_social', 'ruc', 'nombre_comercial', 'sitio_web',
  'email_contacto', 'telefono', 'direccion_legal',
  'departamento', 'provincia', 'distrito',
  'logo_url',
];

// consultarRucPSE ahora vive en @/aplicacion/helpers/consultaRuc para ser
// reutilizado desde el panel SuperAdmin (modales Nueva Cuenta y Crear Empresa).

export default function PaginaConfigTenant() {
  const { tenant, cargando, recargar } = usarTenant();
  const { establecerTema } = usarTema();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado del formulario
  const [form, setForm] = useState<ActualizarTenantRequest>({
    razon_social: '', ruc: '', nombre_comercial: '', direccion_legal: '',
    departamento: '', provincia: '', distrito: '', telefono: '', email_contacto: '',
    sitio_web: '', logo_url: '', color_primario: '#9a4a24',
    plazo_respuesta_dias: 15, notificar_whatsapp: false, notificar_email: false,
    notificar_email_estado: true, notificar_email_mensaje: true, notificar_email_resolucion: true,
    firma_representante: '',
    tema_por_defecto: 'light',
    version: 0,
  });
  const [modalFirmaRepr, setModalFirmaRepr] = useState(false);
  
  const [guardando, setGuardando] = useState(false);
  const [consultandoRuc, setConsultandoRuc] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [tocados, setTocados] = useState<Set<keyof ActualizarTenantRequest>>(new Set());

  const marcarTocado = useCallback((campo: keyof ActualizarTenantRequest) => {
    setTocados((prev) => { const n = new Set(prev); n.add(campo); return n; });
    setForm((current) => {
      setErrores((prev) => ({ ...prev, [campo]: validarCampo(campo, current[campo]) }));
      return current;
    });
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    if (tenant) {
      setForm({
        razon_social: tenant.razon_social,
        ruc: tenant.ruc,
        nombre_comercial: tenant.nombre_comercial ?? '',
        direccion_legal: tenant.direccion_legal ?? '',
        departamento: tenant.departamento ?? '',
        provincia: tenant.provincia ?? '',
        distrito: tenant.distrito ?? '',
        telefono: tenant.telefono ?? '',
        email_contacto: tenant.email_contacto ?? '',
        sitio_web: tenant.sitio_web ?? '',
        logo_url: tenant.logo_url ?? '',
        color_primario: tenant.color_primario ?? '#9a4a24',
        plazo_respuesta_dias: tenant.plazo_respuesta_dias,
        notificar_whatsapp: tenant.notificar_whatsapp,
        notificar_email: tenant.notificar_email,
        notificar_email_estado: tenant.notificar_email_estado,
        notificar_email_mensaje: tenant.notificar_email_mensaje,
        notificar_email_resolucion: tenant.notificar_email_resolucion,
        firma_representante: tenant.firma_representante ?? '',
        tema_por_defecto: tenant.tema_por_defecto || 'light',
        version: tenant.version,
      });
      setPreviewLogo(tenant.logo_url ?? null);
    }
  }, [tenant]);

  if (cargando) return <UiCargando tipo="anillo" etiqueta="Cargando configuración..." pantallaCompleta />;

  // Helper: genera texto de ayuda con contador de caracteres
  const contador = (valor: string | undefined | null, max: number, ayudaExtra?: string) => {
    const len = (valor ?? '').length;
    const txt = `${len}/${max}`;
    return ayudaExtra ? `${ayudaExtra} · ${txt}` : txt;
  };

  const actualizar = (campo: keyof ActualizarTenantRequest, valor: any) => {
    setForm((p) => ({ ...p, [campo]: valor }));
    if (tocados.has(campo)) {
      setErrores((prev) => ({ ...prev, [campo]: validarCampo(campo, valor) }));
    }
  };

  // onChange con restricción real: corta longitud y rechaza caracteres inválidos
  const cambioRestringido = (
    campo: keyof ActualizarTenantRequest,
    raw: string,
    opts?: { max?: number; regex?: RegExp },
  ) => {
    let v = raw;
    if (opts?.max) v = v.slice(0, opts.max);
    if (opts?.regex && v && !opts.regex.test(v)) return; // rechazar keystroke
    actualizar(campo, v);
  };

  const validarTodo = (): boolean => {
    const nuevosErrores: Errores = {};
    let valido = true;
    for (const campo of CAMPOS_VALIDABLES) {
      const err = validarCampo(campo, form[campo]);
      if (err) { nuevosErrores[campo] = err; valido = false; }
    }
    setErrores(nuevosErrores);
    setTocados(new Set(CAMPOS_VALIDABLES));
    return valido;
  };

  // --- LÓGICA DE COMPRESIÓN DE IMAGEN ---
  const procesarImagen = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // Reducimos drásticamente el tamaño para que sea un STRING ligero
                const MAX_SIZE = 200; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    // Fondo blanco por si es PNG transparente (para que no salga negro en JPG)
                    ctx.fillStyle = "#fffefb";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                }
                
                // Convertimos a JPEG calidad 0.7 -> Esto genera una cadena Base64 muy corta
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
  };

  const manejarSubidaLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      notificar.error('Solo se permiten imágenes (PNG, JPG, WEBP)');
      return;
    }

    try {
        const imagenComprimida = await procesarImagen(file);
        setPreviewLogo(imagenComprimida);
        actualizar('logo_url', imagenComprimida);
        notificar.exito('Logo procesado correctamente');
    } catch (error) {
        console.error(error);
        notificar.error('Error al procesar la imagen');
    }
  };

  const eliminarLogo = () => {
    setPreviewLogo(null);
    actualizar('logo_url', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const consultarRuc = async () => {
    if (!form.ruc || form.ruc.length !== 11) {
      notificar.error('Ingresa un RUC valido de 11 digitos');
      return;
    }
    setConsultandoRuc(true);
    try {
      const datos = await consultarRucPSE(form.ruc);
      if (!datos) {
        notificar.error('No se encontraron datos para este RUC');
        return;
      }
      const ubigeo = datos.ubigeo ? resolverUbigeo(datos.ubigeo) : null;
      setForm((p) => ({
        ...p,
        razon_social: datos.nombrerazon || p.razon_social,
        direccion_legal: datos.direccion || p.direccion_legal,
        departamento: ubigeo?.departamento || p.departamento,
        provincia: ubigeo?.provincia || p.provincia,
        distrito: ubigeo?.distrito || p.distrito,
      }));
      notificar.exito('Datos de SUNAT cargados correctamente');
    } catch {
      notificar.error('Error consultando el servicio. Intenta de nuevo.');
    } finally {
      setConsultandoRuc(false);
    }
  };

  const guardar = async () => {
    if (!validarTodo()) {
      notificar.advertencia('Corrige los errores antes de guardar.');
      return;
    }
    setGuardando(true);
    try {
      await tenantApi.actualizar(form);
      notificar.exito('Configuración actualizada');
      // recargar() trae datos frescos del server (con version incrementada)
      // y el useEffect [tenant] actualiza el form automáticamente
      await recargar();
    } catch (error) {
      manejarError(error);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <UiPila
      direccion="columna"
      espaciado={3}
      sx={{ pb: 4, '& .MuiTextField-root, & .MuiFormControl-root': { width: '100%' } }}
    >
      {/* Header */}
      <UiCaja sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
            Configuración de Empresa
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', opacity: 0.6 }}>
            Gestiona la información legal, branding y preferencias operativas.
          </p>
        </div>
        <UiBoton
          texto="Guardar Cambios"
          variante="primario"
          tamano="lg"
          estado={guardando ? 'cargando' : 'inactivo'}
          alHacerClick={guardar}
        />
      </UiCaja>

      <GuiaModulo {...guiaConfiguracion} />

      {/* Identidad Visual */}
      <UiTarjeta titulo="Identidad Visual">
        <UiCuadricula contenedor espaciado={3}>
          <UiCuadricula elemento tamano={{ xs: 12 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>
              Logo de la Empresa (Visible en el Libro)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Logo preview */}
              <div style={{
                width: '100px', height: '100px', borderRadius: 'var(--ui-r-xl)',
                border: `1px solid ${errores.logo_url && tocados.has('logo_url' as any) ? '#b83a32' : 'var(--ui-info-borde)'}`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--ui-superficie-2)', overflow: 'hidden', flexShrink: 0,
              }}>
                {previewLogo ? (
                  <img src={previewLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <svg style={{ width: 32, height: 32, opacity: 0.3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              {/* Botones, color de marca y texto */}
              <div>
                <input type="file" ref={fileInputRef} accept="image/png, image/jpeg, image/webp" onChange={manejarSubidaLogo} style={{ display: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #d3cdbc', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
                    Subir Logo
                  </button>
                  {previewLogo && (
                    <button type="button" onClick={eliminarLogo} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--ui-peligro-borde)', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--ui-peligro-texto)', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  )}
                  {/* Color de marca */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
                    <input type="color" value={form.color_primario || '#9a4a24'} onChange={(e) => actualizar('color_primario', e.target.value)} style={{ width: '32px', height: '32px', padding: 0, border: '1px solid var(--ui-info-borde)', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent' }} title="Clic para elegir color" />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600 }}>{form.color_primario || '#9a4a24'}</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5 }}>Color de marca</p>
                    </div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>Se optimizará automáticamente. Formatos: PNG, JPG.</p>
              </div>
            </div>
            {errores.logo_url && tocados.has('logo_url' as any) && (
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--ui-peligro)', fontWeight: 500 }}>{errores.logo_url}</p>
            )}
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <UiCampoTexto etiqueta="Nombre Comercial" valor={form.nombre_comercial ?? ''} alCambiar={(e) => cambioRestringido('nombre_comercial', e.target.value, { max: 100, regex: RE_SOLO_LETRAS_NUMEROS_ESPACIOS })} alDesenfocar={() => marcarTocado('nombre_comercial')} error={!!errores.nombre_comercial} mensajeError={errores.nombre_comercial} textoAyuda={errores.nombre_comercial ? undefined : contador(form.nombre_comercial, 100, 'Nombre público de la marca')} />
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <UiCampoTexto etiqueta="Sitio Web" valor={form.sitio_web ?? ''} alCambiar={(e) => cambioRestringido('sitio_web', e.target.value, { max: 255 })} alDesenfocar={() => marcarTocado('sitio_web')} error={!!errores.sitio_web} mensajeError={errores.sitio_web} marcador="https://..." textoAyuda={errores.sitio_web ? undefined : contador(form.sitio_web, 255)} />
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>Tema por Defecto</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { actualizar('tema_por_defecto', 'light'); establecerTema('light'); }}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 'var(--ui-r-lg)', cursor: 'pointer',
                    border: form.tema_por_defecto === 'light' ? '2px solid var(--ui-primario)' : '1px solid var(--ui-borde)',
                    backgroundColor: form.tema_por_defecto === 'light' ? 'var(--ui-primario-suave)' : 'var(--ui-superficie)',
                    color: 'var(--ui-texto)', fontWeight: form.tema_por_defecto === 'light' ? 600 : 400, fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                  }}
                >
                  <UiIcono nombre="light_mode" tamano={17} /> Claro
                </button>
                <button
                  type="button"
                  onClick={() => { actualizar('tema_por_defecto', 'dark'); establecerTema('dark'); }}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 'var(--ui-r-lg)', cursor: 'pointer',
                    border: form.tema_por_defecto === 'dark' ? '2px solid var(--ui-primario)' : '1px solid var(--ui-borde)',
                    backgroundColor: form.tema_por_defecto === 'dark' ? 'var(--ui-primario-suave)' : 'var(--ui-superficie)',
                    color: 'var(--ui-texto)', fontWeight: form.tema_por_defecto === 'dark' ? 600 : 400, fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                  }}
                >
                  <UiIcono nombre="dark_mode" tamano={17} /> Oscuro
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.5 }}>Tema inicial para nuevos usuarios. Cada usuario puede cambiarlo con el toggle.</p>
            </div>
          </UiCuadricula>
        </UiCuadricula>
      </UiTarjeta>

      {/* Información Legal */}
      <UiTarjeta titulo="Información Legal">
        <UiCuadricula contenedor espaciado={3}>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6, md: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <UiCampoTexto
                  etiqueta="RUC *"
                  valor={form.ruc}
                  alCambiar={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                    actualizar('ruc', v);
                  }}
                  alDesenfocar={() => marcarTocado('ruc')}
                  error={!!errores.ruc}
                  mensajeError={errores.ruc}
                  marcador="20100047218"
                  textoAyuda={errores.ruc ? undefined : contador(form.ruc, 11)}
                />
              </div>
              <Tooltip title="Consultar datos en SUNAT via PSE Peru" arrow>
                <button
                  type="button"
                  onClick={consultarRuc}
                  disabled={consultandoRuc || form.ruc.length !== 11}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: form.ruc.length === 11 && !consultandoRuc ? '#9a4a24' : '#d3cdbc',
                    color: form.ruc.length === 11 && !consultandoRuc ? '#fff' : '#aca596',
                    border: 'none',
                    borderRadius: 'var(--ui-r-lg)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: form.ruc.length === 11 && !consultandoRuc ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                    height: '42px',
                    marginTop: '7px',
                    flexShrink: 0,
                  }}
                >
                  {consultandoRuc ? 'Consultando...' : 'Consultar'}
                </button>
              </Tooltip>
            </div>
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6, md: 4 }}>
            <UiCampoTexto etiqueta="Razón Social *" valor={form.razon_social} alCambiar={(e) => cambioRestringido('razon_social', e.target.value, { max: 200 })} alDesenfocar={() => marcarTocado('razon_social')} error={!!errores.razon_social} mensajeError={errores.razon_social} textoAyuda={errores.razon_social ? undefined : contador(form.razon_social, 200, 'Se autocompleta al consultar el RUC')} />
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, md: 4 }}>
            <UiCampoTexto etiqueta="Dirección Legal" valor={form.direccion_legal ?? ''} alCambiar={(e) => cambioRestringido('direccion_legal', e.target.value, { max: 300 })} alDesenfocar={() => marcarTocado('direccion_legal')} error={!!errores.direccion_legal} mensajeError={errores.direccion_legal} textoAyuda={errores.direccion_legal ? undefined : contador(form.direccion_legal, 300, 'Se autocompleta al consultar el RUC')} />
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6, md: 4 }}>
            <UiCampoTexto etiqueta="Departamento" valor={form.departamento ?? ''} alCambiar={(e) => cambioRestringido('departamento', e.target.value, { max: 100, regex: RE_SOLO_LETRAS_ESPACIOS })} alDesenfocar={() => marcarTocado('departamento')} error={!!errores.departamento} mensajeError={errores.departamento} textoAyuda={errores.departamento ? undefined : contador(form.departamento, 100)} />
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6, md: 4 }}>
            <UiCampoTexto etiqueta="Provincia" valor={form.provincia ?? ''} alCambiar={(e) => cambioRestringido('provincia', e.target.value, { max: 100, regex: RE_SOLO_LETRAS_ESPACIOS })} alDesenfocar={() => marcarTocado('provincia')} error={!!errores.provincia} mensajeError={errores.provincia} textoAyuda={errores.provincia ? undefined : contador(form.provincia, 100)} />
          </UiCuadricula>
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6, md: 4 }}>
            <UiCampoTexto etiqueta="Distrito" valor={form.distrito ?? ''} alCambiar={(e) => cambioRestringido('distrito', e.target.value, { max: 100, regex: RE_SOLO_LETRAS_ESPACIOS })} alDesenfocar={() => marcarTocado('distrito')} error={!!errores.distrito} mensajeError={errores.distrito} textoAyuda={errores.distrito ? undefined : contador(form.distrito, 100)} />
          </UiCuadricula>
        </UiCuadricula>
      </UiTarjeta>

      {/* Reglas y Contacto */}
      <UiCuadricula contenedor espaciado={3}>
        <UiCuadricula elemento tamano={{ xs: 12, md: 6 }}>
          <UiTarjeta titulo="Reglas de Negocio">
            <div className="flex items-center gap-3 px-1 py-2">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">15</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Plazo de respuesta: 15 días hábiles</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Establecido por INDECOPI (Ley N° 29571, Art. 152). Improrrogable.</p>
              </div>
            </div>
          </UiTarjeta>
        </UiCuadricula>
        <UiCuadricula elemento tamano={{ xs: 12, md: 6 }}>
          <UiTarjeta titulo="Contacto y Alertas">
            <UiPila direccion="columna" espaciado={2}>
              <UiCampoTexto etiqueta="Email de Contacto" valor={form.email_contacto ?? ''} alCambiar={(e) => cambioRestringido('email_contacto', e.target.value, { max: 150 })} alDesenfocar={() => marcarTocado('email_contacto')} error={!!errores.email_contacto} mensajeError={errores.email_contacto} tipo="email" textoAyuda={errores.email_contacto ? undefined : contador(form.email_contacto, 150)} />
              <UiCampoTexto etiqueta="Teléfono" valor={form.telefono ?? ''} alCambiar={(e) => cambioRestringido('telefono', e.target.value, { max: 20, regex: RE_TELEFONO })} alDesenfocar={() => marcarTocado('telefono')} error={!!errores.telefono} mensajeError={errores.telefono} textoAyuda={errores.telefono ? undefined : contador(form.telefono, 20)} />
              <div style={{ borderTop: '1px solid var(--ui-info-borde)', margin: '8px 0' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Notificaciones por Email</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '8px' }}>Controla qué emails se envían al cliente y a la empresa.</p>
              <UiInterruptor etiqueta="Nuevo reclamo registrado" seleccionado={form.notificar_email ?? false} alCambiar={(_e, checked) => actualizar('notificar_email', checked)} />
              <UiInterruptor etiqueta="Cambio de estado" seleccionado={form.notificar_email_estado ?? true} alCambiar={(_e, checked) => actualizar('notificar_email_estado', checked)} />
              <UiInterruptor etiqueta="Nuevo mensaje" seleccionado={form.notificar_email_mensaje ?? true} alCambiar={(_e, checked) => actualizar('notificar_email_mensaje', checked)} />
              <UiInterruptor etiqueta="Resolución enviada" seleccionado={form.notificar_email_resolucion ?? true} alCambiar={(_e, checked) => actualizar('notificar_email_resolucion', checked)} />
            </UiPila>
          </UiTarjeta>
        </UiCuadricula>
      </UiCuadricula>

      {/* Firma del Representante */}
      <UiTarjeta titulo="Firma del Representante Legal">
        <UiPila direccion="columna" espaciado={2}>
          <p style={{ fontSize: '0.8rem', color: 'var(--ui-texto-2)', margin: 0 }}>
            Esta firma se incluira automaticamente en el PDF de resolucion que se envia al consumidor.
          </p>
          {form.firma_representante ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{
                border: '1px solid var(--ui-borde)', borderRadius: 'var(--ui-r-lg)', padding: '8px',
                background: 'var(--ui-superficie-2)', display: 'inline-block',
              }}>
                <img src={form.firma_representante} alt="Firma del representante" style={{ maxWidth: '200px', maxHeight: '80px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <UiBoton texto="Cambiar Firma" variante="contorno" tamano="sm" alHacerClick={() => setModalFirmaRepr(true)} />
                <UiBoton texto="Eliminar" variante="peligro" tamano="sm" alHacerClick={() => actualizar('firma_representante', '')} />
              </div>
            </div>
          ) : (
            <div>
              <UiBoton texto="Dibujar Firma" variante="contorno" alHacerClick={() => setModalFirmaRepr(true)} />
            </div>
          )}
        </UiPila>
      </UiTarjeta>

      {/* Modal de firma */}
      {modalFirmaRepr && <ModalFirmaRepresentante abierto={modalFirmaRepr} alCerrar={() => setModalFirmaRepr(false)} alConfirmar={(dataUrl) => { actualizar('firma_representante', dataUrl); setModalFirmaRepr(false); }} />}
    </UiPila>
  );
}

// ── Modal Firma Representante ──
function ModalFirmaRepresentante({ abierto, alCerrar, alConfirmar }: { abierto: boolean; alCerrar: () => void; alConfirmar: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [tieneTrazos, setTieneTrazos] = useState(false);

  useEffect(() => {
    if (!abierto || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fffefb';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    setTieneTrazos(false);
  }, [abierto]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const iniciar = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  };

  const dibujar = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setTieneTrazos(true); }
  };

  const detener = () => { isDrawing.current = false; };

  const limpiar = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.fillStyle = '#fffefb';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      setTieneTrazos(false);
    }
  };

  const confirmar = () => {
    if (!tieneTrazos) { notificar.advertencia('Dibuje su firma primero'); return; }
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (dataUrl) alConfirmar(dataUrl);
  };

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Firma del Representante Legal"
      maxAncho="sm"
      bloqueado
      pie={
        <>
          <BotonModal texto="Limpiar" variante="secundario" onClick={limpiar} />
          <BotonModal texto="Cancelar" variante="fantasma" onClick={alCerrar} />
          <BotonModal texto="Confirmar Firma" onClick={confirmar} />
        </>
      }
    >
      <div className="text-center overflow-hidden">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Dibuje la firma del representante legal. Se usará en el PDF de resolución.
        </p>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          style={{ maxWidth: '100%', background: '#fff' }}
          className="border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg cursor-crosshair touch-none block mx-auto"
          onMouseDown={iniciar} onMouseMove={dibujar} onMouseUp={detener} onMouseLeave={detener}
          onTouchStart={iniciar} onTouchMove={dibujar} onTouchEnd={detener}
        />
      </div>
    </ModalBase>
  );
}