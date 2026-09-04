package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type TenantRepo struct {
	db *sql.DB
}

func NewTenantRepo(db *sql.DB) *TenantRepo {
	return &TenantRepo{db: db}
}

func (r *TenantRepo) GetByTenantID(ctx context.Context, tenantID uuid.UUID) (*model.Tenant, error) {
	query := `
		SELECT tenant_id, id, razon_social, ruc, nombre_comercial,
			direccion_legal, departamento, provincia, distrito,
			telefono, email_contacto, logo_url, slug, sitio_web,
			color_primario, plazo_respuesta_dias, mensaje_confirmacion,
			notificar_whatsapp, notificar_email,
			notificar_email_estado, notificar_email_mensaje, notificar_email_resolucion,
			firma_representante, tema_por_defecto,
			cuenta_id,
			activo, version,
			fecha_creacion, fecha_actualizacion
		FROM configuracion_tenant
		WHERE tenant_id = $1
		LIMIT 1`

	t := &model.Tenant{}
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(
		&t.TenantID, &t.ID, &t.RazonSocial, &t.RUC, &t.NombreComercial,
		&t.DireccionLegal, &t.Departamento, &t.Provincia, &t.Distrito,
		&t.Telefono, &t.EmailContacto, &t.LogoURL, &t.Slug, &t.SitioWeb,
		&t.ColorPrimario, &t.PlazoRespuestaDias, &t.MensajeConfirmacion,
		&t.NotificarWhatsapp, &t.NotificarEmail,
		&t.NotificarEmailEstado, &t.NotificarEmailMensaje, &t.NotificarEmailResolucion,
		&t.FirmaRepresentante, &t.TemaPorDefecto,
		&t.CuentaID,
		&t.Activo, &t.Version,
		&t.FechaCreacion, &t.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("tenant_repo.GetByTenantID: %w", err)
	}
	return t, nil
}

func (r *TenantRepo) GetBySlug(ctx context.Context, slug string) (*model.Tenant, error) {
	query := `
		SELECT tenant_id, id, razon_social, ruc, nombre_comercial,
			direccion_legal, departamento, provincia, distrito,
			telefono, email_contacto, logo_url, slug, sitio_web,
			color_primario, plazo_respuesta_dias, mensaje_confirmacion,
			notificar_whatsapp, notificar_email,
			notificar_email_estado, notificar_email_mensaje, notificar_email_resolucion,
			firma_representante, tema_por_defecto,
			cuenta_id,
			activo, version,
			fecha_creacion, fecha_actualizacion
		FROM configuracion_tenant
		WHERE slug = $1
		LIMIT 1`

	t := &model.Tenant{}
	err := r.db.QueryRowContext(ctx, query, slug).Scan(
		&t.TenantID, &t.ID, &t.RazonSocial, &t.RUC, &t.NombreComercial,
		&t.DireccionLegal, &t.Departamento, &t.Provincia, &t.Distrito,
		&t.Telefono, &t.EmailContacto, &t.LogoURL, &t.Slug, &t.SitioWeb,
		&t.ColorPrimario, &t.PlazoRespuestaDias, &t.MensajeConfirmacion,
		&t.NotificarWhatsapp, &t.NotificarEmail,
		&t.NotificarEmailEstado, &t.NotificarEmailMensaje, &t.NotificarEmailResolucion,
		&t.FirmaRepresentante, &t.TemaPorDefecto,
		&t.CuentaID,
		&t.Activo, &t.Version,
		&t.FechaCreacion, &t.FechaActualizacion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("tenant_repo.GetBySlug: %w", err)
	}
	return t, nil
}

