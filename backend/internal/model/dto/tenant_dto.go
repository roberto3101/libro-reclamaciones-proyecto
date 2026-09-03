package dto

// TenantPublicResponse datos públicos del tenant para el formulario
type TenantPublicResponse struct {
	RazonSocial     string `json:"razon_social"`
	RUC             string `json:"ruc"`
	NombreComercial string `json:"nombre_comercial,omitempty"`
	DireccionLegal  string `json:"direccion_legal,omitempty"`
	LogoURL         string `json:"logo_url,omitempty"`
	ColorPrimario   string `json:"color_primario"`
	Slug            string `json:"slug"`
}