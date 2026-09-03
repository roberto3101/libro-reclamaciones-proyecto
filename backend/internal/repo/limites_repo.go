package repo

import (
	"context"
	"database/sql"
	"fmt"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

// LimitesRepo lee el uso y límites de un tenant desde v_uso_tenant.
// Es la ÚNICA fuente de verdad para validar límites del plan.
type LimitesRepo struct {
	db *sql.DB
}

func NewLimitesRepo(db *sql.DB) *LimitesRepo {
	return &LimitesRepo{db: db}
}

// ObtenerUso retorna el snapshot de uso + límites de un tenant.
// Retorna nil si no tiene suscripción activa.
func (r *LimitesRepo) ObtenerUso(ctx context.Context, tenantID uuid.UUID) (*model.UsoTenant, error) {
	query := `
		SELECT
			tenant_id, plan_id, plan_codigo, plan_nombre,
			suscripcion_id, suscripcion_estado, suscripcion_ciclo, suscripcion_es_trial,
			limite_sedes, limite_usuarios, limite_reclamos_mes,
			limite_chatbots, limite_canales_whatsapp, limite_storage_mb,
			permite_chatbot, permite_whatsapp, permite_email,
			permite_reportes_pdf, permite_exportar_excel, permite_api,
			permite_marca_blanca, permite_multi_idioma, permite_asistente_ia, permite_atencion_vivo,
			uso_sedes, uso_usuarios, uso_reclamos_mes, uso_chatbots, uso_canales_whatsapp
		FROM v_uso_tenant
		WHERE tenant_id = $1`

	u := &model.UsoTenant{}
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(
		&u.TenantID, &u.PlanID, &u.PlanCodigo, &u.PlanNombre,
		&u.SuscripcionID, &u.SuscripcionEstado, &u.SuscripcionCiclo, &u.EsTrial,
		&u.LimiteSedes, &u.LimiteUsuarios, &u.LimiteReclamosMes,
		&u.LimiteChatbots, &u.LimiteCanalesWhatsApp, &u.LimiteStorageMB,
		&u.PermiteChatbot, &u.PermiteWhatsapp, &u.PermiteEmail,
		&u.PermiteReportesPDF, &u.PermiteExportarExcel, &u.PermiteAPI,
	&u.PermiteMarcaBlanca, &u.PermiteMultiIdioma, &u.PermiteAsistenteIA, &u.PermiteAtencionVivo,
		&u.UsoSedes, &u.UsoUsuarios, &u.UsoReclamosMes, &u.UsoChatbots, &u.UsoCanalesWhatsApp,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("limites_repo.ObtenerUso: %w", err)
	}
	return u, nil
}
