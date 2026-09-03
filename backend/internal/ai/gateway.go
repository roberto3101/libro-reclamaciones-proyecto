package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ──────────────────────────────────────────────
// Interfaz común para cualquier proveedor de IA
// ──────────────────────────────────────────────

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	SystemPrompt string
	Messages     []Message
	MaxTokens    int
}

type ChatResponse struct {
	Content      string
	PromptTokens int
	OutputTokens int
	Provider     string
}

type Provider interface {
	Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error)
	Name() string
}

// ──────────────────────────────────────────────
// Config para el gateway
// ──────────────────────────────────────────────

type GatewayConfig struct {
	Provider string
	APIKey   string
	Model    string
	BaseURL  string
}

// ExtraGatewayConfig — GatewayConfig con un ID personalizado para extras.
type ExtraGatewayConfig struct {
	ID string
	GatewayConfig
}

// ──────────────────────────────────────────────
// Factory — crea un provider individual
// ──────────────────────────────────────────────

func NewProvider(cfg GatewayConfig) (Provider, error) {
	return newSingleProvider(cfg)
}

func newSingleProvider(cfg GatewayConfig) (Provider, error) {
	switch cfg.Provider {
	case "ollama":
		model := cfg.Model
		if model == "" {
			model = "llama3.1"
		}
		baseURL := cfg.BaseURL
		if baseURL == "" {
			baseURL = "http://localhost:11434"
		}
		return &OllamaProvider{baseURL: baseURL, model: model}, nil

	case "anthropic":
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("ai: API key requerida para anthropic")
		}
		model := cfg.Model
		if model == "" {
			model = "claude-sonnet-4-5-20250929"
		}
		return &AnthropicProvider{apiKey: cfg.APIKey, model: model}, nil

	case "openai":
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("ai: API key requerida para openai")
		}
		model := cfg.Model
		if model == "" {
			model = "gpt-4o-mini"
		}
		baseURL := cfg.BaseURL
		if baseURL == "" {
			baseURL = "https://api.openai.com/v1"
		}
		return &OpenAIProvider{apiKey: cfg.APIKey, model: model, baseURL: baseURL}, nil

	case "google":
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("ai: API key requerida para google")
		}
		model := cfg.Model
		if model == "" {
			model = "gemini-2.0-flash"
		}
		return &GoogleProvider{apiKey: cfg.APIKey, model: model}, nil

	default:
		return nil, fmt.Errorf("ai: proveedor desconocido '%s'. Use: ollama, anthropic, openai, google", cfg.Provider)
	}
}

// ──────────────────────────────────────────────
// NewProviderWithFallback — provider principal + fallback automático
// ──────────────────────────────────────────────

func NewProviderWithFallback(primary GatewayConfig, fallback *GatewayConfig, extras []GatewayConfig) (Provider, error) {
	main, err := newSingleProvider(primary)
	if err != nil {
		return nil, fmt.Errorf("ai: provider principal: %w", err)
	}

	chain := []Provider{main}

	if fallback != nil && fallback.Provider != "" {
		fb, err := newSingleProvider(*fallback)
		if err != nil {
			log.Printf("[WARN] ai: fallback provider '%s' no se pudo crear: %v — omitiendo", fallback.Provider, err)
		} else {
			chain = append(chain, fb)
		}
	}

	for _, extra := range extras {
		ep, err := newSingleProvider(extra)
		if err != nil {
			log.Printf("[WARN] ai: extra provider '%s' no se pudo crear: %v — omitiendo", extra.Provider, err)
			continue
		}
		chain = append(chain, ep)
	}

	if len(chain) == 1 {
		return main, nil
	}

	log.Printf("[INFO] ai: cadena de fallback configurada con %d proveedores", len(chain))
	return &ChainProvider{providers: chain}, nil
}

// ──────────────────────────────────────────────
// ProviderInfo — info de un provider configurado
// ──────────────────────────────────────────────

type ProviderInfo struct {
	ID        string `json:"id"`        // "primary" | "fallback" | "mistral" | "openrouter" | etc.
	Provider  string `json:"provider"`  // "openai" | "google" | "anthropic" | "ollama"
	Model     string `json:"model"`     // "llama-3.3-70b-versatile"
	Label     string `json:"label"`     // "Groq (llama-3.3-70b-versatile)"
	OK        bool   `json:"ok"`        // Health check pasó
	Detalle   string `json:"detalle"`   // "Conexión OK" | "Error: ..."
	EsDefault bool   `json:"es_default"`
}

