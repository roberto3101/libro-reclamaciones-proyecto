-- Migration 008: Agregar firma del representante legal al tenant
-- Se usa para incrustar la firma en el PDF de resolucion

ALTER TABLE configuracion_tenant ADD COLUMN IF NOT EXISTS firma_representante TEXT;

COMMENT ON COLUMN configuracion_tenant.firma_representante IS 'Firma digital del representante legal en formato base64 data URL (data:image/png;base64,...). Se incrusta en el PDF de resolucion.';
