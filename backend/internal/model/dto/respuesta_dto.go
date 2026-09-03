package dto

type CreateRespuestaRequest struct {
	RespuestaEmpresa     string `json:"respuesta_empresa" binding:"required"`
	AccionTomada         string `json:"accion_tomada"`
	CompensacionOfrecida string `json:"compensacion_ofrecida"`
	CargoResponsable     string `json:"cargo_responsable"`
}