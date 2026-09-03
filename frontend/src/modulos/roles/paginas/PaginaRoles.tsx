import { useState } from 'react';
import type { CSSProperties } from 'react';
import { UiPila } from '@/ui';
import { UiBoton } from '@/ui';
import { UiIconoAnadir } from '@/ui';
import { usarRoles } from '../ganchos/usarRoles';
import { TablaRoles } from '../componentes/TablaRoles';
import { FormRol } from '../componentes/FormRol';
import type { RolTenant } from '@/tipos';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaRoles } from '@/componentes/ui/guias-contenido';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';

const T = {
  text: { color: 'var(--ui-texto)' } as CSSProperties,
};

export default function PaginaRoles() {
  const { usuario } = usarEstadoAuth();
  const { roles, cargando, recargar } = usarRoles();
  const esAdmin = roles.some(r => r.slug.toLowerCase() === usuario?.rol?.toLowerCase() && r.es_admin) || usuario?.rol === 'ADMIN';
  const rolSlugActual = usuario?.rol ?? '';
  const [mostrarForm, setMostrarForm] = useState(false);
  const [rolEditar, setRolEditar] = useState<RolTenant | null>(null);

  const abrirCrear = () => {
    setRolEditar(null);
    setMostrarForm(true);
  };

  const abrirEditar = (rol: RolTenant) => {
    setRolEditar(rol);
    setMostrarForm(true);
  };

  const cerrarForm = () => {
    setMostrarForm(false);
    setRolEditar(null);
  };

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="m-0 text-xl font-bold" style={T.text}>
            Gestión de Roles
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', opacity: 0.6 }}>
            Configura los roles y permisos de tu equipo.
          </p>
        </div>
        <UiBoton
          texto="Nuevo Rol"
          variante="primario"
          iconoIzquierda={<UiIconoAnadir />}
          alHacerClick={abrirCrear}
        />
      </div>

      <GuiaModulo {...guiaRoles} />

      {/* Tabla */}
      <TablaRoles
        roles={roles}
        cargando={cargando}
        alRecargar={recargar}
        alEditar={abrirEditar}
        esAdmin={esAdmin}
        rolSlugActual={rolSlugActual}
      />

      {/* Form Modal */}
      <FormRol
        abierto={mostrarForm}
        rol={rolEditar}
        esUsuarioAdmin={esAdmin}
        alCerrar={cerrarForm}
        alGuardar={() => {
          cerrarForm();
          recargar();
        }}
      />
    </UiPila>
  );
}
