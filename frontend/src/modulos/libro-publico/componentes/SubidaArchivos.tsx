import { useRef, useState } from 'react';
import { UiPila, UiCaja, UiIcono } from '@/ui';
import { UiBoton } from '@/ui';
import type { ArchivoAdjunto } from '@/tipos';
import {
  TAMANIO_MAXIMO_ARCHIVO_MB,
  TAMANIO_MAXIMO_ARCHIVO_BYTES,
  TIPOS_MIME_PERMITIDOS,
  EXTENSIONES_PROHIBIDAS,
  EXTENSIONES_ACEPTADAS,
} from '@/tipos';
import { notificar } from '@/aplicacion/helpers/toast';
import { ErrorTexto } from './helpers-ui';

interface PropiedadesSubidaArchivos {
  archivos: ArchivoAdjunto[];
  alAgregarArchivos: (archivosNuevos: File[]) => void;
  alEliminarArchivo: (indice: number) => void;
  maximoArchivos?: number;
  colorPrimario?: string | null;
}

/* Ligaduras de Material Symbols; ver la nota del mapa equivalente en el
   detalle de reclamo. */
const ICONOS_POR_TIPO: Record<string, string> = {
  'application/pdf': 'picture_as_pdf',
  'image/': 'image',
  'application/msword': 'description',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'description',
  'application/vnd.ms-excel': 'table',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'table',
  'application/vnd.ms-powerpoint': 'slideshow',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slideshow',
  'application/zip': 'folder_zip',
  'application/x-rar-compressed': 'folder_zip',
  'application/x-7z-compressed': 'folder_zip',
  'text/': 'article',
};

function obtenerIconoPorTipoMime(tipoMime: string): string {
  for (const [patron, icono] of Object.entries(ICONOS_POR_TIPO)) {
    if (tipoMime.startsWith(patron)) return icono;
  }
  return 'attach_file';
}

function formatearTamanioArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function obtenerExtensionArchivo(nombre: string): string {
  return nombre.split('.').pop()?.toLowerCase() || '';
}

