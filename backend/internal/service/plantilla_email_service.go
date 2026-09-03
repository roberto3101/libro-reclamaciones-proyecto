package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

// PlantillaEmailService gestiona la lógica de negocio de plantillas de email.
type PlantillaEmailService struct {
	plantillaRepo *repo.PlantillaEmailRepo
}

// NewPlantillaEmailService crea una nueva instancia del servicio.
func NewPlantillaEmailService(plantillaRepo *repo.PlantillaEmailRepo) *PlantillaEmailService {
	return &PlantillaEmailService{plantillaRepo: plantillaRepo}
}

// ListarPorTenant retorna todas las plantillas del tenant.
// Si no existen, las crea con los valores por defecto (seed automático).
func (s *PlantillaEmailService) ListarPorTenant(ctx context.Context, tenantID uuid.UUID) ([]model.PlantillaEmail, error) {
	// Verificar si el tenant ya tiene plantillas, sino seedear
	existe, err := s.plantillaRepo.ExistsByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_service.ListarPorTenant: %w", err)
	}

	if !existe {
		if err := s.seedPlantillas(ctx, tenantID); err != nil {
			return nil, fmt.Errorf("plantilla_email_service.ListarPorTenant (seed): %w", err)
		}
	}

	plantillas, err := s.plantillaRepo.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_service.ListarPorTenant: %w", err)
	}
	return plantillas, nil
}

// ObtenerPorID retorna una plantilla por su ID.
func (s *PlantillaEmailService) ObtenerPorID(ctx context.Context, tenantID, plantillaID uuid.UUID) (*model.PlantillaEmail, error) {
	p, err := s.plantillaRepo.GetByID(ctx, tenantID, plantillaID)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_service.ObtenerPorID: %w", err)
	}
	if p == nil {
		return nil, apperror.ErrNotFound
	}
	return p, nil
}

// ObtenerPorTipoEvento retorna la plantilla de un tipo de evento (usado por notificacion_service).
func (s *PlantillaEmailService) ObtenerPorTipoEvento(ctx context.Context, tenantID uuid.UUID, tipoEvento string) (*model.PlantillaEmail, error) {
	p, err := s.plantillaRepo.GetByTipoEvento(ctx, tenantID, tipoEvento)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_service.ObtenerPorTipoEvento: %w", err)
	}
	return p, nil
}

// Actualizar actualiza los textos de una plantilla.
func (s *PlantillaEmailService) Actualizar(ctx context.Context, tenantID, plantillaID uuid.UUID, req dto.ActualizarPlantillaEmailRequest) (*model.PlantillaEmail, error) {
	p, err := s.plantillaRepo.GetByID(ctx, tenantID, plantillaID)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_service.Actualizar: %w", err)
	}
	if p == nil {
		return nil, apperror.ErrNotFound
	}

	// Sanitizar: eliminar tags HTML
	asunto := sanitizarTexto(strings.TrimSpace(req.Asunto))
	saludo := sanitizarTexto(strings.TrimSpace(req.Saludo))
	cuerpo := sanitizarTexto(strings.TrimSpace(req.CuerpoPrincipal))
	pie := sanitizarTexto(strings.TrimSpace(req.TextoPie))
	boton := sanitizarTexto(strings.TrimSpace(req.TextoBoton))

	// Validar longitudes
	if len(asunto) < 5 {
		return nil, apperror.New(400, "ASUNTO_MUY_CORTO", "El asunto debe tener al menos 5 caracteres")
	}
	if len(asunto) > 200 {
		return nil, apperror.New(400, "ASUNTO_MUY_LARGO", "El asunto no puede exceder 200 caracteres")
	}
	if len(cuerpo) < 5 {
		return nil, apperror.New(400, "CUERPO_MUY_CORTO", "El cuerpo debe tener al menos 5 caracteres")
	}
	if len(cuerpo) > 2000 {
		return nil, apperror.New(400, "CUERPO_MUY_LARGO", "El cuerpo no puede exceder 2000 caracteres")
	}

	// Validar que las variables usadas sean permitidas
	variablesPermitidas := p.VariablesPermitidas
	if err := validarVariables(asunto, variablesPermitidas); err != nil {
		return nil, apperror.New(400, "VARIABLE_NO_PERMITIDA", "Asunto: "+err.Error())
	}
	if err := validarVariables(saludo, variablesPermitidas); err != nil {
		return nil, apperror.New(400, "VARIABLE_NO_PERMITIDA", "Saludo: "+err.Error())
	}
	if err := validarVariables(cuerpo, variablesPermitidas); err != nil {
		return nil, apperror.New(400, "VARIABLE_NO_PERMITIDA", "Cuerpo: "+err.Error())
	}
	if err := validarVariables(pie, variablesPermitidas); err != nil {
		return nil, apperror.New(400, "VARIABLE_NO_PERMITIDA", "Pie: "+err.Error())
	}

	p.Asunto = asunto
	p.Saludo = saludo
	p.CuerpoPrincipal = cuerpo
	p.TextoPie = pie
	p.TextoBoton = boton

	if req.Activa != nil {
		p.Activa = *req.Activa
	}

	if err := s.plantillaRepo.Update(ctx, p); err != nil {
		return nil, fmt.Errorf("plantilla_email_service.Actualizar: %w", err)
	}
	return p, nil
}

