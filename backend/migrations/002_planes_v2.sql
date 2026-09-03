-- =============================================================================
-- MIGRACIÓN v2: Planes y Suscripciones — Actualización de features reales
-- Ejecutar DESPUÉS del schema base
-- =============================================================================
--
-- Cambios:
--   1. Agrega columnas faltantes en planes (asistente IA, atención en vivo, canales WA)
--   2. Agrega override de canales WA en suscripciones
--   3. Recrea v_uso_tenant con campos nuevos
--   4. Actualiza seed data de planes a estructura real (DEMO/EMPRENDEDOR/PYME/PRO)
--   5. Agrega columna precio_ruc_extra y precio_sede_extra en planes
-- =============================================================================


-- ─── 1. NUEVAS COLUMNAS EN PLANES ──────────────────────────────────────────

ALTER TABLE planes ADD COLUMN IF NOT EXISTS max_canales_whatsapp  INT  NOT NULL DEFAULT 0;
ALTER TABLE planes ADD COLUMN IF NOT EXISTS permite_asistente_ia  BOOL NOT NULL DEFAULT false;
ALTER TABLE planes ADD COLUMN IF NOT EXISTS permite_atencion_vivo BOOL NOT NULL DEFAULT false;

-- Precios de extras (para upselling)
ALTER TABLE planes ADD COLUMN IF NOT EXISTS precio_sede_extra     DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE planes ADD COLUMN IF NOT EXISTS precio_usuario_extra  DECIMAL(10, 2) NOT NULL DEFAULT 0;


-- ─── 2. NUEVA COLUMNA EN SUSCRIPCIONES ────────────────────────────────────

ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS override_max_canales_whatsapp INT;


-- ─── 3. RECREAR VISTA v_uso_tenant ─────────────────────────────────────────

DROP VIEW IF EXISTS v_uso_tenant CASCADE;

CREATE VIEW v_uso_tenant AS
SELECT
    ct.tenant_id,
    -- Plan actual
    p.id                                        AS plan_id,
    p.codigo                                    AS plan_codigo,
    p.nombre                                    AS plan_nombre,
    s.id                                        AS suscripcion_id,
    s.estado                                    AS suscripcion_estado,
    s.ciclo                                     AS suscripcion_ciclo,
    s.es_trial                                  AS suscripcion_es_trial,
    s.fecha_inicio                              AS suscripcion_fecha_inicio,
    s.fecha_fin                                 AS suscripcion_fecha_fin,
    s.fecha_fin_trial                           AS suscripcion_fecha_fin_trial,
    s.fecha_proximo_cobro                       AS suscripcion_proximo_cobro,

    -- Límites efectivos (override > plan, -1 = ilimitado)
    COALESCE(s.override_max_sedes, p.max_sedes)                         AS limite_sedes,
    COALESCE(s.override_max_usuarios, p.max_usuarios)                   AS limite_usuarios,
    COALESCE(s.override_max_reclamos, p.max_reclamos_mes)               AS limite_reclamos_mes,
    COALESCE(s.override_max_chatbots, p.max_chatbots)                   AS limite_chatbots,
    COALESCE(s.override_max_canales_whatsapp, p.max_canales_whatsapp)   AS limite_canales_whatsapp,
    COALESCE(s.override_max_storage_mb, p.max_storage_mb)               AS limite_storage_mb,

    -- Funcionalidades
    p.permite_chatbot,
    p.permite_whatsapp,
    p.permite_email,
    p.permite_reportes_pdf,
    p.permite_exportar_excel,
    p.permite_api,
    p.permite_marca_blanca,
    p.permite_multi_idioma,
    p.permite_asistente_ia,
    p.permite_atencion_vivo,

    -- Uso actual
    (SELECT COUNT(*) FROM sedes sd
     WHERE sd.tenant_id = ct.tenant_id AND sd.activo = true)                AS uso_sedes,
    (SELECT COUNT(*) FROM usuarios_admin ua
     WHERE ua.tenant_id = ct.tenant_id AND ua.activo = true)                AS uso_usuarios,
    (SELECT COUNT(*) FROM reclamos r
     WHERE r.tenant_id = ct.tenant_id
       AND r.deleted_at IS NULL
       AND r.fecha_registro >= DATE_TRUNC('month', CURRENT_DATE))           AS uso_reclamos_mes,
    (SELECT COUNT(*) FROM chatbots cb
     WHERE cb.tenant_id = ct.tenant_id AND cb.activo = true)                AS uso_chatbots,
    (SELECT COUNT(*) FROM canales_whatsapp cw
     WHERE cw.tenant_id = ct.tenant_id AND cw.activo = true)               AS uso_canales_whatsapp

