package dto

// APIResponse respuesta estándar de la API.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

// APIError detalle del error.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
