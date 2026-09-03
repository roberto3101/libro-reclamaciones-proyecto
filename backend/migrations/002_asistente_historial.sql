-- =============================================================================
-- MIGRACIÓN: Historial del Asistente IA
-- Ejecutar DESPUÉS del schema base (v4)
-- =============================================================================
--
-- Agrega 2 tablas para persistir conversaciones del asistente interno.
-- Sigue los mismos principios del schema base:
--   - PK compuesta (tenant_id, id)
--   - FKs compuestas con CASCADE
--   - TTL automático de CockroachDB (7 días)
--   - Sin triggers
--
-- Límites:
--   - Máximo 10 conversaciones activas por usuario (el backend borra la más vieja)
--   - Máximo 50 mensajes por conversación (el backend rechaza después de 50)
--   - Las conversaciones expiran a los 7 días automáticamente (TTL)
--
-- =============================================================================


-- =============================================================================
-- 15. ASISTENTE IA — CONVERSACIONES
-- =============================================================================
-- Una conversación es una sesión de chat entre un usuario admin y el asistente.
-- Se auto-eliminan después de 7 días con TTL de CockroachDB.
-- El backend limita a 10 conversaciones por usuario: al crear la 11va,
-- borra la más vieja con un DELETE inline (sin crons ni jobs).
-- =============================================================================
CREATE TABLE IF NOT EXISTS asistente_conversaciones (
    tenant_id               UUID NOT NULL,
    id                      UUID NOT NULL DEFAULT gen_random_uuid(),
    usuario_id              UUID NOT NULL,

    titulo                  STRING NOT NULL DEFAULT 'Nueva conversación',
    -- Se auto-genera del primer mensaje del usuario (primeros 80 chars)

    activa                  BOOL NOT NULL DEFAULT true,

    -- Contadores (se actualizan en el backend al insertar mensajes)
    total_mensajes          INT NOT NULL DEFAULT 0,
    total_tokens_prompt     INT NOT NULL DEFAULT 0,
    total_tokens_output     INT NOT NULL DEFAULT 0,
    proveedor_ia            STRING,          -- "ollama/llama3.1" | "anthropic" | etc.

    -- TTL: auto-eliminar después de 7 días
    fecha_expiracion        TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',

    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, id),

    CONSTRAINT fk_asistente_conv_usuario
        FOREIGN KEY (tenant_id, usuario_id)
        REFERENCES usuarios_admin (tenant_id, id)
        ON DELETE CASCADE
)
WITH (ttl_expiration_expression = 'fecha_expiracion', ttl_job_cron = '@hourly');

-- Conversaciones activas de un usuario (la query más frecuente)
CREATE INDEX IF NOT EXISTS idx_asistente_conv_usuario
    ON asistente_conversaciones (tenant_id, usuario_id, fecha_actualizacion DESC)
    STORING (titulo, activa, total_mensajes, proveedor_ia)
    WHERE activa = true;


-- =============================================================================
-- 16. ASISTENTE IA — MENSAJES
-- =============================================================================
-- Mensajes individuales de cada conversación.
-- CASCADE delete con la conversación padre (si se borra la conversación,
-- se borran todos sus mensajes automáticamente).
-- =============================================================================
CREATE TABLE IF NOT EXISTS asistente_mensajes (
    tenant_id               UUID NOT NULL,
    id                      UUID NOT NULL DEFAULT gen_random_uuid(),
    conversacion_id         UUID NOT NULL,

    rol                     STRING NOT NULL,
    -- Valores: USER | ASSISTANT

    contenido               STRING NOT NULL,

    -- Métricas de la respuesta de IA (solo para rol=ASSISTANT)
    tokens_prompt           INT DEFAULT 0,
    tokens_output           INT DEFAULT 0,
    proveedor               STRING,          -- "ollama/llama3.1", "anthropic", etc.
    duracion_ms             INT,             -- Tiempo de respuesta en ms

    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, id),

    CONSTRAINT fk_asistente_msg_conv
        FOREIGN KEY (tenant_id, conversacion_id)
        REFERENCES asistente_conversaciones (tenant_id, id)
        ON DELETE CASCADE
);

-- Mensajes de una conversación ordenados (la query principal)
CREATE INDEX IF NOT EXISTS idx_asistente_msg_conv
    ON asistente_mensajes (tenant_id, conversacion_id, fecha_creacion ASC)
    STORING (rol, contenido, tokens_prompt, tokens_output, proveedor);


-- =============================================================================
-- COMENTARIOS
-- =============================================================================
COMMENT ON TABLE asistente_conversaciones IS 'Conversaciones del asistente IA interno. TTL de 7 días. Máximo 10 por usuario.';
COMMENT ON TABLE asistente_mensajes IS 'Mensajes de conversaciones del asistente. CASCADE delete con la conversación padre.';
COMMENT ON COLUMN asistente_conversaciones.fecha_expiracion IS 'TTL de 7 días. CockroachDB elimina automáticamente las conversaciones viejas.';
COMMENT ON COLUMN asistente_conversaciones.total_mensajes IS 'Contador actualizado por el backend. Máximo 50 mensajes por conversación.';