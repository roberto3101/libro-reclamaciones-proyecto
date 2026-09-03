package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/google/uuid"
)

type RespuestaService struct {
	respuestaRepo   *repo.RespuestaRepo
	reclamoRepo     *repo.ReclamoRepo
	historialRepo   *repo.HistorialRepo
	notifService    *NotificacionService
	tenantRepo      *repo.TenantRepo
	notifTiempoReal *NotificacionTiempoRealService
}

func (s *RespuestaService) SetNotificacionTiempoReal(svc *NotificacionTiempoRealService) {
	s.notifTiempoReal = svc
}

func NewRespuestaService(respuestaRepo *repo.RespuestaRepo, reclamoRepo *repo.ReclamoRepo, historialRepo *repo.HistorialRepo, notifService *NotificacionService, tenantRepo *repo.TenantRepo) *RespuestaService {
	return &RespuestaService{
		respuestaRepo: respuestaRepo,
		reclamoRepo:   reclamoRepo,
		historialRepo: historialRepo,
		notifService:  notifService,
		tenantRepo:    tenantRepo,
	}
}

func (s *RespuestaService) GetByReclamo(ctx context.Context, tenantID, reclamoID uuid.UUID) ([]model.Respuesta, error) {
	return s.respuestaRepo.GetByReclamo(ctx, tenantID, reclamoID)
}

