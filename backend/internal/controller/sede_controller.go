package controller

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/service"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// diasValidos lista los días aceptados para horario de atención.
var diasValidos = map[string]bool{
	"Lunes": true, "Martes": true, "Miercoles": true, "Miércoles": true,
	"Jueves": true, "Viernes": true, "Sabado": true, "Sábado": true, "Domingo": true,
}

// validateSedeFields valida formatos que los binding tags no cubren.
func validateSedeFields(slug, codigoSede, telefono, email, departamento, provincia, distrito, responsableNombre string, horarios []any) string {
	if !helper.ValidateSlug(slug) {
		return "slug inválido (solo minúsculas, números y guiones)"
	}
	if codigoSede != "" && !helper.ValidateCodigoSede(codigoSede) {
		return "código de sede inválido (solo letras, números, guiones y guiones bajos)"
	}
	if telefono != "" && !helper.ValidateTelefono(telefono) {
		return "teléfono inválido (solo dígitos, +, espacios, guiones y paréntesis)"
	}
	if email != "" && !helper.ValidateEmail(email) {
		return "formato de email inválido"
	}
	if departamento != "" && !helper.ValidateOnlyLettersSpaces(departamento) {
		return "departamento solo debe contener letras y espacios"
	}
	if provincia != "" && !helper.ValidateOnlyLettersSpaces(provincia) {
		return "provincia solo debe contener letras y espacios"
	}
	if distrito != "" && !helper.ValidateOnlyLettersSpaces(distrito) {
		return "distrito solo debe contener letras y espacios"
	}
	if responsableNombre != "" && !helper.ValidateOnlyLettersSpaces(responsableNombre) {
		return "nombre del responsable solo debe contener letras y espacios"
	}

	// Validar estructura de horarios
	diasVistos := make(map[string]bool)
	for i, item := range horarios {
		m, ok := item.(map[string]interface{})
		if !ok {
			return fmt.Sprintf("horario[%d]: formato inválido", i)
		}
		dia, _ := m["dia"].(string)
		inicio, _ := m["inicio"].(string)
		fin, _ := m["fin"].(string)
		if dia == "" || inicio == "" || fin == "" {
			return fmt.Sprintf("horario[%d]: dia, inicio y fin son obligatorios", i)
		}
		if !diasValidos[dia] {
			return fmt.Sprintf("horario[%d]: día '%s' no es válido", i, dia)
		}
		if diasVistos[dia] {
			return fmt.Sprintf("horario[%d]: día '%s' está duplicado", i, dia)
		}
		diasVistos[dia] = true
		if !helper.ValidateHora(inicio) || !helper.ValidateHora(fin) {
			return fmt.Sprintf("horario[%d]: formato de hora inválido (use HH:MM)", i)
		}
		if inicio >= fin {
			return fmt.Sprintf("horario[%d]: la hora de inicio debe ser anterior a la de fin", i)
		}
	}
	return ""
}

// sanitizeCreateRequest aplica TrimSpace y escapa HTML en campos de texto libre.
func sanitizeCreateRequest(req *dto.CreateSedeRequest) {
	req.Nombre = helper.SanitizeText(req.Nombre)
	req.Slug = strings.TrimSpace(req.Slug)
	req.CodigoSede = helper.SanitizeText(req.CodigoSede)
	req.Direccion = helper.SanitizeText(req.Direccion)
	req.Departamento = strings.TrimSpace(req.Departamento)
	req.Provincia = strings.TrimSpace(req.Provincia)
	req.Distrito = strings.TrimSpace(req.Distrito)
	req.Referencia = helper.SanitizeText(req.Referencia)
	req.Telefono = strings.TrimSpace(req.Telefono)
	req.Email = strings.TrimSpace(req.Email)
	req.ResponsableNombre = strings.TrimSpace(req.ResponsableNombre)
	req.ResponsableCargo = helper.SanitizeText(req.ResponsableCargo)
}

