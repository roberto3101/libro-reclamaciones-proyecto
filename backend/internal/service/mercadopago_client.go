package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"libro-reclamaciones/internal/config"
)

// MercadoPagoClient habla con la API de Mercado Pago.
//
// A diferencia de Culqi, acá NO cobramos nosotros cada mes: creamos una
// suscripción (preapproval) y Mercado Pago se encarga de cobrarla en cada
// ciclo y de reintentar cuando una tarjeta rebota. Esa es toda la razón de
// haber elegido esta integración.
//
// Los montos van en unidades de moneda (soles con decimales), no en céntimos
// como Culqi. Es fácil equivocarse al saltar de una a otra.
type MercadoPagoClient struct {
	cfg  config.MercadoPagoConfig
	http *http.Client
}

func NewMercadoPagoClient(cfg config.MercadoPagoConfig) *MercadoPagoClient {
	return &MercadoPagoClient{
		cfg:  cfg,
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *MercadoPagoClient) Habilitado() bool  { return c.cfg.Enabled }
func (c *MercadoPagoClient) PublicKey() string { return c.cfg.PublicKey }

// Frecuencias admitidas por Mercado Pago.
const (
	MPFrecuenciaMensual = "months"
	MPFrecuenciaAnual   = "years"
)

// CrearSuscripcionRequest son los datos para dar de alta un cobro recurrente.
type CrearSuscripcionRequest struct {
	Motivo            string  // Lo que el cliente verá en su estado de cuenta
	EmailPagador      string  // Debe existir en Mercado Pago
	MontoSoles        float64 // Por ciclo
	Frecuencia        int     // 1 = cada mes (o cada año, según TipoFrecuencia)
	TipoFrecuencia    string  // months | years
	TokenTarjeta      string  // Generado en el navegador por el SDK de MP
	URLRetorno        string  // A dónde vuelve el cliente al terminar
	ReferenciaExterna string  // tenant_id, para conciliar
}

// SuscripcionMP es la parte de la respuesta que nos importa.
type SuscripcionMP struct {
	ID                string `json:"id"`
	Status            string `json:"status"`
	InitPoint         string `json:"init_point"`
	PayerID           int64  `json:"payer_id"`
	ExternalReference string `json:"external_reference"`
	NextPaymentDate   string `json:"next_payment_date"`
	Bruto             []byte `json:"-"`
}

// MPError es un rechazo de Mercado Pago ya traducido.
type MPError struct {
	Status  int
	Mensaje string `json:"message"`
	Error_  string `json:"error"`
	Causas  []struct {
		Codigo      any    `json:"code"`
		Descripcion string `json:"description"`
	} `json:"cause"`
}

func (e *MPError) Error() string {
	if len(e.Causas) > 0 && e.Causas[0].Descripcion != "" {
		return fmt.Sprintf("mercadopago[%d]: %s", e.Status, e.Causas[0].Descripcion)
	}
	if e.Mensaje != "" {
		return fmt.Sprintf("mercadopago[%d]: %s", e.Status, e.Mensaje)
	}
	return fmt.Sprintf("mercadopago: error %d", e.Status)
}

// EsProblemaDeConfiguracion distingue un error nuestro (payload mal armado,
// credenciales, URLs inválidas) de un rechazo real de la tarjeta del cliente.
//
// Mercado Pago manda los rechazos de tarjeta dentro de "cause"; los errores de
// integración vienen solo con "message". Confundirlos hace que un bug de
// configuración se le muestre al cliente como "revisa tu tarjeta", que fue
// exactamente lo que pasó la primera vez que probamos esto.
func (e *MPError) EsProblemaDeConfiguracion() bool {
	return len(e.Causas) == 0
}

// ParaCliente devuelve un mensaje presentable en pantalla.
func (e *MPError) ParaCliente() string {
	if len(e.Causas) > 0 && e.Causas[0].Descripcion != "" {
		return e.Causas[0].Descripcion
	}
	// Sin "cause" el fallo es nuestro, no de su tarjeta: no lo culpemos.
	return "No pudimos activar la suscripción en este momento. Vuelve a intentarlo en unos minutos."
}

// CrearSuscripcion da de alta el cobro recurrente.
func (c *MercadoPagoClient) CrearSuscripcion(ctx context.Context, req CrearSuscripcionRequest) (*SuscripcionMP, error) {
	if !c.cfg.Enabled {
		return nil, fmt.Errorf("mercadopago: falta MP_ACCESS_TOKEN")
	}

	cuerpo := map[string]any{
		"reason":             recortar(req.Motivo, 255),
		"payer_email":        req.EmailPagador,
		"back_url":           req.URLRetorno,
		"external_reference": req.ReferenciaExterna,
		"status":             "authorized", // cobra de inmediato el primer ciclo
		"auto_recurring": map[string]any{
			"frequency":          req.Frecuencia,
			"frequency_type":     req.TipoFrecuencia,
			"transaction_amount": req.MontoSoles,
			"currency_id":        "PEN",
		},
	}
	if req.TokenTarjeta != "" {
		cuerpo["card_token_id"] = req.TokenTarjeta
	}

	var out SuscripcionMP
	crudo, err := c.pedir(ctx, http.MethodPost, "/preapproval", cuerpo, &out)
	if err != nil {
		return nil, err
	}
	out.Bruto = crudo
	return &out, nil
}

// ObtenerSuscripcion consulta el estado actual de una suscripción.
func (c *MercadoPagoClient) ObtenerSuscripcion(ctx context.Context, id string) (*SuscripcionMP, error) {
	var out SuscripcionMP
	crudo, err := c.pedir(ctx, http.MethodGet, "/preapproval/"+id, nil, &out)
	if err != nil {
		return nil, err
	}
	out.Bruto = crudo
	return &out, nil
}

// CancelarSuscripcion detiene los cobros futuros.
func (c *MercadoPagoClient) CancelarSuscripcion(ctx context.Context, id string) error {
	_, err := c.pedir(ctx, http.MethodPut, "/preapproval/"+id,
		map[string]any{"status": "cancelled"}, nil)
	return err
}

// pedir centraliza el transporte HTTP contra la API.
func (c *MercadoPagoClient) pedir(ctx context.Context, metodo, ruta string, cuerpo any, destino any) ([]byte, error) {
	var lector io.Reader
	if cuerpo != nil {
		b, err := json.Marshal(cuerpo)
		if err != nil {
			return nil, fmt.Errorf("mercadopago: no se pudo serializar: %w", err)
		}
		lector = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, metodo, c.cfg.APIURL+ruta, lector)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mercadopago: no se pudo contactar la pasarela: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("mercadopago: respuesta ilegible: %w", err)
	}

	if resp.StatusCode >= 400 {
		me := &MPError{Status: resp.StatusCode}
		_ = json.Unmarshal(body, me)
		return nil, me
	}

	if destino != nil {
		if err := json.Unmarshal(body, destino); err != nil {
			return nil, fmt.Errorf("mercadopago: respuesta inesperada: %w", err)
		}
	}
	return body, nil
}

