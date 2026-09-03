-- 019: renombra es_cliente_codeplex -> es_cliente_registrado
--
-- La columna llevaba el nombre de la marca anterior. Se renombra para que
-- coincida con lo que muestra la interfaz ("cliente registrado") y para no
-- arrastrar esa marca en el esquema.
--
-- Se ejecuta UNA sola vez. No lleva guarda condicional porque CockroachDB
-- no admite bloques DO de PL/pgSQL ni IF EXISTS en RENAME COLUMN; sobre una
-- base ya migrada devuelve "column does not exist", que es inofensivo.
--
--   cockroach sql --insecure --host=localhost:26257 \
--     --database=libroreclamaciones -f migrations/019_renombrar_es_cliente.sql

ALTER TABLE reclamos RENAME COLUMN es_cliente_codeplex TO es_cliente_registrado;
