package service

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/google/uuid"
)

// cooldownNotificacion define el intervalo mínimo entre notificaciones del mismo tipo
// para el mismo contexto (ej: mismo reclamo). Evita spam de notificaciones.
const cooldownNotificacion = 30 * time.Second

// NotificacionTiempoRealService gestiona la creación y difusión de notificaciones en tiempo real.
type NotificacionTiempoRealService struct {
	notifRepo  *repo.NotificacionRepo
	configRepo *repo.ConfiguracionNotificacionRepo
	hub        *ws.ConcentradorConexiones

	// Throttle: tipo+contexto → último envío (evita spam)
	throttleMu    sync.Mutex
	throttleCache map[string]time.Time
}

// NewNotificacionTiempoRealService crea el servicio de notificaciones en tiempo real.
func NewNotificacionTiempoRealService(
	notifRepo *repo.NotificacionRepo,
	configRepo *repo.ConfiguracionNotificacionRepo,
	hub *ws.ConcentradorConexiones,
) *NotificacionTiempoRealService {
	svc := &NotificacionTiempoRealService{
		notifRepo:     notifRepo,
		configRepo:    configRepo,
		hub:           hub,
		throttleCache: make(map[string]time.Time),
	}

	// Limpieza periódica del cache de throttle
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			svc.throttleMu.Lock()
			ahora := time.Now()
			for k, t := range svc.throttleCache {
				if ahora.Sub(t) > 2*time.Minute {
					delete(svc.throttleCache, k)
				}
			}
			svc.throttleMu.Unlock()
		}
	}()

	return svc
}

// estaEnCooldown verifica si una notificación de este tipo+contexto fue enviada recientemente.
// contextKey es un identificador único del contexto (ej: reclamoID, solicitudID).
func (s *NotificacionTiempoRealService) estaEnCooldown(tipo model.TipoNotificacion, contextKey string) bool {
	key := fmt.Sprintf("%s:%s", tipo, contextKey)
	s.throttleMu.Lock()
	defer s.throttleMu.Unlock()

	if ultimo, ok := s.throttleCache[key]; ok {
		if time.Since(ultimo) < cooldownNotificacion {
			return true
		}
	}
	s.throttleCache[key] = time.Now()
	return false
}

