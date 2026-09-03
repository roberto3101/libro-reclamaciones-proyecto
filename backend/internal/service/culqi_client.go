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
	"time"

	"libro-reclamaciones/internal/config"
)

// CulqiClient habla con la API de Culqi.
//
// Culqi maneja los montos en CÉNTIMOS enteros: S/ 29,00 se envía como 2900.
// Mandar 29 cobraría 29 céntimos, así que la conversión es responsabilidad
// de este cliente y de nadie más.
type CulqiClient struct {
	cfg  config.CulqiConfig
	http *http.Client
}

func NewCulqiClient(cfg config.CulqiConfig) *CulqiClient {
	return &CulqiClient{
		cfg: cfg,
		// Culqi puede tardar: la autorización pasa por la marca y el banco.
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *CulqiClient) Habilitado() bool {
	return c.cfg.Enabled
}

// PublicKey es la llave que el navegador necesita para tokenizar la tarjeta.
// Es pública por diseño: no expone nada.
func (c *CulqiClient) PublicKey() string {
	return c.cfg.PublicKey
}

// CargoRequest es lo que necesitamos para cobrar.
type CargoRequest struct {
	TokenID     string            // tkn_xxx generado por Culqi.js en el navegador
	MontoSoles  float64           // En soles; acá se convierte a céntimos
	Email       string            // Culqi lo exige y ahí manda el comprobante
	Descripcion string            // Aparece en el estado de cuenta del cliente
	Metadata    map[string]string // tenant_id, plan, ciclo — para conciliar después
}

// CargoResponse es la parte de la respuesta de Culqi que nos interesa.
type CargoResponse struct {
	ID            string `json:"id"`
	Object        string `json:"object"`
	Amount        int    `json:"amount"`
	CurrencyCode  string `json:"currency_code"`
	ReferenceCode string `json:"reference_code"`
	Outcome       struct {
		Type            string `json:"type"`
		Code            string `json:"code"`
		MerchantMessage string `json:"merchant_message"`
		UserMessage     string `json:"user_message"`
	} `json:"outcome"`
	Bruto []byte `json:"-"` // Respuesta cruda, para guardar en pagos.payload
}

// CulqiError es un rechazo de Culqi ya traducido.
// UserMessage viene redactado por Culqi para mostrarse tal cual al cliente.
type CulqiError struct {
	Status      int
	Tipo        string `json:"type"`
	Codigo      string `json:"code"`
	MsgComercio string `json:"merchant_message"`
	MsgUsuario  string `json:"user_message"`
}

func (e *CulqiError) Error() string {
	if e.MsgComercio != "" {
		return fmt.Sprintf("culqi[%s/%s]: %s", e.Tipo, e.Codigo, e.MsgComercio)
	}
	return fmt.Sprintf("culqi: error %d", e.Status)
}

// ParaCliente devuelve un mensaje seguro de mostrar en pantalla.
func (e *CulqiError) ParaCliente() string {
	if e.MsgUsuario != "" {
		return e.MsgUsuario
	}
	return "No pudimos procesar el pago. Verifica los datos de tu tarjeta o intenta con otra."
}

// CrearCargo ejecuta el cobro contra la tarjeta tokenizada.
func (c *CulqiClient) CrearCargo(ctx context.Context, req CargoRequest) (*CargoResponse, error) {
	if !c.cfg.Enabled {
		return nil, fmt.Errorf("culqi: no hay CULQI_SECRET_KEY configurada")
	}

	cuerpo := map[string]any{
		"amount":        aCentimos(req.MontoSoles),
		"currency_code": "PEN",
		"email":         req.Email,
		"source_id":     req.TokenID,
		"description":   recortar(req.Descripcion, 80),
	}
	if len(req.Metadata) > 0 {
		cuerpo["metadata"] = req.Metadata
	}

	crudo, err := json.Marshal(cuerpo)
	if err != nil {
		return nil, fmt.Errorf("culqi: no se pudo serializar el cargo: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx, http.MethodPost, c.cfg.APIURL+"/charges", bytes.NewReader(crudo),
	)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.cfg.SecretKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("culqi: no se pudo contactar la pasarela: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("culqi: respuesta ilegible: %w", err)
	}

	if resp.StatusCode >= 400 {
		ce := &CulqiError{Status: resp.StatusCode}
		_ = json.Unmarshal(body, ce)
		return nil, ce
	}

	var cargo CargoResponse
	if err := json.Unmarshal(body, &cargo); err != nil {
		return nil, fmt.Errorf("culqi: respuesta inesperada: %w", err)
	}
	cargo.Bruto = body

	return &cargo, nil
}

// VerificarFirmaWebhook compara la firma HMAC-SHA256 del cuerpo recibido.
//
// OJO: confirma el nombre exacto de la cabecera de firma en el panel de Culqi
// antes de pasar a producción; si CULQI_WEBHOOK_SECRET está vacío la
// verificación se omite y el webhook queda abierto — úsalo solo en pruebas.
func (c *CulqiClient) VerificarFirmaWebhook(cuerpo []byte, firmaRecibida string) bool {
	if c.cfg.WebhookSecret == "" {
		return true
	}
	if firmaRecibida == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(c.cfg.WebhookSecret))
	mac.Write(cuerpo)
	esperada := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(esperada), []byte(firmaRecibida))
}

// aCentimos convierte soles a céntimos enteros redondeando al céntimo más
// cercano. Nunca uses int(soles*100) directo: 19.90*100 da 1989.9999... en
// coma flotante y terminarías cobrando un céntimo de menos.
func aCentimos(soles float64) int {
	return int(soles*100 + 0.5)
}

func recortar(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
