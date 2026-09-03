package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// EnviarMensajeWhatsApp envía un mensaje de texto vía la API de Meta.
// Se usa para que el asesor responda al cliente desde el mismo número del bot.
func EnviarMensajeWhatsApp(ctx context.Context, accessToken, phoneNumberID, telefonoDestino, texto string) error {
	url := fmt.Sprintf("https://graph.facebook.com/v21.0/%s/messages", phoneNumberID)

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                telefonoDestino,
		"type":              "text",
		"text":              map[string]string{"body": texto},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("whatsapp_sender.marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("whatsapp_sender.request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("whatsapp_sender.do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("whatsapp_sender: Meta API %d — %s", resp.StatusCode, string(respBody))
	}

	return nil
}