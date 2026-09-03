package service

import (
	"regexp"
	"strings"
)

// ──────────────────────────────────────────────────────────────────────────────
// Tipos de intención del mensaje del usuario
// ──────────────────────────────────────────────────────────────────────────────

type IntencionDelMensaje string

const (
	INTENCION_SALUDO                       IntencionDelMensaje = "SALUDO"
	INTENCION_CONSULTA_ESTADISTICAS        IntencionDelMensaje = "CONSULTA_ESTADISTICAS"
	INTENCION_CONSULTA_RECLAMO_ESPECIFICO  IntencionDelMensaje = "CONSULTA_RECLAMO_ESPECIFICO"
	INTENCION_CONSULTA_RECLAMOS_PENDIENTES IntencionDelMensaje = "CONSULTA_RECLAMOS_PENDIENTES"
	INTENCION_CONSULTA_RECLAMOS_URGENTES   IntencionDelMensaje = "CONSULTA_RECLAMOS_URGENTES"
	INTENCION_CONSULTA_RECLAMOS_POR_ESTADO IntencionDelMensaje = "CONSULTA_RECLAMOS_POR_ESTADO"
	INTENCION_ACCION_CAMBIAR_ESTADO        IntencionDelMensaje = "ACCION_CAMBIAR_ESTADO"
	INTENCION_ACCION_ENVIAR_MENSAJE        IntencionDelMensaje = "ACCION_ENVIAR_MENSAJE"
	INTENCION_ACCION_REASIGNAR_ASESOR      IntencionDelMensaje = "ACCION_REASIGNAR_ASESOR"
	INTENCION_SOLICITUD_EXPORTACION        IntencionDelMensaje = "SOLICITUD_EXPORTACION"
	INTENCION_CONSULTA_GENERAL             IntencionDelMensaje = "CONSULTA_GENERAL"
	INTENCION_MENSAJE_NO_RELEVANTE         IntencionDelMensaje = "MENSAJE_NO_RELEVANTE"
	INTENCION_INTENTO_INYECCION            IntencionDelMensaje = "INTENTO_INYECCION"
	INTENCION_REPETIR_ACCION               IntencionDelMensaje = "REPETIR_ACCION"
)

type ResultadoClasificacionDeIntencion struct {
	Intencion          IntencionDelMensaje
	CodigosReclamo     []string
	EstadoMencionado   string
	UsuarioPideTodos   bool
}

// ──────────────────────────────────────────────────────────────────────────────
// Patrones regex compilados para clasificación
// ──────────────────────────────────────────────────────────────────────────────

