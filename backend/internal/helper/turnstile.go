package helper

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type TurnstileResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

// VerifyTurnstile valida un token de Cloudflare Turnstile.
func VerifyTurnstile(secretKey, token, remoteIP string) error {
	if token == "" {
		return fmt.Errorf("token de verificación requerido")
	}

	client := &http.Client{Timeout: 5 * time.Second}

	resp, err := client.PostForm(turnstileVerifyURL, url.Values{
		"secret":   {secretKey},
		"response": {token},
		"remoteip": {remoteIP},
	})
	if err != nil {
		return fmt.Errorf("error contactando Cloudflare: %w", err)
	}
	defer resp.Body.Close()

	var result TurnstileResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("error decodificando respuesta Cloudflare: %w", err)
	}

	if !result.Success {
		log.Printf("[Turnstile] verificación fallida — error-codes: %s, remoteIP enviada: %s",
			strings.Join(result.ErrorCodes, ", "), remoteIP)
		return fmt.Errorf("verificación CAPTCHA fallida")
	}

	return nil
}
