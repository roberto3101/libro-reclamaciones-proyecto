package service

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"regexp"
	"strings"
	"time"

	"libro-reclamaciones/internal/ai"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────────────────────────────────────
// AssistantService — Lógica de negocio del asistente IA interno.
// ──────────────────────────────────────────────────────────────────────────────

type AssistantService struct {
	aiProvider     ai.Provider
	providerMap    map[string]ai.Provider
	assistantRepo  *repo.AssistantRepo
	historialRepo  *repo.AsistenteHistorialRepo
	tenantRepo     *repo.TenantRepo
	reclamoService *ReclamoService
	mensajeRepo    *repo.MensajeRepo
	usuarioRepo    *repo.UsuarioRepo
}

func NewAssistantService(
	aiProvider ai.Provider,
	providerMap map[string]ai.Provider,
	assistantRepo *repo.AssistantRepo,
	historialRepo *repo.AsistenteHistorialRepo,
	tenantRepo *repo.TenantRepo,
) *AssistantService {
	return &AssistantService{
		aiProvider:    aiProvider,
		providerMap:   providerMap,
		assistantRepo: assistantRepo,
		historialRepo: historialRepo,
		tenantRepo:    tenantRepo,
	}
}

// SetReclamoService inyecta el servicio de reclamos (evita dependencia circular).
func (s *AssistantService) SetReclamoService(rs *ReclamoService) { s.reclamoService = rs }

// SetMensajeRepo inyecta el repo de mensajes.
func (s *AssistantService) SetMensajeRepo(mr *repo.MensajeRepo) { s.mensajeRepo = mr }

// SetUsuarioRepo inyecta el repo de usuarios (evita dependencia circular).
func (s *AssistantService) SetUsuarioRepo(ur *repo.UsuarioRepo) { s.usuarioRepo = ur }

// resolverProvider elige el provider según la selección del usuario.
// Si providerID coincide con uno específico, lo usa directamente (sin fallback).
// Si no, usa el provider combinado (primary + fallback automático).
func (s *AssistantService) resolverProvider(providerID string) ai.Provider {
	if providerID != "" && s.providerMap != nil {
		if p, ok := s.providerMap[providerID]; ok {
			return p
		}
	}
	return s.aiProvider
}

