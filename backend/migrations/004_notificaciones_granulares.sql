-- Toggles granulares de notificación por email.
-- notificar_email existente controla "nuevo reclamo".
-- Los 3 nuevos controlan: cambio de estado, nuevo mensaje, resolución con PDF.

ALTER TABLE configuracion_tenant
  ADD COLUMN IF NOT EXISTS notificar_email_estado     BOOL NOT NULL DEFAULT true;

ALTER TABLE configuracion_tenant
  ADD COLUMN IF NOT EXISTS notificar_email_mensaje    BOOL NOT NULL DEFAULT true;

ALTER TABLE configuracion_tenant
  ADD COLUMN IF NOT EXISTS notificar_email_resolucion BOOL NOT NULL DEFAULT true;
