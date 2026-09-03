-- =============================================================================
-- 013 - AUDITORIA SUPERADMIN + ERROR LOG (Observabilidad)
-- =============================================================================
-- Dos tablas nuevas SIN tenant_id (globales):
--
--   1. auditoria_superadmin → Log de acciones del staff interno
--   2. error_log → Errores HTTP del backend + errores JS del frontend
--
-- El error_log tiene TTL de 90 días (CockroachDB auto-limpia).
-- =============================================================================


-- 1. AUDITORIA SUPERADMIN
CREATE TABLE IF NOT EXISTS auditoria_superadmin (
    id                      UUID NOT NULL DEFAULT gen_random_uuid(),
    superadmin_id           UUID NOT NULL,

    accion                  STRING NOT NULL,
    entidad                 STRING NOT NULL,
    entidad_id              STRING,
    detalles                JSONB,
    ip_address              STRING,

    fecha                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id),

    CONSTRAINT fk_audit_sa_superadmin
        FOREIGN KEY (superadmin_id)
        REFERENCES superadmins (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sa_audit_fecha ON auditoria_superadmin (fecha DESC)
    STORING (superadmin_id, accion, entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_sa_audit_sa ON auditoria_superadmin (superadmin_id, fecha DESC)
    STORING (accion, entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_sa_audit_entidad ON auditoria_superadmin (entidad, entidad_id, fecha DESC)
    STORING (superadmin_id, accion);


-- 2. ERROR LOG
CREATE TABLE IF NOT EXISTS error_log (
    id                      UUID NOT NULL DEFAULT gen_random_uuid(),

    nivel                   STRING NOT NULL,
    origen                  STRING NOT NULL,

    tenant_id               UUID,
    usuario_id              UUID,

    metodo                  STRING,
    ruta                    STRING,
    status_code             INT,

    mensaje                 STRING NOT NULL,
    stack_trace             STRING,
    request_body            STRING,
    ip_address              STRING,
    user_agent              STRING,

    fecha_expiracion        TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 days',
    fecha                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
)
WITH (ttl_expiration_expression = 'fecha_expiracion', ttl_job_cron = '@daily');

CREATE INDEX IF NOT EXISTS idx_error_fecha ON error_log (fecha DESC)
    STORING (nivel, origen, tenant_id, ruta, status_code, mensaje);
CREATE INDEX IF NOT EXISTS idx_error_tenant ON error_log (tenant_id, fecha DESC)
    STORING (nivel, origen, ruta, status_code, mensaje)
    WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_nivel ON error_log (nivel, fecha DESC)
    STORING (origen, tenant_id, ruta, status_code, mensaje);
CREATE INDEX IF NOT EXISTS idx_error_ruta ON error_log (ruta, fecha DESC)
    STORING (nivel, status_code, tenant_id);


COMMENT ON TABLE auditoria_superadmin IS 'Log de acciones del staff interno. Sin tenant_id. Separada de auditoria_admin.';
COMMENT ON TABLE error_log IS 'Errores HTTP del backend + errores JS del frontend. TTL 90 días.';
