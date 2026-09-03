import { useState, useEffect } from 'react';
import { UiPila } from '@/ui';
import { UiCargando, UiTarjeta } from '@/ui';
import type { PlantillaEmail, Tenant } from '@/tipos';
import { usarPlantillasEmail } from '../ganchos/usarPlantillasEmail';
import { TablaPlantillasEmail } from '../componentes/TablaPlantillasEmail';
import { FormPlantillaEmail } from '../componentes/FormPlantillaEmail';
import { tenantApi } from '@/modulos/tenant/api/tenant.api';

export default function PaginaPlantillasEmail() {
  const { plantillas, cargando, recargar } = usarPlantillasEmail();
  const [editando, setEditando] = useState<PlantillaEmail | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    tenantApi.obtener().then(setTenant).catch(() => {});
  }, []);

  const manejarGuardar = () => {
    setEditando(null);
    recargar();
  };

  return (
    <UiPila direccion="columna" espaciado={3} sx={{ pb: 4 }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
          Plantillas de Email
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--ui-texto-2, #857e70)' }}>
          Personaliza los textos de los correos que se envian a clientes y a la empresa.
          La estructura visual se mantiene fija para garantizar compatibilidad con Gmail.
        </p>
      </div>

      {cargando && plantillas.length === 0 ? (
        <UiCargando tipo="anillo" etiqueta="Cargando plantillas..." />
      ) : editando ? (
        <FormPlantillaEmail
          plantilla={editando}
          tenant={tenant}
          alGuardar={manejarGuardar}
          alCancelar={() => setEditando(null)}
        />
      ) : (
        <UiTarjeta titulo="Plantillas configuradas">
          <TablaPlantillasEmail
            plantillas={plantillas}
            alEditar={setEditando}
          />
        </UiTarjeta>
      )}
    </UiPila>
  );
}
