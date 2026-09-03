-- =============================================================================
-- 017 - INDICE GLOBAL POR FECHA EN auditoria_admin
-- =============================================================================
-- Motivacion: el SuperAdmin visualiza actividad agregada de TODAS las empresas
-- en /superadmin/actividad. Los indices existentes arrancan con tenant_id, por
-- lo que una query sin filtro de tenant (ORDER BY fecha DESC + filtro por
-- rango de fecha o accion) obliga a escanear la tabla entera y ordenarla.
--
-- A escala (miles de tenants, millones de filas), esto haria:
--   1) Listado del panel: scan + sort de toda la tabla = timeouts.
--   2) Exportacion streaming por rango de fecha: sin indice util.
--   3) COUNT(*) filtrado por fecha: scan completo.
--
-- Solucion: indice global con (fecha DESC) y STORING de las columnas del
-- listado para evitar lookups adicionales al disco. El JSONB `detalles` NO
-- va en STORING — solo se consulta al pedir el detalle de una fila, y
-- engordaria el indice innecesariamente.
--
-- Impacto en escritura: 1 insert extra en el indice por cada accion
-- auditada. Auditoria_admin es append-only y los inserts del backend ya
-- son "fire and forget" via goroutine, asi que el overhead es negligible.
-- =============================================================================

-- NOTA: tenant_id e id NO van en STORING porque CockroachDB ya los
-- incluye como implicit columns (pertenecen a la PK compuesta). Acceder
-- a ellos desde este indice no implica lookup adicional.
CREATE INDEX IF NOT EXISTS idx_auditoria_global_fecha
    ON auditoria_admin (fecha DESC)
    STORING (usuario_id, accion, entidad, entidad_id, ip_address);

COMMENT ON INDEX auditoria_admin@idx_auditoria_global_fecha IS
    'Indice global por fecha para queries del SuperAdmin sobre actividad agregada de todas las empresas. STORING cubre el listado del panel sin lookups a la tabla principal.';
