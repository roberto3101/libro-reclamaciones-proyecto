-- =============================================================================
-- 19. MENSAJES DE ATENCIÓN EN VIVO (Chat Asesor ↔ Cliente)
-- =============================================================================
-- Mensajes entre asesores y clientes durante una solicitud EN_ATENCION.
-- El asesor escribe desde el panel → sale por el bot de WhatsApp.
-- El cliente responde por WhatsApp → se guarda aquí en vez de ir a la IA.
--
-- Remitentes:
--   CLIENTE → mensaje entrante del usuario por WhatsApp
--   ASESOR  → mensaje saliente del asesor desde el panel
--   SISTEMA → mensajes automáticos (handoff, transferencia, cierre)
-- =============================================================================
CREATE TABLE IF NOT EXISTS mensajes_atencion (
    tenant_id       UUID        NOT NULL,
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    solicitud_id    UUID        NOT NULL,

    remitente       STRING      NOT NULL,
    -- Valores: CLIENTE | ASESOR | SISTEMA

    contenido       STRING      NOT NULL,
    asesor_id       UUID,

    fecha_envio     TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, id),

    CONSTRAINT fk_msg_atencion_solicitud
        FOREIGN KEY (tenant_id, solicitud_id)
        REFERENCES solicitudes_asesor (tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_msg_atencion_asesor
        FOREIGN KEY (tenant_id, asesor_id)
        REFERENCES usuarios_admin (tenant_id, id)
        ON DELETE CASCADE
);

-- Mensajes de una solicitud ordenados (query principal del chat)
CREATE INDEX IF NOT EXISTS idx_msg_atencion_solicitud
    ON mensajes_atencion (tenant_id, solicitud_id, fecha_envio ASC)
    STORING (remitente, contenido, asesor_id);

-- Mensajes recientes por tenant (monitoreo)
CREATE INDEX IF NOT EXISTS idx_msg_atencion_recientes
    ON mensajes_atencion (tenant_id, fecha_envio DESC)
    STORING (solicitud_id, remitente);

COMMENT ON TABLE mensajes_atencion IS 'Chat en vivo entre asesor y cliente durante atención humana. Los mensajes del asesor salen por el bot de WhatsApp.';