package model

import (
	"time"
)

// ── Tipos de evento para plantillas de email ──

const (
	EventoConfirmacionReclamo   = "confirmacion_reclamo"
	EventoNuevoReclamoEmpresa   = "nuevo_reclamo_empresa"
	EventoResolucion            = "resolucion"
	EventoCambioEstado          = "cambio_estado"
	EventoNuevoMensaje          = "nuevo_mensaje"
)

// PlantillaEmail representa una plantilla de email editable por tenant.
type PlantillaEmail struct {
	TenantModel

	TipoEvento          string         `json:"tipo_evento" db:"tipo_evento"`
	NombreVisual        string         `json:"nombre_visual" db:"nombre_visual"`
	Asunto              string         `json:"asunto" db:"asunto"`
	Saludo              string         `json:"saludo" db:"saludo"`
	CuerpoPrincipal     string         `json:"cuerpo_principal" db:"cuerpo_principal"`
	TextoPie            string         `json:"texto_pie" db:"texto_pie"`
	TextoBoton          string         `json:"texto_boton" db:"texto_boton"`
	VariablesPermitidas []string `json:"variables_permitidas" db:"variables_permitidas"`
	Activa              bool           `json:"activa" db:"activa"`

	FechaCreacion      time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion" db:"fecha_actualizacion"`
}

// DefinicionPlantillasEmail retorna las plantillas por defecto con sus variables.
func DefinicionPlantillasEmail() []PlantillaEmail {
	return []PlantillaEmail{
		{
			TipoEvento:          EventoConfirmacionReclamo,
			NombreVisual:        "Confirmación al Cliente",
			Asunto:              "Confirmacion de Registro - {{codigo_reclamo}}",
			Saludo:              "Hola, {{nombre_cliente}}",
			CuerpoPrincipal:     "Hemos recibido su solicitud correctamente. A continuacion los datos de referencia:",
			TextoPie:            "Este correo fue enviado por {{razon_social}}. Si no reconoce esta solicitud, puede ignorar este mensaje.",
			TextoBoton:          "",
			VariablesPermitidas: []string{"nombre_cliente", "codigo_reclamo", "fecha", "razon_social"},
			Activa:              true,
		},
		{
			TipoEvento:          EventoNuevoReclamoEmpresa,
			NombreVisual:        "Alerta a la Empresa",
			Asunto:              "Nuevo {{tipo_solicitud}} recibido - {{codigo_reclamo}}",
			Saludo:              "Nuevo caso registrado",
			CuerpoPrincipal:     "Se ha registrado una nueva solicitud en su libro de reclamaciones que requiere atencion.",
			TextoPie:            "Notificacion interna del sistema de Libro de Reclamaciones.",
			TextoBoton:          "",
			VariablesPermitidas: []string{"codigo_reclamo", "nombre_cliente", "tipo_solicitud", "fecha", "razon_social"},
			Activa:              true,
		},
		{
			TipoEvento:          EventoResolucion,
			NombreVisual:        "Resolución al Cliente",
			Asunto:              "Resolucion de su caso - {{codigo_reclamo}}",
			Saludo:              "Estimado(a) {{nombre_cliente}},",
			CuerpoPrincipal:     "Le informamos que su caso con codigo {{codigo_reclamo}} ha sido atendido.",
			TextoPie:            "Resolucion emitida por {{razon_social}} conforme a la Ley N 29571.",
			TextoBoton:          "",
			VariablesPermitidas: []string{"nombre_cliente", "codigo_reclamo", "respuesta_preview", "razon_social"},
			Activa:              true,
		},
		{
			TipoEvento:          EventoCambioEstado,
			NombreVisual:        "Cambio de Estado",
			Asunto:              "Actualizacion de su caso - {{codigo_reclamo}}",
			Saludo:              "Hola {{nombre_cliente}},",
			CuerpoPrincipal:     "El estado de su caso {{codigo_reclamo}} ha sido actualizado:",
			TextoPie:            "Notificacion enviada por {{razon_social}}.",
			TextoBoton:          "",
			VariablesPermitidas: []string{"nombre_cliente", "codigo_reclamo", "nuevo_estado", "razon_social"},
			Activa:              true,
		},
		{
			TipoEvento:          EventoNuevoMensaje,
			NombreVisual:        "Nuevo Mensaje",
			Asunto:              "Nuevo mensaje sobre su caso {{codigo_reclamo}}",
			Saludo:              "Hola {{nombre_cliente}},",
			CuerpoPrincipal:     "Ha recibido un nuevo mensaje respecto a su caso {{codigo_reclamo}}:",
			TextoPie:            "Mensaje enviado desde el portal de {{razon_social}}.",
			TextoBoton:          "Responder Mensaje",
			VariablesPermitidas: []string{"nombre_cliente", "codigo_reclamo", "mensaje_preview", "razon_social", "slug_tenant"},
			Activa:              true,
		},
	}
}

// EtiquetasTiposEvento retorna nombres legibles para la UI.
func EtiquetasTiposEvento() map[string]string {
	return map[string]string{
		EventoConfirmacionReclamo: "Confirmación al Cliente",
		EventoNuevoReclamoEmpresa: "Alerta a la Empresa",
		EventoResolucion:          "Resolución al Cliente",
		EventoCambioEstado:        "Cambio de Estado",
		EventoNuevoMensaje:        "Nuevo Mensaje",
	}
}

// TiposEventoValidos retorna los tipos de evento válidos.
func TiposEventoValidos() []string {
	return []string{
		EventoConfirmacionReclamo,
		EventoNuevoReclamoEmpresa,
		EventoResolucion,
		EventoCambioEstado,
		EventoNuevoMensaje,
	}
}