// RestaurarDefecto restaura una plantilla a sus valores por defecto.
func (s *PlantillaEmailService) RestaurarDefecto(ctx context.Context, tenantID, plantillaID uuid.UUID) (*model.PlantillaEmail, error) {
	p, err := s.plantillaRepo.GetByID(ctx, tenantID, plantillaID)
	if err != nil {
		return nil, fmt.Errorf("plantilla_email_service.RestaurarDefecto: %w", err)
	}
	if p == nil {
		return nil, apperror.ErrNotFound
	}

	// Buscar la definición por defecto de este tipo
	defaults := model.DefinicionPlantillasEmail()
	var defecto *model.PlantillaEmail
	for _, d := range defaults {
		if d.TipoEvento == p.TipoEvento {
			defecto = &d
			break
		}
	}
	if defecto == nil {
		return nil, apperror.New(400, "TIPO_EVENTO_INVALIDO", "Tipo de evento no reconocido")
	}

	p.Asunto = defecto.Asunto
	p.Saludo = defecto.Saludo
	p.CuerpoPrincipal = defecto.CuerpoPrincipal
	p.TextoPie = defecto.TextoPie
	p.TextoBoton = defecto.TextoBoton
	p.Activa = true

	if err := s.plantillaRepo.Update(ctx, p); err != nil {
		return nil, fmt.Errorf("plantilla_email_service.RestaurarDefecto: %w", err)
	}
	return p, nil
}

// ── Helpers internos ──

// seedPlantillas crea las 5 plantillas por defecto para un tenant.
func (s *PlantillaEmailService) seedPlantillas(ctx context.Context, tenantID uuid.UUID) error {
	defaults := model.DefinicionPlantillasEmail()
	for _, d := range defaults {
		d.TenantID = tenantID
		if err := s.plantillaRepo.Upsert(ctx, &d); err != nil {
			return fmt.Errorf("seed plantilla %s: %w", d.TipoEvento, err)
		}
	}
	return nil
}

// regHTML detecta tags HTML.
var regHTML = regexp.MustCompile(`<[^>]+>`)

// regVariable detecta variables {{nombre}}.
var regVariable = regexp.MustCompile(`\{\{(\w+)\}\}`)

// sanitizarTexto elimina tags HTML del texto.
func sanitizarTexto(texto string) string {
	return regHTML.ReplaceAllString(texto, "")
}

// validarVariables verifica que todas las variables usadas en el texto estén permitidas.
func validarVariables(texto string, permitidas []string) error {
	matches := regVariable.FindAllStringSubmatch(texto, -1)
	permitidoSet := make(map[string]bool)
	for _, v := range permitidas {
		permitidoSet[v] = true
	}

	for _, match := range matches {
		if len(match) > 1 && !permitidoSet[match[1]] {
			return fmt.Errorf("la variable {{%s}} no está permitida para este tipo de plantilla", match[1])
		}
	}
	return nil
}

// ReemplazarVariables reemplaza las variables {{nombre}} con los valores proporcionados.
func ReemplazarVariables(texto string, variables map[string]string) string {
	result := texto
	for clave, valor := range variables {
		result = strings.ReplaceAll(result, "{{"+clave+"}}", valor)
	}
	return result
}
