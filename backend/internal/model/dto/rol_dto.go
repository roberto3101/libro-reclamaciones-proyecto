package dto

import "encoding/json"

// CrearRolRequest payload para crear un rol.
type CrearRolRequest struct {
	Nombre      string          `json:"nombre" binding:"required,min=2,max=50"`
	Descripcion string          `json:"descripcion" binding:"max=200"`
	Color       string          `json:"color" binding:"max=20"`
	Permisos    json.RawMessage `json:"permisos" binding:"required"`
	EsAdmin     bool            `json:"es_admin"`
}

// ActualizarRolRequest payload para editar un rol.
type ActualizarRolRequest struct {
	Nombre      string          `json:"nombre" binding:"required,min=2,max=50"`
	Descripcion string          `json:"descripcion" binding:"max=200"`
	Color       string          `json:"color" binding:"max=20"`
	Permisos    json.RawMessage `json:"permisos" binding:"required"`
	EsAdmin     bool            `json:"es_admin"`
}