// VerificarFirmaWebhook valida la cabecera x-signature de Mercado Pago.
//
// MP firma con el patrón "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
// usando HMAC-SHA256 y la clave secreta del webhook. La cabecera llega como
// "ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8c1aa1..."
//
// Si MP_WEBHOOK_SECRET está vacío la verificación se omite: úsalo solo en
// pruebas locales, nunca en producción.
func (c *MercadoPagoClient) VerificarFirmaWebhook(xSignature, xRequestID, dataID string) bool {
	if c.cfg.WebhookSecret == "" {
		return true
	}
	if xSignature == "" {
		return false
	}

	var ts, v1 string
	for _, parte := range strings.Split(xSignature, ",") {
		kv := strings.SplitN(strings.TrimSpace(parte), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch strings.TrimSpace(kv[0]) {
		case "ts":
			ts = strings.TrimSpace(kv[1])
		case "v1":
			v1 = strings.TrimSpace(kv[1])
		}
	}
	if ts == "" || v1 == "" {
		return false
	}

	plantilla := fmt.Sprintf("id:%s;request-id:%s;ts:%s;",
		strings.ToLower(dataID), xRequestID, ts)

	mac := hmac.New(sha256.New, []byte(c.cfg.WebhookSecret))
	mac.Write([]byte(plantilla))
	esperada := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(esperada), []byte(v1))
}
