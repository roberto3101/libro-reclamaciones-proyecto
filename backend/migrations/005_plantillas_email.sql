-- 005_plantillas_email.sql
-- Plantillas de email editables por tenant.
-- Cada tenant tiene 5 tipos de evento con textos personalizables.
-- La estructura HTML (layout) permanece fija en el código; solo se editan los textos.

CREATE TABLE IF NOT EXISTS plantillas_email (
    tenant_id           UUID        NOT NULL,
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    tipo_evento         STRING      NOT NULL,  -- confirmacion_reclamo | nuevo_reclamo_empresa | resolucion | cambio_estado | nuevo_mensaje
    nombre_visual       STRING      NOT NULL,  -- Nombre legible para la UI
    asunto              STRING      NOT NULL,  -- Línea de asunto (soporta variables {{...}})
    saludo              STRING      NOT NULL DEFAULT '',  -- Texto de saludo
    cuerpo_principal    STRING      NOT NULL DEFAULT '',  -- Cuerpo del mensaje
    texto_pie           STRING      NOT NULL DEFAULT '',  -- Pie de página
    texto_boton         STRING      NOT NULL DEFAULT '',  -- Texto del botón CTA (si aplica)
    variables_permitidas STRING[]   NOT NULL DEFAULT ARRAY[],  -- Variables disponibles para este tipo
    activa              BOOL        NOT NULL DEFAULT true,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, tipo_evento),
    INDEX idx_plantillas_email_tipo (tenant_id, tipo_evento)
);
