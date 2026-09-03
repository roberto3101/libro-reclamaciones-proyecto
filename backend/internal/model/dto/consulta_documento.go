package dto

// ConsultaDocumentoResponse contiene los datos públicos de una persona o empresa
// obtenidos del servicio PSE Perú, listos para devolver al frontend.
type ConsultaDocumentoResponse struct {
	NumeroDocumento string `json:"numero_documento"`
	Nombres         string `json:"nombres"`
	Apellidos       string `json:"apellidos"`
	NombreRazon     string `json:"nombre_razon"`
	Direccion       string `json:"direccion"`
}
