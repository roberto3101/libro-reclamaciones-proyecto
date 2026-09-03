import { useState, useEffect, useMemo } from 'react';
import { UiPila } from '@/ui';
import { UiBoton } from '@/ui';
import { UiIconoAnadir } from '@/ui';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import { usarSedes } from '../ganchos/usarSedes';
import { TablaSedes } from '../componentes/TablaSedes';
import { FormSede } from '../componentes/FormSede';
import { http } from '@/api/http';
import type { Sede, ApiResponse } from '@/tipos';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaSedes } from '@/componentes/ui/guias-contenido';

export default function PaginaSedes() {
  const { sedes, cargando, recargar } = usarSedes(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [sedeEditar, setSedeEditar] = useState<Sede | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'activas' | 'inactivas'>('todas');

  useEffect(() => {
    http
      .get<ApiResponse<{ slug: string }>>('/tenant')
      .then((r) => setTenantSlug(r.data.data.slug))
      .catch(() => {});
  }, []);

  const sedesFiltradas = useMemo(() => {
    if (filtro === 'activas') return sedes.filter(s => s.activo);
    if (filtro === 'inactivas') return sedes.filter(s => !s.activo);
    return sedes;
  }, [sedes, filtro]);

  const contadores = useMemo(() => ({
    todas: sedes.length,
    activas: sedes.filter(s => s.activo).length,
    inactivas: sedes.filter(s => !s.activo).length,
  }), [sedes]);

  const abrirCrear = () => {
    setSedeEditar(null);
    setMostrarForm(true);
  };

  const abrirEditar = (sede: Sede) => {
    setSedeEditar(sede);
    setMostrarForm(true);
  };

  const cerrarForm = () => {
    setMostrarForm(false);
    setSedeEditar(null);
  };

  const alGuardar = () => {
    cerrarForm();
    recargar();
  };

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="m-0 text-xl font-bold" style={{ color: 'var(--ui-texto)' }}>
          Gestión de Sedes
        </h2>
        <UiBoton
          texto="Nueva Sede"
          variante="primario"
          iconoIzquierda={<UiIconoAnadir />}
          alHacerClick={abrirCrear}
        />
      </div>

      {/* ── Filtro de estado ── */}
      <ToggleButtonGroup
        value={filtro}
        exclusive
        onChange={(_, val) => val && setFiltro(val)}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            textTransform: 'none',
            fontSize: '13px',
            fontWeight: 600,
            px: 2,
            py: 0.6,
            borderColor: 'var(--ui-borde)',
            '&.Mui-selected': { bgcolor: 'var(--ui-hover)', color: 'var(--ui-info-texto)' },
          }
        }}
      >
        <ToggleButton value="todas">Todas ({contadores.todas})</ToggleButton>
        <ToggleButton value="activas">Activas ({contadores.activas})</ToggleButton>
        <ToggleButton value="inactivas">Inactivas ({contadores.inactivas})</ToggleButton>
      </ToggleButtonGroup>

      <GuiaModulo {...guiaSedes} />

      {/* ── Tabla ── */}
      <TablaSedes
        sedes={sedesFiltradas}
        cargando={cargando}
        alRecargar={recargar}
        alEditar={abrirEditar}
        tenantSlug={tenantSlug}
      />

      {/* ── Form Modal ── */}
      <FormSede
        abierto={mostrarForm}
        alCerrar={cerrarForm}
        alGuardar={alGuardar}
        sedeEditar={sedeEditar}
      />
    </UiPila>
  );
}
