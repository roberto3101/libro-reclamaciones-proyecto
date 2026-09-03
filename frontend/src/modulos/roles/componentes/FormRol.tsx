import { useState, useEffect } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiCampoTexto } from '@/ui';
import { UiPila } from '@/ui';
import { Typography, Divider, FormControlLabel, Switch, Alert } from '@mui/material';
import type { RolTenant } from '@/tipos';
import { rolesApi } from '../api/roles.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';
import { MatrizPermisos } from './MatrizPermisos';
import { ConfiguracionNotificacionesRol } from '@/modulos/notificaciones/componentes/ConfiguracionNotificacionesRol';
import { notificacionesApi } from '@/modulos/notificaciones/api/notificaciones.api';

interface Props {
  abierto: boolean;
  rol?: RolTenant | null;
  esUsuarioAdmin?: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}

export function FormRol({ abierto, rol, esUsuarioAdmin, alCerrar, alGuardar }: Props) {
  const esEdicion = !!rol;

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [color, setColor] = useState('#857e70');
  const [permisos, setPermisos] = useState<Record<string, Record<string, boolean>>>({});
  const [esAdmin, setEsAdmin] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [configNotificaciones, setConfigNotificaciones] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (rol) {
      setNombre(rol.nombre);
      setDescripcion(rol.descripcion);
      setColor(rol.color || '#857e70');
      setPermisos(rol.permisos || {});
      setEsAdmin(rol.es_admin || false);
    } else {
      setNombre('');
      setDescripcion('');
      setColor('#857e70');
      setPermisos({});
      setEsAdmin(false);
      setConfigNotificaciones({});
    }
  }, [rol, abierto]);

  const manejarGuardar = async () => {
    if (!nombre.trim()) {
      notificar.advertencia('El nombre del rol es obligatorio');
      return;
    }

    // Si no es admin, verificar que tenga al menos un permiso
    if (!esAdmin) {
      const totalPermisos = Object.values(permisos).reduce(
        (sum, acciones) => sum + Object.values(acciones).filter(Boolean).length, 0
      );
      if (totalPermisos === 0) {
        notificar.advertencia('El rol debe tener al menos un permiso activo');
        return;
      }
    }

    setCargando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        color,
        permisos,
        es_admin: esAdmin,
      };

      let rolIdParaConfig: string | undefined;

      if (esEdicion && rol) {
        await rolesApi.actualizar(rol.id, payload);
        rolIdParaConfig = rol.id;
        notificar.exito('Rol actualizado');
      } else {
        const nuevoRol = await rolesApi.crear(payload);
        rolIdParaConfig = nuevoRol?.id;
        notificar.exito('Rol creado exitosamente');
      }

      // Guardar config de notificaciones por separado para no bloquear el guardado del rol
      if (rolIdParaConfig && Object.keys(configNotificaciones).length > 0) {
        try {
          const configuraciones = Object.entries(configNotificaciones).map(([tipo, habilitado]) => ({
            tipo_notificacion: tipo,
            habilitado,
          }));
          await notificacionesApi.actualizarConfiguracionPorRol(rolIdParaConfig, configuraciones);
        } catch {
          notificar.advertencia('El rol se guardó pero hubo un error al guardar las notificaciones');
        }
      }

      alGuardar();
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={esEdicion ? 'Editar Rol' : 'Nuevo Rol'}
      maxAncho="lg"
      pie={
        <>
          <BotonModal texto="Cancelar" variante="secundario" onClick={alCerrar} />
          <BotonModal
            texto={esEdicion ? 'Guardar Cambios' : 'Crear Rol'}
            onClick={manejarGuardar}
            cargando={cargando}
          />
        </>
      }
    >
      <UiPila direccion="columna" espaciado={2} sx={{ py: { xs: 1, sm: 0 } }}>
        {/* Nombre y Color */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <UiCampoTexto
              etiqueta="Nombre del Rol"
              valor={nombre}
              alCambiar={(e) => setNombre(e.target.value)}
              marcador="Ej: Supervisor, Cajero, Auditor..."
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px' }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '36px', height: '36px', padding: 0,
                border: '1px solid var(--ui-info-borde)',
                borderRadius: '6px', cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
              title="Color del rol"
            />
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600 }}>{color}</p>
              <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5 }}>Color del badge</p>
            </div>
          </div>
        </div>

        <UiCampoTexto
          etiqueta="Descripción"
          valor={descripcion}
          alCambiar={(e) => setDescripcion(e.target.value)}
          marcador="Breve descripción de las responsabilidades del rol"
        />

        {/* Toggle Admin */}
        {esUsuarioAdmin && (
          <>
            <Divider />
            <FormControlLabel
              control={
                <Switch
                  checked={esAdmin}
                  onChange={(e) => setEsAdmin(e.target.checked)}
                  color="primary"
                />
              }
              label="Acceso total (Administrador)"
              sx={{ ml: 0 }}
            />
            {esAdmin && (
              <Alert severity="info" sx={{ mt: -1 }}>
                Este rol tendrá acceso completo al sistema, ignorando la matriz de permisos.
              </Alert>
            )}
          </>
        )}

        <Divider />

        {/* Matriz de permisos */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'text.secondary',
          }}
        >
          Matriz de Permisos
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
          Selecciona qué acciones puede realizar este rol en cada módulo del sistema.
        </Typography>

        <div style={{
          maxHeight: '50vh',
          overflowY: 'auto',
          border: '1px solid var(--ui-info-borde)',
          borderRadius: 'var(--ui-r-lg)',
          padding: '8px',
        }}>
          <MatrizPermisos
            permisos={permisos}
            alCambiar={setPermisos}
          />
        </div>

        <Divider />

        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'text.secondary',
          }}
        >
          Notificaciones del Rol
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
          Configura qué notificaciones en tiempo real reciben los usuarios con este rol.
        </Typography>

        <ConfiguracionNotificacionesRol
          rolId={esEdicion && rol ? rol.id : undefined}
          configuraciones={configNotificaciones}
          alCambiar={setConfigNotificaciones}
        />
      </UiPila>
    </ModalBase>
  );
}
