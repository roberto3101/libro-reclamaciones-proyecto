package repo

import (
	"context"
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type PagoRepo struct {
	db *sql.DB
}

func NewPagoRepo(db *sql.DB) *PagoRepo {
	return &PagoRepo{db: db}
}

const columnasPago = `
	id, tenant_id, suscripcion_id, plan_id, proveedor, referencia_externa,
	monto, moneda, ciclo, estado, email, descripcion,
	error_codigo, error_mensaje, registrado_por,
	fecha_pago, fecha_creacion, fecha_actualizacion`

func (r *PagoRepo) Crear(ctx context.Context, p *model.Pago) error {
	query := `
		INSERT INTO pagos (
			tenant_id, suscripcion_id, plan_id, proveedor, referencia_externa,
			monto, moneda, ciclo, estado, email, descripcion, payload,
			error_codigo, error_mensaje, registrado_por, fecha_pago
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id, fecha_creacion, fecha_actualizacion`

	// payload es JSONB: un []byte vacío llega como cadena vacía y Postgres no
	// la acepta como JSON. En los pagos fallidos no hay respuesta que guardar,
	// así que va NULL. Sin esto, ningún intento rechazado queda registrado.
	var payload any
	if len(p.Payload) > 0 {
		payload = p.Payload
	}

	return r.db.QueryRowContext(ctx, query,
		p.TenantID, p.SuscripcionID, p.PlanID, p.Proveedor, p.ReferenciaExterna,
		p.Monto, p.Moneda, p.Ciclo, p.Estado, p.Email, p.Descripcion, payload,
		p.ErrorCodigo, p.ErrorMensaje, p.RegistradoPor, p.FechaPago,
	).Scan(&p.ID, &p.FechaCreacion, &p.FechaActualizacion)
}

func (r *PagoRepo) ObtenerPorID(ctx context.Context, id uuid.UUID) (*model.Pago, error) {
	query := `SELECT ` + columnasPago + ` FROM pagos WHERE id = $1`

	p := &model.Pago{}
	err := r.escanear(r.db.QueryRowContext(ctx, query, id), p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("pago_repo.ObtenerPorID: %w", err)
	}
	return p, nil
}

// ObtenerPorReferencia sirve para no cobrar dos veces cuando el webhook
// de Culqi llega repetido, cosa que pasa por diseño si no respondes 200.
func (r *PagoRepo) ObtenerPorReferencia(ctx context.Context, proveedor, referencia string) (*model.Pago, error) {
	query := `SELECT ` + columnasPago + `
		FROM pagos
		WHERE proveedor = $1 AND referencia_externa = $2`

	p := &model.Pago{}
	err := r.escanear(r.db.QueryRowContext(ctx, query, proveedor, referencia), p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("pago_repo.ObtenerPorReferencia: %w", err)
	}
	return p, nil
}

func (r *PagoRepo) ListarPorTenant(ctx context.Context, tenantID uuid.UUID, limite int) ([]model.Pago, error) {
	if limite <= 0 || limite > 200 {
		limite = 50
	}

	query := `SELECT ` + columnasPago + `
		FROM pagos
		WHERE tenant_id = $1
		ORDER BY fecha_creacion DESC
		LIMIT $2`

	filas, err := r.db.QueryContext(ctx, query, tenantID, limite)
	if err != nil {
		return nil, fmt.Errorf("pago_repo.ListarPorTenant: %w", err)
	}
	defer filas.Close()

	pagos := []model.Pago{}
	for filas.Next() {
		var p model.Pago
		if err := r.escanear(filas, &p); err != nil {
			return nil, fmt.Errorf("pago_repo.ListarPorTenant scan: %w", err)
		}
		pagos = append(pagos, p)
	}
	return pagos, filas.Err()
}

func (r *PagoRepo) ActualizarEstado(ctx context.Context, id uuid.UUID, estado string) error {
	query := `
		UPDATE pagos
		SET estado = $2, fecha_actualizacion = now()
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, id, estado)
	if err != nil {
		return fmt.Errorf("pago_repo.ActualizarEstado: %w", err)
	}
	return nil
}

// TotalCobradoPorTenant devuelve cuánto ha pagado un tenant en total.
func (r *PagoRepo) TotalCobradoPorTenant(ctx context.Context, tenantID uuid.UUID) (float64, error) {
	query := `
		SELECT COALESCE(SUM(monto), 0)
		FROM pagos
		WHERE tenant_id = $1 AND estado = $2`

	var total float64
	err := r.db.QueryRowContext(ctx, query, tenantID, model.PagoPagado).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("pago_repo.TotalCobradoPorTenant: %w", err)
	}
	return total, nil
}

// --- Idempotencia de webhooks ---

// RegistrarEvento guarda el evento y dice si es nuevo.
// Si devuelve false, ya lo procesamos antes y hay que ignorarlo.
func (r *PagoRepo) RegistrarEvento(ctx context.Context, proveedor, eventoID, tipo string, payload []byte) (bool, error) {
	query := `
		INSERT INTO pagos_eventos (proveedor, evento_id, tipo, payload)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (proveedor, evento_id) DO NOTHING
		RETURNING id`

	var id uuid.UUID
	err := r.db.QueryRowContext(ctx, query, proveedor, eventoID, tipo, payload).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("pago_repo.RegistrarEvento: %w", err)
	}
	return true, nil
}

func (r *PagoRepo) MarcarEventoProcesado(ctx context.Context, proveedor, eventoID string) error {
	query := `
		UPDATE pagos_eventos
		SET procesado = true
		WHERE proveedor = $1 AND evento_id = $2`

	_, err := r.db.ExecContext(ctx, query, proveedor, eventoID)
	return err
}

// escanear centraliza el orden de columnas para que Crear, Obtener y Listar
// no se desincronicen al agregar campos.
type escaneable interface {
	Scan(dest ...any) error
}

func (r *PagoRepo) escanear(fila escaneable, p *model.Pago) error {
	return fila.Scan(
		&p.ID, &p.TenantID, &p.SuscripcionID, &p.PlanID, &p.Proveedor, &p.ReferenciaExterna,
		&p.Monto, &p.Moneda, &p.Ciclo, &p.Estado, &p.Email, &p.Descripcion,
		&p.ErrorCodigo, &p.ErrorMensaje, &p.RegistradoPor,
		&p.FechaPago, &p.FechaCreacion, &p.FechaActualizacion,
	)
}
