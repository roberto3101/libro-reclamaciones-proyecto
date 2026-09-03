// Respuesta del endpoint /libro/:slug/consulta-documento/:numero
// Contiene los datos públicos de una persona o empresa obtenidos via PSE Perú.
export interface ConsultaDocumentoResponse {
  numero_documento: string;
  nombres: string;
  apellidos: string;
  nombre_razon: string;
  direccion: string;
}
