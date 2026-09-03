package service

import (
	"context"
	"fmt"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/google/uuid"
)

type MensajeAtencionService struct {
	mensajeRepo     *repo.MensajeAtencionRepo
	solicitudRepo   *repo.SolicitudAsesorRepo
	canalWARepo     *repo.CanalWhatsAppRepo
	notifTiempoReal *NotificacionTiempoRealService
}

func (s *MensajeAtencionService) SetNotificacionTiempoReal(svc *NotificacionTiempoRealService) {
	s.notifTiempoReal = svc
}

func NewMensajeAtencionService(
	mensajeRepo *repo.MensajeAtencionRepo,
	solicitudRepo *repo.SolicitudAsesorRepo,
	canalWARepo *repo.CanalWhatsAppRepo,
) *MensajeAtencionService {
	return &MensajeAtencionService{
		mensajeRepo:   mensajeRepo,
		solicitudRepo: solicitudRepo,
		canalWARepo:   canalWARepo,
	}
}

// ListarMensajes retorna los mensajes de una solicitud.
func (s *MensajeAtencionService) ListarMensajes(ctx context.Context, tenantID, solicitudID uuid.UUID) ([]model.MensajeAtencion, error) {
	return s.mensajeRepo.ListarPorSolicitud(ctx, tenantID, solicitudID)
}

// EnviarComoAsesor guarda el mensaje y lo envía por WhatsApp.
func (s *MensajeAtencionService) EnviarComoAsesor(ctx context.Context, tenantID, solicitudID, asesorID uuid.UUID, contenido string) (*model.MensajeAtencion, error) {
	// Validar que la solicitud existe y está en atención
	sol, err := s.solicitudRepo.GetByID(ctx, tenantID, solicitudID)
	if err != nil {
		return nil, fmt.Errorf("mensaje_atencion_service.EnviarComoAsesor: %w", err)
	}
	if sol == nil {
		return nil, apperror.ErrNotFound
	}
	if !sol.EstaAbierta() {
		return nil, apperror.New(400, "SOLICITUD_CERRADA", "No se pueden enviar mensajes a una solicitud cerrada")
	}

	// Guardar en BD
	msg := &model.MensajeAtencion{
		TenantID:    tenantID,
		SolicitudID: solicitudID,
		Remitente:   model.RemitentAsesor,
		Contenido:   contenido,
		AsesorID:    model.NullUUID{UUID: asesorID, Valid: true},
	}

	if err := s.mensajeRepo.Crear(ctx, msg); err != nil {
		return nil, fmt.Errorf("mensaje_atencion_service.EnviarComoAsesor guardar: %w", err)
	}

	// Enviar por WhatsApp (si tiene canal vinculado)
	if sol.CanalWhatsAppID.Valid {
		go func() {
			canal, errC := s.canalWARepo.GetByID(ctx, tenantID, sol.CanalWhatsAppID.UUID)
			if errC != nil || canal == nil {
				fmt.Printf("[Chat] Error obteniendo canal WA: %v\n", errC)
				return
			}
			errSend := EnviarMensajeWhatsApp(ctx, canal.AccessToken, canal.PhoneNumberID, sol.Telefono, contenido)
			if errSend != nil {
				fmt.Printf("[Chat] Error enviando WA a %s: %v\n", sol.Telefono, errSend)
			} else {
				fmt.Printf("[Chat] ✅ Mensaje asesor → %s enviado por WA\n", sol.Telefono)
			}
		}()
	}

	if s.notifTiempoReal != nil {
		s.notifTiempoReal.EmitirEventoSalaAtencionVivo(tenantID.String(), solicitudID.String(),
			ws.EventoMensajeAtencionAsesorEnviado,
			ws.DatosMensajeAtencionRecibido{
				SolicitudID: solicitudID.String(),
				MensajeID:   msg.ID.String(),
				Remitente:   model.RemitentAsesor,
				Contenido:   contenido,
				FechaEnvio:  msg.FechaEnvio.Format("2006-01-02T15:04:05Z07:00"),
				AsesorID:    asesorID.String(),
			},
		)
	}

	return msg, nil
}

// GuardarMensajeCliente guarda un mensaje entrante del cliente (llamado desde whatsapp_service).
func (s *MensajeAtencionService) GuardarMensajeCliente(ctx context.Context, tenantID, solicitudID uuid.UUID, contenido string) error {
	msg := &model.MensajeAtencion{
		TenantID:    tenantID,
		SolicitudID: solicitudID,
		Remitente:   model.RemitentCliente,
		Contenido:   contenido,
	}
	if err := s.mensajeRepo.Crear(ctx, msg); err != nil {
		return err
	}

	if s.notifTiempoReal != nil {
		s.notifTiempoReal.EmitirEventoSalaAtencionVivo(tenantID.String(), solicitudID.String(),
			ws.EventoMensajeAtencionClienteRecibido,
			ws.DatosMensajeAtencionRecibido{
				SolicitudID: solicitudID.String(),
				MensajeID:   msg.ID.String(),
				Remitente:   model.RemitentCliente,
				Contenido:   contenido,
				FechaEnvio:  msg.FechaEnvio.Format("2006-01-02T15:04:05Z07:00"),
			},
		)
		go s.notifTiempoReal.EmitirNotificacion(
			tenantID, model.NotifMensajeAtencionClienteRecibido,
			"Nuevo mensaje en atención en vivo",
			fmt.Sprintf("El cliente envió un mensaje en la solicitud de atención"),
			nil, nil,
		)
	}

	return nil
}

// ContarMensajesCliente cuenta los mensajes enviados por el cliente en una solicitud.
func (s *MensajeAtencionService) ContarMensajesCliente(ctx context.Context, tenantID, solicitudID uuid.UUID) (int, error) {
	return s.mensajeRepo.ContarMensajesCliente(ctx, tenantID, solicitudID)
}

// TieneRespuestaAsesor verifica si el asesor ya respondió en la solicitud.
func (s *MensajeAtencionService) TieneRespuestaAsesor(ctx context.Context, tenantID, solicitudID uuid.UUID) (bool, error) {
	return s.mensajeRepo.TieneRespuestaAsesor(ctx, tenantID, solicitudID)
}

// GuardarMensajeSistema guarda un mensaje automático (handoff, transferencia, cierre).
func (s *MensajeAtencionService) GuardarMensajeSistema(ctx context.Context, tenantID, solicitudID uuid.UUID, contenido string) error {
	msg := &model.MensajeAtencion{
		TenantID:    tenantID,
		SolicitudID: solicitudID,
		Remitente:   model.RemitentSistema,
		Contenido:   contenido,
	}
	return s.mensajeRepo.Crear(ctx, msg)
}