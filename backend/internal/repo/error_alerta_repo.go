package repo

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	ws "libro-reclamaciones/internal/websocket"

	"github.com/google/uuid"
)

type ErrorAlertaRepo struct {
	db *sql.DB
}

func NuevoErrorAlertaRepo(db *sql.DB) *ErrorAlertaRepo {
	return &ErrorAlertaRepo{db: db}
}

type ErrorAlerta struct {
	ID          uuid.UUID `json:"id"`
	Fingerprint string    `json:"fingerprint"`
	Tipo        string    `json:"tipo"`
	Mensaje     string    `json:"mensaje"`
	Visto       bool      `json:"visto"`
	Fecha       string    `json:"fecha"`
}

func (r *ErrorAlertaRepo) Insertar(ctx context.Context, fingerprint, tipo, mensaje string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO error_alertas (fingerprint, tipo, mensaje) VALUES ($1, $2, $3) RETURNING id`,
		fingerprint, tipo, mensaje).Scan(&id)
	return id, err
}

func (r *ErrorAlertaRepo) ListarSinVer(ctx context.Context) ([]ErrorAlerta, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, fingerprint, tipo, mensaje, visto, fecha FROM error_alertas WHERE visto = false ORDER BY fecha DESC LIMIT 50`)
	if err != nil {
		return nil, fmt.Errorf("error_alerta_repo.ListarSinVer: %w", err)
	}
	defer rows.Close()

	alertas := []ErrorAlerta{}
	for rows.Next() {
		var a ErrorAlerta
		if err := rows.Scan(&a.ID, &a.Fingerprint, &a.Tipo, &a.Mensaje, &a.Visto, &a.Fecha); err != nil {
			return nil, err
		}
		alertas = append(alertas, a)
	}
	return alertas, rows.Err()
}

func (r *ErrorAlertaRepo) MarcarComoVista(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE error_alertas SET visto = true WHERE id = $1`, id)
	return err
}

func (r *ErrorAlertaRepo) MarcarTodasComoVistas(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `UPDATE error_alertas SET visto = true WHERE visto = false`)
	return err
}

func (r *ErrorAlertaRepo) ContarSinVer(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM error_alertas WHERE visto = false`).Scan(&count)
	return count, err
}

// ── Evaluador de alertas en memoria ──

type rastreadorFingerprint struct {
	primerVisto   bool
	conteoVentana int
	inicioVentana time.Time
}

type EvaluadorAlertasEnMemoria struct {
	repo          *ErrorAlertaRepo
	concentrador  *ws.ConcentradorConexiones
	rastreadores  map[string]*rastreadorFingerprint
	mu            sync.Mutex
	umbralSpike   int
	ventanaMinutos int
}

func NuevoEvaluadorAlertas(repo *ErrorAlertaRepo, concentrador *ws.ConcentradorConexiones) *EvaluadorAlertasEnMemoria {
	e := &EvaluadorAlertasEnMemoria{
		repo:           repo,
		concentrador:   concentrador,
		rastreadores:   make(map[string]*rastreadorFingerprint),
		umbralSpike:    10,
		ventanaMinutos: 5,
	}

	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			e.limpiarRastreadoresViejos()
		}
	}()

	return e
}

func (e *EvaluadorAlertasEnMemoria) EvaluarError(fingerprint, mensaje string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	ahora := time.Now()
	rastreador, existe := e.rastreadores[fingerprint]

	if !existe {
		e.rastreadores[fingerprint] = &rastreadorFingerprint{
			primerVisto:   true,
			conteoVentana: 1,
			inicioVentana: ahora,
		}
		e.emitirAlerta(fingerprint, "NUEVO", mensaje)
		return
	}

	if ahora.Sub(rastreador.inicioVentana) > time.Duration(e.ventanaMinutos)*time.Minute {
		rastreador.conteoVentana = 0
		rastreador.inicioVentana = ahora
	}

	rastreador.conteoVentana++

	if rastreador.conteoVentana == e.umbralSpike {
		truncado := mensaje
		if len(truncado) > 100 {
			truncado = truncado[:100] + "..."
		}
		e.emitirAlerta(fingerprint, "SPIKE", fmt.Sprintf("%s (%d veces en %d min)", truncado, rastreador.conteoVentana, e.ventanaMinutos))
		rastreador.conteoVentana = 0
		rastreador.inicioVentana = ahora
	}
}

func (e *EvaluadorAlertasEnMemoria) emitirAlerta(fingerprint, tipo, mensaje string) {
	go func() {
		id, err := e.repo.Insertar(context.Background(), fingerprint, tipo, mensaje)
		if err != nil {
			log.Printf("[ALERTAS] Error insertando alerta: %v", err)
			return
		}

		if e.concentrador != nil {
			e.concentrador.DifundirASala <- &ws.MensajeDifusionSala{
				NombreSala: ws.NombreSalaSAErrores(),
				Mensaje: ws.MensajeWebSocket{
					Tipo: ws.EventoErrorAlertaNueva,
					Datos: ws.DatosErrorAlertaNueva{
						ID:          id.String(),
						Fingerprint: fingerprint,
						Tipo:        tipo,
						Mensaje:     mensaje,
						Fecha:       time.Now().Format(time.RFC3339),
					},
					FechaEvento: time.Now(),
				},
			}
		}
	}()
}

func (e *EvaluadorAlertasEnMemoria) limpiarRastreadoresViejos() {
	e.mu.Lock()
	defer e.mu.Unlock()

	limite := time.Now().Add(-1 * time.Hour)
	for fp, r := range e.rastreadores {
		if r.inicioVentana.Before(limite) {
			delete(e.rastreadores, fp)
		}
	}
}