func (s *RespuestaService) Crear(ctx context.Context, tenantID, reclamoID, userID uuid.UUID, respuestaTexto, accionTomada, compensacion, cargo, ip string) (*model.Respuesta, error) {
	// 1. Obtener datos del reclamo
	reclamo, err := s.reclamoRepo.GetByID(ctx, tenantID, reclamoID)
	if err != nil {
		return nil, fmt.Errorf("respuesta_service.Crear: %w", err)
	}
	if reclamo == nil {
		return nil, apperror.ErrNotFound
	}

	// 2. Preparar objeto Respuesta
	resp := &model.Respuesta{
		TenantModel:          model.TenantModel{TenantID: tenantID},
		ReclamoID:            reclamoID,
		RespuestaEmpresa:     respuestaTexto,
		AccionTomada:         model.NullString{NullString: sql.NullString{String: accionTomada, Valid: accionTomada != ""}},
		CompensacionOfrecida: model.NullString{NullString: sql.NullString{String: compensacion, Valid: compensacion != ""}},
		RespondidoPor:        model.NullUUID{UUID: userID, Valid: true},
		CargoResponsable:     model.NullString{NullString: sql.NullString{String: cargo, Valid: cargo != ""}},
		Origen:               model.OrigenPanel,
	}

	// 3. Guardar respuesta + actualizar reclamo + registrar historial en una sola transacción.
	//    Es la operación más crítica: si falla cualquier paso, se revierte todo.
	estadoAnterior := reclamo.Estado
	if err := repo.EjecutarEnTransaccion(ctx, s.reclamoRepo.BaseDeDatos(), func(tx *sql.Tx) error {
		respuestaTx := s.respuestaRepo.ConTransaccion(tx)
		reclamoTx := s.reclamoRepo.ConTransaccion(tx)
		historialTx := s.historialRepo.ConTransaccion(tx)

		if err := respuestaTx.Create(ctx, resp); err != nil {
			return fmt.Errorf("insertar respuesta: %w", err)
		}

		if err := reclamoTx.UpdateFechaRespuesta(ctx, tenantID, reclamoID); err != nil {
			return fmt.Errorf("actualizar fecha de respuesta: %w", err)
		}

		if estadoAnterior == model.EstadoPendiente || estadoAnterior == model.EstadoEnProceso {
			if err := reclamoTx.UpdateEstado(ctx, tenantID, reclamoID, model.EstadoCerrado, &userID); err != nil {
				return fmt.Errorf("cerrar reclamo automaticamente: %w", err)
			}
		}

		if err := historialTx.Create(ctx, &model.Historial{
			TenantModel:    model.TenantModel{TenantID: tenantID},
			ReclamoID:      reclamoID,
			EstadoAnterior: model.NullString{NullString: sql.NullString{String: estadoAnterior, Valid: true}},
			EstadoNuevo:    model.EstadoCerrado,
			TipoAccion:     model.AccionRespuesta,
			UsuarioAccion:  model.NullUUID{UUID: userID, Valid: true},
			IPAddress:      model.NullString{NullString: sql.NullString{String: ip, Valid: ip != ""}},
		}); err != nil {
			return fmt.Errorf("registrar historial de respuesta: %w", err)
		}

		return nil
	}); err != nil {
		return nil, fmt.Errorf("respuesta_service.Crear transaccion: %w", err)
	}

	// 7. Generación de PDF y envío (Background) — respeta toggle notificar_email_resolucion
	if reclamo.Email != "" {
		// Capturamos variables para evitar punteros nulos en la goroutine
		targetEmail := reclamo.Email
		codigo := reclamo.CodigoReclamo
		nombreCli := reclamo.NombreCompleto
		tDoc, nDoc := reclamo.TipoDocumento, reclamo.NumeroDocumento
		detReclamo := reclamo.DetalleReclamo
		pedidoCli := reclamo.PedidoConsumidor
		fechaReg := reclamo.FechaRegistro.Format("02/01/2006")

		// Datos del consumidor para el PDF
		domicilioCli := reclamo.Domicilio.String
		telefonoCli := reclamo.Telefono
		emailCli := reclamo.Email

		// Datos del Proveedor (snapshot)
		rSoc := reclamo.RazonSocialProveedor.String
		ruc := reclamo.RUCProveedor.String

		// Sede y Dirección
		sedeNom := reclamo.SedeNombre.String
		if sedeNom == "" {
			sedeNom = "Establecimiento no especificado"
		}

		sedeDir := reclamo.SedeDireccion.String
		if sedeDir == "" {
			sedeDir = reclamo.DireccionProveedor.String
		}
		if sedeDir == "" {
			sedeDir = "No registrada en el sistema"
		}

		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[CRITICAL] Panic en goroutine PDF/email reclamo %s: %v", codigo, r)
				}
			}()

			// Verificar toggle antes de generar PDF (operación costosa)
			tenantCheck, _ := s.tenantRepo.GetByTenantID(context.Background(), tenantID)
			if tenantCheck == nil || !tenantCheck.NotificarEmailResolucion {
				return
			}

			// Datos del tenant para el PDF
			nombreComercial := ""
			colorPrimario := ""
			firmaRepr := ""
			if tenantCheck != nil {
				if tenantCheck.NombreComercial.Valid {
					nombreComercial = tenantCheck.NombreComercial.String
				}
				colorPrimario = tenantCheck.ColorPrimario
				if tenantCheck.FirmaRepresentante.Valid {
					firmaRepr = tenantCheck.FirmaRepresentante.String
				}
			}

			pdfBytes, err := GenerarPDFResolucion(DatosResolucionPDF{
				Codigo:           codigo,
				Fecha:            fechaReg,
				RazonSocial:      rSoc,
				NombreComercial:  nombreComercial,
				RUC:              ruc,
				Sede:             sedeNom,
				DireccionSede:    sedeDir,
				NombreCliente:    nombreCli,
				TipoDoc:          tDoc,
				NumDoc:           nDoc,
				DomicilioCliente: domicilioCli,
				TelefonoCliente:  telefonoCli,
				EmailCliente:     emailCli,
				DetalleReclamo:   detReclamo,
				PedidoConsumidor: pedidoCli,
				RespuestaTexto:   respuestaTexto,
				AccionTomada:     accionTomada,
				ColorPrimario:    colorPrimario,
				FirmaBase64:      firmaRepr,
			})
			if err != nil {
				log.Printf("[ERROR] PDF Resolucion reclamo %s: %v", codigo, err)
				return
			}

			// Enviar email con reintentos (máximo 3 intentos con backoff)
			var errEnvio error
			for intento := 1; intento <= 3; intento++ {
				errEnvio = s.notifService.EnviarResolucionCliente(
					context.Background(),
					targetEmail,
					tenantCheck,
					codigo,
					nombreCli,
					respuestaTexto,
					pdfBytes,
				)
				if errEnvio == nil {
					break
				}
				log.Printf("[WARN] SMTP intento %d/3 reclamo %s a %s: %v", intento, codigo, targetEmail, errEnvio)
				if intento < 3 {
					time.Sleep(time.Duration(intento*5) * time.Second)
				}
			}
			if errEnvio != nil {
				log.Printf("[ERROR] SMTP fallido reclamo %s a %s tras 3 intentos: %v", codigo, targetEmail, errEnvio)
			}
		}()
	}

	if s.notifTiempoReal != nil {
		go s.notifTiempoReal.EmitirNotificacion(
			tenantID, model.NotifReclamoResueltoConRespuesta,
			"Reclamo resuelto con respuesta",
			fmt.Sprintf("El reclamo %s ha sido resuelto con respuesta oficial", reclamo.CodigoReclamo),
			ws.DatosReclamoEstadoCambiado{
				ReclamoID:      reclamoID.String(),
				CodigoReclamo:  reclamo.CodigoReclamo,
				EstadoAnterior: estadoAnterior,
				EstadoNuevo:    model.EstadoCerrado,
			}, &userID,
		)

		s.notifTiempoReal.EmitirEventoSeguimientoPublico(tenantID.String(), reclamo.CodigoReclamo,
			ws.EventoReclamoResueltoConRespuesta,
			ws.DatosSeguimientoPublico{
				CodigoReclamo: reclamo.CodigoReclamo,
				EstadoNuevo:   model.EstadoCerrado,
				TipoEvento:    "RESPUESTA_OFICIAL",
			},
		)
	}

	return resp, nil
}