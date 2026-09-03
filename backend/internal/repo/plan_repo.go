package repo

import (
	"context"
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type PlanRepo struct {
	db *sql.DB
}

func NewPlanRepo(db *sql.DB) *PlanRepo {
	return &PlanRepo{db: db}
}

// ─── Columnas comunes (DRY) ─────────────────────────────────────────────────

const columnasSelectPlan = `
	id, codigo, nombre, descripcion,
	precio_mensual, precio_anual, precio_sede_extra, precio_usuario_extra,
	max_sedes, max_usuarios, max_reclamos_mes, max_chatbots, max_canales_whatsapp,
	permite_chatbot, permite_whatsapp, permite_email,
	permite_reportes_pdf, permite_exportar_excel, permite_api,
	permite_marca_blanca, permite_multi_idioma,
	permite_asistente_ia, permite_atencion_vivo,
	max_storage_mb, orden, activo, destacado, fecha_creacion`

func scanPlan(row interface{ Scan(...interface{}) error }) (*model.Plan, error) {
	p := &model.Plan{}
	err := row.Scan(
		&p.ID, &p.Codigo, &p.Nombre, &p.Descripcion,
		&p.PrecioMensual, &p.PrecioAnual, &p.PrecioSedeExtra, &p.PrecioUsuarioExtra,
		&p.MaxSedes, &p.MaxUsuarios, &p.MaxReclamosMes, &p.MaxChatbots, &p.MaxCanalesWhatsApp,
		&p.PermiteChatbot, &p.PermiteWhatsapp, &p.PermiteEmail,
		&p.PermiteReportesPDF, &p.PermiteExportarExcel, &p.PermiteAPI,
		&p.PermiteMarcaBlanca, &p.PermiteMultiIdioma,
		&p.PermiteAsistenteIA, &p.PermiteAtencionVivo,
		&p.MaxStorageMB, &p.Orden, &p.Activo, &p.Destacado, &p.FechaCreacion,
	)
	return p, err
}

// ─── Queries ────────────────────────────────────────────────────────────────

// GetAll retorna planes activos ordenados (para pricing page y panel del tenant).
func (r *PlanRepo) GetAll(ctx context.Context) ([]model.Plan, error) {
	query := fmt.Sprintf(`SELECT %s FROM planes WHERE activo = true ORDER BY orden ASC`, columnasSelectPlan)

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("plan_repo.GetAll: %w", err)
	}
	defer rows.Close()

	return scanPlanes(rows)
}

// GetAllIncluyendoInactivos retorna TODOS los planes (para superadmin).
func (r *PlanRepo) GetAllIncluyendoInactivos(ctx context.Context) ([]model.Plan, error) {
	query := fmt.Sprintf(`SELECT %s FROM planes ORDER BY orden ASC`, columnasSelectPlan)

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("plan_repo.GetAllIncluyendoInactivos: %w", err)
	}
	defer rows.Close()

	return scanPlanes(rows)
}

// GetByID retorna un plan por su UUID.
func (r *PlanRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	query := fmt.Sprintf(`SELECT %s FROM planes WHERE id = $1`, columnasSelectPlan)

	plan, err := scanPlan(r.db.QueryRowContext(ctx, query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("plan_repo.GetByID: %w", err)
	}
	return plan, nil
}

// GetByCodigo retorna un plan por su código (DEMO, EMPRENDEDOR, PYME, PRO).
func (r *PlanRepo) GetByCodigo(ctx context.Context, codigo string) (*model.Plan, error) {
	query := fmt.Sprintf(`SELECT %s FROM planes WHERE codigo = $1`, columnasSelectPlan)

	plan, err := scanPlan(r.db.QueryRowContext(ctx, query, codigo))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("plan_repo.GetByCodigo: %w", err)
	}
	return plan, nil
}

// ─── Comandos ───────────────────────────────────────────────────────────────

