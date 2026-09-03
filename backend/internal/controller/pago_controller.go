package controller

import (
	"encoding/json"
	"io"
	"net/http"

	"libro-reclamaciones/internal/apperror"
	"libro-reclamaciones/internal/helper"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
)

type PagoController struct {
	pagoService *service.PagoService
	culqi       *service.CulqiClient
}

func NewPagoController(pagoService *service.PagoService, culqi *service.CulqiClient) *PagoController {
	return &PagoController{pagoService: pagoService, culqi: culqi}
}

// GetConfig entrega al frontend lo que necesita para montar el checkout.
// La llave pública es pública por diseño; la secreta nunca sale de acá.
// GET /api/v1/pagos/config
func (c *PagoController) GetConfig(ctx *gin.Context) {
	helper.Success(ctx, gin.H{
		"moneda": "PEN",
		"culqi": gin.H{
			"habilitado":    c.pagoService.CulqiHabilitado(),
			"llave_publica": c.pagoService.LlavePublica(),
		},
		"mercadopago": gin.H{
			"habilitado":    c.pagoService.MPHabilitado(),
			"llave_publica": c.pagoService.LlavePublicaMP(),
			"recurrente":    true,
		},
	})
}

type suscribirMPReq struct {
	PlanCodigo   string `json:"plan_codigo" binding:"required"`
	Ciclo        string `json:"ciclo" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	TokenTarjeta string `json:"token_tarjeta"`
	URLRetorno   string `json:"url_retorno"`
}

// SuscribirMercadoPago da de alta el cobro recurrente.
// Mercado Pago cobra cada ciclo por su cuenta y reintenta si la tarjeta rebota.
// POST /api/v1/pagos/suscripcion
func (c *PagoController) SuscribirMercadoPago(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	var req suscribirMPReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		helper.Error(ctx, apperror.New(http.StatusBadRequest, "DATOS_INVALIDOS",
			"Falta el plan, el ciclo o un correo válido."))
		return
	}

	usuarioID, _ := helper.GetUserID(ctx)

	pago, initPoint, err := c.pagoService.SuscribirConMercadoPago(ctx.Request.Context(), service.SuscribirMPParams{
		TenantID:     tenantID,
		UsuarioID:    usuarioID,
		PlanCodigo:   req.PlanCodigo,
		Ciclo:        req.Ciclo,
		Email:        req.Email,
		TokenTarjeta: req.TokenTarjeta,
		URLRetorno:   req.URLRetorno,
	})
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, gin.H{
		"pago":       pago,
		"init_point": initPoint,
	})
}

type cobrarTarjetaReq struct {
	TokenID    string `json:"token_id" binding:"required"`
	PlanCodigo string `json:"plan_codigo" binding:"required"`
	Ciclo      string `json:"ciclo" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
}

// CobrarTarjeta ejecuta el cargo contra la tarjeta ya tokenizada.
// El número de tarjeta jamás pasa por nuestro servidor: el navegador se lo
// entrega a Culqi y acá solo llega un token de un solo uso.
// POST /api/v1/pagos/tarjeta
func (c *PagoController) CobrarTarjeta(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	var req cobrarTarjetaReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		helper.Error(ctx, apperror.New(http.StatusBadRequest, "DATOS_INVALIDOS",
			"Falta el token de la tarjeta, el plan, el ciclo o un correo válido."))
		return
	}

	usuarioID, _ := helper.GetUserID(ctx)

	pago, err := c.pagoService.CobrarConTarjeta(ctx.Request.Context(), service.CobrarTarjetaParams{
		TenantID:   tenantID,
		UsuarioID:  usuarioID,
		TokenID:    req.TokenID,
		PlanCodigo: req.PlanCodigo,
		Ciclo:      req.Ciclo,
		Email:      req.Email,
	})
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, pago)
}

type pagoManualReq struct {
	Proveedor  string `json:"proveedor" binding:"required"` // YAPE | TRANSFERENCIA | MANUAL
	Referencia string `json:"referencia"`
	PlanCodigo string `json:"plan_codigo" binding:"required"`
	Ciclo      string `json:"ciclo" binding:"required"`
	Email      string `json:"email"`
	Notas      string `json:"notas"`
}

// RegistrarManual anota un pago hecho por fuera de la pasarela y activa el plan.
// Es la vía para cobrar por Yape o transferencia sin depender de Culqi.
// POST /api/v1/admin/pagos/manual
func (c *PagoController) RegistrarManual(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	var req pagoManualReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		helper.Error(ctx, apperror.New(http.StatusBadRequest, "DATOS_INVALIDOS",
			"Falta el proveedor, el plan o el ciclo."))
		return
	}

	usuarioID, _ := helper.GetUserID(ctx)

	pago, err := c.pagoService.RegistrarPagoManual(ctx.Request.Context(), service.RegistrarManualParams{
		TenantID:   tenantID,
		UsuarioID:  usuarioID,
		Proveedor:  req.Proveedor,
		Referencia: req.Referencia,
		PlanCodigo: req.PlanCodigo,
		Ciclo:      req.Ciclo,
		Email:      req.Email,
		Notas:      req.Notas,
	})
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, pago)
}

// Historial lista los pagos del tenant.
// GET /api/v1/pagos
func (c *PagoController) Historial(ctx *gin.Context) {
	tenantID, err := helper.GetTenantID(ctx)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	pagos, err := c.pagoService.ListarPorTenant(ctx.Request.Context(), tenantID, 50)
	if err != nil {
		helper.Error(ctx, err)
		return
	}

	helper.Success(ctx, pagos)
}

// Webhook recibe los eventos de Culqi.
//
// Responde 200 salvo que la firma no cuadre. Cualquier otro código hace que
// Culqi reintente, y un reintento sobre un evento ya procesado es justo lo
// que la tabla pagos_eventos evita.
// POST /webhook/culqi
func (c *PagoController) Webhook(ctx *gin.Context) {
	cuerpo, err := io.ReadAll(io.LimitReader(ctx.Request.Body, 1<<20))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "cuerpo ilegible"})
		return
	}

	firma := ctx.GetHeader("X-Culqi-Signature")
	if !c.culqi.VerificarFirmaWebhook(cuerpo, firma) {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "firma inválida"})
		return
	}

	var evento struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(cuerpo, &evento); err != nil {
		// Malformado: aceptamos para que no reintente eternamente, pero no procesamos.
		ctx.JSON(http.StatusOK, gin.H{"recibido": false, "motivo": "json inválido"})
		return
	}

	eventoID := evento.ID
	if eventoID == "" {
		eventoID = evento.Data.ID
	}

	procesado, err := c.pagoService.ProcesarEventoWebhook(
		ctx.Request.Context(), eventoID, evento.Type, cuerpo,
	)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"recibido": true, "procesado": false})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"recibido": true, "procesado": procesado})
}
