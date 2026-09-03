-- =============================================================================
-- 015 - CUENTA OBLIGATORIA: toda empresa debe pertenecer a una cuenta
-- =============================================================================
-- Antes: cuenta_id nullable (empresas podían existir sin cuenta)
-- Ahora: cuenta_id NOT NULL (solo el SA crea empresas bajo cuentas)
-- =============================================================================

-- 1. Crear cuenta por defecto para tenants huérfanos
INSERT INTO cuentas (id, nombre, email_contacto, notas)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Cuenta por defecto (migración)',
    'CAMBIAR@TU-DOMINIO.pe',
    'Cuenta creada automáticamente para tenants que existían antes de la migración 015. Reasignar manualmente.'
) ON CONFLICT DO NOTHING;

-- 2. Asignar tenants huérfanos a la cuenta por defecto
UPDATE configuracion_tenant
SET cuenta_id = '00000000-0000-0000-0000-000000000001',
    fecha_actualizacion = now()
WHERE cuenta_id IS NULL;

-- 3. Hacer cuenta_id NOT NULL
ALTER TABLE configuracion_tenant ALTER COLUMN cuenta_id SET NOT NULL;

-- 4. Recrear índice sin filtro WHERE (ya no hay NULLs)
DROP INDEX IF EXISTS idx_tenant_cuenta;
CREATE INDEX idx_tenant_cuenta ON configuracion_tenant (cuenta_id)
    STORING (razon_social, ruc, slug, logo_url, activo);