// ChatMessage representa un mensaje en la conversación del asistente.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResult es la respuesta del asistente.
type ChatResult struct {
	Response       string `json:"response"`
	PromptTokens   int    `json:"prompt_tokens"`
	OutputTokens   int    `json:"output_tokens"`
	Provider       string `json:"provider"`
	ConversacionID string `json:"conversacion_id"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat
// ──────────────────────────────────────────────────────────────────────────────

func (s *AssistantService) Chat(ctx context.Context, tenantID, usuarioID uuid.UUID, conversacionID uuid.UUID, userMessage string, providerID string) (*ChatResult, error) {
	// 1. Si no hay conversación, crear una nueva
	if conversacionID == uuid.Nil {
		titulo := userMessage
		if len(titulo) > 80 {
			titulo = titulo[:80]
		}
		newID, err := s.historialRepo.CrearConversacion(ctx, tenantID, usuarioID, titulo)
		if err != nil {
			return nil, fmt.Errorf("assistant_service.Chat crear conversacion: %w", err)
		}
		conversacionID = newID
	} else {
		ok, err := s.historialRepo.VerificarConversacionDelUsuario(ctx, tenantID, usuarioID, conversacionID)
		if err != nil {
			return nil, fmt.Errorf("assistant_service.Chat verificar: %w", err)
		}
		if !ok {
			return nil, fmt.Errorf("conversacion_no_encontrada")
		}
	}

	// 2. Guardar mensaje del usuario en BD
	if err := s.historialRepo.GuardarMensajeUsuario(ctx, tenantID, conversacionID, userMessage); err != nil {
		if err.Error() == "limite_mensajes_alcanzado" {
			return nil, fmt.Errorf("Esta conversación alcanzó el límite de 50 mensajes. Crea una nueva conversación.")
		}
		return nil, fmt.Errorf("assistant_service.Chat guardar usuario: %w", err)
	}

	// 3. Cargar historial completo de la conversación desde BD
	mensajesDB, err := s.historialRepo.ListarMensajes(ctx, tenantID, conversacionID)
	if err != nil {
		return nil, fmt.Errorf("assistant_service.Chat cargar historial: %w", err)
	}

	// 5. Clasificar intención del mensaje ANTES de preparar historial
	//    para poder optimizar cuánto historial enviar según la intención.
	clasificacion := ClasificarIntencionDelMensaje(userMessage)

	// 4. Convertir a formato del gateway de IA (historial comprimido según intención)
	maxHistorial := 12
	maxCompresion := 300
	switch clasificacion.Intencion {
	case INTENCION_SALUDO, INTENCION_MENSAJE_NO_RELEVANTE, INTENCION_INTENTO_INYECCION:
		// Saludos, basura e inyecciones: solo el mensaje actual, sin historial
		maxHistorial = 1
		maxCompresion = 0
	case INTENCION_ACCION_CAMBIAR_ESTADO, INTENCION_ACCION_REASIGNAR_ASESOR, INTENCION_SOLICITUD_EXPORTACION:
		// Acciones puntuales: poco historial
		maxHistorial = 4
		maxCompresion = 150
	case INTENCION_REPETIR_ACCION:
		// Necesita historial reciente para saber qué repetir
		maxHistorial = 6
		maxCompresion = 400
	}

	var messages []ai.Message
	inicio := 0
	if len(mensajesDB) > maxHistorial {
		inicio = len(mensajesDB) - maxHistorial
	}
	for _, m := range mensajesDB[inicio:] {
		role := "user"
		contenido := m.Contenido
		if m.Rol == "ASSISTANT" {
			role = "assistant"
			if maxCompresion > 0 {
				contenido = comprimirMensajeDelHistorial(contenido, maxCompresion)
			} else {
				contenido = comprimirMensajeDelHistorial(contenido, 50)
			}
		}
		messages = append(messages, ai.Message{Role: role, Content: contenido})
	}
	log.Printf("[ASISTENTE] Intencion=%s Codigos=%v Estado=%s Historial=%d/%d",
		clasificacion.Intencion, clasificacion.CodigosReclamo, clasificacion.EstadoMencionado,
		len(messages), len(mensajesDB))

	contextoIA, err := s.construirContextoSegunIntencion(ctx, tenantID, clasificacion)
	if err != nil {
		log.Printf("[ASISTENTE] Error contexto para %s, usando fallback general: %v", clasificacion.Intencion, err)
		contextoIA, err = s.construirContextoGeneral(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("assistant_service.Chat contexto: %w", err)
		}
	}

	log.Printf("[ASISTENTE] Prompt=%d chars, MaxTokens=%d", len(contextoIA.PromptDelSistema), contextoIA.MaxTokensRespuesta)

	// 6. Llamar al proveedor de IA (respetar selección del usuario)
	provider := s.resolverProvider(providerID)
	inicio_ia := time.Now()
	resp, err := provider.Chat(ctx, ai.ChatRequest{
		SystemPrompt: contextoIA.PromptDelSistema,
		Messages:     messages,
		MaxTokens:    contextoIA.MaxTokensRespuesta,
	})
	duracionMs := int(time.Since(inicio_ia).Milliseconds())

	if err != nil {
		ai.RecordProviderFailure(provider.Name(), err.Error())
		return nil, fmt.Errorf("assistant_service.Chat IA: %w", err)
	}
	ai.ClearProviderFailure(provider.Name())

	// 7. Procesar acciones (cambiar estado, enviar mensaje) si la IA las incluyó
	contenidoFinal := s.procesarAcciones(ctx, resp.Content, tenantID, usuarioID)

	// 8. Guardar respuesta de la IA en BD
	_ = s.historialRepo.GuardarMensajeAsistente(
		ctx, tenantID, conversacionID,
		contenidoFinal, resp.PromptTokens, resp.OutputTokens,
		duracionMs, resp.Provider,
	)

	return &ChatResult{
		Response:       contenidoFinal,
		PromptTokens:   resp.PromptTokens,
		OutputTokens:   resp.OutputTokens,
		Provider:       resp.Provider,
		ConversacionID: conversacionID.String(),
	}, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Gestión de conversaciones
// ──────────────────────────────────────────────────────────────────────────────

func (s *AssistantService) ListarConversaciones(ctx context.Context, tenantID, usuarioID uuid.UUID) ([]repo.ConversacionResumen, error) {
	return s.historialRepo.ListarConversaciones(ctx, tenantID, usuarioID)
}

func (s *AssistantService) ObtenerMensajes(ctx context.Context, tenantID, usuarioID, conversacionID uuid.UUID) ([]repo.MensajeHistorial, error) {
	ok, err := s.historialRepo.VerificarConversacionDelUsuario(ctx, tenantID, usuarioID, conversacionID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("conversacion_no_encontrada")
	}
	return s.historialRepo.ListarMensajes(ctx, tenantID, conversacionID)
}

func (s *AssistantService) EliminarConversacion(ctx context.Context, tenantID, usuarioID, conversacionID uuid.UUID) error {
	return s.historialRepo.EliminarConversacion(ctx, tenantID, usuarioID, conversacionID)
}

// ──────────────────────────────────────────────────────────────────────────────
// Procesamiento de acciones en respuesta del asistente
// ──────────────────────────────────────────────────────────────────────────────

var accionRegex = regexp.MustCompile(`\[ACCION:(\w+)(?:\|([^\]]+))?\]`)

func (s *AssistantService) procesarAcciones(ctx context.Context, respuesta string, tenantID, userID uuid.UUID) string {
	matches := accionRegex.FindAllStringSubmatchIndex(respuesta, -1)
	if len(matches) == 0 {
		return respuesta
	}

	resultado := respuesta
	// Procesar en reversa para no romper indices
	for i := len(matches) - 1; i >= 0; i-- {
		m := matches[i]
		bloque := respuesta[m[0]:m[1]]
		tipo := respuesta[m[2]:m[3]]
		params := ""
		if m[4] >= 0 && m[5] >= 0 {
			params = respuesta[m[4]:m[5]]
		}

		paramsMap := parsearParams(params)
		var reemplazo string

		switch tipo {
		case "CAMBIAR_ESTADO":
			reemplazo = s.ejecutarCambiarEstado(ctx, tenantID, userID, paramsMap)
		case "ENVIAR_MENSAJE":
			reemplazo = s.ejecutarEnviarMensaje(ctx, tenantID, paramsMap)
		case "EXPORTAR":
			reemplazo = generarLinksDeExportacion(paramsMap)
		case "REASIGNAR_ASESOR":
			reemplazo = s.ejecutarReasignarAsesor(ctx, tenantID, userID, paramsMap)
		default:
			reemplazo = bloque
		}

		resultado = resultado[:m[0]] + reemplazo + resultado[m[1]:]
	}

	return resultado
}

func parsearParams(raw string) map[string]string {
	params := make(map[string]string)
	for _, par := range strings.Split(raw, "|") {
		kv := strings.SplitN(par, "=", 2)
		if len(kv) == 2 {
			params[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
		}
	}
	return params
}

func (s *AssistantService) ejecutarCambiarEstado(ctx context.Context, tenantID, userID uuid.UUID, params map[string]string) string {
	codigo := params["codigo"]
	estado := strings.ToUpper(params["estado"])

	if codigo == "" || estado == "" {
		return "⚠ No se pudo ejecutar: faltan datos (codigo o estado)."
	}

	estadosValidos := map[string]bool{"PENDIENTE": true, "EN_PROCESO": true, "RESUELTO": true, "RECHAZADO": true, "CERRADO": true}
	if !estadosValidos[estado] {
		return fmt.Sprintf("⚠ Estado '%s' no es valido.", estado)
	}

	if s.reclamoService == nil {
		return "⚠ Servicio de reclamos no disponible."
	}

	reclamo, err := s.assistantRepo.GetReclamoBasicoPorCodigo(ctx, tenantID, codigo)
	if err != nil {
		return fmt.Sprintf("⚠ No se encontro el reclamo **%s**.", codigo)
	}

	err = s.reclamoService.CambiarEstado(ctx, tenantID, reclamo.ID, userID, estado, "Cambio via Asistente IA", "")
	if err != nil {
		return fmt.Sprintf("⚠ Error al cambiar estado: %s", err.Error())
	}

	return fmt.Sprintf("✅ Estado de **%s** actualizado de %s a **%s**. (Cliente: %s, Email: %s, Tel: %s)",
		codigo, reclamo.Estado, estado, reclamo.NombreCompleto, reclamo.Email, reclamo.Telefono)
}

func (s *AssistantService) ejecutarEnviarMensaje(ctx context.Context, tenantID uuid.UUID, params map[string]string) string {
	codigo := params["codigo"]
	mensaje := params["mensaje"]

	if codigo == "" || mensaje == "" {
		return "⚠ No se pudo enviar: faltan datos (codigo o mensaje)."
	}

	if s.mensajeRepo == nil {
		return "⚠ Servicio de mensajes no disponible."
	}

	reclamo, err := s.assistantRepo.GetReclamoBasicoPorCodigo(ctx, tenantID, codigo)
	if err != nil {
		return fmt.Sprintf("⚠ No se encontro el reclamo **%s**.", codigo)
	}

	msg := &model.Mensaje{
		TenantModel:  model.TenantModel{TenantID: tenantID},
		ReclamoID:    reclamo.ID,
		TipoMensaje:  "EMPRESA",
		MensajeTexto: mensaje,
	}
	if err := s.mensajeRepo.Create(ctx, msg); err != nil {
		return fmt.Sprintf("⚠ Error al enviar mensaje: %s", err.Error())
	}

	return fmt.Sprintf("✅ Mensaje enviado al consumidor del reclamo **%s** (%s, %s).",
		codigo, reclamo.NombreCompleto, reclamo.Email)
}

func (s *AssistantService) ejecutarReasignarAsesor(ctx context.Context, tenantID, userID uuid.UUID, params map[string]string) string {
	codigo := params["codigo"]
	asesorEmail := strings.ToLower(strings.TrimSpace(params["asesor_email"]))

	if codigo == "" || asesorEmail == "" {
		return "⚠ No se pudo ejecutar: faltan datos (codigo o asesor_email)."
	}

	if s.reclamoService == nil {
		return "⚠ Servicio de reclamos no disponible."
	}
	if s.usuarioRepo == nil {
		return "⚠ Repositorio de usuarios no disponible."
	}

	reclamo, err := s.assistantRepo.GetReclamoBasicoPorCodigo(ctx, tenantID, codigo)
	if err != nil {
		return fmt.Sprintf("⚠ No se encontró el reclamo **%s**.", codigo)
	}

	usuarios, err := s.usuarioRepo.GetByTenant(ctx, tenantID)
	if err != nil {
		return "⚠ No se pudo obtener la lista de asesores."
	}

	var asesorID uuid.UUID
	var asesorNombre string
	for _, u := range usuarios {
		if strings.ToLower(u.Email) == asesorEmail && u.Activo {
			asesorID = u.ID
			asesorNombre = u.NombreCompleto
			break
		}
	}
	if asesorID == uuid.Nil {
		return fmt.Sprintf("⚠ No se encontró un asesor activo con email **%s**.", asesorEmail)
	}

	err = s.reclamoService.Asignar(ctx, tenantID, reclamo.ID, asesorID, userID, "")
	if err != nil {
		return fmt.Sprintf("⚠ Error al asignar asesor: %s", err.Error())
	}

	return fmt.Sprintf("✅ Reclamo **%s** asignado a **%s** (%s). (Cliente: %s, Email: %s)",
		codigo, asesorNombre, asesorEmail, reclamo.NombreCompleto, reclamo.Email)
}

func generarLinksDeExportacion(params map[string]string) string {
	queryParams := ""
	separador := "?"

	palabrasGenericasQueNoSonFiltro := map[string]bool{
		"todos": true, "todas": true, "todo": true, "toda": true,
		"completo": true, "completa": true, "general": true, "mis": true,
		"mis reclamos": true, "todos mis reclamos": true, "all": true,
	}
	if busqueda := params["busqueda"]; busqueda != "" {
		busquedaLimpia := strings.TrimSpace(strings.ToLower(busqueda))
		if !palabrasGenericasQueNoSonFiltro[busquedaLimpia] {
			queryParams += separador + "busqueda=" + url.QueryEscape(strings.TrimSpace(busqueda))
			separador = "&"
		}
	}
	if estado := params["estado"]; estado != "" {
		queryParams += separador + "estado=" + url.QueryEscape(strings.ToUpper(estado))
		separador = "&"
	}

	descripcionFiltro := ""
	if busqueda := params["busqueda"]; busqueda != "" {
		descripcionFiltro = fmt.Sprintf(" de \"%s\"", busqueda)
	}
	if estado := params["estado"]; estado != "" {
		descripcionFiltro += fmt.Sprintf(" (estado: %s)", strings.ToUpper(estado))
	}

	urlPDF := "/api/v1/reclamos/exportar/pdf" + queryParams
	urlExcel := "/api/v1/reclamos/exportar/excel" + queryParams

	return fmt.Sprintf("📄 [Descargar PDF - Reclamos%s](%s)\n📊 [Descargar Excel - Reclamos%s](%s)",
		descripcionFiltro, urlPDF, descripcionFiltro, urlExcel)
}