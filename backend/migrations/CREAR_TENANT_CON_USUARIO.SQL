DO $$
DECLARE
    v_tenant_id UUID := gen_random_uuid();
    v_plan_id UUID;
BEGIN
    SELECT id INTO v_plan_id FROM planes WHERE codigo = 'DEMO' LIMIT 1;

    INSERT INTO configuracion_tenant (tenant_id, razon_social, ruc, slug, email_contacto, color_primario, plazo_respuesta_dias, notificar_email, notificar_email_estado, notificar_email_mensaje, notificar_email_resolucion)
    VALUES (v_tenant_id, 'Empresa Demo SRL', '20512345678', 'empresa-demo', 'admin@empresademo.pe', '#1a56db', 15, true, true, true, true);

    INSERT INTO sedes (tenant_id, nombre, slug, direccion, es_principal, activo)
    VALUES (v_tenant_id, 'Sede Principal', 'principal', 'Dirección por configurar', true, true);

    INSERT INTO usuarios_admin (tenant_id, email, nombre_completo, password_hash, rol, activo, debe_cambiar_password)
    VALUES (v_tenant_id, 'admin@empresademo.pe', 'Admin Demo', '$2a$10$BmZeVgvw8Q4XbrqCVMKbGuSVsX.4gKq6u7eZ4kBP5dFj.gRqk51H.', 'ADMIN', true, false);

    INSERT INTO roles_tenant (tenant_id, slug, nombre, descripcion, color, permisos, es_base, orden)
    VALUES
    (v_tenant_id, 'admin', 'Administrador', 'Acceso total al sistema', '#1a56db',
     '{"reclamos":{"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"cambiar_estado":true,"asignar":true},"usuarios":{"ver":true,"crear":true,"editar":true,"eliminar":true},"sedes":{"ver":true,"crear":true,"editar":true,"eliminar":true},"configuracion":{"ver":true,"editar":true},"chatbots":{"ver":true,"crear":true,"editar":true,"eliminar":true},"canales_whatsapp":{"ver":true,"crear":true,"editar":true,"eliminar":true},"atencion_vivo":{"ver":true,"asignar":true,"cambiar_estado":true},"asistente":{"ver":true},"reportes":{"ver":true,"exportar":true},"roles":{"ver":true,"crear":true,"editar":true,"eliminar":true},"plantillas_email":{"ver":true,"editar":true}}'::JSONB,
     true, 0),
    (v_tenant_id, 'soporte', 'Soporte', 'Gestión de reclamos y atención al cliente', '#6b7280',
     '{"reclamos":{"ver":true,"editar":true,"cambiar_estado":true,"exportar":true},"atencion_vivo":{"ver":true,"asignar":true,"cambiar_estado":true},"sedes":{"ver":true},"reportes":{"ver":true}}'::JSONB,
     true, 1);

    INSERT INTO suscripciones (tenant_id, plan_id, estado, ciclo, es_trial, dias_trial, fecha_fin_trial, activado_por, notas)
    VALUES (v_tenant_id, v_plan_id, 'TRIAL', 'MENSUAL', true, 30, now() + INTERVAL '30 days', 'ONBOARDING', 'Trial 30 días — onboarding manual');
END $$;