var (
	regexCodigoReclamo       = regexp.MustCompile(`(?i)(RCL-\d{4}-\d{4,6})`)
	regexAccionCambiarEstado = regexp.MustCompile(`(?i)(cambia|cambiar|pasar|pasa|marcar?|mover|mueve|actualizar|actualiza).{0,25}(estado|como\s+(pendiente|en.proceso|resuelto|rechazado|cerrado)|a\s+(pendiente|en.proceso|resuelto|rechazado|cerrado))`)
	regexAccionEnviarMensaje    = regexp.MustCompile(`(?i)(envia|enviar|envía|envíar|responde|responder|notifica|notificar|comunica|comunicar).{0,20}(mensaje|respuesta|notificacion|notificación|al\s+cliente|al\s+consumidor)`)
	regexAccionReasignarAsesor = regexp.MustCompile(`(?i)(asigna|asignar|reasigna|reasignar|delega|delegar|cambia\w*\s+(el\s+)?asesor|pon(le|er)?\s+como\s+responsable).{0,30}(asesor|encargado|responsable|atiende)?`)
	regexUrgentes            = regexp.MustCompile(`(?i)(urgente|por\s+vencer|vencido|vencidos|critico|crítico|fecha\s*l[ií]mite|pr[oó]ximos?\s+a\s+vencer|a\s+punto\s+de\s+vencer|plazo\s+(pr[oó]ximo|venc|l[ií]mite))`)
	regexPendientes          = regexp.MustCompile(`(?i)(pendiente|pendientes|sin\s+atender|por\s+atender|sin\s+resolver|nuevos?\s+reclamo)`)
	regexEstadoEspecifico    = regexp.MustCompile(`(?i)\b(resueltos?|rechazados?|cerrados?|en[\s_]proceso)\b`)
	regexEstadisticas        = regexp.MustCompile(`(?i)(estad[ií]stica|resumen|cu[aá]ntos|totale?s?\b|reporte|dashboard|n[uú]meros|panorama|m[eé]tricas?)`)
	regexContinuacion        = regexp.MustCompile(`(?i)^(m[aá]s|sigue|continua|contin[uú]a|siguiente|siguientes|muestra\s+m[aá]s|ver\s+m[aá]s|dame\s+m[aá]s|listame\s+m[aá]s|los\s+dem[aá]s)\s*[!.,;?\s]*$`)
	regexRepetirAccion       = regexp.MustCompile(`(?i)^(hazlo\s+(de\s+nuevo|otra\s+vez)|rep[ií]te(lo)?|otra\s+vez|de\s+nuevo|lo\s+mismo|igual|vu[eé]lve(lo)?\s+a\s+hacer|haz(lo)?\s+otra\s+vez|haz\s+lo\s+mismo|nuevamente)\s*[!.,;?\s]*$`)
	regexPideTodos           = regexp.MustCompile(`(?i)(todos|todas|completo|completa|listame\s+los\s+\d+|mu[eé]strame\s+los\s+\d+|dame\s+los\s+\d+|los\s+\d+\s+reclamos|todo\s+el\s+listado)`)
	regexExportacion         = regexp.MustCompile(`(?i)(genera|generar|crear?|exporta|exportar|descargar?|descarga|baja|bajar|dame\s+un|hazme\s+un|quiero\s+un|p[aá]sa(lo|me)?\s+a|en\s+un)\s*.{0,15}(pdf|excel|xlsx|csv|reporte|documento|archivo|informe)|(?i)\ben\s+(pdf|excel)\b`)
	regexSaludoYDespedida    = regexp.MustCompile(`(?i)^(hola|buenos?\s*(d[ií]as|tardes|noches)|hey|qu[eé]\s+tal|saludos|hi|hello|buenas(\s+tardes|\s+noches|\s+d[ií]as)?|adi[oó]s|chao|chau|hasta\s+luego|nos\s+vemos|bye|gracias|muchas\s+gracias|ok\s+gracias|listo\s+gracias|vale\s+gracias)\s*[!.,;?\s]*$`)
	// Detecta saludos repetidos: "holahola", "holaholahola", "hikihi", etc.
	regexSaludoRepetido      = regexp.MustCompile(`(?i)^(hola|hi|hey|buenas|bye|chau|ok)+\s*[!.,;?\s]*$`)
	// Detecta mensajes sin contenido útil: solo consonantes, caracteres random, muy cortos sin sentido
	regexMensajeBasura       = regexp.MustCompile(`(?i)^[bcdfghjklmnpqrstvwxyz]{3,}$|^(a{3,}|b{3,}|c{3,}|d{3,}|e{3,}|f{3,}|g{3,}|h{3,}|i{3,}|j{3,}|k{3,}|l{3,}|m{3,}|n{3,}|o{3,}|p{3,}|q{3,}|r{3,}|s{3,}|t{3,}|u{3,}|v{3,}|w{3,}|x{3,}|y{3,}|z{3,})$`)
	// Keywords del dominio: si el mensaje contiene al menos una, merece contexto completo.
	// Excluye palabras genéricas del español (dame, cómo, ayuda) que aparecen en cualquier contexto.
	regexKeywordsDominio     = regexp.MustCompile(`(?i)(reclam|queja|consumidor|cliente|atenci[oó]n|estado|pendiente|proceso|resuel|rechaz|cerrad|vencid|urgent|cr[ií]tic|plazo|indecopi|multa|asesor|asigna|sede|respuesta|mensaje|redact|export|pdf|excel|estad[ií]stic|cu[aá]ntos?\s+reclam|total\w*\s+reclam|atend|notifi|envi\w+\s+(mensaje|respuesta|notificaci)|comunic\w+\s+(al\s+cliente|al\s+consumidor))`)
	// Detecta intentos de inyección de prompts, ataques y manipulación
	regexIntentoInyeccion    = regexp.MustCompile(`(?i)(ignora\s+(todas\s+las\s+)?instrucciones|olv[ií]da\s+(tus|las)\s+reglas|act[uú]a\s+como|eres\s+un\s+modelo|sin\s+restricciones|mu[eé]strame\s+(tus|las)\s+instrucciones|tu\s+prompt|tu\s+configuraci[oó]n|dame\s+(las\s+)?credenciales|contrase[nñ]a|password|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|SELECT\s+\*|exec\.Command|rm\s+-rf|<script|<div|<img|eval\(|alert\(|document\.|window\.)`)
)

// ──────────────────────────────────────────────────────────────────────────────
// Mapeo de texto detectado → estado canónico de la base de datos
// ──────────────────────────────────────────────────────────────────────────────