// extraerContextKey obtiene la clave de contexto de los datos extra para throttling.
func extraerContextKey(datosExtra interface{}) string {
	if datosExtra == nil {
		return ""
	}
	b, err := json.Marshal(datosExtra)
	if err != nil {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return ""
	}
	// Priorizar reclamo_id, luego solicitud_id como clave de contexto
	if v, ok := m["reclamo_id"]; ok {
		return fmt.Sprintf("%v", v)
	}
	if v, ok := m["solicitud_id"]; ok {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

// EmitirNotificacion crea notificaciones para los destinatarios según config de rol y las difunde por WS.
func (s *NotificacionTiempoRealService) EmitirNotificacion(
	tenantID uuid.UUID,
	tipo model.TipoNotificacion,
	titulo string,
	contenido string,
	datosExtra interface{},
	excluirUsuarioID *uuid.UUID,
) {
	log.Printf("[NOTIF-DEBUG] === EmitirNotificacion INICIO === tipo=%s, tenant=%s", tipo, tenantID)
	if excluirUsuarioID != nil {
		log.Printf("[NOTIF-DEBUG] Excluir usuario: %s", *excluirUsuarioID)
	}

	// Throttle: evitar spam de notificaciones del mismo tipo para el mismo contexto
	contextKey := extraerContextKey(datosExtra)
	if contextKey != "" && s.estaEnCooldown(tipo, contextKey) {
		log.Printf("[NOTIF] Throttled: %s para contexto %s (cooldown %s)", tipo, contextKey, cooldownNotificacion)
		return
	}

	destinatarios, err := s.configRepo.ObtenerUsuariosDestinatariosPorTipoNotificacion(tenantID, tipo)
	if err != nil {
		log.Printf("[NOTIF] Error obteniendo destinatarios para %s: %v", tipo, err)
		return
	}

	log.Printf("[NOTIF-DEBUG] Destinatarios encontrados: %d", len(destinatarios))
	for i, d := range destinatarios {
		log.Printf("[NOTIF-DEBUG]   destinatario[%d]: %s", i, d)
	}

	if len(destinatarios) == 0 {
		log.Printf("[NOTIF-DEBUG] === SIN DESTINATARIOS — saliendo sin crear notificaciones ===")
		return
	}

	datosExtraJSON := json.RawMessage("null")
	if datosExtra != nil {
		b, err := json.Marshal(datosExtra)
		if err == nil {
			datosExtraJSON = b
		}
	}

	ahora := time.Now()
	var notificaciones []*model.Notificacion

	for _, usuarioID := range destinatarios {
		if excluirUsuarioID != nil && usuarioID == *excluirUsuarioID {
			log.Printf("[NOTIF-DEBUG] Usuario %s EXCLUIDO (es quien realizó la acción)", usuarioID)
			continue
		}

		notifID := uuid.New()
		notif := &model.Notificacion{
			TenantID:         tenantID,
			ID:               notifID,
			UsuarioDestinoID: usuarioID,
			Tipo:             tipo,
			Titulo:           titulo,
			Contenido:        contenido,
			DatosExtra:       datosExtraJSON,
			FechaCreacion:    ahora,
		}
		notificaciones = append(notificaciones, notif)
	}

	log.Printf("[NOTIF-DEBUG] Notificaciones a persistir: %d (de %d destinatarios)", len(notificaciones), len(destinatarios))

	// 1. Persistir PRIMERO para que el contador de no leídas sea correcto
	if len(notificaciones) > 0 {
		if err := s.notifRepo.CrearMultiples(notificaciones); err != nil {
			log.Printf("[NOTIF] Error persistiendo %d notificaciones: %v", len(notificaciones), err)
			return
		}
		log.Printf("[NOTIF-DEBUG] ✅ %d notificaciones persistidas en DB", len(notificaciones))
	} else {
		log.Printf("[NOTIF-DEBUG] === NINGUNA notificación para persistir (todos excluidos) ===")
		return
	}

	// 2. Difundir por WebSocket DESPUÉS de persistir
	var datosExtraMap map[string]interface{}
	if len(datosExtraJSON) > 0 {
		_ = json.Unmarshal(datosExtraJSON, &datosExtraMap)
	}

	for _, notif := range notificaciones {
		log.Printf("[NOTIF-DEBUG] Difundiendo WS a usuario=%s tipo=%s", notif.UsuarioDestinoID, notif.Tipo)
		s.hub.PublicarEventoAUsuario(tenantID.String(), notif.UsuarioDestinoID.String(),
			ws.EventoNotificacionNueva,
			ws.DatosNotificacionNueva{
				NotificacionID: notif.ID.String(),
				Tipo:           string(notif.Tipo),
				Titulo:         notif.Titulo,
				Contenido:      notif.Contenido,
				DatosExtra:     datosExtraMap,
				FechaCreacion:  notif.FechaCreacion.Format(time.RFC3339),
			},
		)

		// Enviar contador actualizado (ya incluye la notificación recién persistida)
		go func(tid, uid uuid.UUID) {
			total, err := s.notifRepo.ContarNoLeidasPorUsuario(tid, uid)
			if err == nil {
				s.hub.PublicarEventoAUsuario(tid.String(), uid.String(),
					ws.EventoContadorNotificacionesActualizado,
					ws.DatosContadorNotificaciones{TotalSinLeer: total},
				)
			}
		}(tenantID, notif.UsuarioDestinoID)
	}
}

// EmitirNotificacionAUsuario crea y difunde una notificación directa a un usuario específico.
// A diferencia de EmitirNotificacion (que busca destinatarios por config de rol),
// esta envía directamente al usuario indicado sin pasar por la config de roles.
func (s *NotificacionTiempoRealService) EmitirNotificacionAUsuario(
	tenantID, usuarioDestinoID uuid.UUID,
	tipo model.TipoNotificacion,
	titulo, contenido string,
	datosExtra interface{},
) {
	datosExtraJSON := json.RawMessage("null")
	if datosExtra != nil {
		b, err := json.Marshal(datosExtra)
		if err == nil {
			datosExtraJSON = b
		}
	}

	notif := &model.Notificacion{
		TenantID:         tenantID,
		ID:               uuid.New(),
		UsuarioDestinoID: usuarioDestinoID,
		Tipo:             tipo,
		Titulo:           titulo,
		Contenido:        contenido,
		DatosExtra:       datosExtraJSON,
		FechaCreacion:    time.Now(),
	}

	if err := s.notifRepo.CrearMultiples([]*model.Notificacion{notif}); err != nil {
		log.Printf("[NOTIF] Error persistiendo notificación directa: %v", err)
		return
	}

	var datosExtraMap map[string]interface{}
	if len(datosExtraJSON) > 0 {
		_ = json.Unmarshal(datosExtraJSON, &datosExtraMap)
	}

	s.hub.PublicarEventoAUsuario(tenantID.String(), usuarioDestinoID.String(),
		ws.EventoNotificacionNueva,
		ws.DatosNotificacionNueva{
			NotificacionID: notif.ID.String(),
			Tipo:           string(notif.Tipo),
			Titulo:         notif.Titulo,
			Contenido:      notif.Contenido,
			DatosExtra:     datosExtraMap,
			FechaCreacion:  notif.FechaCreacion.Format(time.RFC3339),
		},
	)

	go func() {
		total, err := s.notifRepo.ContarNoLeidasPorUsuario(tenantID, usuarioDestinoID)
		if err == nil {
			s.hub.PublicarEventoAUsuario(tenantID.String(), usuarioDestinoID.String(),
				ws.EventoContadorNotificacionesActualizado,
				ws.DatosContadorNotificaciones{TotalSinLeer: total},
			)
		}
	}()
}

// EmitirEventoSalaAtencionVivo difunde un evento a la sala de una solicitud de atención.
func (s *NotificacionTiempoRealService) EmitirEventoSalaAtencionVivo(tenantID, solicitudID string, tipo ws.TipoEvento, datos interface{}) {
	sala := ws.NombreSalaAtencionVivo(tenantID, solicitudID)
	s.hub.PublicarEventoASala(sala, tipo, datos)
}

// EmitirEventoSalaReclamoMensajes difunde un evento a la sala de mensajes de un reclamo.
func (s *NotificacionTiempoRealService) EmitirEventoSalaReclamoMensajes(tenantID, reclamoID string, tipo ws.TipoEvento, datos interface{}) {
	sala := ws.NombreSalaReclamoMensajes(tenantID, reclamoID)
	s.hub.PublicarEventoASala(sala, tipo, datos)
}

// EmitirEventoSeguimientoPublico difunde un evento al tracking público de un reclamo.
func (s *NotificacionTiempoRealService) EmitirEventoSeguimientoPublico(tenantID, codigoReclamo string, tipo ws.TipoEvento, datos interface{}) {
	sala := ws.NombreSalaSeguimientoPublico(tenantID, codigoReclamo)
	s.hub.PublicarEventoASala(sala, tipo, datos)
}

// EmitirEventoATenant difunde un evento a todas las conexiones del tenant.
func (s *NotificacionTiempoRealService) EmitirEventoATenant(tenantID string, tipo ws.TipoEvento, datos interface{}) {
	s.hub.PublicarEventoATenant(tenantID, tipo, datos)
}

// ObtenerConcentrador retorna el hub para uso directo cuando sea necesario.
func (s *NotificacionTiempoRealService) ObtenerConcentrador() *ws.ConcentradorConexiones {
	return s.hub
}
