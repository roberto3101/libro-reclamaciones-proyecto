import { useState, useEffect, useMemo, useRef } from 'react';
import { UiPila } from '@/ui';
import { UiCampoTexto, UiBoton, UiInterruptor } from '@/ui';
import { Chip, Alert, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { PlantillaEmail, ActualizarPlantillaEmailRequest, Tenant } from '@/tipos';
import { plantillasEmailApi } from '../api/plantillas-email.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { VistaPreviaEmail } from './VistaPreviaEmail';

interface Props {
  plantilla: PlantillaEmail;
  tenant: Tenant | null;
  alGuardar: () => void;
  alCancelar: () => void;
}

// Nombres amigables y descripciones para cada variable
const INFO_VARIABLES: Record<string, { nombre: string; descripcion: string; ejemplo: string }> = {
  nombre_cliente: { nombre: 'Nombre del cliente', descripcion: 'Nombre completo del consumidor', ejemplo: 'Juan Perez' },
  codigo_reclamo: { nombre: 'Codigo del reclamo', descripcion: 'Codigo unico asignado al caso', ejemplo: 'RCL-2026-00042' },
  fecha: { nombre: 'Fecha de registro', descripcion: 'Fecha y hora del registro', ejemplo: '06/03/2026 14:30' },
  razon_social: { nombre: 'Nombre de la empresa', descripcion: 'Razon social configurada', ejemplo: 'Mi Empresa SAC' },
  tipo_solicitud: { nombre: 'Tipo de solicitud', descripcion: 'RECLAMO o QUEJA', ejemplo: 'RECLAMO' },
  nuevo_estado: { nombre: 'Nuevo estado', descripcion: 'Estado actualizado del caso', ejemplo: 'EN PROCESO' },
  respuesta_preview: { nombre: 'Resumen de respuesta', descripcion: 'Extracto de la resolucion', ejemplo: 'Se ha procedido a realizar la devolucion...' },
  mensaje_preview: { nombre: 'Resumen del mensaje', descripcion: 'Extracto del mensaje enviado', ejemplo: 'Estimado cliente, le informamos...' },
  slug_tenant: { nombre: 'Identificador empresa', descripcion: 'Slug unico del tenant', ejemplo: 'mi-empresa' },
};

const regVariable = /\{\{(\w+)\}\}/g;
const CAMPOS_CON_VARIABLES = ['asunto', 'saludo', 'cuerpo_principal', 'texto_pie', 'texto_boton'] as const;

/**
 * Protege las variables {{...}} para que no sean editables.
 * Si el usuario intenta modificar el interior de una variable, se restaura la variable original.
 * Si el usuario borra parcialmente una variable, se elimina la variable completa.
 */
function protegerVariables(valorAnterior: string, valorNuevo: string): { texto: string; cursorOffset: number | null } {
  // Extraer variables del valor anterior
  const variablesAnterior = [...valorAnterior.matchAll(/\{\{\w+\}\}/g)].map(m => ({
    texto: m[0],
    inicio: m.index!,
    fin: m.index! + m[0].length,
  }));

  if (variablesAnterior.length === 0) return { texto: valorNuevo, cursorOffset: null };

  // Detectar dónde ocurrió el cambio
  const diff = valorNuevo.length - valorAnterior.length;

  // Encontrar la posición del cambio comparando carácter a carácter
  let posicionCambio = 0;
  for (let i = 0; i < Math.min(valorAnterior.length, valorNuevo.length); i++) {
    if (valorAnterior[i] !== valorNuevo[i]) { posicionCambio = i; break; }
    posicionCambio = i + 1;
  }

  // Si fue una inserción dentro de una variable, revertir
  if (diff > 0) {
    for (const v of variablesAnterior) {
      // La inserción ocurrió dentro de la variable (entre {{ y }})
      if (posicionCambio > v.inicio && posicionCambio < v.fin) {
        // Revertir: quitar los caracteres insertados
        const restaurado = valorNuevo.slice(0, posicionCambio) + valorNuevo.slice(posicionCambio + diff);
        return { texto: restaurado, cursorOffset: v.fin };
      }
    }
  }

  // Si fue un borrado parcial de una variable, eliminar la variable completa
  if (diff < 0) {
    const cantBorrada = Math.abs(diff);
    const inicioSeleccion = posicionCambio;
    const finSeleccion = posicionCambio + cantBorrada;

    for (const v of variablesAnterior) {
      // El borrado afecta parcialmente a la variable (no la borra completa)
      const afectaVariable = inicioSeleccion < v.fin && finSeleccion > v.inicio;
      const borraCompleta = inicioSeleccion <= v.inicio && finSeleccion >= v.fin;

      if (afectaVariable && !borraCompleta) {
        // Eliminar la variable completa del valor anterior, luego aplicar el texto antes/después
        const textoSinVariable = valorAnterior.slice(0, v.inicio) + valorAnterior.slice(v.fin);
        return { texto: textoSinVariable, cursorOffset: v.inicio };
      }
    }
  }

  // Verificar que el resultado no tenga variables corruptas (e.g., {{nombre_clinte}})
  const variablesNuevo = [...valorNuevo.matchAll(/\{\{(\w+)\}\}/g)];
  for (const m of variablesNuevo) {
    if (!INFO_VARIABLES[m[1]]) {
      // Variable corrupta detectada: buscar cuál era la variable original en esa zona
      const posVar = m.index!;
      for (const v of variablesAnterior) {
        // Si la posición coincide aproximadamente con una variable anterior
        if (Math.abs(posVar - v.inicio) <= Math.abs(diff) + 2) {
          const restaurado = valorNuevo.slice(0, posVar) + v.texto + valorNuevo.slice(posVar + m[0].length);
          return { texto: restaurado, cursorOffset: v.inicio + v.texto.length };
        }
      }
    }
  }

  return { texto: valorNuevo, cursorOffset: null };
}

export function FormPlantillaEmail({ plantilla, tenant, alGuardar, alCancelar }: Props) {
  const [form, setForm] = useState<ActualizarPlantillaEmailRequest>({
    asunto: '', saludo: '', cuerpo_principal: '', texto_pie: '', texto_boton: '', activa: true,
  });
  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [campoActivo, setCampoActivo] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const alEnfocarCampo = (campo: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    inputRefs.current[campo] = e.target;
    setCampoActivo(campo);
  };

  useEffect(() => {
    setForm({
      asunto: plantilla.asunto, saludo: plantilla.saludo,
      cuerpo_principal: plantilla.cuerpo_principal, texto_pie: plantilla.texto_pie,
      texto_boton: plantilla.texto_boton, activa: plantilla.activa,
    });
    setErrores({});
    setCampoActivo(null);
  }, [plantilla]);

  const actualizar = (campo: keyof ActualizarPlantillaEmailRequest, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    validarCampo(campo, valor);
  };

  const actualizarConProteccion = (campo: keyof ActualizarPlantillaEmailRequest, valorNuevo: string, maxLen: number) => {
    if (valorNuevo.length > maxLen) return;
    const valorAnterior = String(form[campo] || '');
    const resultado = protegerVariables(valorAnterior, valorNuevo);
    actualizar(campo, resultado.texto);
    if (resultado.cursorOffset !== null) {
      const input = inputRefs.current[campo];
      if (input) {
        setTimeout(() => {
          input.setSelectionRange(resultado.cursorOffset!, resultado.cursorOffset!);
        }, 0);
      }
    }
  };

  const insertarVariable = (variable: string) => {
    const campo = campoActivo as keyof ActualizarPlantillaEmailRequest | null;
    if (!campo || !CAMPOS_CON_VARIABLES.includes(campo as any)) {
      navigator.clipboard.writeText(`{{${variable}}}`).then(() =>
        notificar.exito(`Texto copiado. Pegalo en el campo que desees.`)
      );
      return;
    }
    const input = inputRefs.current[campo];
    const valorActual = String(form[campo] || '');
    const textoInsertar = `{{${variable}}}`;
    let pos = valorActual.length;
    if (input) pos = input.selectionStart ?? valorActual.length;
    const nuevoValor = valorActual.slice(0, pos) + textoInsertar + valorActual.slice(pos);
    actualizar(campo, nuevoValor);
    setTimeout(() => {
      if (input) {
        input.focus();
        const nuevaPos = pos + textoInsertar.length;
        input.setSelectionRange(nuevaPos, nuevaPos);
      }
    }, 0);
  };

  const validarCampo = (campo: string, valor: any) => {
    const nuevosErrores = { ...errores };
    delete nuevosErrores[campo];
    const texto = String(valor);
    if (campo === 'asunto') {
      if (texto.replace(/<[^>]+>/g, '').length < 5) nuevosErrores.asunto = 'Minimo 5 caracteres';
      else if (texto.length > 200) nuevosErrores.asunto = 'Maximo 200 caracteres';
      else if (/<[^>]+>/.test(texto)) nuevosErrores.asunto = 'No se permite HTML';
      else validarVariablesCampo(texto, campo, nuevosErrores);
    }
    if (campo === 'cuerpo_principal') {
      if (texto.replace(/<[^>]+>/g, '').length < 5) nuevosErrores.cuerpo_principal = 'Minimo 5 caracteres';
      else if (texto.length > 2000) nuevosErrores.cuerpo_principal = 'Maximo 2000 caracteres';
      else if (/<[^>]+>/.test(texto)) nuevosErrores.cuerpo_principal = 'No se permite HTML';
      else validarVariablesCampo(texto, campo, nuevosErrores);
    }
    if (campo === 'saludo' || campo === 'texto_pie') {
      if (/<[^>]+>/.test(texto)) nuevosErrores[campo] = 'No se permite HTML';
      else validarVariablesCampo(texto, campo, nuevosErrores);
    }
    setErrores(nuevosErrores);
  };

  const validarVariablesCampo = (texto: string, campo: string, erroresObj: Record<string, string>) => {
    const matches = [...texto.matchAll(regVariable)];
    for (const match of matches) {
      if (!plantilla.variables_permitidas.includes(match[1])) {
        const nombre = INFO_VARIABLES[match[1]]?.nombre || match[1];
        erroresObj[campo] = `"${nombre}" no esta disponible para este tipo de plantilla`;
        break;
      }
    }
  };

  const hayErrores = useMemo(() => Object.keys(errores).length > 0, [errores]);

  const datosPreview = useMemo(() => ({
    nombre_cliente: 'Juan Perez',
    codigo_reclamo: 'RCL-2026-00042',
    fecha: '06/03/2026 14:30',
    razon_social: tenant?.razon_social || 'Mi Empresa SAC',
    tipo_solicitud: 'RECLAMO',
    nuevo_estado: 'EN PROCESO',
    respuesta_preview: 'Se ha procedido a realizar la devolucion del monto pagado...',
    mensaje_preview: 'Estimado cliente, le informamos que estamos revisando su caso...',
    slug_tenant: tenant?.slug || 'mi-empresa',
  }), [tenant]);

  const reemplazarVariables = (texto: string) =>
    texto.replace(regVariable, (_, nombre) => datosPreview[nombre as keyof typeof datosPreview] || `{{${nombre}}}`);

  const guardar = async () => {
    if (hayErrores) return;
    setGuardando(true);
    try {
      await plantillasEmailApi.actualizar(plantilla.id, form);
      notificar.exito('Plantilla actualizada correctamente');
      alGuardar();
    } catch (error) { manejarError(error); }
    finally { setGuardando(false); }
  };

  const restaurar = async () => {
    setRestaurando(true);
    try {
      await plantillasEmailApi.restaurarDefecto(plantilla.id);
      notificar.exito('Plantilla restaurada a valores por defecto');
      alGuardar();
    } catch (error) { manejarError(error); }
    finally { setRestaurando(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header con nombre y toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 rounded-xl border border-[var(--ui-borde,#e5e0d4)] bg-[var(--ui-superficie-2,#fff)]">
        <div>
          <h3 className="text-lg font-bold m-0">{plantilla.nombre_visual}</h3>
          <p className="text-sm mt-1 mb-0" style={{ color: 'var(--ui-texto-2, #857e70)' }}>
            Edita los textos que aparecen en este correo. La estructura visual se mantiene fija.
          </p>
        </div>
        <div className="flex-shrink-0">
          <UiInterruptor
            etiqueta="Plantilla activa"
            seleccionado={form.activa}
            alCambiar={(_e, checked) => actualizar('activa', checked)}
          />
        </div>
      </div>

      {/* Datos dinamicos disponibles */}
      <div className="p-4 sm:p-5 rounded-xl" style={{
        backgroundColor: 'var(--ui-info-suave, #fbf2ec)',
        border: '1px solid var(--ui-info-borde, #f0dccd)',
      }}>
        <p className="text-sm font-bold m-0 mb-2" style={{ color: 'var(--ui-info-texto, #6d3216)' }}>
          Datos dinamicos disponibles
        </p>
        <p className="text-xs m-0 mb-3" style={{ color: 'var(--ui-info-texto, #6d3216)', opacity: 0.8 }}>
          {campoActivo
            ? 'Haz clic en un dato para insertarlo donde esta el cursor.'
            : 'Haz clic en un campo de texto primero, luego clic en el dato que quieras insertar.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {plantilla.variables_permitidas.map((v) => {
            const info = INFO_VARIABLES[v];
            return (
              <Tooltip key={v} title={info ? `${info.descripcion} — Ej: ${info.ejemplo}` : v} arrow placement="top">
                <Chip
                  icon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                  label={info?.nombre || v}
                  size="small"
                  color="primary"
                  variant={campoActivo ? 'filled' : 'outlined'}
                  onClick={() => insertarVariable(v)}
                  sx={{ cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, height: '32px',
                    transition: 'border-color 0.15s', '&:hover': { borderColor: 'var(--ui-borde-fuerte)' } }}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Layout principal: Form + Preview lado a lado en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Columna izquierda: Campos */}
        <div className="flex flex-col gap-5">
          {/* Asunto */}
          <div className="p-5 rounded-xl border border-[var(--ui-borde,#e5e0d4)] bg-[var(--ui-superficie-2,#fff)]">
            <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: 'var(--ui-texto, #1f1d19)' }}>
              Asunto del correo
            </p>
            <p className="text-xs m-0 mb-4" style={{ color: 'var(--ui-texto-2, #857e70)' }}>
              Es lo primero que ve el destinatario en su bandeja de entrada.
            </p>
            <UiCampoTexto
              etiqueta="Asunto"
              valor={form.asunto}
              alCambiar={(e) => actualizarConProteccion('asunto', e.target.value, 200)}
              textoAyuda={errores.asunto || `${form.asunto.length}/200 caracteres`}
              error={!!errores.asunto || form.asunto.length >= 200}
              multilinea
              filasMinimas={1}
              filasMaximas={3}
              anchoCompleto
              alEnfocar={alEnfocarCampo('asunto')}
            />
          </div>

          {/* Contenido */}
          <div className="p-5 rounded-xl border border-[var(--ui-borde,#e5e0d4)] bg-[var(--ui-superficie-2,#fff)]">
            <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: 'var(--ui-texto, #1f1d19)' }}>
              Contenido del correo
            </p>
            <p className="text-xs m-0 mb-4" style={{ color: 'var(--ui-texto-2, #857e70)' }}>
              Estos textos aparecen dentro del cuerpo del email que recibe el destinatario.
            </p>
            <UiPila direccion="columna" espaciado={2}>
              <UiCampoTexto
                etiqueta="Saludo inicial"
                valor={form.saludo}
                alCambiar={(e) => actualizarConProteccion('saludo', e.target.value, 300)}
                textoAyuda={errores.saludo || `${form.saludo.length}/300 — Se muestra en negrita al inicio`}
                error={!!errores.saludo || form.saludo.length >= 300}
                multilinea
                filasMinimas={1}
                filasMaximas={2}
                anchoCompleto
                alEnfocar={alEnfocarCampo('saludo')}
              />
              <UiCampoTexto
                etiqueta="Mensaje principal"
                valor={form.cuerpo_principal}
                alCambiar={(e) => actualizarConProteccion('cuerpo_principal', e.target.value, 2000)}
                multilinea
                filasMinimas={4}
                filasMaximas={12}
                textoAyuda={errores.cuerpo_principal || `${form.cuerpo_principal.length}/2000 caracteres`}
                error={!!errores.cuerpo_principal || form.cuerpo_principal.length >= 2000}
                anchoCompleto
                alEnfocar={alEnfocarCampo('cuerpo_principal')}
              />
              <UiCampoTexto
                etiqueta="Pie de pagina"
                valor={form.texto_pie}
                alCambiar={(e) => actualizarConProteccion('texto_pie', e.target.value, 500)}
                textoAyuda={errores.texto_pie || `${form.texto_pie.length}/500 — Aparece en gris al final`}
                error={!!errores.texto_pie || form.texto_pie.length >= 500}
                multilinea
                filasMinimas={1}
                filasMaximas={3}
                anchoCompleto
                alEnfocar={alEnfocarCampo('texto_pie')}
              />
              {plantilla.tipo_evento === 'nuevo_mensaje' && (
                <UiCampoTexto
                  etiqueta="Texto del boton"
                  valor={form.texto_boton}
                  alCambiar={(e) => actualizar('texto_boton', e.target.value)}
                  textoAyuda="Texto visible en el boton de accion dentro del correo"
                  marcador="Responder Mensaje"
                  anchoCompleto
                  alEnfocar={alEnfocarCampo('texto_boton')}
                />
              )}
            </UiPila>
          </div>

          {hayErrores && (
            <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>
              Corrige los errores marcados antes de guardar.
            </Alert>
          )}
        </div>

        {/* Columna derecha: Vista previa */}
        <div className="flex flex-col gap-4">
          <div className="p-5 rounded-xl border border-[var(--ui-borde,#e5e0d4)] bg-[var(--ui-superficie-2,#fff)]">
            <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: 'var(--ui-texto, #1f1d19)' }}>
              Vista previa
            </p>
            <p className="text-xs m-0 mb-4" style={{ color: 'var(--ui-texto-2, #857e70)' }}>
              Asi se vera el correo real. Los datos dinamicos se reemplazan con valores de ejemplo.
            </p>
            <VistaPreviaEmail
              asunto={reemplazarVariables(form.asunto)}
              saludo={reemplazarVariables(form.saludo)}
              cuerpo={reemplazarVariables(form.cuerpo_principal)}
              pie={reemplazarVariables(form.texto_pie)}
              boton={form.texto_boton ? reemplazarVariables(form.texto_boton) : undefined}
              tipoEvento={plantilla.tipo_evento}
              logoUrl={tenant?.logo_url || null}
              colorMarca={tenant?.color_primario || '#9a4a24'}
              razonSocial={tenant?.razon_social || 'Mi Empresa'}
            />
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <UiBoton
          texto="Restaurar valores originales"
          variante="contorno"
          tamano="md"
          estado={restaurando ? 'cargando' : 'inactivo'}
          alHacerClick={restaurar}
        />
        <UiBoton
          texto="Cancelar"
          variante="contorno"
          tamano="md"
          alHacerClick={alCancelar}
        />
        <UiBoton
          texto="Guardar Cambios"
          variante="primario"
          tamano="md"
          estado={guardando ? 'cargando' : 'inactivo'}
          alHacerClick={guardar}
        />
      </div>
    </div>
  );
}
