-- =============================================================================
-- 016 - HISTORIAL DE NOTAS POR CUENTA (mini CRM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cuenta_notas (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    cuenta_id       UUID NOT NULL,
    contenido       STRING NOT NULL,
    autor_id        UUID NOT NULL,
    autor_nombre    STRING NOT NULL,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id),

    CONSTRAINT fk_cuenta_nota_cuenta
        FOREIGN KEY (cuenta_id) REFERENCES cuentas (id) ON DELETE CASCADE,
    CONSTRAINT fk_cuenta_nota_autor
        FOREIGN KEY (autor_id) REFERENCES superadmins (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cuenta_notas_cuenta ON cuenta_notas (cuenta_id, fecha DESC)
    STORING (contenido, autor_nombre);
