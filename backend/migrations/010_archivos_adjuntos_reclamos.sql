-- 010: Agregar columna archivos_adjuntos a la tabla reclamos
-- Almacena las claves de archivos subidos a Cloudflare R2 como un array JSON

ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS archivos_adjuntos JSONB;