// Create inserta un nuevo plan en el catálogo.
func (r *PlanRepo) Create(ctx context.Context, p *model.Plan) error {
	query := `
		INSERT INTO planes (
			codigo, nombre, descripcion,
			precio_mensual, precio_anual, precio_sede_extra, precio_usuario_extra,
			max_sedes, max_usuarios, max_reclamos_mes, max_chatbots, max_canales_whatsapp,
			permite_chatbot, permite_whatsapp, permite_email,
			permite_reportes_pdf, permite_exportar_excel, permite_api,
			permite_marca_blanca, permite_multi_idioma,
			permite_asistente_ia, permite_atencion_vivo,
			max_storage_mb, orden, activo, destacado
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
		) RETURNING id, fecha_creacion`

	return r.db.QueryRowContext(ctx, query,
		p.Codigo, p.Nombre, p.Descripcion,
		p.PrecioMensual, p.PrecioAnual, p.PrecioSedeExtra, p.PrecioUsuarioExtra,
		p.MaxSedes, p.MaxUsuarios, p.MaxReclamosMes, p.MaxChatbots, p.MaxCanalesWhatsApp,
		p.PermiteChatbot, p.PermiteWhatsapp, p.PermiteEmail,
		p.PermiteReportesPDF, p.PermiteExportarExcel, p.PermiteAPI,
		p.PermiteMarcaBlanca, p.PermiteMultiIdioma,
		p.PermiteAsistenteIA, p.PermiteAtencionVivo,
		p.MaxStorageMB, p.Orden, p.Activo, p.Destacado,
	).Scan(&p.ID, &p.FechaCreacion)
}

// Update actualiza un plan existente.
func (r *PlanRepo) Update(ctx context.Context, p *model.Plan) error {
	query := `
		UPDATE planes SET
			nombre = $1, descripcion = $2,
			precio_mensual = $3, precio_anual = $4, precio_sede_extra = $5, precio_usuario_extra = $6,
			max_sedes = $7, max_usuarios = $8, max_reclamos_mes = $9, max_chatbots = $10, max_canales_whatsapp = $11,
			permite_chatbot = $12, permite_whatsapp = $13, permite_email = $14,
			permite_reportes_pdf = $15, permite_exportar_excel = $16, permite_api = $17,
			permite_marca_blanca = $18, permite_multi_idioma = $19,
			permite_asistente_ia = $20, permite_atencion_vivo = $21,
			max_storage_mb = $22, orden = $23, activo = $24, destacado = $25
		WHERE id = $26`

	_, err := r.db.ExecContext(ctx, query,
		p.Nombre, p.Descripcion,
		p.PrecioMensual, p.PrecioAnual, p.PrecioSedeExtra, p.PrecioUsuarioExtra,
		p.MaxSedes, p.MaxUsuarios, p.MaxReclamosMes, p.MaxChatbots, p.MaxCanalesWhatsApp,
		p.PermiteChatbot, p.PermiteWhatsapp, p.PermiteEmail,
		p.PermiteReportesPDF, p.PermiteExportarExcel, p.PermiteAPI,
		p.PermiteMarcaBlanca, p.PermiteMultiIdioma,
		p.PermiteAsistenteIA, p.PermiteAtencionVivo,
		p.MaxStorageMB, p.Orden, p.Activo, p.Destacado,
		p.ID,
	)
	if err != nil {
		return fmt.Errorf("plan_repo.Update: %w", err)
	}
	return nil
}

// ContarSuscripcionesActivas retorna cuántas suscripciones usan un plan.
func (r *PlanRepo) ContarSuscripcionesActivas(ctx context.Context, planID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM suscripciones WHERE plan_id = $1 AND estado IN ('ACTIVA', 'TRIAL')`,
		planID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("plan_repo.ContarSuscripcionesActivas: %w", err)
	}
	return count, nil
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func scanPlanes(rows *sql.Rows) ([]model.Plan, error) {
	var planes []model.Plan
	for rows.Next() {
		p, err := scanPlan(rows)
		if err != nil {
			return nil, fmt.Errorf("plan_repo.scan: %w", err)
		}
		planes = append(planes, *p)
	}
	return planes, rows.Err()
}
