package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config raíz — agrupa todas las configuraciones del sistema.
type Config struct {
	Server    ServerConfig
	Cockroach CockroachConfig
	JWT       JWTConfig
	APIKey    APIKeyConfig
	RateLimit RateLimitConfig
	CORS      CORSConfig
	SMTP      SMTPConfig
	AI        AIConfig
	WhatsApp  WhatsAppConfig
	Turnstile TurnstileConfig
	Storage   StorageConfig
	Culqi     CulqiConfig
	MP        MercadoPagoConfig
	App       AppConfig
}

// AppConfig agrupa los datos propios del despliegue: el dominio publico y
// el buzon de soporte. Antes estaban escritos dentro del codigo, lo que
// ataba el binario a un dominio concreto. Van vacios por defecto: hay que
// rellenarlos en el .env antes de publicar.
type AppConfig struct {
	// URLPublica es la base del portal de seguimiento que se enlaza en los
	// correos, sin barra final. Ej: https://reclamos.miempresa.pe
	URLPublica string
	// EmailSoporte recibe las solicitudes de activacion de WhatsApp.
	EmailSoporte string
}

type StorageConfig struct {
	APIURL string
	APIKey string
}

type ServerConfig struct {
	Port string
	Env  string // development | production
}

type CockroachConfig struct {
	Host            string
	Port            string
	User            string
	Password        string
	DBName          string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type JWTConfig struct {
	Secret          string
	ExpirationHours int
}

type APIKeyConfig struct {
	Prefix string // "crb"
}

type RateLimitConfig struct {
	RequestsPerMin int
	RequestsPerDay int
}

type CORSConfig struct {
	AllowedOrigins []string
}

type SMTPConfig struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

// AIConfig configuración del asistente IA multi-proveedor con fallback en cadena.
type AIConfig struct {
	Provider string // "ollama" | "anthropic" | "openai" | "google"
	APIKey   string
	Model    string
	BaseURL  string // Para Ollama o APIs OpenAI-compatible (Groq, Together, etc.)

	// Fallback: si el provider principal falla, intenta con este
	FallbackProvider string
	FallbackAPIKey   string
	FallbackModel    string
	FallbackBaseURL  string

	// Proveedores extras (Mistral, OpenRouter, etc.) — se cargan dinámicamente
	ExtraProviders []ExtraProviderConfig
}

// ExtraProviderConfig un proveedor extra de IA con ID personalizado.
type ExtraProviderConfig struct {
	ID       string // "mistral", "openrouter", "gemini", etc.
	Provider string // "openai" | "google" | "anthropic" | "ollama"
	APIKey   string
	Model    string
	BaseURL  string
}

// TurnstileConfig configuración de Cloudflare Turnstile (CAPTCHA).
type TurnstileConfig struct {
	SecretKey string
	Enabled   bool
}

// WhatsAppConfig configuración global de WhatsApp Business Cloud API.
// Los tokens y phone_id por tenant ahora viven en la tabla canales_whatsapp.
// Solo se conserva VerifyToken como token global para la verificación inicial del webhook por Meta.
type WhatsAppConfig struct {
	VerifyToken string // Token global para verificación del webhook con Meta
	AppSecret   string // App Secret de Meta — para verificar firma HMAC de webhooks
	Enabled     bool   // Si el módulo WhatsApp está habilitado
}

// CulqiConfig configuración de la pasarela de pagos Culqi.
// Culqi es peruana, cobra en soles y acepta Yape de forma nativa — a
// diferencia de Stripe, que no opera en Perú.
type CulqiConfig struct {
	PublicKey     string // pk_test_xxx / pk_live_xxx — se expone al navegador
	SecretKey     string // sk_test_xxx / sk_live_xxx — NUNCA sale del backend
	WebhookSecret string // Para verificar la firma HMAC de los webhooks
	APIURL        string // Base de la API de cargos
	Enabled       bool   // Si hay llaves configuradas
}

// MercadoPagoConfig configuración de Mercado Pago.
//
// La integración elegida es Suscripciones (preapproval): Mercado Pago cobra
// solo cada mes y reintenta cuando una tarjeta rebota, así que la lógica de
// renovación no vive en nuestro backend.
type MercadoPagoConfig struct {
	PublicKey     string // TEST-xxx / APP_USR-xxx — se expone al navegador
	AccessToken   string // NUNCA sale del backend
	WebhookSecret string // Firma de las notificaciones
	APIURL        string // Base de la API
	Enabled       bool   // Si hay access token configurado
}

// DSN retorna el connection string para CockroachDB.
func (c CockroachConfig) DSN() string {
	if c.Password != "" {
		return fmt.Sprintf(
			"postgresql://%s:%s@%s:%s/%s?sslmode=%s",
			c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode,
		)
	}
	return fmt.Sprintf(
		"postgresql://%s@%s:%s/%s?sslmode=%s",
		c.User, c.Host, c.Port, c.DBName, c.SSLMode,
	)
}

// IsDevelopment retorna true si estamos en modo desarrollo.
func (c ServerConfig) IsDevelopment() bool {
	return c.Env == "development"
}

// Load carga la configuración desde variables de entorno.
func Load() (*Config, error) {
	_ = godotenv.Load()

	verifyToken := env("WHATSAPP_VERIFY_TOKEN", "")
	whatsappAppSecret := env("META_APP_SECRET", "")

	cfg := &Config{
		Server: ServerConfig{
			Port: env("SERVER_PORT", "8080"),
			Env:  env("SERVER_ENV", "development"),
		},
		Cockroach: CockroachConfig{
			Host:            env("CRDB_HOST", "localhost"),
			Port:            env("CRDB_PORT", "26257"),
			User:            env("CRDB_USER", "root"),
			Password:        env("CRDB_PASSWORD", ""),
			DBName:          env("CRDB_DATABASE", "libroreclamaciones"),
			SSLMode:         env("CRDB_SSLMODE", "disable"),
			MaxOpenConns:    envInt("CRDB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    envInt("CRDB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: time.Duration(envInt("CRDB_CONN_MAX_LIFETIME_MIN", 30)) * time.Minute,
		},
		JWT: JWTConfig{
			Secret:          env("JWT_SECRET", ""),
			ExpirationHours: envInt("JWT_EXPIRATION_HOURS", 24),
		},
		APIKey: APIKeyConfig{
			Prefix: env("API_KEY_PREFIX", "crb"),
		},
		RateLimit: RateLimitConfig{
			RequestsPerMin: envInt("RATE_LIMIT_REQUESTS_PER_MIN", 60),
			RequestsPerDay: envInt("RATE_LIMIT_REQUESTS_PER_DAY", 5000),
		},
		CORS: CORSConfig{
			AllowedOrigins: envSlice("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
		},
		SMTP: SMTPConfig{
			Host: env("SMTP_HOST", "smtp.gmail.com"),
			Port: envInt("SMTP_PORT", 587),
			User: env("SMTP_USER", ""),
			Pass: env("SMTP_PASS", ""),
			From: env("SMTP_FROM", "no-reply@saaslibro.com"),
		},
		AI: AIConfig{
			Provider: env("AI_PROVIDER", ""),
			APIKey:   env("AI_API_KEY", ""),
			Model:    env("AI_MODEL", ""),
			BaseURL:  env("AI_BASE_URL", ""),

			FallbackProvider: env("AI_FALLBACK_PROVIDER", ""),
			FallbackAPIKey:   env("AI_FALLBACK_API_KEY", ""),
			FallbackModel:    env("AI_FALLBACK_MODEL", ""),
			FallbackBaseURL:  env("AI_FALLBACK_BASE_URL", ""),
		},
		WhatsApp: WhatsAppConfig{
			VerifyToken: verifyToken,
			AppSecret:   whatsappAppSecret,
			Enabled:     verifyToken != "",
		},
		Turnstile: TurnstileConfig{
			SecretKey: env("TURNSTILE_SECRET_KEY", ""),
			Enabled:   env("TURNSTILE_ENABLED", "false") == "true",
		},
		App: AppConfig{
			URLPublica:   strings.TrimRight(env("APP_URL_PUBLICA", ""), "/"),
			EmailSoporte: env("APP_EMAIL_SOPORTE", ""),
		},
		Storage: StorageConfig{
			APIURL: env("STORAGE_API_URL", ""),
			APIKey: env("STORAGE_API_KEY", ""),
		},
		Culqi: CulqiConfig{
			PublicKey:     env("CULQI_PUBLIC_KEY", ""),
			SecretKey:     env("CULQI_SECRET_KEY", ""),
			WebhookSecret: env("CULQI_WEBHOOK_SECRET", ""),
			APIURL:        env("CULQI_API_URL", "https://api.culqi.com/v2"),
			Enabled:       env("CULQI_SECRET_KEY", "") != "",
		},
		MP: MercadoPagoConfig{
			PublicKey:     env("MP_PUBLIC_KEY", ""),
			AccessToken:   env("MP_ACCESS_TOKEN", ""),
			WebhookSecret: env("MP_WEBHOOK_SECRET", ""),
			APIURL:        env("MP_API_URL", "https://api.mercadopago.com"),
			Enabled:       env("MP_ACCESS_TOKEN", "") != "",
		},
	}

	// Cargar proveedores extras (AI_EXTRA_1_* hasta AI_EXTRA_10_*)
	for i := 1; i <= 10; i++ {
		prefix := fmt.Sprintf("AI_EXTRA_%d_", i)
		id := env(prefix+"ID", "")
		prov := env(prefix+"PROVIDER", "")
		if id == "" || prov == "" {
			continue
		}
		cfg.AI.ExtraProviders = append(cfg.AI.ExtraProviders, ExtraProviderConfig{
			ID:       id,
			Provider: prov,
			APIKey:   env(prefix+"API_KEY", ""),
			Model:    env(prefix+"MODEL", ""),
			BaseURL:  env(prefix+"BASE_URL", ""),
		})
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// validate verifica que las variables críticas estén presentes.
func (c *Config) validate() error {
	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT_SECRET es obligatorio")
	}
	if len(c.JWT.Secret) < 32 {
		return fmt.Errorf("JWT_SECRET debe tener al menos 32 caracteres")
	}
	if c.Cockroach.DBName == "" {
		return fmt.Errorf("CRDB_DATABASE es obligatorio")
	}
	return nil
}

// --- Helpers DRY para leer env vars ---

func env(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func envInt(key string, fallback int) int {
	val := env(key, "")
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func envSlice(key string, fallback []string) []string {
	val := env(key, "")
	if val == "" {
		return fallback
	}
	parts := strings.Split(val, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
