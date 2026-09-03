-- 009: Agregar columna activado_por_usuario_id a suscripciones
-- Para registrar qué usuario realizó el cambio de plan o activación.
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS activado_por_usuario_id UUID;