export function SubidaArchivos({
  archivos,
  alAgregarArchivos,
  alEliminarArchivo,
  maximoArchivos = 3,
  colorPrimario,
}: PropiedadesSubidaArchivos) {
  const referenciaInputArchivo = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const espaciosDisponibles = maximoArchivos - archivos.length;
  const limiteAlcanzado = espaciosDisponibles <= 0;

  const validarArchivos = (listaArchivos: File[]): File[] => {
    const archivosValidos: File[] = [];

    for (const archivo of listaArchivos) {
      if (archivosValidos.length >= espaciosDisponibles) {
        notificar.advertencia(`Solo puedes adjuntar ${maximoArchivos} archivos en total`);
        break;
      }

      if (archivo.size === 0) {
        notificar.error(`"${archivo.name}" está vacío`);
        continue;
      }

      if (archivo.size > TAMANIO_MAXIMO_ARCHIVO_BYTES) {
        notificar.error(`"${archivo.name}" excede el límite de ${TAMANIO_MAXIMO_ARCHIVO_MB} MB`);
        continue;
      }

      const extension = obtenerExtensionArchivo(archivo.name);
      if (EXTENSIONES_PROHIBIDAS.includes(extension)) {
        notificar.error(`"${archivo.name}" tiene una extensión no permitida`);
        continue;
      }

      if (!TIPOS_MIME_PERMITIDOS.includes(archivo.type)) {
        notificar.error(`"${archivo.name}" tiene un tipo de archivo no permitido`);
        continue;
      }

      const yaExiste = archivos.some(
        (existente) =>
          existente.archivo.name === archivo.name && existente.archivo.size === archivo.size,
      );
      if (yaExiste) {
        notificar.advertencia(`"${archivo.name}" ya fue agregado`);
        continue;
      }

      archivosValidos.push(archivo);
    }

    return archivosValidos;
  };

  const manejarSeleccionArchivos = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const listaArchivos = Array.from(evento.target.files || []);
    if (listaArchivos.length === 0) return;

    const archivosValidos = validarArchivos(listaArchivos);
    if (archivosValidos.length > 0) {
      alAgregarArchivos(archivosValidos);
    }

    evento.target.value = '';
  };

  const manejarSoltar = (evento: React.DragEvent) => {
    evento.preventDefault();
    setArrastrando(false);

    if (limiteAlcanzado) return;

    const listaArchivos = Array.from(evento.dataTransfer.files);
    const archivosValidos = validarArchivos(listaArchivos);
    if (archivosValidos.length > 0) {
      alAgregarArchivos(archivosValidos);
    }
  };

  const manejarArrastrarEncima = (evento: React.DragEvent) => {
    evento.preventDefault();
    if (!limiteAlcanzado) setArrastrando(true);
  };

  const manejarArrastrarFuera = (evento: React.DragEvent) => {
    evento.preventDefault();
    setArrastrando(false);
  };

  return (
    <UiPila direccion="columna" espaciado={1}>
      <span className="font-semibold text-gray-900 dark:text-gray-100">
        Archivos Adjuntos
        <span className="font-normal text-sm text-gray-600 dark:text-gray-400 ml-2">
          (opcional, máx. {maximoArchivos})
        </span>
      </span>

      {!limiteAlcanzado && (
        <div
          onDrop={manejarSoltar}
          onDragOver={manejarArrastrarEncima}
          onDragLeave={manejarArrastrarFuera}
          onClick={() => referenciaInputArchivo.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${arrastrando
              ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800/50'
            }
          `}
        >
          <p className="text-gray-600 dark:text-gray-400 text-sm m-0">
            {arrastrando
              ? 'Suelta los archivos aquí'
              : 'Arrastra archivos aquí o haz clic para seleccionar'}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-xs mt-1 mb-0">
            PDF, imágenes, documentos Office, comprimidos — máx. {TAMANIO_MAXIMO_ARCHIVO_MB} MB por archivo
          </p>
          <input
            ref={referenciaInputArchivo}
            type="file"
            multiple
            accept={EXTENSIONES_ACEPTADAS}
            onChange={manejarSeleccionArchivos}
            className="hidden"
          />
        </div>
      )}

      {archivos.length > 0 && (
        <UiPila direccion="columna" espaciado={1}>
          {archivos.map((archivoAdjunto, indice) => (
            <div
              key={`${archivoAdjunto.archivo.name}-${indice}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <UiIcono
                nombre={obtenerIconoPorTipoMime(archivoAdjunto.archivo.type)}
                tamano={20}
                sx={{ flex: 'none', color: 'var(--ui-texto-3)' }}
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 m-0 truncate">
                  {archivoAdjunto.archivo.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 m-0">
                  {formatearTamanioArchivo(archivoAdjunto.archivo.size)}
                  {archivoAdjunto.estado === 'subiendo' && ' — Subiendo...'}
                  {archivoAdjunto.estado === 'completado' && ' — Subido'}
                  {archivoAdjunto.estado === 'error' && (
                    <span className="text-red-600 dark:text-red-400">
                      {' '}— {archivoAdjunto.mensajeError || 'Error al subir'}
                    </span>
                  )}
                </p>
              </div>

              {archivoAdjunto.estado === 'subiendo' && (
                <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
              )}

              {archivoAdjunto.estado !== 'subiendo' && (
                <UiBoton
                  soloIcono
                  iconoIzquierda={<UiIcono nombre="close" tamano={16} />}
                  aria-label={`Quitar ${archivoAdjunto.archivo.name}`}
                  variante="fantasma"
                  tamano="sm"
                  alHacerClick={() => alEliminarArchivo(indice)}
                />
              )}
            </div>
          ))}
        </UiPila>
      )}

      {limiteAlcanzado && archivos.length > 0 && (
        <ErrorTexto mensaje={`Límite de ${maximoArchivos} archivos alcanzado`} />
      )}
    </UiPila>
  );
}
