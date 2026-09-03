import { useEffect, useState } from 'react';
import { UiCargando } from '@/ui';
import { Checkbox, Tooltip, IconButton } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RemoveDoneIcon from '@mui/icons-material/RemoveDone';
import { Button, Stack } from '@mui/material';
import type { DefinicionPermisos } from '@/tipos';
import { rolesApi } from '../api/roles.api';

interface Props {
  permisos: Record<string, Record<string, boolean>>;
  alCambiar: (permisos: Record<string, Record<string, boolean>>) => void;
  soloLectura?: boolean;
}

// Orden visual de los módulos (más importante primero)
const ORDEN_MODULOS = [
  'dashboard', 'reclamos', 'usuarios', 'sedes', 'configuracion',
  'chatbots', 'canales_whatsapp', 'atencion_vivo', 'asistente',
  'roles', 'plantillas_email',
];

export function MatrizPermisos({ permisos, alCambiar, soloLectura = false }: Props) {
  const [definicion, setDefinicion] = useState<DefinicionPermisos | null>(null);
  const [cargandoDefinicion, setCargandoDefinicion] = useState(true);

  useEffect(() => {
    rolesApi.obtenerDefinicion()
      .then(setDefinicion)
      .catch(() => {})
      .finally(() => setCargandoDefinicion(false));
  }, []);

  if (cargandoDefinicion || !definicion) {
    return <UiCargando tipo="anillo" etiqueta="Cargando permisos..." />;
  }

  const { modulos, etiquetas_modulos, etiquetas_acciones } = definicion;

  // Recopilar todas las acciones únicas en el orden correcto
  const todasLasAcciones = Array.from(
    new Set(Object.values(modulos).flat())
  );

  const alternarPermiso = (modulo: string, accion: string) => {
    if (soloLectura) return;
    const nuevosPermisos = { ...permisos };
    if (!nuevosPermisos[modulo]) nuevosPermisos[modulo] = {};
    const nuevoValor = !nuevosPermisos[modulo]?.[accion];
    nuevosPermisos[modulo] = { ...nuevosPermisos[modulo], [accion]: nuevoValor };

    if (accion === 'ver' && !nuevoValor) {
      // Al desmarcar "ver", desmarcar todas las demás acciones del módulo
      const acciones = modulos[modulo] || [];
      acciones.forEach((a) => { nuevosPermisos[modulo][a] = false; });
    } else if (accion !== 'ver' && nuevoValor) {
      // Al marcar cualquier otra acción, automarcar "ver"
      if ((modulos[modulo] || []).includes('ver')) {
        nuevosPermisos[modulo]['ver'] = true;
      }
    }

    alCambiar(nuevosPermisos);
  };

  const marcarTodoModulo = (modulo: string) => {
    if (soloLectura) return;
    const acciones = modulos[modulo] || [];
    const nuevosPermisos = { ...permisos };
    nuevosPermisos[modulo] = {};
    acciones.forEach((a) => { nuevosPermisos[modulo][a] = true; });
    alCambiar(nuevosPermisos);
  };

  const desmarcarTodoModulo = (modulo: string) => {
    if (soloLectura) return;
    const nuevosPermisos = { ...permisos };
    nuevosPermisos[modulo] = {};
    alCambiar(nuevosPermisos);
  };

  const tienePermiso = (modulo: string, accion: string): boolean =>
    permisos[modulo]?.[accion] === true;

  const moduloTieneTodo = (modulo: string): boolean => {
    const acciones = modulos[modulo] || [];
    return acciones.every((a) => tienePermiso(modulo, a));
  };

  const todosLosModulosTienenTodo = (): boolean =>
    ORDEN_MODULOS.filter((m) => modulos[m]).every(moduloTieneTodo);

  const asignarTodosLosPermisos = () => {
    if (soloLectura) return;
    const nuevosPermisos: Record<string, Record<string, boolean>> = {};
    for (const modulo of Object.keys(modulos)) {
      nuevosPermisos[modulo] = {};
      for (const accion of modulos[modulo]) {
        nuevosPermisos[modulo][accion] = true;
      }
    }
    alCambiar(nuevosPermisos);
  };

  const desmarcarTodosLosPermisos = () => {
    if (soloLectura) return;
    const nuevosPermisos: Record<string, Record<string, boolean>> = {};
    for (const modulo of Object.keys(modulos)) {
      nuevosPermisos[modulo] = {};
    }
    alCambiar(nuevosPermisos);
  };

  // Ordenar módulos según orden visual
  const modulosOrdenados = ORDEN_MODULOS.filter((m) => modulos[m]);

  const tieneAlMenosUnPermiso = Object.values(permisos).some(
    (acciones) => Object.values(acciones).some(Boolean),
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      {!soloLectura && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, justifyContent: 'flex-end' }}>
          {todosLosModulosTienenTodo() ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<RemoveDoneIcon />}
              onClick={desmarcarTodosLosPermisos}
              sx={{ textTransform: 'none', fontSize: '0.775rem' }}
            >
              Desmarcar todo
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<DoneAllIcon />}
              onClick={asignarTodosLosPermisos}
              sx={{ textTransform: 'none', fontSize: '0.775rem' }}
            >
              Asignar todo
            </Button>
          )}
          {tieneAlMenosUnPermiso && !todosLosModulosTienenTodo() && (
            <Button
              size="small"
              variant="text"
              color="error"
              startIcon={<RemoveDoneIcon />}
              onClick={desmarcarTodosLosPermisos}
              sx={{ textTransform: 'none', fontSize: '0.775rem' }}
            >
              Limpiar
            </Button>
          )}
        </Stack>
      )}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.825rem',
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left',
              padding: '8px 12px',
              borderBottom: '2px solid var(--ui-info-borde)',
              fontWeight: 700,
              minWidth: '150px',
              position: 'sticky',
              top: 0,
              left: 0,
              backgroundColor: 'var(--ui-superficie-2)',
              zIndex: 3,
            }}>
              Módulo
            </th>
            {todasLasAcciones.map((accion) => (
              <th key={accion} style={{
                textAlign: 'center',
                padding: '8px 4px',
                borderBottom: '2px solid var(--ui-info-borde)',
                fontWeight: 600,
                fontSize: '0.75rem',
                minWidth: '70px',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--ui-superficie-2)',
                zIndex: 2,
              }}>
                {etiquetas_acciones[accion] || accion}
              </th>
            ))}
            {!soloLectura && (
              <th style={{
                textAlign: 'center',
                padding: '8px 4px',
                borderBottom: '2px solid var(--ui-info-borde)',
                fontWeight: 600,
                fontSize: '0.7rem',
                minWidth: '60px',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--ui-superficie-2)',
                zIndex: 2,
              }}>
                Rápido
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {modulosOrdenados.map((modulo) => {
            const accionesDisponibles = modulos[modulo] || [];
            return (
              <tr key={modulo} style={{
                borderBottom: '1px solid var(--ui-info-borde)',
              }}>
                <td style={{
                  padding: '6px 12px',
                  fontWeight: 600,
                  position: 'sticky',
                  left: 0,
                  backgroundColor: 'var(--ui-superficie-2)',
                  zIndex: 1,
                }}>
                  {etiquetas_modulos[modulo] || modulo}
                </td>
                {todasLasAcciones.map((accion) => {
                  const disponible = accionesDisponibles.includes(accion);
                  if (!disponible) {
                    return (
                      <td key={accion} style={{
                        textAlign: 'center',
                        padding: '2px',
                        opacity: 0.15,
                      }}>
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={accion} style={{ textAlign: 'center', padding: '2px' }}>
                      <Tooltip title={`${etiquetas_modulos[modulo] || modulo} → ${etiquetas_acciones[accion] || accion}`} arrow>
                        <Checkbox
                          size="small"
                          checked={tienePermiso(modulo, accion)}
                          onChange={() => alternarPermiso(modulo, accion)}
                          disabled={soloLectura}
                          icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                          checkedIcon={<CheckBoxIcon fontSize="small" />}
                          sx={{ padding: '4px' }}
                        />
                      </Tooltip>
                    </td>
                  );
                })}
                {!soloLectura && (
                  <td style={{ textAlign: 'center', padding: '2px' }}>
                    <Tooltip title={moduloTieneTodo(modulo) ? 'Desmarcar todo' : 'Marcar todo'} arrow>
                      <IconButton
                        size="small"
                        onClick={() =>
                          moduloTieneTodo(modulo)
                            ? desmarcarTodoModulo(modulo)
                            : marcarTodoModulo(modulo)
                        }
                        sx={{ padding: '4px' }}
                      >
                        {moduloTieneTodo(modulo)
                          ? <DeselectIcon fontSize="small" sx={{ color: '#a3312a' }} />
                          : <SelectAllIcon fontSize="small" sx={{ color: '#40613a' }} />
                        }
                      </IconButton>
                    </Tooltip>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
