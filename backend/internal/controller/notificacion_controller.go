package controller

import (
	"net/http"
	"strconv"
	"time"

	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificacionController struct {
	notifRepo  *repo.NotificacionRepo
	configRepo *repo.ConfiguracionNotificacionRepo
}

func NewNotificacionController(notifRepo *repo.NotificacionRepo, configRepo *repo.ConfiguracionNotificacionRepo) *NotificacionController {
	return &NotificacionController{
		notifRepo:  notifRepo,
		configRepo: configRepo,
	}
}

// ListarNotificaciones lista las notificaciones paginadas del usuario autenticado.
func (ctrl *NotificacionController) ListarNotificaciones(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id inválido"})
		return
	}
	usuarioID, err := helper.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return
	}

	limite, _ := strconv.Atoi(c.DefaultQuery("limite", "20"))
	if limite <= 0 || limite > 100 {
		limite = 20
	}

	soloNoLeidas := c.Query("solo_no_leidas") == "true"
	tipo := c.Query("tipo")

	var cursor *time.Time
	if cursorStr := c.Query("cursor"); cursorStr != "" {
		t, err := time.Parse(time.RFC3339Nano, cursorStr)
		if err != nil {
			t, err = time.Parse(time.RFC3339, cursorStr)
		}
		if err == nil {
			cursor = &t
		}
	}

	notificaciones, err := ctrl.notifRepo.ListarPorUsuarioPaginado(tenantID, usuarioID, limite+1, cursor, soloNoLeidas, tipo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error listando notificaciones"})
		return
	}

	tieneMas := len(notificaciones) > limite
	if tieneMas {
		notificaciones = notificaciones[:limite]
	}

	var siguienteCursor *string
	if tieneMas && len(notificaciones) > 0 {
		s := notificaciones[len(notificaciones)-1].FechaCreacion.Format(time.RFC3339Nano)
		siguienteCursor = &s
	}

	totalSinLeer, _ := ctrl.notifRepo.ContarNoLeidasPorUsuario(tenantID, usuarioID)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"notificaciones":   notificaciones,
			"siguiente_cursor": siguienteCursor,
			"tiene_mas":        tieneMas,
			"total_sin_leer":   totalSinLeer,
		},
	})
}

// ContarNoLeidas retorna el total de notificaciones sin leer.
func (ctrl *NotificacionController) ContarNoLeidas(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id inválido"})
		return
	}
	usuarioID, err := helper.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return
	}

	total, err := ctrl.notifRepo.ContarNoLeidasPorUsuario(tenantID, usuarioID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error contando notificaciones"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"total": total}})
}

// MarcarComoLeida marca una notificación como leída (solo si pertenece al usuario autenticado).
func (ctrl *NotificacionController) MarcarComoLeida(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id inválido"})
		return
	}
	usuarioID, err := helper.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return
	}
	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	if err := ctrl.notifRepo.MarcarComoLeida(tenantID, usuarioID, notifID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error marcando como leída"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"mensaje": "Notificación marcada como leída"}})
}

// MarcarTodasComoLeidas marca todas las notificaciones del usuario como leídas.
func (ctrl *NotificacionController) MarcarTodasComoLeidas(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id inválido"})
		return
	}
	usuarioID, err := helper.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return
	}

	afectadas, err := ctrl.notifRepo.MarcarTodasComoLeidas(tenantID, usuarioID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error marcando como leídas"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"mensaje": "Notificaciones marcadas como leídas", "afectadas": afectadas}})
}

// ObtenerDefinicionTiposNotificacion retorna los tipos disponibles para la UI de configuración.
func (ctrl *NotificacionController) ObtenerDefinicionTiposNotificacion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": model.DefinicionTiposNotificacion{
			Tipos:     model.TodosLosTiposNotificacion,
			Etiquetas: model.EtiquetasTipoNotificacion,
			Modulos:   model.ModuloRequeridoPorTipoNotificacion,
		},
	})
}

// ObtenerConfiguracionPorRol retorna la configuración de notificaciones de un rol.
func (ctrl *NotificacionController) ObtenerConfiguracionPorRol(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id inválido"})
		return
	}
	rolID, err := uuid.Parse(c.Param("rolId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de rol inválido"})
		return
	}

	configs, err := ctrl.configRepo.ObtenerPorRol(tenantID, rolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error obteniendo configuración"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": configs})
}

// ActualizarConfiguracionPorRol actualiza la configuración de notificaciones de un rol.
func (ctrl *NotificacionController) ActualizarConfiguracionPorRol(c *gin.Context) {
	tenantID, err := helper.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id inválido"})
		return
	}
	rolID, err := uuid.Parse(c.Param("rolId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de rol inválido"})
		return
	}

	var body struct {
		Configuraciones []struct {
			TipoNotificacion string `json:"tipo_notificacion"`
			Habilitado       bool   `json:"habilitado"`
		} `json:"configuraciones" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Formato inválido"})
		return
	}

	configs := make(map[model.TipoNotificacion]bool)
	for _, item := range body.Configuraciones {
		tipo := model.TipoNotificacion(item.TipoNotificacion)
		if _, valido := model.ModuloRequeridoPorTipoNotificacion[tipo]; !valido {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de notificación inválido: " + item.TipoNotificacion})
			return
		}
		configs[tipo] = item.Habilitado
	}

	if err := ctrl.configRepo.UpsertMultiplesConfiguraciones(tenantID, rolID, configs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error actualizando configuración"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"mensaje": "Configuración actualizada"}})
}
