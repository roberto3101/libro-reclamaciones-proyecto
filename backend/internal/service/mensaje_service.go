package service

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/google/uuid"
)

// cooldownEmailMensaje = intervalo minimo entre emails de nuevo_mensaje por reclamo.
const cooldownEmailMensaje = 5 * time.Minute

type MensajeService struct {
	mensajeRepo     *repo.MensajeRepo
	reclamoRepo     *repo.ReclamoRepo
	tenantRepo      *repo.TenantRepo
	notifService    *NotificacionService
	notifTiempoReal *NotificacionTiempoRealService

	// Rate-limit: ultimo email de nuevo_mensaje enviado por reclamoID.
	mu              sync.Mutex
	ultimoEmailMsg  map[uuid.UUID]time.Time
}

func (s *MensajeService) SetNotificacionTiempoReal(svc *NotificacionTiempoRealService) {
	s.notifTiempoReal = svc
}

func NewMensajeService(mensajeRepo *repo.MensajeRepo, reclamoRepo *repo.ReclamoRepo, tenantRepo *repo.TenantRepo, notifService *NotificacionService) *MensajeService {
	return &MensajeService{
		mensajeRepo:    mensajeRepo,
		reclamoRepo:    reclamoRepo,
		tenantRepo:     tenantRepo,
		notifService:   notifService,
		ultimoEmailMsg: make(map[uuid.UUID]time.Time),
	}
}

// puedeEnviarEmailMensaje verifica si ya paso el cooldown desde el ultimo
// email de nuevo_mensaje para este reclamo. Si puede, registra el instante.
func (s *MensajeService) puedeEnviarEmailMensaje(reclamoID uuid.UUID) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	ahora := time.Now()
	if ultimo, ok := s.ultimoEmailMsg[reclamoID]; ok {
		if ahora.Sub(ultimo) < cooldownEmailMensaje {
			return false
		}
	}
	s.ultimoEmailMsg[reclamoID] = ahora

	// Limpieza periodica: eliminar entradas viejas (>10 min) para no acumular memoria.
	if len(s.ultimoEmailMsg) > 500 {
		for id, t := range s.ultimoEmailMsg {
			if ahora.Sub(t) > 10*time.Minute {
				delete(s.ultimoEmailMsg, id)
			}
		}
	}

	return true
}

func (s *MensajeService) GetByReclamo(ctx context.Context, tenantID, reclamoID uuid.UUID) ([]model.Mensaje, error) {
	return s.mensajeRepo.GetByReclamo(ctx, tenantID, reclamoID)
}

func (s *MensajeService) Crear(ctx context.Context, tenantID, reclamoID uuid.UUID, tipoMensaje, texto, archivoURL, archivoNombre string) (*model.Mensaje, error) {
	// Verificar que el reclamo existe
	reclamo, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("mensaje_service.Crear: %w", err)
	}
	if reclamo == nil {
		return nil, apperror.ErrNotFound
	}

	msg := &model.Mensaje{
		TenantModel:   model.TenantModel{TenantID: tenantID},
		ReclamoID:     reclamoID,
		TipoMensaje:   tipoMensaje,
		MensajeTexto:  texto,
		ArchivoURL:    model.NullString{NullString: sql.NullString{String: archivoURL, Valid: archivoURL != ""}},
		ArchivoNombre: model.NullString{NullString: sql.NullString{String: archivoNombre, Valid: archivoNombre != ""}},
	}

	if err := s.mensajeRepo.Create(ctx, msg); err != nil {
		return nil, fmt.Errorf("mensaje_service.Crear: %w", err)
	}

	// Notificar al cliente si el mensaje es de la EMPRESA/ADMIN (respeta toggle notificar_email_mensaje).
	// Rate-limit: maximo 1 email cada 5 min por reclamo para evitar spam.
	if tipoMensaje != "CLIENTE" && reclamo.Email != "" && s.puedeEnviarEmailMensaje(reclamoID) {
		go func() {
			bgCtx := context.Background()
			t, _ := s.tenantRepo.GetByTenantID(bgCtx, tenantID)

			if t == nil || !t.NotificarEmailMensaje {
				return
			}

			errEnvio := s.notifService.EnviarNotificacionMensajeNuevo(
				bgCtx,
				reclamo.Email,
				t,
				reclamo.CodigoReclamo,
				reclamo.NombreCompleto,
				texto,
			)
			if errEnvio != nil {
				fmt.Printf("[ERROR SMTP Mensaje] %v\n", errEnvio)
			}
		}()
	}

	if s.notifTiempoReal != nil {
		datosMensaje := ws.DatosReclamoMensajeRecibido{
			ReclamoID:     reclamoID.String(),
			CodigoReclamo: reclamo.CodigoReclamo,
			MensajeID:     msg.ID.String(),
			TipoMensaje:   tipoMensaje,
			Contenido:     texto,
		}

		s.notifTiempoReal.EmitirEventoSalaReclamoMensajes(tenantID.String(), reclamoID.String(),
			ws.EventoReclamoMensajeEmpresaEnviado, datosMensaje,
		)

		s.notifTiempoReal.EmitirEventoSeguimientoPublico(tenantID.String(), reclamo.CodigoReclamo,
			ws.EventoSeguimientoMensajeNuevo,
			ws.DatosSeguimientoPublico{
				CodigoReclamo: reclamo.CodigoReclamo,
				TipoEvento:    "MENSAJE_EMPRESA",
			},
		)
	}

	return msg, nil
}

