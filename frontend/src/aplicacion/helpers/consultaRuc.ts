/**
 * Helper para consultar datos de una empresa peruana por RUC contra
 * el servicio público de PSE Peru (https://pseperu.pe).
 *
 * Se usa desde varios lugares:
 *   - Libro público (configuración del tenant) → PaginaConfigTenant
 *   - Panel SuperAdmin → modal "Nueva Cuenta" (SACuentas)
 *   - Panel SuperAdmin → modal "Crear Empresa" (SADetalleCuenta)
 *
 * El servicio acepta CORS abierto desde cualquier origen, así que se
 * consume directamente desde el navegador.
 */

export interface DatosRucPSE {
  /** Razón social o nombre completo según SUNAT */
  nombrerazon: string;
  /** Dirección fiscal registrada en SUNAT */
  direccion: string;
  /** Ubigeo INEI de 6 dígitos (departamento + provincia + distrito) */
  ubigeo: string;
}

/**
 * Consulta un RUC en PSE Peru y retorna los datos de la empresa.
 * Retorna null si el RUC no es válido, no existe, o si el servicio falla.
 *
 * @param ruc RUC de 11 dígitos (personas jurídicas empiezan con 20)
 */
export async function consultarRucPSE(ruc: string): Promise<DatosRucPSE | null> {
  if (!ruc || ruc.length !== 11) return null;
  try {
    const resp = await fetch(`https://pseperu.pe/Servicios/consultaDocumento/${ruc}`);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.success) return null;
    return json.data as DatosRucPSE;
  } catch {
    return null;
  }
}
