-- =============================================================================
-- 012 - MULTI-SEDE POR USUARIO
-- =============================================================================
-- Permite asignar acceso a multiples sedes por usuario.
-- Hoy: sede_id UUID nullable (1 sede o todas).
-- Nuevo: tabla usuarios_sedes (N sedes por usuario).
-- Sin registros = acceso global (como NULL antes).
--
-- No choca con roles: roles = que puede hacer, sedes = que data ve.
-- =============================================================================


-- 1. Crear tabla de relacion usuarios ↔ sedes
CREATE TABLE IF NOT EXISTS usuarios_sedes (
    tenant_id   UUID NOT NULL,
    usuario_id  UUID NOT NULL,
    sede_id     UUID NOT NULL,

    PRIMARY KEY (tenant_id, usuario_id, sede_id),

    CONSTRAINT fk_us_usuario
        FOREIGN KEY (tenant_id, usuario_id)
        REFERENCES usuarios_admin (tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_us_sede
        FOREIGN KEY (tenant_id, sede_id)
        REFERENCES sedes (tenant_id, id)
        ON DELETE CASCADE
);

-- Buscar todas las sedes de un usuario (query principal del middleware)
-- No necesita STORING porque sede_id ya esta en la PK compuesta
CREATE INDEX IF NOT EXISTS idx_us_usuario ON usuarios_sedes (tenant_id, usuario_id);

-- Buscar todos los usuarios asignados a una sede
CREATE INDEX IF NOT EXISTS idx_us_sede ON usuarios_sedes (tenant_id, sede_id);


-- 2. Migrar datos existentes: usuarios con sede_id asignado
INSERT INTO usuarios_sedes (tenant_id, usuario_id, sede_id)
SELECT tenant_id, id, sede_id
FROM usuarios_admin
WHERE sede_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- 3. Eliminar columna sede_id de usuarios_admin (ya no se usa)
-- Primero eliminar el FK constraint y los indices que lo referencian
ALTER TABLE usuarios_admin DROP CONSTRAINT IF EXISTS fk_usuario_sede;
DROP INDEX IF EXISTS idx_admin_sede;

-- Eliminar la columna
ALTER TABLE usuarios_admin DROP COLUMN IF EXISTS sede_id;

-- 4. Actualizar indice global de email (ya no incluye sede_id en STORING)
DROP INDEX IF EXISTS idx_admin_email_global;
CREATE INDEX IF NOT EXISTS idx_admin_email_global ON usuarios_admin (email)
    STORING (nombre_completo, password_hash, rol)
    WHERE activo = true;


-- =============================================================================
-- COMENTARIOS
-- =============================================================================
COMMENT ON TABLE usuarios_sedes IS 'Relacion N:N entre usuarios y sedes. Sin registros = acceso global. CASCADE delete en ambas direcciones.';
