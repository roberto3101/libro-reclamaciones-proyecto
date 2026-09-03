-- =============================================================================
-- 018 — Registro de pagos (Culqi, Yape, transferencia y activación manual)
--
-- Hasta ahora las suscripciones se activaban sin dejar rastro de cobro:
-- metodo_pago y referencia_pago quedaban vacíos. Esta tabla es el libro
-- contable del SaaS: toda plata que entra queda registrada acá.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    suscripcion_id      UUID,
    plan_id             UUID NOT NULL,

    -- CULQI | YAPE | TRANSFERENCIA | MANUAL
    proveedor           TEXT NOT NULL,

    -- chr_xxx de Culqi, código de operación de Yape, o nº de transferencia
    referencia_externa  TEXT,

    monto               DECIMAL(10,2) NOT NULL,
    moneda              TEXT NOT NULL DEFAULT 'PEN',
    ciclo               TEXT NOT NULL DEFAULT 'MENSUAL',

    -- PENDIENTE | PAGADO | FALLIDO | REEMBOLSADO
    estado              TEXT NOT NULL DEFAULT 'PENDIENTE',

    email               TEXT,
    descripcion         TEXT,

    -- Respuesta cruda del proveedor, para auditar sin depender de su panel
    payload             JSONB,

    -- Motivo de rechazo cuando estado = FALLIDO
    error_codigo        TEXT,
    error_mensaje       TEXT,

    -- Quién lo registró si fue activación manual
    registrado_por      UUID,

    fecha_pago          TIMESTAMPTZ,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_tenant       ON pagos (tenant_id, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion  ON pagos (suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado       ON pagos (estado, fecha_creacion DESC);

-- Evita cobrar dos veces el mismo cargo si el webhook llega repetido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_referencia_unica
    ON pagos (proveedor, referencia_externa)
    WHERE referencia_externa IS NOT NULL;

-- =============================================================================
-- Idempotencia de webhooks: Culqi reintenta si no respondes 200.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos_eventos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor       TEXT NOT NULL,
    evento_id       TEXT NOT NULL,
    tipo            TEXT,
    payload         JSONB,
    procesado       BOOLEAN NOT NULL DEFAULT false,
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_eventos_unico
    ON pagos_eventos (proveedor, evento_id);
