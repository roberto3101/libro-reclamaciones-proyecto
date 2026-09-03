-- =============================================================================
-- 014 - MEJORAS CONSOLA ERRORES: Fingerprint, Breadcrumbs, Alertas, Métricas
-- =============================================================================

-- 1. Fingerprint para agrupación de errores (Sentry-style)
ALTER TABLE error_log ADD COLUMN IF NOT EXISTS fingerprint STRING;

UPDATE error_log SET fingerprint = md5(
    COALESCE(mensaje, '') || '::' || COALESCE(ruta, '') || '::' || COALESCE(status_code::STRING, '')
) WHERE fingerprint IS NULL;

CREATE INDEX IF NOT EXISTS idx_error_fingerprint ON error_log (fingerprint, fecha DESC)
    STORING (nivel, origen, tenant_id, ruta, status_code, mensaje);


-- 2. Breadcrumbs (ruta del usuario antes del error)
ALTER TABLE error_log ADD COLUMN IF NOT EXISTS breadcrumbs JSONB;


-- 3. Alertas de errores (fingerprint nuevo o spike de ocurrencias)
CREATE TABLE IF NOT EXISTS error_alertas (
    id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    fingerprint         STRING NOT NULL,
    tipo                STRING NOT NULL,          -- NUEVO | SPIKE
    mensaje             STRING NOT NULL,
    visto               BOOL NOT NULL DEFAULT false,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',

    PRIMARY KEY (id)
)
WITH (ttl_expiration_expression = 'fecha_expiracion', ttl_job_cron = '@daily');

CREATE INDEX IF NOT EXISTS idx_error_alertas_sin_ver ON error_alertas (visto, fecha DESC)
    WHERE visto = false;
CREATE INDEX IF NOT EXISTS idx_error_alertas_fingerprint ON error_alertas (fingerprint, fecha DESC);


-- 4. Métricas de rendimiento API (latencia por ruta)
CREATE TABLE IF NOT EXISTS api_metricas (
    id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    ruta                STRING NOT NULL,
    metodo              STRING NOT NULL,
    duracion_ms         INT NOT NULL,
    status_code         INT NOT NULL,
    tenant_id           UUID,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',

    PRIMARY KEY (id)
)
WITH (ttl_expiration_expression = 'fecha_expiracion', ttl_job_cron = '@hourly');

CREATE INDEX IF NOT EXISTS idx_api_metricas_ruta ON api_metricas (ruta, fecha DESC)
    STORING (metodo, duracion_ms, status_code);
CREATE INDEX IF NOT EXISTS idx_api_metricas_fecha ON api_metricas (fecha DESC)
    STORING (ruta, metodo, duracion_ms, status_code);


COMMENT ON TABLE error_alertas IS 'Alertas generadas cuando aparece un error nuevo o un spike de ocurrencias. TTL 30 días.';
COMMENT ON TABLE api_metricas IS 'Métricas de latencia por ruta API. TTL 7 días. Para dashboard de rendimiento del SA.';
