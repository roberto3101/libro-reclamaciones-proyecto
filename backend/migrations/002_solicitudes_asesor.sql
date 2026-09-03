-- ============================================================================
-- MIGRACIÓN 002: Crear tabla solicitudes_asesor
-- Módulo de "Atención en Vivo" — registra cuando un usuario de WhatsApp
-- solicita hablar con un asesor humano.
-- ============================================================================

CREATE TABLE IF NOT EXISTS solicitudes_asesor (
    tenant_id           UUID        NOT NULL,
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),

    -- Datos del solicitante
    nombre              STRING      NOT NULL DEFAULT '',
    telefono            STRING      NOT NULL,
    motivo              STRING      NOT NULL DEFAULT '',

    -- Canal de origen
    canal_origen        STRING      NOT NULL DEFAULT 'WHATSAPP',
    canal_whatsapp_id   UUID,

    -- Gestión interna
    estado              STRING      NOT NULL DEFAULT 'PENDIENTE',
    -- Valores: PENDIENTE | EN_ATENCION | RESUELTO | CANCELADO
    prioridad           STRING      NOT NULL DEFAULT 'NORMAL',
    -- Valores: BAJA | NORMAL | ALTA | URGENTE

    asignado_a          UUID,
    fecha_asignacion    TIMESTAMPTZ,
    fecha_resolucion    TIMESTAMPTZ,
    nota_interna        STRING      NOT NULL DEFAULT '',

    -- Contexto de la conversación (resumen del bot antes de escalar)
    resumen_conversacion STRING     NOT NULL DEFAULT '',

    -- Auditoría
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, id),

    CONSTRAINT fk_solicitud_canal_wa
        FOREIGN KEY (tenant_id, canal_whatsapp_id)
        REFERENCES canales_whatsapp (tenant_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_solicitud_asesor
        FOREIGN KEY (tenant_id, asignado_a)
        REFERENCES usuarios_admin (tenant_id, id)
        ON DELETE RESTRICT
);

-- Solicitudes pendientes de un tenant (vista principal del panel)
CREATE INDEX IF NOT EXISTS idx_solicitud_asesor_pendientes
    ON solicitudes_asesor (tenant_id, estado, fecha_creacion DESC)
    STORING (nombre, telefono, motivo, canal_origen, prioridad, asignado_a)
    WHERE estado IN ('PENDIENTE', 'EN_ATENCION');

-- Solicitudes asignadas a un asesor específico
CREATE INDEX IF NOT EXISTS idx_solicitud_asesor_asignado
    ON solicitudes_asesor (tenant_id, asignado_a, estado)
    WHERE asignado_a IS NOT NULL;

-- Buscar por teléfono (evitar duplicados o ver historial)
CREATE INDEX IF NOT EXISTS idx_solicitud_asesor_telefono
    ON solicitudes_asesor (tenant_id, telefono, fecha_creacion DESC);

COMMENT ON TABLE solicitudes_asesor IS 'Solicitudes de atención humana desde WhatsApp u otro canal. El bot crea el registro; el panel admin permite gestionarlas.';