// sanitizeUpdateRequest aplica TrimSpace y escapa HTML en campos de texto libre.
func sanitizeUpdateRequest(req *dto.UpdateSedeRequest) {
	req.Nombre = helper.SanitizeText(req.Nombre)
	req.Slug = strings.TrimSpace(req.Slug)
	req.CodigoSede = helper.SanitizeText(req.CodigoSede)
	req.Direccion = helper.SanitizeText(req.Direccion)
	req.Departamento = strings.TrimSpace(req.Departamento)
	req.Provincia = strings.TrimSpace(req.Provincia)
	req.Distrito = strings.TrimSpace(req.Distrito)
	req.Referencia = helper.SanitizeText(req.Referencia)
	req.Telefono = strings.TrimSpace(req.Telefono)
	req.Email = strings.TrimSpace(req.Email)
	req.ResponsableNombre = strings.TrimSpace(req.ResponsableNombre)
	req.ResponsableCargo = helper.SanitizeText(req.ResponsableCargo)
}

type SedeController struct {
	sedeService *service.SedeService
}

func NewSedeController(sedeService *service.SedeService) *SedeController {
	return &SedeController{sedeService: sedeService}
}

// GetAll GET /api/v1/sedes
func (ctrl *SedeController) GetAll(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var sedes []model.Sede
	if c.Query("incluir_inactivas") == "true" {
		sedes, err = ctrl.sedeService.GetByTenantAll(c.Request.Context(), tenantID)
	} else {
		sedes, err = ctrl.sedeService.GetByTenant(c.Request.Context(), tenantID)
	}
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, sedes)
}

// GetByID GET /api/v1/sedes/:id
func (ctrl *SedeController) GetByID(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	sedeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de sede inválido")
		return
	}

	sede, err := ctrl.sedeService.GetByID(c.Request.Context(), tenantID, sedeID)
	if err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, sede)
}

// Create POST /api/v1/sedes
func (ctrl *SedeController) Create(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	var req dto.CreateSedeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "Datos inválidos: verifica nombre (3-100), slug (2-50), dirección (5-250) y demás campos")
		return
	}

	if msg := validateSedeFields(req.Slug, req.CodigoSede, req.Telefono, req.Email, req.Departamento, req.Provincia, req.Distrito, req.ResponsableNombre, req.HorarioAtencion); msg != "" {
		helper.ValidationError(c, msg)
		return
	}

	sanitizeCreateRequest(&req)
	sede := ctrl.mapCreateToModel(tenantID, &req)

	if err := ctrl.sedeService.Create(c.Request.Context(), sede); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Created(c, sede)
}

// Update PUT /api/v1/sedes/:id
func (ctrl *SedeController) Update(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	sedeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de sede inválido")
		return
	}

	var req dto.UpdateSedeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helper.ValidationError(c, "Datos inválidos: verifica nombre (3-100), slug (2-50), dirección (5-250) y demás campos")
		return
	}

	if msg := validateSedeFields(req.Slug, req.CodigoSede, req.Telefono, req.Email, req.Departamento, req.Provincia, req.Distrito, req.ResponsableNombre, req.HorarioAtencion); msg != "" {
		helper.ValidationError(c, msg)
		return
	}

	sanitizeUpdateRequest(&req)
	sede := ctrl.mapUpdateToModel(tenantID, sedeID, &req)

	if err := ctrl.sedeService.Update(c.Request.Context(), sede); err != nil {
		helper.Error(c, err)
		return
	}
	helper.Success(c, sede)
}

// Deactivate DELETE /api/v1/sedes/:id
func (ctrl *SedeController) Deactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	sedeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de sede inválido")
		return
	}

	if err := ctrl.sedeService.Deactivate(c.Request.Context(), tenantID, sedeID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.NoContent(c)
}

// Reactivate POST /api/v1/sedes/:id/reactivar
func (ctrl *SedeController) Reactivate(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		helper.Error(c, err)
		return
	}

	sedeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		helper.ValidationError(c, "ID de sede inválido")
		return
	}

	if err := ctrl.sedeService.Reactivate(c.Request.Context(), tenantID, sedeID); err != nil {
		helper.Error(c, err)
		return
	}
	helper.NoContent(c)
}

// ── Helpers de mapeo ──

