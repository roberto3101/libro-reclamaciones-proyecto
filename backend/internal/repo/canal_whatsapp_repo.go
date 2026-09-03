package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type CanalWhatsAppRepo struct {
	db *sql.DB
}

func NewCanalWhatsAppRepo(db *sql.DB) *CanalWhatsAppRepo {
	return &CanalWhatsAppRepo{db: db}
}

// Columnas centralizadas para evitar repetición
const canalWAColumns = `
	tenant_id, id, phone_number_id, display_phone,
	access_token, verify_token, nombre_canal, chatbot_id, activo,
	fecha_creacion, fecha_actualizacion`

func scanCanalWA(scanner interface{ Scan(...interface{}) error }) (*model.CanalWhatsApp, error) {
	c := &model.CanalWhatsApp{}
	err := scanner.Scan(
		&c.TenantID, &c.ID, &c.PhoneNumberID, &c.DisplayPhone,
		&c.AccessToken, &c.VerifyToken, &c.NombreCanal, &c.ChatbotID, &c.Activo,
		&c.FechaCreacion, &c.FechaActualizacion,
	)
	return c, err
}

// GetByPhoneNumberID busca el canal activo asociado a un phone_number_id de Meta.
// Esta es la query clave para resolver tenant dinámicamente en el webhook.
func (r *CanalWhatsAppRepo) GetByPhoneNumberID(ctx context.Context, phoneNumberID string) (*model.CanalWhatsApp, error) {
	query := `SELECT ` + canalWAColumns + `
		FROM canales_whatsapp
		WHERE phone_number_id = $1 AND activo = true
		LIMIT 1`

	c, err := scanCanalWA(r.db.QueryRowContext(ctx, query, phoneNumberID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("canal_whatsapp_repo.GetByPhoneNumberID: %w", err)
	}
	return c, nil
}

// GetByTenant retorna todos los canales WhatsApp de un tenant.
func (r *CanalWhatsAppRepo) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]model.CanalWhatsApp, error) {
	query := `SELECT ` + canalWAColumns + `
		FROM canales_whatsapp
		WHERE tenant_id = $1
		ORDER BY activo DESC, fecha_creacion DESC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("canal_whatsapp_repo.GetByTenant: %w", err)
	}
	defer rows.Close()

	var canales []model.CanalWhatsApp
	for rows.Next() {
		c, err := scanCanalWA(rows)
		if err != nil {
			return nil, fmt.Errorf("canal_whatsapp_repo.scan: %w", err)
		}
		canales = append(canales, *c)
	}
	return canales, rows.Err()
}

// GetByID retorna un canal específico de un tenant.
func (r *CanalWhatsAppRepo) GetByID(ctx context.Context, tenantID, canalID uuid.UUID) (*model.CanalWhatsApp, error) {
	query := `SELECT ` + canalWAColumns + `
		FROM canales_whatsapp
		WHERE tenant_id = $1 AND id = $2`

	c, err := scanCanalWA(r.db.QueryRowContext(ctx, query, tenantID, canalID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("canal_whatsapp_repo.GetByID: %w", err)
	}
	return c, nil
}

// Create inserta un nuevo canal WhatsApp para un tenant.
func (r *CanalWhatsAppRepo) Create(ctx context.Context, c *model.CanalWhatsApp) error {
	query := `
		INSERT INTO canales_whatsapp (
			tenant_id, phone_number_id, display_phone,
			access_token, verify_token, nombre_canal, chatbot_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, activo, fecha_creacion, fecha_actualizacion`

	return r.db.QueryRowContext(ctx, query,
		c.TenantID, c.PhoneNumberID, c.DisplayPhone,
		c.AccessToken, c.VerifyToken, c.NombreCanal, c.ChatbotID,
	).Scan(&c.ID, &c.Activo, &c.FechaCreacion, &c.FechaActualizacion)
}

// Update actualiza los campos editables de un canal.
func (r *CanalWhatsAppRepo) Update(ctx context.Context, c *model.CanalWhatsApp) error {
	query := `
		UPDATE canales_whatsapp SET
			phone_number_id = $1, display_phone = $2,
			access_token = $3, verify_token = $4,
			nombre_canal = $5, chatbot_id = $6, activo = $7,
			fecha_actualizacion = $8
		WHERE tenant_id = $9 AND id = $10`

	_, err := r.db.ExecContext(ctx, query,
		c.PhoneNumberID, c.DisplayPhone,
		c.AccessToken, c.VerifyToken,
		c.NombreCanal, c.ChatbotID, c.Activo,
		time.Now(), c.TenantID, c.ID,
	)
	if err != nil {
		return fmt.Errorf("canal_whatsapp_repo.Update: %w", err)
	}
	return nil
}

// Deactivate desactiva un canal (soft delete).
func (r *CanalWhatsAppRepo) Deactivate(ctx context.Context, tenantID, canalID uuid.UUID) error {
	query := `UPDATE canales_whatsapp SET activo = false, fecha_actualizacion = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, canalID)
	if err != nil {
		return fmt.Errorf("canal_whatsapp_repo.Deactivate: %w", err)
	}
	return nil
}