-- Vincular canal WhatsApp con chatbot
ALTER TABLE canales_whatsapp ADD COLUMN IF NOT EXISTS chatbot_id UUID;

ALTER TABLE canales_whatsapp
    ADD CONSTRAINT fk_canal_wa_chatbot
    FOREIGN KEY (tenant_id, chatbot_id)
    REFERENCES chatbots (tenant_id, id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_canal_wa_chatbot
    ON canales_whatsapp (tenant_id, chatbot_id)
    WHERE chatbot_id IS NOT NULL AND activo = true;