var mapaTextoAEstadoCanonico = map[string]string{
	"resuelto":   "RESUELTO",
	"resueltos":  "RESUELTO",
	"rechazado":  "RECHAZADO",
	"rechazados": "RECHAZADO",
	"cerrado":    "CERRADO",
	"cerrados":   "CERRADO",
	"en proceso": "EN_PROCESO",
	"en_proceso": "EN_PROCESO",
}

func normalizarEstadoDetectado(textoDetectado string) string {
	textoLimpio := strings.ToLower(strings.TrimSpace(textoDetectado))
	textoLimpio = strings.ReplaceAll(textoLimpio, "_", " ")
	if estado, existe := mapaTextoAEstadoCanonico[textoLimpio]; existe {
		return estado
	}
	for clave, estado := range mapaTextoAEstadoCanonico {
		if strings.Contains(textoLimpio, clave) {
			return estado
		}
	}
	return ""
}

// ──────────────────────────────────────────────────────────────────────────────
// ClasificarIntencionDelMensaje — analiza el texto del usuario y determina
// qué tipo de consulta o acción quiere realizar, sin usar IA.
// ──────────────────────────────────────────────────────────────────────────────

func ClasificarIntencionDelMensaje(mensajeUsuario string) ResultadoClasificacionDeIntencion {
	mensaje := strings.TrimSpace(mensajeUsuario)
	mensajeMinusculas := strings.ToLower(mensaje)

	resultado := ResultadoClasificacionDeIntencion{
		Intencion: INTENCION_CONSULTA_GENERAL,
	}

	// ── Paso 1: Extraer códigos de reclamo presentes en el mensaje ──
	coincidenciasCodigos := regexCodigoReclamo.FindAllStringSubmatch(mensaje, -1)
	for _, coincidencia := range coincidenciasCodigos {
		codigoNormalizado := strings.ToUpper(coincidencia[1])
		if !contieneTexto(resultado.CodigosReclamo, codigoNormalizado) {
			resultado.CodigosReclamo = append(resultado.CodigosReclamo, codigoNormalizado)
		}
	}

	// ── Detectar si el usuario quiere ver todos los resultados ──
	resultado.UsuarioPideTodos = regexPideTodos.MatchString(mensajeMinusculas)

	tieneCodigos := len(resultado.CodigosReclamo) > 0

	// ── Paso 1b: Detectar intentos de inyección/ataque (PRIORIDAD MÁXIMA) ──
	// Se evalúa antes que cualquier otra intención para no cargar contexto innecesario.
	if regexIntentoInyeccion.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_INTENTO_INYECCION
		return resultado
	}

	// ── Paso 2: Si hay código + keywords de cambiar estado ──
	if tieneCodigos && regexAccionCambiarEstado.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_ACCION_CAMBIAR_ESTADO
		resultado.EstadoMencionado = extraerEstadoMencionado(mensajeMinusculas)
		return resultado
	}

	// ── Paso 3: Si hay código + keywords de enviar mensaje ──
	if tieneCodigos && regexAccionEnviarMensaje.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_ACCION_ENVIAR_MENSAJE
		return resultado
	}

	// ── Paso 3b: Si hay código + keywords de reasignar asesor ──
	if tieneCodigos && regexAccionReasignarAsesor.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_ACCION_REASIGNAR_ASESOR
		return resultado
	}

	// ── Paso 4: Si hay código sin acción → consulta del reclamo específico ──
	if tieneCodigos {
		resultado.Intencion = INTENCION_CONSULTA_RECLAMO_ESPECIFICO
		return resultado
	}

	// ── Paso 5: Solicitud de exportación (PDF, Excel, CSV) ──
	if regexExportacion.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_SOLICITUD_EXPORTACION
		return resultado
	}

	// ── Paso 6: Keywords de urgentes/vencidos ──
	if regexUrgentes.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_CONSULTA_RECLAMOS_URGENTES
		return resultado
	}

	// ── Paso 6: Keywords de pendientes ──
	if regexPendientes.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_CONSULTA_RECLAMOS_PENDIENTES
		return resultado
	}

	// ── Paso 7: Mención de estado específico (resuelto, cerrado, etc.) ──
	if coincidenciaEstado := regexEstadoEspecifico.FindString(mensajeMinusculas); coincidenciaEstado != "" {
		estadoCanon := normalizarEstadoDetectado(coincidenciaEstado)
		if estadoCanon != "" {
			resultado.Intencion = INTENCION_CONSULTA_RECLAMOS_POR_ESTADO
			resultado.EstadoMencionado = estadoCanon
			return resultado
		}
	}

	// ── Paso 8: Keywords de estadísticas/resumen ──
	if regexEstadisticas.MatchString(mensajeMinusculas) {
		resultado.Intencion = INTENCION_CONSULTA_ESTADISTICAS
		return resultado
	}

	// ── Paso 9a: Repetir acción ("hazlo de nuevo", "repite", "otra vez") ──
	if regexRepetirAccion.MatchString(mensaje) {
		resultado.Intencion = INTENCION_REPETIR_ACCION
		return resultado
	}

	// ── Paso 9: Continuación ("más", "sigue", "todos") ──
	if regexContinuacion.MatchString(mensaje) {
		resultado.Intencion = INTENCION_CONSULTA_GENERAL
		return resultado
	}

	// ── Paso 10: Saludo simple (mensaje corto) ──
	if len(mensaje) < 40 && regexSaludoYDespedida.MatchString(mensaje) {
		resultado.Intencion = INTENCION_SALUDO
		return resultado
	}

	// ── Paso 10b: Saludo repetido ("holahola", "hihihi") ──
	if len(mensaje) < 50 && regexSaludoRepetido.MatchString(mensaje) {
		resultado.Intencion = INTENCION_SALUDO
		return resultado
	}

	// ── Paso 10c: Mensaje basura/sin sentido ("ascdccsdc", "xxx", "aaa") ──
	if esMensajeBasura(mensaje) {
		resultado.Intencion = INTENCION_MENSAJE_NO_RELEVANTE
		return resultado
	}

	// ── Paso 11: Si no tiene keywords del dominio → mensaje fuera de tema ──
	// Evita cargar TODO el contexto del tenant para preguntas irrelevantes
	// como "que son las estrellas" o "cuéntame un chiste".
	if !tieneKeywordsDeDominio(mensajeMinusculas) {
		resultado.Intencion = INTENCION_MENSAJE_NO_RELEVANTE
		return resultado
	}

	// ── Paso 12: Fallback → consulta general (con keywords del dominio) ──
	return resultado
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────────────────

