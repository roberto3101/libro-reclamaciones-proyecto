package dto

import "github.com/google/uuid"

// CrearSolicitudAsesorRequest datos para registrar una solicitud (desde bot o panel).
type CrearSolicitudAsesorRequest struct {
	Nombre              string  `json:"nombre" binding:"required"`
	Telefono            string  `json:"telefono" binding:"required"`
	Motivo              string  `json:"motivo" binding:"required"`
	CanalOrigen         string  `json:"canal_origen"`
	CanalWhatsAppID     *string `json:"canal_whatsapp_id"`
	Prioridad           string  `json:"prioridad"`
	ResumenConversacion string  `json:"resumen_conversacion"`
}

// AsignarSolicitudRequest asignación de un asesor a la solicitud.
type AsignarSolicitudRequest struct {
	AsignadoA uuid.UUID `json:"asignado_a" binding:"required"`
}

// ResolverSolicitudRequest cierre de la solicitud con nota interna.
type ResolverSolicitudRequest struct {
	NotaInterna string `json:"nota_interna"`
}

// ActualizarPrioridadRequest cambio de prioridad.
type ActualizarPrioridadRequest struct {
	Prioridad string `json:"prioridad" binding:"required,oneof=BAJA NORMAL ALTA URGENTE"`
}

// ActualizarNotaInternaRequest edición de la nota interna.
type ActualizarNotaInternaRequest struct {
	NotaInterna string `json:"nota_interna" binding:"required"`
}