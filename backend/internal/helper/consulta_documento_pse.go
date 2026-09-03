package helper

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const urlServicioPSEConsultaDocumento = "https://pseperu.pe/Servicios/consultaDocumento/"

// RespuestaPSE contiene los datos de una persona o empresa
// devueltos por el servicio externo de PSE Perú.
type RespuestaPSE struct {
	RucDni      string `json:"rucdni"`
	Nombres     string `json:"nombres"`
	Apellidos   string `json:"apellidos"`
	NombreRazon string `json:"nombrerazon"`
	Direccion   string `json:"direccion"`
	Ubigeo      string `json:"ubigeo"`
	Activo      int    `json:"activo"`
	EstadoSunat int    `json:"estadosunat"`
}

// respuestaExternaPSE es la estructura completa que devuelve el endpoint
// de PSE Perú: { "success": true, "data": { ... } }
type respuestaExternaPSE struct {
	Success bool         `json:"success"`
	Data    RespuestaPSE `json:"data"`
}

// ConsultarDocumentoEnPSE consulta el servicio externo de PSE Perú
// para obtener datos de una persona o empresa a partir de su número de documento.
// Retorna nil si el servicio responde con success=false o si el documento no existe.
func ConsultarDocumentoEnPSE(numeroDocumento string) (*RespuestaPSE, error) {
	if numeroDocumento == "" {
		return nil, fmt.Errorf("el número de documento es obligatorio")
	}

	clienteHTTP := &http.Client{Timeout: 8 * time.Second}

	respuestaHTTP, err := clienteHTTP.Get(urlServicioPSEConsultaDocumento + numeroDocumento)
	if err != nil {
		return nil, fmt.Errorf("error contactando servicio PSE Perú: %w", err)
	}
	defer respuestaHTTP.Body.Close()

	if respuestaHTTP.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("servicio PSE Perú respondió con estado %d", respuestaHTTP.StatusCode)
	}

	var respuesta respuestaExternaPSE
	if err := json.NewDecoder(respuestaHTTP.Body).Decode(&respuesta); err != nil {
		return nil, fmt.Errorf("error decodificando respuesta de PSE Perú: %w", err)
	}

	if !respuesta.Success {
		return nil, nil
	}

	return &respuesta.Data, nil
}
