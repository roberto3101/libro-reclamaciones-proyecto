-- =============================================================================
-- 007: Sistema de notificaciones en tiempo real (producción SaaS)
-- =============================================================================
--
-- Tabla principal: almacena cada notificación enviada a un usuario.
-- Tabla config: permite activar/desactivar tipos de notificación por rol.
--
-- Diseño para producción con miles de usuarios:
--
--   1. TTL de 90 días → CockroachDB limpia automáticamente notificaciones
--      viejas sin intervención del backend. Un usuario con 20 notifs/día
--      genera ~1800 filas en 90 días, manejable por tenant.
--
--   2. STORING en índices → evita lookups al disco en las queries de
--      listado (campana, página, contador). El 95% de las reads no
--      necesitan tocar la tabla base.
--
--   3. Índice parcial para no leídas → el contador del badge (query más
--      frecuente) solo escanea filas con leida=false, que son pocas.
--
--   4. FKs compuestas → misma convención del schema base. Garantizan
--      integridad referencial con CASCADE para cleanup automático.
--
--   5. Sin COUNT(*) costoso → el repo usa cursor-based pagination.
--      El total_sin_leer se obtiene del índice parcial (rápido).
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS notificaciones (
    tenant_id          UUID        NOT NULL,
    id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    usuario_destino_id UUID        NOT NULL,
    tipo               STRING      NOT NULL,
    titulo             STRING      NOT NULL,
    contenido          STRING      NOT NULL,
    datos_extra        JSONB,
    leida              BOOL        NOT NULL DEFAULT false,
    fecha_lectura      TIMESTAMPTZ,
    fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- TTL: auto-eliminar después de 90 días
    fecha_expiracion   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 days',

    PRIMARY KEY (tenant_id, id),

    -- FK al usuario destino (CASCADE: si se borra el usuario, se borran sus notificaciones)
    CONSTRAINT fk_notif_usuario
        FOREIGN KEY (tenant_id, usuario_destino_id)
        REFERENCES usuarios_admin (tenant_id, id)
        ON DELETE CASCADE
)
WITH (ttl_expiration_expression = 'fecha_expiracion', ttl_job_cron = '@daily');

-- Query principal: listado paginado por usuario (campana + página de notificaciones)
-- STORING evita lookup a la tabla base para las columnas del listado
CREATE INDEX idx_notif_usuario_listado
    ON notificaciones (tenant_id, usuario_destino_id, fecha_creacion DESC)
    STORING (tipo, titulo, contenido, datos_extra, leida, fecha_lectura);

-- Contador de no leídas (badge de la campana) — query más frecuente
-- Índice parcial: solo escanea filas con leida=false (típicamente pocas)
CREATE INDEX idx_notif_usuario_no_leidas
    ON notificaciones (tenant_id, usuario_destino_id)
    STORING (tipo, titulo, fecha_creacion)
    WHERE leida = false;

-- Filtrar por tipo de notificación (filtro en la página de notificaciones)
CREATE INDEX idx_notif_tipo
    ON notificaciones (tenant_id, tipo, fecha_creacion DESC)
    STORING (usuario_destino_id, titulo, leida);

-- =============================================================================

CREATE TABLE IF NOT EXISTS configuracion_notificaciones_rol (
    tenant_id          UUID        NOT NULL,
    id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    rol_id             UUID        NOT NULL,
    tipo_notificacion  STRING      NOT NULL,
    habilitado         BOOL        NOT NULL DEFAULT true,

    PRIMARY KEY (tenant_id, id),

    -- FK al rol (CASCADE: si se borra el rol, se borra su config de notificaciones)
    CONSTRAINT fk_config_notif_rol
        FOREIGN KEY (tenant_id, rol_id)
        REFERENCES roles_tenant (tenant_id, id)
        ON DELETE CASCADE,

    -- Un solo registro por (tenant, rol, tipo) — UPSERT semántico
    UNIQUE INDEX idx_config_notif_unico (tenant_id, rol_id, tipo_notificacion)
        STORING (habilitado)
);

-- Lookup rápido: obtener toda la config de un rol (formulario de edición)
CREATE INDEX idx_config_notif_por_rol
    ON configuracion_notificaciones_rol (tenant_id, rol_id)
    STORING (tipo_notificacion, habilitado);

-- =============================================================================

COMMENT ON TABLE notificaciones IS 'Notificaciones en tiempo real por usuario. TTL 90 días. Cursor-based pagination. WebSocket push.';
COMMENT ON TABLE configuracion_notificaciones_rol IS 'Toggle de tipos de notificación por rol. Sin registro = habilitado por defecto. CASCADE con roles_tenant.';
COMMENT ON COLUMN notificaciones.fecha_expiracion IS 'TTL de 90 días. CockroachDB elimina automáticamente las notificaciones viejas.';
