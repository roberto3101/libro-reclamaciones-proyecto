import { useEffect, useRef, useState } from 'react';
import { UiCampoTexto, UiSelector, UiCasilla, UiBoton, UiTarjeta } from '@/ui';
import { UiPila, UiCuadricula, UiCaja } from '@/ui';
import { lazy, Suspense } from 'react';
import type { CrearReclamoRequest, Sede } from '@/tipos';
import { publicoApi } from '../api/publico.api';

const MapaUbicacion = lazy(() => import('@/aplicacion/componentes/MapaUbicacion'));
import { notificar } from '@/aplicacion/helpers/toast';
import type { EventoSelector } from '@/ui';

import { ErrorTexto, Contador } from './helpers-ui';

// Importamos la librería y estilos
import 'intl-tel-input/build/css/intlTelInput.css';
import intlTelInput from 'intl-tel-input';

interface Props {
  form: Partial<CrearReclamoRequest>;
  sedes: Sede[];
  actualizar: (campos: Partial<CrearReclamoRequest>) => void;
  alSiguiente: () => void;
  colorPrimario?: string | null;
  tenantSlug?: string;
}

const TIPOS_DOCUMENTO = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'CE', etiqueta: 'Carné de Extranjería' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
  { valor: 'RUC', etiqueta: 'RUC' },
];

const TIPOS_SOLICITUD = [
  { valor: 'RECLAMO', etiqueta: 'Reclamo' },
  { valor: 'QUEJA', etiqueta: 'Queja' },
];

// Reglas extendidas para validación live y bloqueo de input
const REGLAS_DOCUMENTO: Record<string, { regex: RegExp; error: string; max: number; soloNumeros: boolean }> = {
  DNI: { regex: /^\d{8}$/, error: 'El DNI debe tener 8 dígitos', max: 8, soloNumeros: true },
  RUC: { regex: /^\d{11}$/, error: 'El RUC debe tener 11 dígitos', max: 11, soloNumeros: true },
  CE: { regex: /^[a-zA-Z0-9]{9,12}$/, error: 'El CE debe tener entre 9 y 12 caracteres', max: 12, soloNumeros: false },
  PASAPORTE: { regex: /^[a-zA-Z0-9]{6,12}$/, error: 'El Pasaporte debe tener entre 6 y 12 caracteres', max: 12, soloNumeros: false },
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,253}\.[a-zA-Z]{2,10}$/;

