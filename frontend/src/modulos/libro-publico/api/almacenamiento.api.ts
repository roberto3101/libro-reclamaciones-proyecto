import axios from 'axios';
import type { RespuestaAlmacenamiento } from '@/tipos';

// Deriva el host del backend desde VITE_API_URL para que el proxy /storage-api
// vaya al mismo backend Go, no al dominio estático del frontend.
const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
const storageBase = apiUrl.startsWith('http')
  ? apiUrl.replace(/\/api\/v1\/?$/, '') + '/storage-api'
  : '/storage-api';

const httpAlmacenamiento = axios.create({
  baseURL: storageBase,
  timeout: 60_000,
});

interface RespuestaListar {
  exito: boolean;
  datos?: {
    Archivos?: Array<{ Clave: string }>;
  };
}

export const almacenamientoApi = {
  subirArchivo: async (archivo: File, empresaId: string, ruta: string): Promise<string> => {
    const datosFormulario = new FormData();
    datosFormulario.append('archivo', archivo);
    datosFormulario.append('empresa_id', empresaId);
    datosFormulario.append('ruta', ruta);

    try {
      const respuesta = await httpAlmacenamiento.post<RespuestaAlmacenamiento>(
        '/almacenamiento/subir',
        datosFormulario,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      if (!respuesta.data.exito) {
        throw new Error(respuesta.data.mensaje || 'Error al subir archivo');
      }

      const clave = respuesta.data.datos?.Clave || respuesta.data.clave;
      if (!clave) {
        throw new Error('No se recibió la clave del archivo');
      }

      return clave;
    } catch (error: any) {
      // 409 = hash duplicado o nombre duplicado.
      if (error?.response?.status === 409) {
        const codigoError = error.response.data?.codigo_error;

        // Nombre duplicado: el mismo archivo ya existe con el mismo nombre -> reusar clave
        if (codigoError === 'ALMACENAMIENTO_ARCHIVO_DUPLICADO') {
          const nombreSanitizado = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          return `${ruta}/${nombreSanitizado}`;
        }

        // Hash duplicado: el contenido ya existe con otro nombre.
        // Buscar la clave del archivo existente en el bucket.
        const nombreSanitizado = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');

        try {
          const listaResp = await httpAlmacenamiento.get<RespuestaListar>(
            '/almacenamiento/listar',
            { params: { ruta, empresa_id: empresaId } },
          );

          const archivos = listaResp.data.datos?.Archivos || [];
          const existente = archivos.find(
            (a) => a.Clave.endsWith(`/${nombreSanitizado}`) || a.Clave.endsWith(`/${archivo.name}`),
          );
          if (existente) return existente.Clave;

          const parcial = archivos.find((a) => a.Clave.includes(nombreSanitizado));
          if (parcial) return parcial.Clave;
        } catch {
          // Si falla el listar, no propagamos ese error
        }

        // No encontramos el archivo por nombre — el contenido existe con otro nombre.
        throw new Error('Este archivo ya fue subido previamente con otro nombre');
      }

      throw error;
    }
  },

  eliminarArchivo: async (clave: string, empresaId: string): Promise<void> => {
    await httpAlmacenamiento.delete('/almacenamiento/eliminar', {
      params: { clave, empresa_id: empresaId },
    });
  },

  obtenerUrlFirmada: async (clave: string, empresaId: string): Promise<string> => {
    const respuesta = await httpAlmacenamiento.get<RespuestaAlmacenamiento>(
      '/almacenamiento/url-firmada',
      { params: { clave, empresa_id: empresaId } },
    );

    if (!respuesta.data.exito) {
      throw new Error(respuesta.data.mensaje || 'Error al obtener URL firmada');
    }

    const url = respuesta.data.datos?.Url || respuesta.data.url;
    if (!url) {
      throw new Error('No se recibió la URL firmada');
    }

    return url;
  },
};
