package model

import (
	"encoding/json"
	"time"
)

// ── Módulos del sistema (filas de la matriz de permisos) ──

const (
	ModuloDashboard         = "dashboard"
	ModuloReclamos          = "reclamos"
	ModuloUsuarios          = "usuarios"
	ModuloSedes             = "sedes"
	ModuloConfiguracion     = "configuracion"
	ModuloChatbots          = "chatbots"
	ModuloCanalesWhatsApp   = "canales_whatsapp"
	ModuloAtencionVivo      = "atencion_vivo"
	ModuloAsistente         = "asistente"
	ModuloRoles             = "roles"
	ModuloPlantillasEmail   = "plantillas_email"
)

// ── Acciones por módulo (columnas de la matriz de permisos) ──

const (
	AccionVer           = "ver"
	AccionCrear         = "crear"
	AccionEditar        = "editar"
	AccionEliminar      = "eliminar"
	AccionExportar      = "exportar"
	AccionCambiarEstado = "cambiar_estado"
	AccionAsignar       = "asignar"
)

// RolTenant rol personalizable por tenant con permisos JSONB.
type RolTenant struct {
	TenantModel

	Slug        string          `json:"slug" db:"slug"`
	Nombre      string          `json:"nombre" db:"nombre"`
	Descripcion string          `json:"descripcion" db:"descripcion"`
	Color       string          `json:"color" db:"color"`
	Permisos    json.RawMessage `json:"permisos" db:"permisos"`
	EsAdmin     bool            `json:"es_admin" db:"es_admin"`
	EsBase      bool            `json:"es_base" db:"es_base"`
	Orden       int             `json:"orden" db:"orden"`

	FechaCreacion      time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion" db:"fecha_actualizacion"`

	// Campo virtual (no en DB): cantidad de usuarios con este rol
	CantidadUsuarios int `json:"cantidad_usuarios,omitempty" db:"-"`
}

// DefinicionModulosPermisos retorna el mapa completo módulo→acciones.
// El frontend lo usa para construir la matriz visual de checkboxes.
func DefinicionModulosPermisos() map[string][]string {
	return map[string][]string{
		ModuloDashboard:       {AccionVer},
		ModuloReclamos:        {AccionVer, AccionCrear, AccionEditar, AccionEliminar, AccionExportar, AccionCambiarEstado, AccionAsignar},
		ModuloUsuarios:        {AccionVer, AccionCrear, AccionEditar, AccionEliminar},
		ModuloSedes:           {AccionVer, AccionCrear, AccionEditar, AccionEliminar},
		ModuloConfiguracion:   {AccionVer, AccionEditar},
		ModuloChatbots:        {AccionVer, AccionCrear, AccionEditar, AccionEliminar},
		ModuloCanalesWhatsApp: {AccionVer, AccionCrear, AccionEditar, AccionEliminar},
		ModuloAtencionVivo:    {AccionVer, AccionAsignar, AccionCambiarEstado},
		ModuloAsistente:       {AccionVer},
		ModuloRoles:           {AccionVer, AccionCrear, AccionEditar, AccionEliminar},
		ModuloPlantillasEmail: {AccionVer, AccionEditar},
	}
}

// EtiquetasModulos nombres legibles para la UI.
func EtiquetasModulos() map[string]string {
	return map[string]string{
		ModuloDashboard:       "Dashboard",
		ModuloReclamos:        "Reclamos",
		ModuloUsuarios:        "Usuarios",
		ModuloSedes:           "Sedes",
		ModuloConfiguracion:   "Configuración",
		ModuloChatbots:        "Chatbots",
		ModuloCanalesWhatsApp: "Canales WhatsApp",
		ModuloAtencionVivo:    "Atención en Vivo",
		ModuloAsistente:       "Asistente IA",
		ModuloRoles:           "Roles",
		ModuloPlantillasEmail: "Plantillas Email",
	}
}

// EtiquetasAcciones nombres legibles para la UI.
func EtiquetasAcciones() map[string]string {
	return map[string]string{
		AccionVer:           "Ver",
		AccionCrear:         "Crear",
		AccionEditar:        "Editar",
		AccionEliminar:      "Eliminar",
		AccionExportar:      "Exportar",
		AccionCambiarEstado: "Cambiar Estado",
		AccionAsignar:       "Asignar",
	}
}

// PermisosCompletoAdmin genera JSONB con TODAS las acciones en true.
func PermisosCompletoAdmin() json.RawMessage {
	definicion := DefinicionModulosPermisos()
	resultado := make(map[string]map[string]bool)
	for modulo, acciones := range definicion {
		accionesMap := make(map[string]bool)
		for _, accion := range acciones {
			accionesMap[accion] = true
		}
		resultado[modulo] = accionesMap
	}
	bytes, _ := json.Marshal(resultado)
	return bytes
}

// PermisosSoporte genera JSONB con permisos limitados para soporte.
func PermisosSoporte() json.RawMessage {
	resultado := map[string]map[string]bool{
		ModuloDashboard: {
			AccionVer: true,
		},
		ModuloReclamos: {
			AccionVer:           true,
			AccionEditar:        true,
			AccionCambiarEstado: true,
			AccionExportar:      true,
		},
		ModuloAtencionVivo: {
			AccionVer:           true,
			AccionAsignar:       true,
			AccionCambiarEstado: true,
		},
		ModuloSedes: {
			AccionVer: true,
		},
	}
	bytes, _ := json.Marshal(resultado)
	return bytes
}
