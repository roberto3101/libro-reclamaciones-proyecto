-- =============================================================================
-- 011 - SOPORTE MULTI-EMPRESA
-- =============================================================================
-- Agrega:
--   1. Tabla `cuentas`      — agrupa tenants (empresas) bajo un cliente
--   2. Tabla `superadmins`  — usuarios interno (staff, no pertenecen a ningun tenant)
--   3. Columna `cuenta_id`  — en configuracion_tenant para vincular empresa a cuenta
--   4. Indice global email  — en usuarios_admin para login multi-tenant eficiente
--
-- PRINCIPIOS:
--   - Aditiva: no modifica PKs, FKs ni indices existentes
--   - Backward compatible: cuenta_id es nullable (tenants sin cuenta siguen funcionando)
--   - Optimizada para 5,000+ empresas: indices con STORING para evitar lookups
--   - Sin triggers (CockroachDB no los soporta)
--
-- MODELO:
--   Cuenta (1) ──── (N) Tenants/Empresas
--   SuperAdmin — auth separado, acceso a todo
--   Usuario ──── puede existir en N tenants (mismo email, distintos tenant_id)
-- =============================================================================


-- =============================================================================
-- 1. CUENTAS (clientes que agrupan empresas)
-- =============================================================================
-- Representa al cliente final (persona o entidad que contrata el servicio).
-- Un cliente puede tener N empresas (tenants). Ejemplo:
--   Cuenta "Grupo Quma SAC" → Empresa Quma + Empresa CYB
--
-- NO tiene tenant_id — es una entidad cross-tenant.
-- El SuperAdmin administra esta tabla.
-- =============================================================================
CREATE TABLE IF NOT EXISTS cuentas (
    id                      UUID NOT NULL DEFAULT gen_random_uuid(),

    nombre                  STRING NOT NULL,           -- "Grupo Quma SAC"
    email_contacto          STRING NOT NULL,           -- Email principal del cliente
    telefono                STRING,
    ruc                     STRING,                    -- RUC del grupo/holding (opcional)
    direccion               STRING,
    notas                   STRING,                    -- Notas internas del SuperAdmin

    activo                  BOOL NOT NULL DEFAULT true,

    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- Buscar cuenta por email (SuperAdmin busca clientes)
CREATE INDEX IF NOT EXISTS idx_cuenta_email ON cuentas (email_contacto)
    STORING (nombre, ruc, activo);

-- Buscar cuenta por RUC
CREATE INDEX IF NOT EXISTS idx_cuenta_ruc ON cuentas (ruc)
    STORING (nombre, email_contacto, activo)
    WHERE ruc IS NOT NULL;

-- Listar cuentas activas (panel SuperAdmin)
CREATE INDEX IF NOT EXISTS idx_cuenta_activa ON cuentas (activo, nombre ASC)
    STORING (email_contacto, ruc, telefono)
    WHERE activo = true;

-- Busqueda por nombre (SuperAdmin busca por texto)
CREATE INDEX IF NOT EXISTS idx_cuenta_nombre ON cuentas (nombre)
    STORING (email_contacto, ruc, activo);


-- =============================================================================
-- 2. SUPERADMINS (staff interno)
-- =============================================================================
-- Usuarios internos que administran TODA la plataforma.
-- Completamente separados de usuarios_admin (no pertenecen a ningun tenant).
-- Auth flow independiente: cookie propia (lr_sa_session), JWT sin tenant_id.
--
-- Endpoints: /api/v1/superadmin/*
-- =============================================================================
CREATE TABLE IF NOT EXISTS superadmins (
    id                      UUID NOT NULL DEFAULT gen_random_uuid(),

    email                   STRING NOT NULL,
    password_hash           STRING NOT NULL,
    nombre                  STRING NOT NULL,

    activo                  BOOL NOT NULL DEFAULT true,
    ultimo_acceso           TIMESTAMPTZ,

    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- Email unico global (solo puede haber un superadmin con ese email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_superadmin_email ON superadmins (email);


-- =============================================================================
-- 3. VINCULAR TENANT A CUENTA
-- =============================================================================
-- Agrega cuenta_id a configuracion_tenant para saber a que cliente
-- pertenece cada empresa. Nullable para backward compatibility.
--
-- Tenants sin cuenta_id siguen funcionando exactamente igual.
-- El SuperAdmin puede asignar tenants huerfanos a cuentas en cualquier momento.
-- =============================================================================
ALTER TABLE configuracion_tenant ADD COLUMN IF NOT EXISTS cuenta_id UUID;

-- FK a cuentas: garantiza que cuenta_id apunte a una cuenta real
ALTER TABLE configuracion_tenant ADD CONSTRAINT IF NOT EXISTS fk_tenant_cuenta
    FOREIGN KEY (cuenta_id) REFERENCES cuentas (id);
-- Buscar todos los tenants de una cuenta (query principal del SuperAdmin)
-- Nota: tenant_id NO va en STORING porque ya esta implicito en la PK compuesta
CREATE INDEX IF NOT EXISTS idx_tenant_cuenta ON configuracion_tenant (cuenta_id)
    STORING (razon_social, ruc, slug, logo_url, activo)
    WHERE cuenta_id IS NOT NULL;


-- =============================================================================
-- 4. INDICE GLOBAL DE EMAIL EN USUARIOS
-- =============================================================================
-- Hoy GetByEmailGlobal() hace:
--   SELECT ... FROM usuarios_admin WHERE email = $1 AND activo = true LIMIT 1
-- Esto es un full-scan cuando hay 5,000+ tenants.
--
-- El nuevo indice permite buscar TODOS los usuarios con un email
-- de forma eficiente (covering index, sin lookups adicionales).
-- Es critico para el login multi-empresa.
-- =============================================================================
-- Nota: tenant_id NO va en STORING porque ya esta implicito en la PK compuesta
CREATE INDEX IF NOT EXISTS idx_admin_email_global ON usuarios_admin (email)
    STORING (nombre_completo, password_hash, rol, sede_id)
    WHERE activo = true;


-- =============================================================================
-- SEED: Primer SuperAdmin interno
-- =============================================================================
-- MARCADOR: cambia el correo y genera tu propio hash bcrypt antes de usarlo.
-- CAMBIAR EN PRODUCCION inmediatamente despues del deploy.
-- =============================================================================
INSERT INTO superadmins (email, password_hash, nombre)
VALUES (
    'CAMBIAR@TU-DOMINIO.pe',
    '$2a$10$7ih5EEr1/b5Wka0qRJIFOOXCgqtQVnxu6BpHE2tm2Zhd1btcWVo.u',
    'Administrador'
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- COMENTARIOS
-- =============================================================================
COMMENT ON TABLE cuentas IS 'Clientes que agrupan empresas (tenants). Sin tenant_id. Administrado por SuperAdmin.';
COMMENT ON TABLE superadmins IS 'Staff interno. Auth separado. Acceso a todo. Sin tenant_id.';
COMMENT ON COLUMN configuracion_tenant.cuenta_id IS 'FK logica a cuentas.id. Nullable. Tenants sin cuenta siguen funcionando.';
COMMENT ON INDEX idx_admin_email_global IS 'Covering index para login multi-empresa. Busca todos los usuarios activos por email sin full-scan.';
