package dto

// ActualizarPlantillaEmailRequest DTO para actualizar una plantilla de email.
type ActualizarPlantillaEmailRequest struct {
	Asunto          string `json:"asunto" binding:"required,min=5,max=200"`
	Saludo          string `json:"saludo" binding:"max=300"`
	CuerpoPrincipal string `json:"cuerpo_principal" binding:"required,min=5,max=2000"`
	TextoPie        string `json:"texto_pie" binding:"max=500"`
	TextoBoton      string `json:"texto_boton" binding:"max=100"`
	Activa          *bool  `json:"activa"`
}
