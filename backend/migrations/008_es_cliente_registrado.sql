-- 008: Agregar columna es_cliente_registrado a reclamos
-- Indica si el consumidor fue validado como cliente de la empresa
-- contra la base de datos externa al momento de registrar el reclamo.

ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS es_cliente_registrado BOOL NOT NULL DEFAULT false;