func (s *MensajeService) CrearPublico(ctx context.Context, tenantID, reclamoID uuid.UUID, texto, archivoURL, archivoNombre string) (*model.Mensaje, error) {
	reclamo, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("mensaje_service.CrearPublico: %w", err)
	}
	if reclamo == nil {
		return nil, apperror.ErrNotFound
	}

	// No permitir mensajes en reclamos cerrados o resueltos.
	if reclamo.Estado == model.EstadoCerrado || reclamo.Estado == model.EstadoResuelto {
		return nil, apperror.New(403, "RECLAMO_CERRADO", "Este reclamo ya fue atendido. No es posible enviar más mensajes.")
	}

	msg := &model.Mensaje{
		TenantModel:   model.TenantModel{TenantID: tenantID},
		ReclamoID:     reclamoID,
		TipoMensaje:   "CLIENTE",
		MensajeTexto:  texto,
		ArchivoURL:    model.NullString{NullString: sql.NullString{String: archivoURL, Valid: archivoURL != ""}},
		ArchivoNombre: model.NullString{NullString: sql.NullString{String: archivoNombre, Valid: archivoNombre != ""}},
	}

	if err := s.mensajeRepo.Create(ctx, msg); err != nil {
		return nil, fmt.Errorf("mensaje_service.CrearPublico: %w", err)
	}

	if s.notifTiempoReal != nil {
		datosMensaje := ws.DatosReclamoMensajeRecibido{
			ReclamoID:     reclamoID.String(),
			CodigoReclamo: reclamo.CodigoReclamo,
			MensajeID:     msg.ID.String(),
			TipoMensaje:   "CLIENTE",
			Contenido:     texto,
		}

		s.notifTiempoReal.EmitirEventoSalaReclamoMensajes(tenantID.String(), reclamoID.String(),
			ws.EventoReclamoMensajeClienteRecibido, datosMensaje,
		)

		go s.notifTiempoReal.EmitirNotificacion(
			tenantID, model.NotifReclamoMensajeClienteRecibido,
			"Nuevo mensaje del cliente en reclamo",
			fmt.Sprintf("El cliente envió un mensaje en el reclamo %s", reclamo.CodigoReclamo),
			datosMensaje, nil,
		)
	}

	return msg, nil
}

func (s *MensajeService) MarcarLeidos(ctx context.Context, tenantID, reclamoID uuid.UUID, tipo string) error {
	reclamo, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return fmt.Errorf("mensaje_service.MarcarLeidos: %w", err)
	}
	if reclamo == nil {
		return apperror.ErrNotFound
	}
	return s.mensajeRepo.MarkAsRead(ctx, tenantID, reclamoID, tipo)
}