FROM configuracion_tenant ct
JOIN suscripciones s ON s.tenant_id = ct.tenant_id AND s.estado IN ('ACTIVA', 'TRIAL')
JOIN planes p ON p.id = s.plan_id;


-- ─── 4. ACTUALIZAR SEED DATA ──────────────────────────────────────────────
-- Borra los planes viejos y crea los nuevos.
-- IMPORTANTE: Si ya hay suscripciones apuntando a planes viejos, 
-- primero migrar las suscripciones o usar UPDATE en vez de DELETE.
-- En desarrollo es seguro hacer DELETE + INSERT.

DELETE FROM planes WHERE codigo IN ('DEMO', 'BRONZE', 'IRON', 'GOLD', 'EMPRENDEDOR', 'PYME', 'PRO');

INSERT INTO planes (
    codigo, nombre, descripcion,
    precio_mensual, precio_anual, precio_sede_extra, precio_usuario_extra,
    max_sedes, max_usuarios, max_reclamos_mes, max_chatbots, max_canales_whatsapp,
    permite_chatbot, permite_whatsapp, permite_email,
    permite_reportes_pdf, permite_exportar_excel, permite_api,
    permite_marca_blanca, permite_multi_idioma,
    permite_asistente_ia, permite_atencion_vivo,
    max_storage_mb, orden, activo, destacado
) VALUES
    -- DEMO: Prueba gratuita 15 días
    ('DEMO', 'Plan Demo',
     'Prueba gratuita por 15 días. Conoce todas las funcionalidades.',
     0, NULL, 0, 0,
     1, 1, 20, 0, 0,
     false, false, true,
     false, false, false,
     false, false,
     false, false,
     50, 1, true, false),

    -- EMPRENDEDOR: Ideal para negocios pequeños
    ('EMPRENDEDOR', 'Plan Emprendedor',
     'Ideal para emprendedores y negocios pequeños con una sede.',
     19.90, 179.90, 20.00, 15.00,
     3, 1, -1, 1, 1,
     true, true, true,
     true, true, false,
     false, false,
     true, true,
     200, 2, true, false),

    -- PYME: El favorito de las PYMEs
    ('PYME', 'Plan PYME',
     'El favorito de las PYMEs. Múltiples sedes y usuarios.',
     44.90, 449.90, 20.00, 10.00,
     15, 5, -1, 2, 1,
     true, true, true,
     true, true, true,
     false, false,
     true, true,
     1000, 3, true, true),

    -- PRO: Para empresas establecidas
    ('PRO', 'Plan Pro',
     'Para empresas establecidas. Sin límites operativos. Marca blanca incluida.',
     84.90, 899.90, 15.00, 8.00,
     50, 10, -1, 5, 2,
     true, true, true,
     true, true, true,
     true, true,
     true, true,
     10000, 4, true, false);


-- ─── 5. ACTUALIZAR SUSCRIPCIONES EXISTENTES (desarrollo) ──────────────────
-- Apuntar suscripciones huérfanas al plan DEMO
-- (Solo si hay suscripciones apuntando a planes que ya no existen)

UPDATE suscripciones
SET plan_id = (SELECT id FROM planes WHERE codigo = 'DEMO' LIMIT 1)
WHERE plan_id NOT IN (SELECT id FROM planes);


-- =============================================================================
COMMENT ON COLUMN planes.max_canales_whatsapp IS 'Máximo de canales WhatsApp. -1 = ilimitado. 0 = no disponible.';
COMMENT ON COLUMN planes.permite_asistente_ia IS 'Habilita el asistente IA interno del panel admin.';
COMMENT ON COLUMN planes.permite_atencion_vivo IS 'Habilita el chat en vivo con asesores (solicitudes + mensajes).';
COMMENT ON COLUMN planes.precio_sede_extra IS 'Precio mensual por cada sede adicional sobre el límite del plan.';
COMMENT ON COLUMN planes.precio_usuario_extra IS 'Precio mensual por cada usuario adicional sobre el límite del plan.';
