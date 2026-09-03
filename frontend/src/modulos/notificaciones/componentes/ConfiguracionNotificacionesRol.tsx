import { useState, useEffect, useCallback } from 'react';
import { Typography, CircularProgress, Switch } from '@mui/material';
import { notificacionesApi } from '../api/notificaciones.api';
import { manejarError } from '@/aplicacion/helpers/errores';
import type { DefinicionTiposNotificacion, TipoNotificacion } from '@/tipos';
import { UiIcono } from '@/ui';

interface Props {
  rolId?: string;
  configuraciones: Record<string, boolean>;
  alCambiar: (configuraciones: Record<string, boolean>) => void;
}

const NOMBRE_MODULO: Record<string, string> = {
  atencion_vivo: 'Atención en vivo',
  reclamos: 'Reclamos',
};

const ICONO_MODULO: Record<string, string> = {
  atencion_vivo: 'forum',
  reclamos: 'assignment',
};

/* Dos tonos por modulo: el solido rellena el interruptor y lleva blanco
   encima; el de texto es el que se lee sobre la superficie. Usar el mismo
   para ambas cosas dejaba las etiquetas en 3.5:1 sobre fondo oscuro. */
const COLOR_MODULO: Record<string, string> = {
  atencion_vivo: 'var(--ui-exito)',
  reclamos: 'var(--ui-info)',
};

const COLOR_MODULO_TEXTO: Record<string, string> = {
  atencion_vivo: 'var(--ui-exito-texto)',
  reclamos: 'var(--ui-info-texto)',
};

export function ConfiguracionNotificacionesRol({ rolId, configuraciones, alCambiar }: Props) {
  const [definicion, setDefinicion] = useState<DefinicionTiposNotificacion | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarDefinicion = useCallback(async () => {
    try {
      const datos = await notificacionesApi.obtenerDefinicionTipos();
      setDefinicion(datos);
    } catch (error) {
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarConfiguracionRol = useCallback(async () => {
    if (!rolId) return;
    try {
      const configs = await notificacionesApi.obtenerConfiguracionPorRol(rolId);
      const mapa: Record<string, boolean> = {};
      configs.forEach((c) => {
        mapa[c.tipo_notificacion] = c.habilitado;
      });
      alCambiar(mapa);
    } catch {
      // Si no hay config previa, se usan los defaults (todos habilitados)
    }
  }, [rolId, alCambiar]);

  useEffect(() => {
    cargarDefinicion();
  }, [cargarDefinicion]);

  useEffect(() => {
    cargarConfiguracionRol();
  }, [cargarConfiguracionRol]);

  const alternarNotificacion = (tipo: string, habilitado: boolean) => {
    alCambiar({ ...configuraciones, [tipo]: habilitado });
  };

  const alternarModuloCompleto = (tipos: TipoNotificacion[], habilitar: boolean) => {
    const nuevas = { ...configuraciones };
    tipos.forEach((tipo) => {
      nuevas[tipo] = habilitar;
    });
    alCambiar(nuevas);
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-4">
        <CircularProgress size={24} />
      </div>
    );
  }

  if (!definicion) return null;

  const tiposPorModulo = definicion.tipos.reduce<Record<string, TipoNotificacion[]>>((acc, tipo) => {
    const modulo = definicion.modulos[tipo] || 'Otros';
    if (!acc[modulo]) acc[modulo] = [];
    acc[modulo].push(tipo);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(tiposPorModulo).map(([modulo, tipos]) => {
        const todosHabilitados = tipos.every((t) => configuraciones[t] !== false);
        const algunoHabilitado = tipos.some((t) => configuraciones[t] !== false);
        const colorModulo = COLOR_MODULO[modulo] || 'var(--ui-texto-2)';
        const colorTexto = COLOR_MODULO_TEXTO[modulo] || 'var(--ui-texto-2)';

        return (
          <div
            key={modulo}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--ui-info-borde)' }}
          >
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ backgroundColor: 'var(--ui-hover)' }}
            >
              <div className="flex items-center gap-2">
                <UiIcono nombre={ICONO_MODULO[modulo] || 'notifications'} tamano={16} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontSize: '11px',
                    color: colorTexto,
                  }}
                >
                  {NOMBRE_MODULO[modulo] || modulo}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '10px', color: 'text.secondary', ml: 0.5 }}
                >
                  ({tipos.filter((t) => configuraciones[t] !== false).length}/{tipos.length})
                </Typography>
              </div>
              <Switch
                size="small"
                checked={todosHabilitados}
                onChange={(_, checked) => alternarModuloCompleto(tipos, checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: colorModulo },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: colorModulo },
                }}
              />
            </div>

            <div className="flex flex-col">
              {tipos.map((tipo, idx) => {
                const habilitado = configuraciones[tipo] !== false;
                const esUltimo = idx === tipos.length - 1;

                return (
                  <div
                    key={tipo}
                    className="flex items-center justify-between px-3 py-1.5"
                    style={{
                      borderBottom: esUltimo ? 'none' : '1px solid var(--ui-info-borde)',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '12px',
                        color: habilitado ? 'text.primary' : 'text.disabled',
                        transition: 'color 0.2s',
                      }}
                    >
                      {definicion.etiquetas[tipo]}
                    </Typography>
                    <Switch
                      size="small"
                      checked={habilitado}
                      onChange={(_, checked) => alternarNotificacion(tipo, checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: colorModulo },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: colorModulo },
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
