UPDATE roles_tenant
SET permisos = permisos || '{"plantillas_email":{"ver":true,"editar":true}}'::JSONB
WHERE slug = 'admin';
