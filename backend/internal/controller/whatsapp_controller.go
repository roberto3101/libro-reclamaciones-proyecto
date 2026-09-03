package controller

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
	"sync"
	"time"

	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/service"

	"github.com/gin-gonic/gin"
)

// WhatsAppController maneja el webhook de WhatsApp Business Cloud API.
type WhatsAppController struct {
	configuracion   config.WhatsAppConfig
	whatsappService *service.WhatsAppService

	// ── Deduplicación: evita procesar webhooks duplicados de Meta ──
	mensajesProcesados map[string]time.Time
	muMensajes         sync.RWMutex
}

const (
	// ttlDeduplicacion define cuánto tiempo se recuerda un mensaje procesado.
	// Meta puede reintentar webhooks hasta ~7 días, pero 2 horas cubre el 99% de los retries.
	ttlDeduplicacion = 2 * time.Hour
)

func NewWhatsAppController(
	configuracion config.WhatsAppConfig,
	whatsappService *service.WhatsAppService,
) *WhatsAppController {
	ctrl := &WhatsAppController{
		configuracion:      configuracion,
		whatsappService:    whatsappService,
		mensajesProcesados: make(map[string]time.Time),
	}

	go ctrl.limpiarMensajesProcesados()

	return ctrl
}

// yaFueProcesado verifica si un mensaje ya fue procesado (por su ID de Meta).
// Si es nuevo, lo registra y devuelve false. Si es duplicado, devuelve true.
func (ctrl *WhatsAppController) yaFueProcesado(messageID string) bool {
	ctrl.muMensajes.RLock()
	_, existe := ctrl.mensajesProcesados[messageID]
	ctrl.muMensajes.RUnlock()

	if existe {
		return true
	}

	ctrl.muMensajes.Lock()
	ctrl.mensajesProcesados[messageID] = time.Now()
	ctrl.muMensajes.Unlock()

	return false
}

// limpiarMensajesProcesados elimina IDs expirados cada 30 minutos.
func (ctrl *WhatsAppController) limpiarMensajesProcesados() {
	ticker := time.NewTicker(30 * time.Minute)
	for range ticker.C {
		ctrl.muMensajes.Lock()
		ahora := time.Now()
		eliminados := 0
		for id, registrado := range ctrl.mensajesProcesados {
			if ahora.Sub(registrado) > ttlDeduplicacion {
				delete(ctrl.mensajesProcesados, id)
				eliminados++
			}
		}
		ctrl.muMensajes.Unlock()

		if eliminados > 0 {
			fmt.Printf("[WhatsApp] Dedup: %d message IDs expirados eliminados\n", eliminados)
		}
	}
}

// ── Structs del payload de Meta ─────────────────────────────────────────────

type payloadWebhookMeta struct {
	Object string           `json:"object"`
	Entry  []entradaWebhook `json:"entry"`
}

type entradaWebhook struct {
	ID      string          `json:"id"`
	Changes []cambioWebhook `json:"changes"`
}

type cambioWebhook struct {
	Value valorCambio `json:"value"`
	Field string      `json:"field"`
}

type valorCambio struct {
	MessagingProduct string            `json:"messaging_product"`
	Metadata         metadataTelefono  `json:"metadata"`
	Messages         []mensajeEntrante `json:"messages"`
	Statuses         []interface{}     `json:"statuses"`
}

type metadataTelefono struct {
	DisplayPhoneNumber string `json:"display_phone_number"`
	PhoneNumberID      string `json:"phone_number_id"`
}

type mensajeEntrante struct {
	From      string        `json:"from"`
	ID        string        `json:"id"`
	Timestamp string        `json:"timestamp"`
	Type      string        `json:"type"`
	Text      *textoMensaje `json:"text,omitempty"`
}

type textoMensaje struct {
	Body string `json:"body"`
}

// ── GET /webhook/whatsapp — Verificación del webhook por Meta ───────────────

func (ctrl *WhatsAppController) VerificarWebhook(c *gin.Context) {
	modo := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	desafio := c.Query("hub.challenge")

	if modo == "subscribe" && token == ctrl.configuracion.VerifyToken {
		fmt.Println("[WhatsApp] Webhook verificado con token global")
		c.String(http.StatusOK, desafio)
		return
	}

	fmt.Printf("[WhatsApp] Verificación fallida — modo=%s token=%s\n", modo, token)
	c.String(http.StatusForbidden, "Forbidden")
}

// verificarFirmaMeta valida el header X-Hub-Signature-256 usando HMAC-SHA256.
// Si no hay AppSecret configurado, deja pasar (modo permisivo para no romper nada).
func (ctrl *WhatsAppController) verificarFirmaMeta(cuerpo []byte, headerFirma string) bool {
	appSecret := ctrl.configuracion.AppSecret
	if appSecret == "" {
		return true
	}

	if headerFirma == "" {
		fmt.Println("[WhatsApp] Webhook rechazado: falta header X-Hub-Signature-256")
		return false
	}

	firmaHex := strings.TrimPrefix(headerFirma, "sha256=")
	if firmaHex == headerFirma {
		fmt.Println("[WhatsApp] Webhook rechazado: formato de firma inválido")
		return false
	}

	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(cuerpo)
	firmaEsperada := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(firmaHex), []byte(firmaEsperada)) {
		fmt.Println("[WhatsApp] Webhook rechazado: firma HMAC inválida")
		return false
	}

	return true
}

