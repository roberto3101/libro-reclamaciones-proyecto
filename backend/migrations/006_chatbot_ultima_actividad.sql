-- 006: Agrega columna ultima_actividad a chatbots
-- Trackea la última vez que el bot procesó cualquier interacción (WhatsApp, API, etc.)
-- Esto es independiente de ultimo_uso en chatbot_api_keys que solo trackea uso de API keys.

ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ NULL;
