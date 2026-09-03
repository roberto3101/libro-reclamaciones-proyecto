import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { UiPila } from '@/ui';
import { UiBoton } from '@/ui';
import { UiIconoAnadir } from '@/ui';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import { usarUsuarios } from '../ganchos/usarUsuarios';
import { usarSedes } from '@/modulos/sedes/ganchos/usarSedes';
import { usarRoles } from '@/modulos/roles/ganchos/usarRoles';
import { TablaUsuarios } from '../componentes/TablaUsuarios';
import { FormUsuario } from '../componentes/FormUsuario';
import { ModalAgregarUsuarioExistente } from '../componentes/ModalAgregarUsuarioExistente';
import { usuariosApi } from '../api/usuarios.api';
import type { Usuario } from '@/tipos';
import { usarAuth } from '@/aplicacion/ganchos/usarAuth';
import { notificar } from '@/aplicacion/helpers/toast';
import { GuiaModulo } from '@/componentes/ui/GuiaModulo';
import { guiaUsuarios } from '@/componentes/ui/guias-contenido';

/* ── Theme tokens (CSS custom properties → works in light & dark) ── */
const T = {
  text: { color: 'var(--ui-texto)' } as CSSProperties,
};

export default function PaginaUsuarios() {
  const { usuarios, cargando, recargar } = usarUsuarios();
  const { sedes } = usarSedes();
  const { roles } = usarRoles();
  const { usuario: usuarioActual } = usarAuth();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [mostrarAgregarExistente, setMostrarAgregarExistente] = useState(false);

  const usuariosFiltrados = useMemo(() => {
    if (filtro === 'activos') return usuarios.filter(u => u.activo);
    if (filtro === 'inactivos') return usuarios.filter(u => !u.activo);
    return usuarios;
  }, [usuarios, filtro]);

  const contadores = useMemo(() => ({
    todos: usuarios.length,
    activos: usuarios.filter(u => u.activo).length,
    inactivos: usuarios.filter(u => !u.activo).length,
  }), [usuarios]);

  const abrirCrear = () => {
    setUsuarioEditar(null);
    setMostrarForm(true);
  };

  const esAdmin = usuarioActual?.rol?.toUpperCase() === 'ADMIN';

  const abrirEditar = (usuario: Usuario) => {
    if (!esAdmin && usuario.rol?.toUpperCase() === 'ADMIN') {
      notificar.advertencia('Solo un administrador puede editar a otro administrador');
      return;
    }
    setUsuarioEditar(usuario);
    setMostrarForm(true);
  };

  const cerrarForm = () => {
    setMostrarForm(false);
    setUsuarioEditar(null);
  };

  return (
    <UiPila direccion="columna" espaciado={3}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="m-0 text-xl font-bold" style={T.text}>
          Gestión de Usuarios
        </h2>
        <div className="flex gap-2">
          <UiBoton
            texto="Agregar existente"
            variante="secundario"
            alHacerClick={() => setMostrarAgregarExistente(true)}
          />
          <UiBoton
            texto="Nuevo Usuario"
            variante="primario"
            iconoIzquierda={<UiIconoAnadir />}
            alHacerClick={abrirCrear}
          />
        </div>
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
        <ToggleButton value="todos">Todos ({contadores.todos})</ToggleButton>
        <ToggleButton value="activos">Activos ({contadores.activos})</ToggleButton>
        <ToggleButton value="inactivos">Inactivos ({contadores.inactivos})</ToggleButton>
      </ToggleButtonGroup>

      <GuiaModulo {...guiaUsuarios} />

      {/* ── Tabla ── */}
      <TablaUsuarios
        usuarios={usuariosFiltrados}
        sedes={sedes}
        roles={roles}
        cargando={cargando}
        alRecargar={recargar}
        alEditar={abrirEditar}
        usuarioActualId={usuarioActual?.id}
      />

      {/* ── Form Modal ── */}
      <FormUsuario
        abierto={mostrarForm}
        usuario={usuarioEditar}
        sedes={sedes}
        roles={roles}
        esAdmin={esAdmin}
        alCerrar={cerrarForm}
        alGuardar={() => {
          cerrarForm();
          recargar();
        }}
      />

      {/* ── Modal "Agregar usuario existente" ── */}
      <ModalAgregarUsuarioExistente
        abierto={mostrarAgregarExistente}
        sedes={sedes}
        roles={roles}
        esAdmin={esAdmin}
        alCerrar={() => setMostrarAgregarExistente(false)}
        alAgregado={() => {
          setMostrarAgregarExistente(false);
          recargar();
        }}
        buscarFn={(email) => usuariosApi.buscarEnCuenta(email)}
        agregarFn={(datos) => usuariosApi.agregarExistente(datos)}
      />
    </UiPila>
  );
}