func (ctrl *SedeController) mapCreateToModel(tenantID uuid.UUID, req *dto.CreateSedeRequest) *model.Sede {
	sede := &model.Sede{
		TenantModel:       model.TenantModel{TenantID: tenantID},
		Nombre:            req.Nombre,
		Slug:              req.Slug,
		CodigoSede:        model.NullString{NullString: sql.NullString{String: req.CodigoSede, Valid: req.CodigoSede != ""}},
		Direccion:         req.Direccion,
		Departamento:      model.NullString{NullString: sql.NullString{String: req.Departamento, Valid: req.Departamento != ""}},
		Provincia:         model.NullString{NullString: sql.NullString{String: req.Provincia, Valid: req.Provincia != ""}},
		Distrito:          model.NullString{NullString: sql.NullString{String: req.Distrito, Valid: req.Distrito != ""}},
		Referencia:        model.NullString{NullString: sql.NullString{String: req.Referencia, Valid: req.Referencia != ""}},
		Telefono:          model.NullString{NullString: sql.NullString{String: req.Telefono, Valid: req.Telefono != ""}},
		Email:             model.NullString{NullString: sql.NullString{String: req.Email, Valid: req.Email != ""}},
		ResponsableNombre: model.NullString{NullString: sql.NullString{String: req.ResponsableNombre, Valid: req.ResponsableNombre != ""}},
		ResponsableCargo:  model.NullString{NullString: sql.NullString{String: req.ResponsableCargo, Valid: req.ResponsableCargo != ""}},
		EsPrincipal:       req.EsPrincipal,
	}

	// HorarioAtencion: JSONB → sql.NullString
	sede.HorarioAtencion = marshalHorario(req.HorarioAtencion)

	// Latitud / Longitud con punteros
	if req.Latitud != nil && *req.Latitud >= -90 && *req.Latitud <= 90 {
		sede.Latitud = model.NullFloat64{NullFloat64: sql.NullFloat64{Float64: *req.Latitud, Valid: true}}
	}
	if req.Longitud != nil && *req.Longitud >= -180 && *req.Longitud <= 180 {
		sede.Longitud = model.NullFloat64{NullFloat64: sql.NullFloat64{Float64: *req.Longitud, Valid: true}}
	}

	return sede
}

func (ctrl *SedeController) mapUpdateToModel(tenantID uuid.UUID, sedeID uuid.UUID, req *dto.UpdateSedeRequest) *model.Sede {
	sede := &model.Sede{
		TenantModel:       model.TenantModel{TenantID: tenantID},
		Nombre:            req.Nombre,
		Slug:              req.Slug,
		CodigoSede:        model.NullString{NullString: sql.NullString{String: req.CodigoSede, Valid: req.CodigoSede != ""}},
		Direccion:         req.Direccion,
		Departamento:      model.NullString{NullString: sql.NullString{String: req.Departamento, Valid: req.Departamento != ""}},
		Provincia:         model.NullString{NullString: sql.NullString{String: req.Provincia, Valid: req.Provincia != ""}},
		Distrito:          model.NullString{NullString: sql.NullString{String: req.Distrito, Valid: req.Distrito != ""}},
		Referencia:        model.NullString{NullString: sql.NullString{String: req.Referencia, Valid: req.Referencia != ""}},
		Telefono:          model.NullString{NullString: sql.NullString{String: req.Telefono, Valid: req.Telefono != ""}},
		Email:             model.NullString{NullString: sql.NullString{String: req.Email, Valid: req.Email != ""}},
		ResponsableNombre: model.NullString{NullString: sql.NullString{String: req.ResponsableNombre, Valid: req.ResponsableNombre != ""}},
		ResponsableCargo:  model.NullString{NullString: sql.NullString{String: req.ResponsableCargo, Valid: req.ResponsableCargo != ""}},
		EsPrincipal:       req.EsPrincipal,
	}
	sede.ID = sedeID

	sede.HorarioAtencion = marshalHorario(req.HorarioAtencion)

	if req.Latitud != nil && *req.Latitud >= -90 && *req.Latitud <= 90 {
		sede.Latitud = model.NullFloat64{NullFloat64: sql.NullFloat64{Float64: *req.Latitud, Valid: true}}
	}
	if req.Longitud != nil && *req.Longitud >= -180 && *req.Longitud <= 180 {
		sede.Longitud = model.NullFloat64{NullFloat64: sql.NullFloat64{Float64: *req.Longitud, Valid: true}}
	}

	return sede
}

// marshalHorario convierte []any a sql.NullString con JSON
func marshalHorario(horario []any) sql.NullString {
	if len(horario) == 0 {
		return sql.NullString{Valid: false}
	}
	b, err := json.Marshal(horario)
	if err != nil {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: string(b), Valid: true}
}