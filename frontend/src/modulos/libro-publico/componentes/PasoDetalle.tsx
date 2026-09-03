import { useState, useRef, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { UiCampoTexto, UiCasilla, UiBoton, UiTarjeta } from '@/ui';
import { UiPila, UiCuadricula, UiCaja } from '@/ui';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import type { CrearReclamoRequest, ArchivoAdjunto } from '@/tipos';
import { notificar } from '@/aplicacion/helpers/toast';
import { ErrorTexto, Contador } from './helpers-ui';
import { SubidaArchivos } from './SubidaArchivos';
import dayjs from 'dayjs';

interface Props {
  form: Partial<CrearReclamoRequest>;
  actualizar: (campos: Partial<CrearReclamoRequest>) => void;
  alAnterior: () => void;
  alEnviar: () => void;
  enviando: boolean;
  colorPrimario?: string | null;
  onTurnstileToken: (token: string) => void;
  archivosAdjuntos: ArchivoAdjunto[];
  alAgregarArchivos: (archivosNuevos: File[]) => void;
  alEliminarArchivo: (indice: number) => void;
}

export function PasoDetalle({ form, actualizar, alAnterior, alEnviar, enviando, colorPrimario, onTurnstileToken, archivosAdjuntos, alAgregarArchivos, alEliminarArchivo }: Props) {
  const [modalFirma, setModalFirma] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // --- MANEJADORES CON VALIDACIÓN LIVE ---

  const handleTextoLimitado = (campo: keyof CrearReclamoRequest, valor: string, max: number) => {
    // 1. Bloqueo de longitud
    if (valor.length > max) return;

    actualizar({ [campo]: valor });

    // 2. Limpiar error si escribe algo y el campo tenía error
    if (errores[campo]) {
        // Solo limpiamos si hay contenido, o si la validación era "obligatorio" y ya no está vacío.
        // Si tienes validaciones más complejas, aquí irían.
        if (valor.trim().length > 0) {
            setErrores(prev => { const n = { ...prev }; delete n[campo]; return n; });
        }
    }
  };

  const validarFecha = (fecha: dayjs.Dayjs | null): string | null => {
    if (!fecha || !fecha.isValid()) return null;
    if (fecha.isAfter(dayjs())) return 'La fecha no puede ser posterior a hoy';
    if (fecha.isBefore(dayjs().subtract(2, 'year'))) return 'La fecha no puede tener más de 2 años de antigüedad';
    return null;
  };

  const handleFecha = (fecha: dayjs.Dayjs | null) => {
    if (!fecha || !fecha.isValid()) {
      actualizar({ fecha_incidente: '' });
      return;
    }
    const valor = fecha.format('YYYY-MM-DD');
    actualizar({ fecha_incidente: valor });
    const error = validarFecha(fecha);
    if (error) {
      setErrores(prev => ({ ...prev, fecha_incidente: error }));
    } else if (errores.fecha_incidente) {
      setErrores(prev => { const n = { ...prev }; delete n.fecha_incidente; return n; });
    }
  };

  const handleTerminos = () => {
     actualizar({ acepta_terminos: !form.acepta_terminos });
     if (!form.acepta_terminos && errores.acepta_terminos) {
         setErrores(prev => { const n = { ...prev }; delete n.acepta_terminos; return n; });
     }
  };

  // --- VALIDACIÓN FINAL ---
  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    let esValido = true;

    if (!form.fecha_incidente) {
        nuevosErrores.fecha_incidente = 'La fecha es obligatoria';
        esValido = false;
    } else {
        const fecha = dayjs(form.fecha_incidente);
        const errorFecha = validarFecha(fecha);
        if (errorFecha) {
            nuevosErrores.fecha_incidente = errorFecha;
            esValido = false;
        }
    }
    
    // Validaciones Detalle (Obligatorio)
    if (!form.detalle_reclamo?.trim()) { 
        nuevosErrores.detalle_reclamo = 'El detalle es obligatorio'; 
        esValido = false; 
    }

    // Validaciones Pedido (Obligatorio)
    if (!form.pedido_consumidor?.trim()) { 
        nuevosErrores.pedido_consumidor = 'El pedido es obligatorio'; 
        esValido = false; 
    }

    // Validaciones Área Queja (Opcional pero con límite, aquí solo validamos si por alguna razón viniera sucio, pero el input ya bloquea)
    // Si quisieras que sea obligatorio, descomenta:
    // if (!form.area_queja?.trim()) { nuevosErrores.area_queja = 'Campo requerido'; esValido = false; }

    // Validaciones Descripción Situación (Opcional pero con límite)
    
    if (!form.acepta_terminos) { 
        nuevosErrores.acepta_terminos = 'Debe aceptar los términos'; 
        esValido = false; 
    }
    
    if (!form.firma_digital) {
        nuevosErrores.firma_digital = 'La firma es obligatoria';
        esValido = false;
    }

    if (!form.turnstile_token) {
        nuevosErrores.turnstile_token = 'Completa la verificación de seguridad';
        esValido = false;
    }

    setErrores(nuevosErrores);

    if (!esValido) {
        notificar.advertencia('Complete los campos obligatorios marcados en rojo');
    }
    
    return esValido;
  };

  return (
    <>
      <UiTarjeta titulo="Detalle del Reclamo">
        <UiPila direccion="columna" espaciado={2}>
          <UiCuadricula contenedor espaciado={2}>
            
            <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Fecha del Incidente *"
                value={form.fecha_incidente ? dayjs(form.fecha_incidente) : null}
                disableFuture
                minDate={dayjs().subtract(2, 'year')}
                onChange={handleFecha}
                enableAccessibleFieldDOMStructure={false}
                slots={{ textField: TextField }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    variant: 'outlined',
                    error: !!errores.fecha_incidente,
                    helperText: errores.fecha_incidente || 'Máximo 2 años de antigüedad (Art. 121, Ley 29571)'
                  },
                }}
              />
            </UiCuadricula>
            
            <UiCuadricula elemento tamano={{ xs: 12, sm: 6 }}>
              <UiCampoTexto
                etiqueta="Área de Queja"
                valor={form.area_queja ?? ''}
                alCambiar={(e) => handleTextoLimitado('area_queja', e.target.value, 200)}
                error={!!errores.area_queja}
                anchoCompleto
                sx={{ my: 0 }}
              />
              <UiCaja>
                 <ErrorTexto mensaje={errores.area_queja} />
                 <Contador actual={form.area_queja?.length || 0} max={200} />
              </UiCaja>
            </UiCuadricula>
            
            <UiCuadricula elemento tamano={{ xs: 12 }}>
              <UiCampoTexto
                etiqueta="Descripción de la Situación"
                valor={form.descripcion_situacion ?? ''}
                alCambiar={(e) => handleTextoLimitado('descripcion_situacion', e.target.value, 1000)}
                multilinea
                filasMinimas={4}
                error={!!errores.descripcion_situacion}
                anchoCompleto
              />
              <UiCaja>
                 <ErrorTexto mensaje={errores.descripcion_situacion} />
                 <Contador actual={form.descripcion_situacion?.length || 0} max={1000} />
              </UiCaja>
            </UiCuadricula>
            
            <UiCuadricula elemento tamano={{ xs: 12 }}>
              <UiCampoTexto
                etiqueta="Detalle del Reclamo *"
                valor={form.detalle_reclamo ?? ''}
                alCambiar={(e) => handleTextoLimitado('detalle_reclamo', e.target.value, 3000)}
                multilinea
                filasMinimas={5}
                marcador="Describa detalladamente su reclamo..."
                error={!!errores.detalle_reclamo}
                anchoCompleto
              />
              <UiCaja>
                  <ErrorTexto mensaje={errores.detalle_reclamo} />
                  <Contador actual={form.detalle_reclamo?.length || 0} max={3000} />
              </UiCaja>
            </UiCuadricula>
            
            <UiCuadricula elemento tamano={{ xs: 12 }}>
              <UiCampoTexto
                etiqueta="Pedido del Consumidor *"
                valor={form.pedido_consumidor ?? ''}
                alCambiar={(e) => handleTextoLimitado('pedido_consumidor', e.target.value, 2000)}
                multilinea
                filasMinimas={4}
                marcador="¿Qué solicita como solución?"
                error={!!errores.pedido_consumidor}
                anchoCompleto
              />
              <UiCaja>
                  <ErrorTexto mensaje={errores.pedido_consumidor} />
                  <Contador actual={form.pedido_consumidor?.length || 0} max={2000} />
              </UiCaja>
            </UiCuadricula>
          </UiCuadricula>

          <SubidaArchivos
            archivos={archivosAdjuntos}
            alAgregarArchivos={alAgregarArchivos}
            alEliminarArchivo={alEliminarArchivo}
            colorPrimario={colorPrimario}
          />

          {/* Firma digital */}
          <UiPila direccion="columna" espaciado={1}>
            <span className={`font-semibold ${errores.firma_digital ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                Firma Digital *
            </span>
            {form.firma_digital ? (
              <UiCaja sx={{ textAlign: 'center' }}>
                <img src={form.firma_digital} alt="Firma" className="max-w-full sm:max-w-[280px] border border-gray-200 dark:border-gray-600 rounded-lg" />
                <br />
                <UiBoton texto="Cambiar Firma" variante="contorno" tamano="sm" alHacerClick={() => setModalFirma(true)} />
              </UiCaja>
            ) : (
              <UiBoton texto="Firmar" variante="contorno" alHacerClick={() => setModalFirma(true)} />
            )}
            <ErrorTexto mensaje={errores.firma_digital} />
          </UiPila>

          <UiCaja>
            <UiCasilla
                etiqueta="Acepto los términos y condiciones del libro de reclamaciones *"
                seleccionado={form.acepta_terminos ?? false}
                alCambiar={handleTerminos}
            />
            <ErrorTexto mensaje={errores.acepta_terminos} />
          </UiCaja>

          {/* CAPTCHA Cloudflare Turnstile */}
          <UiCaja sx={{ display: 'flex', justifyContent: 'center', overflow: 'hidden', maxWidth: '100%' }}>
            <Turnstile
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onSuccess={onTurnstileToken}
            />
          </UiCaja>

          <UiPila direccion="fila" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <UiBoton texto="Anterior" variante="contorno" alHacerClick={alAnterior} />
            <UiBoton
              texto="Enviar Reclamo"
              variante="primario"
              tamano="lg"
              estado={enviando ? 'cargando' : 'inactivo'}
              alHacerClick={() => validar() && alEnviar()}
              sx={colorPrimario ? {
                backgroundColor: colorPrimario,
                borderColor: colorPrimario,
                '&:hover': { backgroundColor: colorPrimario, filter: 'brightness(0.9)' }
              } : undefined}
            />
          </UiPila>
        </UiPila>
      </UiTarjeta>

      <ModalFirmaDigital
        abierto={modalFirma}
        alCerrar={() => setModalFirma(false)}
        alConfirmar={(dataUrl) => { 
            actualizar({ firma_digital: dataUrl }); 
            setModalFirma(false);
            // Limpiar error de firma si existe
            setErrores(prev => { const n = { ...prev }; delete n.firma_digital; return n; });
        }}
      />
    </>
  );
}

// ── Modal de Firma Digital (Lógica original intacta) ──

interface ModalFirmaProps {
  abierto: boolean;
  alCerrar: () => void;
  alConfirmar: (dataUrl: string) => void;
}

function ModalFirmaDigital({ abierto, alCerrar, alConfirmar }: ModalFirmaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [tieneTrazos, setTieneTrazos] = useState(false);

  // Inicializar contexto al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#000000';
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar visualmente
          setTieneTrazos(false);
          isDrawing.current = false;
        }
      }, 50); // Pequeño delay para asegurar renderizado
    }
  }, [abierto]);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e: any) => {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      const { x, y } = getPos(e);
      ctx.moveTo(x, y);
      setTieneTrazos(true);
    }
  };

  const move = (e: any) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const end = () => {
    isDrawing.current = false;
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTieneTrazos(false);
      isDrawing.current = false;
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
      titulo="Firma Digital"
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
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
          Dibuje su firma en el recuadro
        </p>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          style={{ maxWidth: '100%', height: 'auto' }}
          className="border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg cursor-crosshair touch-none bg-white block mx-auto"
        />
      </div>
    </ModalBase>
  );
}