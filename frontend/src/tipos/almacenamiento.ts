export type EstadoArchivoAdjunto = 'pendiente' | 'subiendo' | 'completado' | 'error';

export interface RespuestaAlmacenamiento {
  exito: boolean;
  mensaje?: string;
  clave?: string;
  url?: string;
  // Respuesta directa del microservicio R2
  datos?: {
    Clave?: string;
    Url?: string;
    NombreOriginal?: string;
    NombreSeguro?: string;
    MimeType?: string;
    TamanoBytes?: number;
  };
}

export interface ArchivoAdjunto {
  archivo: File;
  clave?: string;
  urlVistaPrevia?: string;
  estado: EstadoArchivoAdjunto;
  mensajeError?: string;
}

export const TAMANIO_MAXIMO_ARCHIVO_MB = 10;
export const TAMANIO_MAXIMO_ARCHIVO_BYTES = TAMANIO_MAXIMO_ARCHIVO_MB * 1024 * 1024;

export const TIPOS_MIME_PERMITIDOS: string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/x-icon',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'text/plain',
  'text/csv',
  'application/xml',
  'text/xml',
];

export const EXTENSIONES_PROHIBIDAS = [
  'php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'phps',
  'cgi', 'pl', 'asp', 'aspx', 'jsp',
  'sh', 'bat', 'cmd', 'exe', 'com', 'dll', 'msi',
  'htaccess', 'htpasswd',
];

export const EXTENSIONES_ACEPTADAS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z',
  '.txt', '.csv', '.xml',
].join(',');
