-- =============================================================================
-- 17. CANALES WHATSAPP (multi-tenant dinámico)
-- =============================================================================
-- Mapeo phone_number_id → tenant. Cuando Meta envía un mensaje al webhook,
-- el backend busca aquí qué tenant atiende ese número.
-- Cada tenant configura su canal desde el panel admin.
--
-- Flujo:
--   1. Meta envía POST /webhook/whatsapp con metadata.phone_number_id
--   2. SELECT tenant_id, access_token FROM canales_whatsapp WHERE phone_number_id = $1 AND activo = true
--   3. El service procesa el mensaje en el contexto de ese tenant
--   4. El controller envía la respuesta usando el access_token del canal
-- =============================================================================
CREATE TABLE IF NOT EXISTS canales_whatsapp (
    tenant_id           UUID        NOT NULL,
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    phone_number_id     STRING      NOT NULL,
    display_phone       STRING      NOT NULL DEFAULT '',
    access_token        STRING      NOT NULL DEFAULT '',
    verify_token        STRING      NOT NULL DEFAULT '',
    nombre_canal        STRING      NOT NULL DEFAULT 'WhatsApp Principal',
    activo              BOOL        NOT NULL DEFAULT true,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    UNIQUE INDEX idx_canal_wa_phone_activo (phone_number_id)
        STORING (access_token, verify_token)
        WHERE activo = true
);
-- Canales activos de un tenant (panel admin)
CREATE INDEX IF NOT EXISTS idx_canal_wa_tenant ON canales_whatsapp (tenant_id)
    STORING (phone_number_id, display_phone, nombre_canal, activo)
    WHERE activo = true;

COMMENT ON TABLE canales_whatsapp IS 'Mapeo phone_number_id → tenant para WhatsApp multi-tenant. Un número solo puede estar activo en un tenant a la vez.';
COMMENT ON COLUMN canales_whatsapp.access_token IS 'Token de Meta. En desarrollo va en plano, en producción encriptar con AES-256.';