// GetConfiguredProviders retorna los providers configurados con health check (en paralelo).
func GetConfiguredProviders(primary GatewayConfig, fallback *GatewayConfig, extras []ExtraGatewayConfig) []ProviderInfo {
	type job struct {
		cfg       GatewayConfig
		id        string
		esDefault bool
		idx       int
	}

	var jobs []job
	if primary.Provider != "" {
		jobs = append(jobs, job{primary, "primary", true, len(jobs)})
	}
	if fallback != nil && fallback.Provider != "" {
		jobs = append(jobs, job{*fallback, "fallback", false, len(jobs)})
	}
	for _, extra := range extras {
		jobs = append(jobs, job{extra.GatewayConfig, extra.ID, false, len(jobs)})
	}

	results := make([]ProviderInfo, len(jobs))
	var wg sync.WaitGroup
	for i, j := range jobs {
		wg.Add(1)
		go func(idx int, j job) {
			defer wg.Done()
			results[idx] = checkProviderHealth(j.cfg, j.id, j.esDefault)
		}(i, j)
	}
	wg.Wait()

	return results
}

// checkProviderHealth verifica que el provider realmente pueda generar texto
// haciendo una mini-completación con max_tokens=1 (~2-3 tokens, costo despreciable).
// Esto detecta: API keys inválidas, sin créditos, rate limits, modelos no disponibles.
func checkProviderHealth(cfg GatewayConfig, id string, esDefault bool) ProviderInfo {
	model := cfg.Model
	label := buildLabel(cfg)

	info := ProviderInfo{
		ID:        id,
		Provider:  cfg.Provider,
		Model:     model,
		Label:     label,
		EsDefault: esDefault,
	}

	if cfg.APIKey == "" && cfg.Provider != "ollama" {
		info.OK = false
		info.Detalle = "API key no configurada"
		return info
	}

	client := &http.Client{Timeout: 6 * time.Second}
	var err error
	var statusCode int

	switch cfg.Provider {
	case "openai":
		baseURL := cfg.BaseURL
		if baseURL == "" {
			baseURL = "https://api.openai.com/v1"
		}
		body, _ := json.Marshal(map[string]any{
			"model":      model,
			"max_tokens": 1,
			"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		})
		req, _ := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
		req.Header.Set("Content-Type", "application/json")
		var resp *http.Response
		resp, err = client.Do(req)
		if err == nil {
			statusCode = resp.StatusCode
			resp.Body.Close()
			if statusCode != 200 {
				err = fmt.Errorf("HTTP %d", statusCode)
			}
		}

	case "google":
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, cfg.APIKey)
		body, _ := json.Marshal(map[string]any{
			"contents": []map[string]any{
				{"parts": []map[string]string{{"text": "hi"}}},
			},
			"generationConfig": map[string]any{"maxOutputTokens": 1},
		})
		req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		var resp *http.Response
		resp, err = client.Do(req)
		if err == nil {
			statusCode = resp.StatusCode
			resp.Body.Close()
			if statusCode != 200 {
				err = fmt.Errorf("HTTP %d", statusCode)
			}
		}

	case "anthropic":
		body, _ := json.Marshal(map[string]any{
			"model":      model,
			"max_tokens": 1,
			"messages":   []map[string]any{{"role": "user", "content": "hi"}},
		})
		req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
		req.Header.Set("x-api-key", cfg.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("Content-Type", "application/json")
		var resp *http.Response
		resp, err = client.Do(req)
		if err == nil {
			statusCode = resp.StatusCode
			resp.Body.Close()
			if statusCode != 200 {
				err = fmt.Errorf("HTTP %d", statusCode)
			}
		}

	case "ollama":
		baseURL := cfg.BaseURL
		if baseURL == "" {
			baseURL = "http://localhost:11434"
		}
		var resp *http.Response
		resp, err = client.Get(baseURL + "/api/tags")
		if err == nil {
			statusCode = resp.StatusCode
			resp.Body.Close()
			if statusCode != 200 {
				err = fmt.Errorf("HTTP %d", statusCode)
			}
		}

	default:
		err = fmt.Errorf("proveedor desconocido")
	}

	if err != nil {
		info.OK = false
		info.Detalle = humanizeHealthError(statusCode, err.Error())
	} else {
		info.OK = true
		info.Detalle = "Conexión OK"
	}

	return info
}

// humanizeHealthError traduce errores HTTP a mensajes legibles.
func humanizeHealthError(status int, raw string) string {
	switch {
	case status == 401:
		return "API key inválida"
	case status == 402 || strings.Contains(raw, "billing") || strings.Contains(raw, "quota"):
		return "Sin créditos disponibles"
	case status == 403:
		return "Acceso denegado"
	case status == 404:
		return "Modelo no disponible"
	case status == 429:
		return "Límite de uso alcanzado"
	case status == 503 || status == 502:
		return "Servicio no disponible"
	case strings.Contains(raw, "timeout") || strings.Contains(raw, "deadline"):
		return "Tiempo de espera agotado"
	case strings.Contains(raw, "connection refused") || strings.Contains(raw, "no such host"):
		return "Servidor no accesible"
	default:
		if status > 0 {
			return fmt.Sprintf("Error del servidor (%d)", status)
		}
		return raw
	}
}

// buildLabel genera un label legible para el provider.
func buildLabel(cfg GatewayConfig) string {
	providerName := cfg.Provider
	model := cfg.Model

	// Detectar si es un provider compatible (Groq, Together, etc.)
	if cfg.Provider == "openai" && cfg.BaseURL != "" && cfg.BaseURL != "https://api.openai.com/v1" {
		if contains(cfg.BaseURL, "groq") {
			providerName = "Groq"
		} else if contains(cfg.BaseURL, "together") {
			providerName = "Together"
		} else if contains(cfg.BaseURL, "mistral") {
			providerName = "Mistral"
		} else if contains(cfg.BaseURL, "openrouter") {
			providerName = "OpenRouter"
		} else if contains(cfg.BaseURL, "cerebras") {
			providerName = "Cerebras"
		} else if contains(cfg.BaseURL, "sambanova") {
			providerName = "SambaNova"
		} else if contains(cfg.BaseURL, "models.inference.ai.azure.com") {
			providerName = "GitHub"
		} else if contains(cfg.BaseURL, "integrate.api.nvidia.com") {
			providerName = "NVIDIA"
		} else if contains(cfg.BaseURL, "huggingface.co") {
			providerName = "HuggingFace"
		} else if contains(cfg.BaseURL, "llm7.io") {
			providerName = "LLM7"
		} else {
			providerName = "OpenAI-compatible"
		}
	} else {
		switch cfg.Provider {
		case "openai":
			providerName = "OpenAI"
		case "google":
			providerName = "Google"
		case "anthropic":
			providerName = "Anthropic"
		case "ollama":
			providerName = "Ollama"
		}
	}

	if model == "" {
		return providerName
	}
	return providerName + " (" + model + ")"
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsLower(s, substr))
}

func containsLower(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// ──────────────────────────────────────────────
// CHAIN PROVIDER — intenta providers en orden hasta que uno responda
// ──────────────────────────────────────────────

type ChainProvider struct {
	providers []Provider
}

func (p *ChainProvider) Name() string {
	names := make([]string, len(p.providers))
	for i, prov := range p.providers {
		names[i] = prov.Name()
	}
	return strings.Join(names, "+")
}

func (p *ChainProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	var lastErr error
	for i, prov := range p.providers {
		resp, err := prov.Chat(ctx, req)
		if err == nil {
			return resp, nil
		}
		log.Printf("[WARN] ai: provider #%d '%s' falló: %v", i+1, prov.Name(), err)
		lastErr = err
	}
	return nil, fmt.Errorf("ai: todos los proveedores (%d) fallaron. Último error: %v", len(p.providers), lastErr)
}

// ──────────────────────────────────────────────
// OLLAMA (Local, gratis, sin API key)
// ──────────────────────────────────────────────

type OllamaProvider struct {
	baseURL string
	model   string
}

func (p *OllamaProvider) Name() string { return "ollama/" + p.model }

func (p *OllamaProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	msgs := make([]map[string]string, 0, len(req.Messages)+1)
	if req.SystemPrompt != "" {
		msgs = append(msgs, map[string]string{
			"role":    "system",
			"content": req.SystemPrompt,
		})
	}
	for _, m := range req.Messages {
		msgs = append(msgs, map[string]string{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	body := map[string]interface{}{
		"model":    p.model,
		"messages": msgs,
		"stream":   false,
	}

	jsonBody, _ := json.Marshal(body)

	url := p.baseURL + "/api/chat"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("ollama: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ollama: no se pudo conectar a %s — ejecuta 'ollama serve' primero: %w", p.baseURL, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("ollama: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		PromptEvalCount int `json:"prompt_eval_count"`
		EvalCount       int `json:"eval_count"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("ollama: parse error: %w", err)
	}

	return &ChatResponse{
		Content:      result.Message.Content,
		PromptTokens: result.PromptEvalCount,
		OutputTokens: result.EvalCount,
		Provider:     "ollama/" + p.model,
	}, nil
}

// ──────────────────────────────────────────────
// ANTHROPIC (Claude)
// ──────────────────────────────────────────────

type AnthropicProvider struct {
	apiKey string
	model  string
}

func (p *AnthropicProvider) Name() string { return "anthropic" }

func (p *AnthropicProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	msgs := make([]map[string]string, 0, len(req.Messages))
	for _, m := range req.Messages {
		if m.Role == "system" {
			continue
		}
		msgs = append(msgs, map[string]string{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	body := map[string]interface{}{
		"model":      p.model,
		"max_tokens": maxTokens,
		"messages":   msgs,
	}
	if req.SystemPrompt != "" {
		body["system"] = req.SystemPrompt
	}

	jsonBody, _ := json.Marshal(body)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("anthropic: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("anthropic: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("anthropic: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("anthropic: parse error: %w", err)
	}

	text := ""
	for _, c := range result.Content {
		if c.Type == "text" {
			text += c.Text
		}
	}

	return &ChatResponse{
		Content:      text,
		PromptTokens: result.Usage.InputTokens,
		OutputTokens: result.Usage.OutputTokens,
		Provider:     "anthropic",
	}, nil
}

// ──────────────────────────────────────────────
// OPENAI (GPT + compatibles: Groq, Together, etc.)
// ──────────────────────────────────────────────

type OpenAIProvider struct {
	apiKey  string
	model   string
	baseURL string
}

func (p *OpenAIProvider) Name() string {
	if p.baseURL != "" && p.baseURL != "https://api.openai.com/v1" {
		return "openai-compatible/" + p.model
	}
	return "openai/" + p.model
}

func (p *OpenAIProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	msgs := make([]map[string]string, 0, len(req.Messages)+1)
	if req.SystemPrompt != "" {
		msgs = append(msgs, map[string]string{
			"role":    "system",
			"content": req.SystemPrompt,
		})
	}
	for _, m := range req.Messages {
		msgs = append(msgs, map[string]string{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	body := map[string]interface{}{
		"model":      p.model,
		"max_tokens": maxTokens,
		"messages":   msgs,
	}

	jsonBody, _ := json.Marshal(body)

	baseURL := p.baseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	endpoint := baseURL + "/chat/completions"

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("openai: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("openai: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("openai: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("openai: parse error: %w", err)
	}

	text := ""
	if len(result.Choices) > 0 {
		text = result.Choices[0].Message.Content
	}

	return &ChatResponse{
		Content:      text,
		PromptTokens: result.Usage.PromptTokens,
		OutputTokens: result.Usage.CompletionTokens,
		Provider:     p.Name(),
	}, nil
}

// ──────────────────────────────────────────────
// GOOGLE (Gemini)
// ──────────────────────────────────────────────

type GoogleProvider struct {
	apiKey string
	model  string
}

func (p *GoogleProvider) Name() string { return "google/" + p.model }

func (p *GoogleProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	contents := make([]map[string]interface{}, 0)

	for _, m := range req.Messages {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		contents = append(contents, map[string]interface{}{
			"role": role,
			"parts": []map[string]string{
				{"text": m.Content},
			},
		})
	}

	body := map[string]interface{}{
		"contents": contents,
		"generationConfig": map[string]interface{}{
			"maxOutputTokens": maxTokens,
		},
	}

	if req.SystemPrompt != "" {
		body["systemInstruction"] = map[string]interface{}{
			"parts": []map[string]string{
				{"text": req.SystemPrompt},
			},
		}
	}

	jsonBody, _ := json.Marshal(body)

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", p.model, p.apiKey)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("google: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("google: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("google: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("google: parse error: %w", err)
	}

	text := ""
	if len(result.Candidates) > 0 && len(result.Candidates[0].Content.Parts) > 0 {
		text = result.Candidates[0].Content.Parts[0].Text
	}

	return &ChatResponse{
		Content:      text,
		PromptTokens: result.UsageMetadata.PromptTokenCount,
		OutputTokens: result.UsageMetadata.CandidatesTokenCount,
		Provider:     "google/" + p.model,
	}, nil
}