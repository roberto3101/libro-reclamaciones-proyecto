import ubigeos from './ubigeos.json';

interface Ubigeo {
  departamento: string;
  provincia: string;
  distrito: string;
}

const mapa = ubigeos as Record<string, { d: string; p: string; di: string }>;

/**
 * Resuelve un código ubigeo INEI de 6 dígitos a departamento, provincia y distrito.
 * Retorna null si el código no existe.
 */
export function resolverUbigeo(codigo: string): Ubigeo | null {
  const entry = mapa[codigo];
  if (!entry) return null;
  return {
    departamento: entry.d,
    provincia: entry.p,
    distrito: entry.di,
  };
}