// ── POST /webhook/whatsapp — Recepción de mensajes entrantes ────────────────

func (ctrl *WhatsAppController) RecibirMensajeEntrante(c *gin.Context) {
	cuerpo, err := io.ReadAll(c.Request.Body)
	if err != nil {
		fmt.Printf("[WhatsApp] Error leyendo body: %v\n", err)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	if !ctrl.verificarFirmaMeta(cuerpo, c.GetHeader("X-Hub-Signature-256")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "firma inválida"})
		return
	}

	defer c.JSON(http.StatusOK, gin.H{"status": "ok"})

	var payload payloadWebhookMeta
	if err := json.Unmarshal(cuerpo, &payload); err != nil {
		fmt.Printf("[WhatsApp] Error parseando JSON: %v\n", err)
		return
	}

	for _, entrada := range payload.Entry {
		for _, cambio := range entrada.Changes {
			if len(cambio.Value.Messages) == 0 {
				continue
			}

			phoneNumberID := cambio.Value.Metadata.PhoneNumberID

			// ── RESOLUCIÓN DINÁMICA DEL TENANT ──
			ctx, cancelar := context.WithTimeout(context.Background(), 5*time.Second)
			canalResuelto, err := ctrl.whatsappService.ResolverCanalPorPhoneNumberID(ctx, phoneNumberID)
			cancelar()

			if err != nil {
				fmt.Printf("[WhatsApp] Error resolviendo canal para phone_number_id=%s: %v\n", phoneNumberID, err)
				continue
			}

			if canalResuelto == nil {
				fmt.Printf("[WhatsApp] No hay canal registrado para phone_number_id=%s — ignorando mensaje\n", phoneNumberID)
				continue
			}

			fmt.Printf("[WhatsApp] Canal resuelto → tenant=%s phone=%s chatbot=%v\n",
				canalResuelto.TenantID, canalResuelto.PhoneID, canalResuelto.ChatbotID)

			// ── PROCESAR CADA MENSAJE ──
			for _, mensaje := range cambio.Value.Messages {
				// ── DEDUPLICACIÓN: ignorar webhooks duplicados de Meta ──
				if ctrl.yaFueProcesado(mensaje.ID) {
					fmt.Printf("[WhatsApp] Dedup: mensaje %s ya procesado, ignorando\n", mensaje.ID)
					continue
				}

				if mensaje.Type != "text" || mensaje.Text == nil {
					ctrl.enviarMensajeDeTexto(
						canalResuelto.PhoneID, canalResuelto.AccessToken,
						mensaje.From,
						"Por ahora solo puedo procesar mensajes de texto. "+
							"Envíame tu consulta escrita y te ayudaré. 📝",
					)
					continue
				}

				fmt.Printf("[WhatsApp] Mensaje de %s: %s\n", mensaje.From, mensaje.Text.Body)

				// ── DEBOUNCE: acumular mensajes rápidos, procesar después de 2s de silencio ──
				ctrl.whatsappService.AcumularMensaje(
					canalResuelto,
					mensaje.From,
					mensaje.Text.Body,
					ctrl.enviarMensajeDeTexto,
				)
			}
		}
	}
}

// ── Envío de mensaje vía WhatsApp Cloud API ─────────────────────────────────

func (ctrl *WhatsAppController) enviarMensajeDeTexto(phoneID, accessToken, destinatario, texto string) {
	urlAPI := fmt.Sprintf("https://graph.facebook.com/v22.0/%s/messages", phoneID)

	cuerpoJSON := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                destinatario,
		"type":              "text",
		"text": map[string]string{
			"body": texto,
		},
	}

	datosJSON, err := json.Marshal(cuerpoJSON)
	if err != nil {
		fmt.Printf("[WhatsApp] Error serializando payload: %v\n", err)
		return
	}

	peticion, err := http.NewRequest("POST", urlAPI, bytes.NewBuffer(datosJSON))
	if err != nil {
		fmt.Printf("[WhatsApp] Error creando request: %v\n", err)
		return
	}

	peticion.Header.Set("Content-Type", "application/json")
	peticion.Header.Set("Authorization", "Bearer "+accessToken)

	cliente := &http.Client{Timeout: 15 * time.Second}
	respuesta, err := cliente.Do(peticion)
	if err != nil {
		fmt.Printf("[WhatsApp] Error enviando mensaje a %s: %v\n", destinatario, err)
		return
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode != http.StatusOK {
		cuerpoRespuesta, _ := io.ReadAll(respuesta.Body)
		fmt.Printf("[WhatsApp] Meta respondió %d: %s\n", respuesta.StatusCode, string(cuerpoRespuesta))
		return
	}

	fmt.Printf("[WhatsApp] Mensaje enviado a %s\n", destinatario)
}