export function PasoConsumidor({ form, sedes, actualizar, alSiguiente, colorPrimario, tenantSlug }: Props) {
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<any>(null);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [buscandoDocumento, setBuscandoDocumento] = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] = useState<'exito' | 'error' | null>(null);
  const documentoYaConsultado = useRef<string>('');

  // Estado para cliente empresa
  const [esEmpresa, setEsEmpresa] = useState(false);
  const [validandoEmpresa, setValidandoEmpresa] = useState(false);
  const [empresaValidada, setEmpresaValidada] = useState<{ razon_social: string } | null>(null);
  const [errorEmpresa, setErrorEmpresa] = useState('');

  const handleToggleEmpresa = (checked: boolean) => {
    setEsEmpresa(checked);
    setEmpresaValidada(null);
    setErrorEmpresa('');
    if (checked) {
      actualizar({ tipo_documento: 'RUC', numero_documento: '', nombre_completo: '', domicilio: '' });
      documentoYaConsultado.current = '';
      setResultadoBusqueda(null);
    } else {
      actualizar({ tipo_documento: '', numero_documento: '', nombre_completo: '', domicilio: '', ruc_empresa: undefined, razon_social_empresa: undefined });
      documentoYaConsultado.current = '';
      setResultadoBusqueda(null);
    }
  };

  const validarEmpresaRUC = async (ruc: string) => {
    if (!tenantSlug || ruc.length !== 11) return;
    if (!/^(10|20)\d{9}$/.test(ruc)) {
      setErrorEmpresa('RUC invalido (debe empezar con 10 o 20)');
      return;
    }

    setValidandoEmpresa(true);
    setErrorEmpresa('');
    try {
      const empresa = await publicoApi.validarEmpresaRUC(tenantSlug, ruc);
      setEmpresaValidada(empresa);
      const campos: Partial<CrearReclamoRequest> = {
        ruc_empresa: ruc,
        razon_social_empresa: empresa.razon_social,
        nombre_completo: empresa.razon_social,
        es_cliente_registrado: true,
      };
      if (empresa.direccion) campos.domicilio = empresa.direccion;
      if (empresa.email) campos.email = empresa.email;
      actualizar(campos);
      // Autocompletar teléfono si existe
      if (empresa.telefono && itiRef.current) {
        itiRef.current.setNumber(empresa.telefono.startsWith('+') ? empresa.telefono : `+51${empresa.telefono}`);
        actualizar({ ...campos, telefono: empresa.telefono });
      }
      setErrores(prev => { const n = { ...prev }; delete n.nombre_completo; delete n.email; delete n.domicilio; return n; });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || 'Empresa no registrada en el sistema';
      setErrorEmpresa(msg);
      setEmpresaValidada(null);
      actualizar({ es_cliente_registrado: false });
    } finally {
      setValidandoEmpresa(false);
    }
  };

  // Inicializar intl-tel-input (Lógica original intacta)
  useEffect(() => {
    if (phoneInputRef.current && !itiRef.current) {
      const options: any = {
        /* Perú fijo, no geolocalización.
           Antes se llamaba a ipapi.co en cada carga para adivinar el país:
           eso mandaba la IP del consumidor a un tercero, retrasaba el campo
           y, si la consulta tardaba o fallaba, dejaba el prefijo en +1. En
           un libro de reclamaciones peruano el país es Perú; quien venga de
           fuera puede cambiarlo con el selector de banderas. */
        initialCountry: "pe",
        countryOrder: ["pe", "co", "ec", "cl", "mx", "us"],
        separateDialCode: true,
        autoPlaceholder: "polite",
        utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@26.1.1/build/js/utils.js",
      };

      itiRef.current = intlTelInput(phoneInputRef.current, options);

      if (form.telefono) {
          itiRef.current.setNumber(form.telefono);
      }

      const handleChange = () => {
        if (itiRef.current) {
           const numero = itiRef.current.getNumber();
           const isValid = itiRef.current.isValidNumber();
           
           // Validación live del teléfono
           if (!isValid && numero.length > 5) {
             setErrores(prev => ({ ...prev, telefono: 'Número de teléfono inválido' }));
           } else {
             setErrores(prev => { const newErr = { ...prev }; delete newErr.telefono; return newErr; });
           }
           
           actualizar({ telefono: numero });
        }
      };

      phoneInputRef.current.addEventListener('countrychange', handleChange);
      phoneInputRef.current.addEventListener('input', handleChange);
      phoneInputRef.current.addEventListener('blur', handleChange);
    }

    return () => {
      if (itiRef.current) {
        itiRef.current.destroy();
        itiRef.current = null;
      }
    };
  }, []);

  // Consulta automática de documento cuando el número está completo y válido.
  // Se dispara al alcanzar la longitud exacta (ej: 8 dígitos para DNI, 11 para RUC).
  const consultarDocumentoSiEstaCompleto = async (tipoDocumento: string, numeroDocumento: string) => {
    const regla = REGLAS_DOCUMENTO[tipoDocumento];
    if (!regla || !tenantSlug) return;

    const documentoEsValido = regla.regex.test(numeroDocumento);
    if (!documentoEsValido) return;

    // Evitar consultas duplicadas para el mismo número
    if (documentoYaConsultado.current === numeroDocumento) return;
    documentoYaConsultado.current = numeroDocumento;

    setBuscandoDocumento(true);
    setResultadoBusqueda(null);
    try {
      const datos = await publicoApi.consultarDocumentoIdentidad(tenantSlug, numeroDocumento);
      if (datos) {
        actualizar({
          nombre_completo: datos.nombre_razon || `${datos.nombres} ${datos.apellidos}`.trim(),
          domicilio: datos.direccion || '',
        });
        setResultadoBusqueda('exito');
        // Limpiar errores de los campos autocompletados
        setErrores(prev => {
          const nuevos = { ...prev };
          delete nuevos.nombre_completo;
          return nuevos;
        });
      } else {
        setResultadoBusqueda('error');
      }
    } catch {
      setResultadoBusqueda('error');
      // No bloquear al usuario: si falla, puede escribir manualmente
    } finally {
      setBuscandoDocumento(false);
    }
  };

  // --- MANEJADORES DE INPUT CON VALIDACIÓN LIVE ---

  const handleDocumentoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const tipo = form.tipo_documento;
      let valor = e.target.value;
      const regla = tipo ? REGLAS_DOCUMENTO[tipo] : null;

      if (regla) {
        // 1. Bloqueo de caracteres no permitidos
        if (regla.soloNumeros) {
            valor = valor.replace(/[^0-9]/g, '');
        } else {
            valor = valor.replace(/[^a-zA-Z0-9]/g, '');
        }

        // 2. Bloqueo de longitud máxima
        if (valor.length > regla.max) {
            return; // No actualizamos si excede
        }

        // 3. Validación de error live
        let errorMsg = '';
        if (valor.length > 0 && !regla.regex.test(valor) && valor.length !== regla.max) {
             // Mostramos error si está incompleto (pero escribiendo)
             errorMsg = `Debe tener ${regla.max} caracteres`;
             // Para rangos (CE/Pasaporte)
             if (!regla.soloNumeros) errorMsg = regla.error;
        } else if (valor.length > 0 && !regla.regex.test(valor)) {
             errorMsg = regla.error;
        }

        setErrores(prev => ({ ...prev, numero_documento: errorMsg }));
      }

      actualizar({ numero_documento: valor });

      // Consultar datos automáticamente cuando el documento es válido
      console.log('[DEBUG] handleDocumentoInput', { tipo, valor, esEmpresa, tenantSlug, len: valor.length });
      if (tipo) {
        if (esEmpresa && tipo === 'RUC') {
          // Validar contra SQL Server (empresa)
          const regla = REGLAS_DOCUMENTO['RUC'];
          console.log('[DEBUG] Empresa RUC check', { regexTest: regla.regex.test(valor), valor });
          if (regla.regex.test(valor)) {
            console.log('[DEBUG] Llamando validarEmpresaRUC con', valor);
            validarEmpresaRUC(valor);
          }
        } else {
          consultarDocumentoSiEstaCompleto(tipo, valor);
        }
      }
  };

  const handleTextoGeneral = (campo: keyof CrearReclamoRequest, valor: string, maxLen: number, regex?: RegExp, errorMsg?: string) => {
      // Bloqueo de longitud
      if (valor.length > maxLen) return;

      // Validación Live
      let error = '';
      if (valor.length > 0) {
          if (regex && !regex.test(valor)) {
              error = errorMsg || 'Formato inválido';
          }
      }
      
      // Validación específica para Nombre (solo letras)
      if (campo === 'nombre_completo' || campo === 'nombre_apoderado') {
         if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(valor)) {
             // Si intenta escribir caracteres raros, los limpiamos o mostramos error.
             // Aquí opto por limpiar para mejor UX:
             valor = valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
         }
      }

      setErrores(prev => {
          const nuevos = { ...prev };
          if (error) nuevos[campo] = error;
          else delete nuevos[campo];
          return nuevos;
      });

      actualizar({ [campo]: valor });
  };

  const validarFinal = (): boolean => {
    let esValido = true;
    const nuevosErrores: Record<string, string> = {};

    // 1. Validar Nombre
    if (!form.nombre_completo?.trim()) { 
        nuevosErrores.nombre_completo = 'El nombre es obligatorio';
        esValido = false; 
    }

    // 2. Validar Documento
    if (!form.tipo_documento) {
        nuevosErrores.tipo_documento = 'Seleccione tipo';
        esValido = false;
    }
    if (!form.numero_documento?.trim()) { 
        nuevosErrores.numero_documento = 'Documento obligatorio';
        esValido = false; 
    } else {
        const regla = REGLAS_DOCUMENTO[form.tipo_documento!];
        if (regla && !regla.regex.test(form.numero_documento)) {
            nuevosErrores.numero_documento = regla.error;
            esValido = false;
        }
    }

    // 3. Validar Teléfono
    if (itiRef.current) {
        const esValidoEstricto = itiRef.current.isValidNumber();
        const valorVisual = phoneInputRef.current?.value || '';
        const cantidadDigitos = valorVisual.replace(/[^0-9]/g, '').length;

        if (!esValidoEstricto && cantidadDigitos < 7) {
             nuevosErrores.telefono = 'Número incompleto o inválido';
             esValido = false;
        }

        // Sincronizar el valor del plugin con el form.
        // getNumber() puede fallar si el utilsScript del CDN no cargó,
        // así que usamos fallback: dial code + valor del input.
        let numeroFinal = itiRef.current.getNumber();
        if (!numeroFinal && valorVisual) {
            const countryData = itiRef.current.getSelectedCountryData();
            const dialCode = countryData?.dialCode || '';
            const soloDigitos = valorVisual.replace(/[^0-9]/g, '');
            numeroFinal = '+' + dialCode + soloDigitos;
        }
        if (numeroFinal) {
            actualizar({ telefono: numeroFinal });
        }
    }

    // 4. Validar Email
    if (!form.email?.trim()) { 
        nuevosErrores.email = 'El correo es obligatorio'; 
        esValido = false; 
    } else if (!EMAIL_REGEX.test(form.email)) { 
        nuevosErrores.email = 'Correo inválido'; 
        esValido = false; 
    }

    // 5. Validar Apoderado
    if (form.menor_de_edad && !form.nombre_apoderado?.trim()) {
        nuevosErrores.nombre_apoderado = 'Nombre del apoderado obligatorio';
        esValido = false;
    }

    // 6. Validar empresa registrada (si es cliente empresa)
    if (esEmpresa && !empresaValidada) {
        nuevosErrores.numero_documento = 'Debe validar el RUC de la empresa';
        esValido = false;
    }

    setErrores(nuevosErrores);
    
    if (!esValido) {
        notificar.advertencia('Por favor corrija los errores marcados');
    }
    
    return esValido;
  };

  const opcionesSedes = (sedes || []).map((s) => ({ valor: s.slug, etiqueta: s.nombre }));

  const handleSelect = (campo: string) => (e: EventoSelector) => {
    actualizar({ [campo]: e.target.value });
    // Limpiar error al seleccionar
    setErrores(prev => { const n = { ...prev }; delete n[campo]; return n; });
  };

  return (
    <UiTarjeta titulo="Datos del Consumidor">
      <UiPila direccion="columna" espaciado={2}>
        <UiCuadricula contenedor espaciado={2} alineacion="fin">

          {/* ── Fila 1: Tipo Solicitud + Sede ── */}
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <UiSelector
              etiqueta="Tipo de Solicitud *"
              opciones={TIPOS_SOLICITUD}
              value={form.tipo_solicitud ?? 'RECLAMO'}
              onChange={handleSelect('tipo_solicitud')}
              sx={{ width: '100%' }}
            />
          </UiCuadricula>

          {opcionesSedes.length > 0 && (
            <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
              <UiSelector
                etiqueta="Sede"
                opciones={opcionesSedes}
                value={form.sede_slug ?? ''}
                onChange={handleSelect('sede_slug')}
                buscable
                sx={{ width: '100%' }}
              />
            </UiCuadricula>
          )}

          {/* ── Toggle Cliente Empresa ── */}
          <UiCuadricula elemento tamano={{ xs: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 'var(--ui-r-lg)',
              background: esEmpresa ? 'rgba(154,74,36,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${esEmpresa ? 'rgba(154,74,36,0.4)' : 'rgba(255,255,255,0.15)'}`,
              transition: 'all 0.2s',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--ui-texto, #1a1a1a)' }}>
                <input
                  type="checkbox"
                  checked={esEmpresa}
                  onChange={(e) => handleToggleEmpresa(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: colorPrimario || '#9a4a24' }}
                />
                Soy cliente registrado (empresa)
              </label>
              {esEmpresa && (
                <span style={{ fontSize: 12, color: 'var(--ui-texto-2, #999)' }}>
                  Ingrese su RUC para validar
                </span>
              )}
            </div>
          </UiCuadricula>

          {/* ── Fila 2: Tipo Documento + Número Documento ── */}
          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <UiSelector
              etiqueta="Tipo Documento *"
              opciones={esEmpresa ? [{ valor: 'RUC', etiqueta: 'RUC' }] : TIPOS_DOCUMENTO}
              value={form.tipo_documento ?? ''}
              onChange={(e) => {
                  handleSelect('tipo_documento')(e);
                  actualizar({ numero_documento: '', nombre_completo: '', domicilio: '' });
                  documentoYaConsultado.current = '';
                  setResultadoBusqueda(null);
                  setEmpresaValidada(null);
                  setErrorEmpresa('');
                  setErrores(prev => { const n = { ...prev }; delete n.numero_documento; return n; });
              }}
              sx={{ width: '100%' }}
            />
            <ErrorTexto mensaje={errores.tipo_documento} />
          </UiCuadricula>

          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <UiCampoTexto
                etiqueta="Número Documento *"
                valor={form.numero_documento ?? ''}
                alCambiar={handleDocumentoInput}
                deshabilitado={!form.tipo_documento}
                marcador={!form.tipo_documento ? 'Seleccione tipo primero' : ''}
                anchoCompleto
                inputProps={{
                  inputMode: (form.tipo_documento && REGLAS_DOCUMENTO[form.tipo_documento]?.soloNumeros) ? 'numeric' : 'text',
                  pattern: (form.tipo_documento && REGLAS_DOCUMENTO[form.tipo_documento]?.soloNumeros) ? '[0-9]*' : undefined,
                  autoComplete: 'off',
                }}
                sx={{ my: 1 }}
            />
            {buscandoDocumento && (
              <span className="block mt-1 text-xs text-blue-600 dark:text-blue-400 animate-pulse">Consultando datos del documento...
              </span>
            )}
            {!buscandoDocumento && resultadoBusqueda === 'exito' && (
              <span className="block mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
                ✓ Datos encontrados y autocompletados
              </span>
            )}
            {!buscandoDocumento && resultadoBusqueda === 'error' && (
              <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">No se encontraron datos. Complete manualmente.
              </span>
            )}
            <ErrorTexto mensaje={errores.numero_documento} />
            {/* Validación empresa SQL Server */}
            {esEmpresa && validandoEmpresa && (
              <span className="block mt-1 text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                Validando empresa...
              </span>
            )}
            {esEmpresa && errorEmpresa && (
              <div style={{
                marginTop: 4, padding: '6px 10px', borderRadius: 6,
                background: 'rgba(184,58,50,0.08)', border: '1px solid rgba(184,58,50,0.3)',
                fontSize: 13, color: '#a3312a', fontWeight: 500,
              }}>
                {errorEmpresa}
              </div>
            )}
            {esEmpresa && empresaValidada && (
              <div style={{
                marginTop: 4, padding: '6px 10px', borderRadius: 6,
                background: 'rgba(92,138,79,0.08)', border: '1px solid rgba(92,138,79,0.3)',
                fontSize: 13, color: '#3a5834', fontWeight: 500,
              }}>
                Empresa registrada: {empresaValidada.razon_social}
              </div>
            )}
          </UiCuadricula>

          {/* Info de la sede seleccionada */}
          {(() => {
            const sede = sedes.find((s) => s.slug === form.sede_slug);
            if (!sede) return null;
            const tieneMapa = sede.latitud && sede.longitud;
            const direccionCompleta = [sede.direccion, sede.distrito, sede.provincia, sede.departamento]
              .filter(Boolean)
              .join(', ');

            // horario_atencion puede ser {String, Valid}, string JSON, o array
            let horarios: Array<{ dia: string; inicio: string; fin: string }> = [];
            try {
              const h = sede.horario_atencion as unknown;
              const raw = h && typeof h === 'object' && !Array.isArray(h) && 'String' in (h as Record<string, unknown>)
                ? (h as Record<string, unknown>).String
                : h;
              if (raw && typeof raw === 'string') {
                const parsed = JSON.parse(raw);
                horarios = Array.isArray(parsed) ? parsed : [];
              } else if (Array.isArray(raw)) {
                horarios = raw;
              }
            } catch { /* ignorar */ }

            const tieneInfo = direccionCompleta || sede.referencia || sede.telefono || horarios.length > 0;
            if (!tieneInfo && !tieneMapa) return null;

            const iconCls = 'w-3.5 h-3.5 text-gray-600 dark:text-gray-400 shrink-0';
            const detailCls = 'flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400 leading-snug';

            return (
              <UiCuadricula elemento tamano={{ xs: 12 }}>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-white/[0.03] overflow-hidden">
                  <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-gray-200/80 dark:border-gray-700/40">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400 m-0 mb-0.5">
                        Sede seleccionada
                      </p>
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 m-0 truncate">
                        {sede.nombre}
                      </p>
                      {direccionCompleta && (
                        <p className="text-[12px] text-gray-600 dark:text-gray-400 m-0 mt-0.5 truncate">
                          {direccionCompleta}
                        </p>
                      )}
                    </div>
                    {sede.es_principal && (
                      <span className="text-[10px] font-medium tracking-wide uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded shrink-0">
                        Principal
                      </span>
                    )}
                  </div>

                  {(sede.referencia || sede.telefono || horarios.length > 0) && (
                    <div className="px-4 py-3 flex flex-wrap gap-x-5 gap-y-2">
                      {sede.referencia && (
                        <div className={detailCls}>
                          <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span>{sede.referencia}</span>
                        </div>
                      )}
                      {sede.telefono && (
                        <div className={detailCls}>
                          <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          <span>{sede.telefono}</span>
                        </div>
                      )}
                      {horarios.length > 0 && (
                        <div className={detailCls}>
                          <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>{horarios.map((h) => `${h.dia} ${h.inicio}–${h.fin}`).join(' · ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {tieneMapa && (
                    <div className="h-[170px] border-t border-gray-200/80 dark:border-gray-700/40">
                      <Suspense fallback={<div className="h-full bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
                        <MapaUbicacion
                          latitud={sede.latitud!}
                          longitud={sede.longitud!}
                          editable={false}
                          altura={170}
                          nombreSede={sede.nombre}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              </UiCuadricula>
            );
          })()}

          {/* ── Nombre Completo / Razón Social (puede autocompletarse) ── */}
          <UiCuadricula elemento tamano={{ xs: 12 }}>
            <UiCampoTexto
                etiqueta={esEmpresa ? "Razon Social *" : "Nombre Completo *"}
                valor={form.nombre_completo ?? ''}
                alCambiar={(e) => handleTextoGeneral('nombre_completo', e.target.value, 150)}
                marcador={esEmpresa ? "Se autocompleta al validar RUC" : "Nombres y Apellidos"}
                anchoCompleto
            />
            <ErrorTexto mensaje={errores.nombre_completo} />
            <Contador actual={form.nombre_completo?.length || 0} max={150} />
          </UiCuadricula>

          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
             <div className="relative w-full">
                <fieldset
                  className={`absolute inset-0 rounded pointer-events-none px-2 m-0 border ${
                    errores.telefono
                      ? 'border-red-600 dark:border-red-400'
                      : 'border-gray-400 dark:border-gray-600'
                  }`}
                  style={{ top: '-5px' }}
                >
                  <legend
                    className={`text-xs px-1 ${
                      errores.telefono
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Teléfono *
                  </legend>
                </fieldset>
                <input
                    ref={phoneInputRef}
                    type="tel"
                    maxLength={15}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="iti-mobile-input w-full px-3.5 py-4 rounded text-base outline-none bg-transparent text-gray-900 dark:text-gray-100"
                    placeholder="987654321"
                />
             </div>
             <ErrorTexto mensaje={errores.telefono} />
          </UiCuadricula>

          <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
            <UiCampoTexto
                etiqueta="Correo Electrónico *"
                valor={form.email ?? ''}
                alCambiar={(e) => handleTextoGeneral('email', e.target.value, 100, EMAIL_REGEX, 'Correo inválido')}
                tipo="email"
                anchoCompleto
            />
            <ErrorTexto mensaje={errores.email} />
          </UiCuadricula>

          <UiCuadricula elemento tamano={{ xs: 12 }}>
            <UiCampoTexto
                etiqueta="Domicilio"
                valor={form.domicilio ?? ''}
                alCambiar={(e) => handleTextoGeneral('domicilio', e.target.value, 250)}
                anchoCompleto
            />
            <Contador actual={form.domicilio?.length || 0} max={250} />
          </UiCuadricula>

          <UiCuadricula elemento tamano={{ xs: 12 }}>
            <UiCasilla
              etiqueta="Menor de Edad"
              seleccionado={form.menor_de_edad ?? false}
              alCambiar={() => actualizar({ menor_de_edad: !form.menor_de_edad })}
            />
          </UiCuadricula>

          {form.menor_de_edad && (
            <UiCuadricula elemento tamano={{ xs: 12 }}>
              <UiCampoTexto
                etiqueta="Nombre del Apoderado *"
                valor={form.nombre_apoderado ?? ''}
                alCambiar={(e) => handleTextoGeneral('nombre_apoderado', e.target.value, 150)}
                anchoCompleto
              />
              <ErrorTexto mensaje={errores.nombre_apoderado} />
            </UiCuadricula>
          )}

        </UiCuadricula>

        <UiPila direccion="fila" sx={{ justifyContent: 'flex-end' }}>
         <UiBoton 
  texto="Siguiente" 
  variante="primario" 
  alHacerClick={() => { if (validarFinal()) { setTimeout(alSiguiente, 0); } }}
  sx={colorPrimario ? { 
    backgroundColor: colorPrimario,
    borderColor: colorPrimario,
    '&:hover': { backgroundColor: colorPrimario, filter: 'brightness(0.9)' }
  } : undefined}
/>
        </UiPila>
      </UiPila>
    </UiTarjeta>
  );
}