func extraerEstadoMencionado(mensajeMinusculas string) string {
	patrones := []struct {
		regex  *regexp.Regexp
		estado string
	}{
		{regexp.MustCompile(`(?i)\b(pendiente)\b`), "PENDIENTE"},
		{regexp.MustCompile(`(?i)\b(en[\s_]proceso)\b`), "EN_PROCESO"},
		{regexp.MustCompile(`(?i)\b(resuelto)\b`), "RESUELTO"},
		{regexp.MustCompile(`(?i)\b(rechazado)\b`), "RECHAZADO"},
		{regexp.MustCompile(`(?i)\b(cerrado)\b`), "CERRADO"},
	}
	for _, p := range patrones {
		if p.regex.MatchString(mensajeMinusculas) {
			return p.estado
		}
	}
	return ""
}

// tieneKeywordsDeDominio verifica si el mensaje contiene al menos una palabra
// relacionada con el Libro de Reclamaciones. Si no tiene ninguna, no vale la
// pena cargar todo el contexto del tenant.
func tieneKeywordsDeDominio(mensajeMinusculas string) bool {
	return regexKeywordsDominio.MatchString(mensajeMinusculas)
}

// esMensajeBasura detecta mensajes sin sentido: solo consonantes,
// caracteres repetidos, o cadenas cortas aleatorias sin palabras reales.
func esMensajeBasura(mensaje string) bool {
	limpio := strings.TrimSpace(mensaje)
	if len(limpio) == 0 || len(limpio) > 30 {
		return false
	}
	min := strings.ToLower(limpio)
	// Si coincide con el regex de basura directa (puras consonantes, o letras repetidas)
	if regexMensajeBasura.MatchString(min) {
		return true
	}
	// Si es una sola "palabra" corta sin espacios y sin dígitos, verificar que no sea
	// una palabra real de al menos 4 letras (indica consulta legítima)
	if !strings.Contains(min, " ") && len(min) <= 20 {
		// Palabras cortas que podrían parecer basura pero son reales
		palabrasValidas := []string{
			"ayuda", "help", "estado", "lista", "ver", "dame", "quiero",
			"como", "cual", "urgente", "nuevo", "excel", "reclamo",
		}
		for _, p := range palabrasValidas {
			if strings.Contains(min, p) {
				return false
			}
		}
		// Contar vocales: si < 20% de la longitud, probablemente es basura
		vocales := 0
		for _, c := range min {
			if strings.ContainsRune("aeiouáéíóúü", c) {
				vocales++
			}
		}
		if len(min) >= 4 && float64(vocales)/float64(len(min)) < 0.2 {
			return true
		}
	}
	return false
}

func contieneTexto(lista []string, texto string) bool {
	for _, item := range lista {
		if item == texto {
			return true
		}
	}
	return false
}