func (r *TenantRepo) Create(ctx context.Context, t *model.Tenant) error {
	query := `
		INSERT INTO configuracion_tenant (
			tenant_id, razon_social, ruc, nombre_comercial,
			direccion_legal, departamento, provincia, distrito,
			telefono, email_contacto, logo_url, slug, sitio_web,
			color_primario, plazo_respuesta_dias, mensaje_confirmacion,
			notificar_whatsapp, notificar_email,
			notificar_email_estado, notificar_email_mensaje, notificar_email_resolucion
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
		RETURNING id, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		t.TenantID, t.RazonSocial, t.RUC, t.NombreComercial,
		t.DireccionLegal, t.Departamento, t.Provincia, t.Distrito,
		t.Telefono, t.EmailContacto, t.LogoURL, t.Slug, t.SitioWeb,
		t.ColorPrimario, t.PlazoRespuestaDias, t.MensajeConfirmacion,
		t.NotificarWhatsapp, t.NotificarEmail,
		t.NotificarEmailEstado, t.NotificarEmailMensaje, t.NotificarEmailResolucion,
	).Scan(&t.ID, &t.FechaCreacion, &t.FechaActualizacion)
}

func (r *TenantRepo) Update(ctx context.Context, t *model.Tenant) error {
	query := `
		UPDATE configuracion_tenant SET
			razon_social = $1, ruc = $2, nombre_comercial = $3,
			direccion_legal = $4, departamento = $5, provincia = $6, distrito = $7,
			telefono = $8, email_contacto = $9, logo_url = $10, sitio_web = $11,
			color_primario = $12, plazo_respuesta_dias = $13, mensaje_confirmacion = $14,
			notificar_whatsapp = $15, notificar_email = $16,
			notificar_email_estado = $17, notificar_email_mensaje = $18, notificar_email_resolucion = $19,
			firma_representante = $20,
			tema_por_defecto = $21,
			version = version + 1, fecha_actualizacion = $22
		WHERE tenant_id = $23 AND version = $24`

	// IMPORTANTE: Pasamos t.Campo.NullString para asegurar que el driver SQL reciba el tipo estándar
	result, err := r.db.ExecContext(ctx, query,
		t.RazonSocial, t.RUC, t.NombreComercial.NullString,
		t.DireccionLegal.NullString, t.Departamento.NullString, t.Provincia.NullString, t.Distrito.NullString,
		t.Telefono.NullString, t.EmailContacto.NullString, t.LogoURL.NullString, t.SitioWeb.NullString,
		t.ColorPrimario, t.PlazoRespuestaDias, t.MensajeConfirmacion.NullString,
		t.NotificarWhatsapp, t.NotificarEmail,
		t.NotificarEmailEstado, t.NotificarEmailMensaje, t.NotificarEmailResolucion,
		t.FirmaRepresentante.NullString,
		t.TemaPorDefecto,
		time.Now(), t.TenantID, t.Version,
	)
	if err != nil {
		return fmt.Errorf("tenant_repo.Update: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("optimistic_lock")
	}
	return nil
}

// GetByCuentaID retorna todos los tenants de una cuenta.
func (r *TenantRepo) GetByCuentaID(ctx context.Context, cuentaID uuid.UUID) ([]model.TenantResumen, error) {
	query := `
		SELECT tenant_id, razon_social, ruc, slug, logo_url, activo
		FROM configuracion_tenant
		WHERE cuenta_id = $1
		ORDER BY razon_social`

	rows, err := r.db.QueryContext(ctx, query, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("tenant_repo.GetByCuentaID: %w", err)
	}
	defer rows.Close()

	tenants := []model.TenantResumen{}
	for rows.Next() {
		var t model.TenantResumen
		if err := rows.Scan(&t.TenantID, &t.RazonSocial, &t.RUC, &t.Slug, &t.LogoURL, &t.Activo); err != nil {
			return nil, fmt.Errorf("tenant_repo.GetByCuentaID scan: %w", err)
		}
		tenants = append(tenants, t)
	}
	return tenants, rows.Err()
}

// GetByTenantIDs retorna resúmenes de múltiples tenants por sus IDs.
func (r *TenantRepo) GetByTenantIDs(ctx context.Context, ids []uuid.UUID) ([]model.TenantResumen, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	query := `
		SELECT tenant_id, razon_social, ruc, slug, logo_url, activo
		FROM configuracion_tenant
		WHERE tenant_id = ANY($1::UUID[])
		ORDER BY razon_social`

	// Convertir a array de strings para el driver
	strIDs := make([]string, len(ids))
	for i, id := range ids {
		strIDs[i] = id.String()
	}

	rows, err := r.db.QueryContext(ctx, query, fmt.Sprintf("{%s}", joinStrings(strIDs, ",")))
	if err != nil {
		return nil, fmt.Errorf("tenant_repo.GetByTenantIDs: %w", err)
	}
	defer rows.Close()

	tenants := []model.TenantResumen{}
	for rows.Next() {
		var t model.TenantResumen
		if err := rows.Scan(&t.TenantID, &t.RazonSocial, &t.RUC, &t.Slug, &t.LogoURL, &t.Activo); err != nil {
			return nil, fmt.Errorf("tenant_repo.GetByTenantIDs scan: %w", err)
		}
		tenants = append(tenants, t)
	}
	return tenants, rows.Err()
}

// UpdateCuentaID asigna un tenant a una cuenta.
func (r *TenantRepo) UpdateCuentaID(ctx context.Context, tenantID, cuentaID uuid.UUID) error {
	query := `UPDATE configuracion_tenant SET cuenta_id = $1, fecha_actualizacion = $2 WHERE tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, cuentaID, time.Now(), tenantID)
	if err != nil {
		return fmt.Errorf("tenant_repo.UpdateCuentaID: %w", err)
	}
	return nil
}

// SetActivo activa o desactiva un tenant.
func (r *TenantRepo) SetActivo(ctx context.Context, tenantID uuid.UUID, activo bool) error {
	query := `UPDATE configuracion_tenant SET activo = $1, fecha_actualizacion = $2 WHERE tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, activo, time.Now(), tenantID)
	if err != nil {
		return fmt.Errorf("tenant_repo.SetActivo: %w", err)
	}
	return nil
}

// ListAll retorna todos los tenants con métricas (para SuperAdmin).
func (r *TenantRepo) ListAll(ctx context.Context, offset, limit int) ([]model.TenantResumen, int, error) {
	countQuery := `SELECT count(*) FROM configuracion_tenant`
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("tenant_repo.ListAll count: %w", err)
	}

	query := `
		SELECT tenant_id, razon_social, ruc, slug, logo_url, activo
		FROM configuracion_tenant
		ORDER BY razon_social
		LIMIT $1 OFFSET $2`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("tenant_repo.ListAll: %w", err)
	}
	defer rows.Close()

	tenants := []model.TenantResumen{}
	for rows.Next() {
		var t model.TenantResumen
		if err := rows.Scan(&t.TenantID, &t.RazonSocial, &t.RUC, &t.Slug, &t.LogoURL, &t.Activo); err != nil {
			return nil, 0, fmt.Errorf("tenant_repo.ListAll scan: %w", err)
		}
		tenants = append(tenants, t)
	}
	return tenants, total, rows.Err()
}

// joinStrings une strings con un separador (helper interno).
func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}