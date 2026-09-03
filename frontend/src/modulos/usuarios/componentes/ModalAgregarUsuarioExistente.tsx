import { useState, useEffect } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiCampoTexto, UiSelector, UiBoton } from '@/ui';
import { UiPila } from '@/ui';
import { Typography, Divider, Chip, CircularProgress, Autocomplete, TextField } from '@mui/material';
import type { EventoSelector } from '@/ui';
import type { Sede, RolTenant, AccesoUsuarioEnCuenta, CandidatoUsuarioCuenta } from '@/tipos';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

/**
 * Modal "Agregar usuario existente".
 *
 * Flujo:
 *  1. Usuario ingresa email → click buscar
 *  2. Backend busca si el email existe en alguna empresa de la misma cuenta
 *  3. Si existe: muestra tarjeta con nombre + empresas donde ya tiene acceso
 *  4. Usuario elige rol base + sedes iniciales
 *  5. Al confirmar, se llama al endpoint de vincular (reutiliza hash)
 *
 * Se usa desde:
 *  - Panel de usuarios del tenant (admin jala usuarios de otras empresas
 *    de su misma cuenta)
 *  - Panel SA → detalle de empresa (SA asigna usuarios entre empresas de
 *    una cuenta)
 *
 * Las funciones de búsqueda y creación se inyectan por props para que el
 * mismo componente pueda usar el API del tenant (/usuarios/...) o el API
 * del SA (/superadmin/empresas/:id/usuarios/...).
 */
interface Props {
  abierto: boolean;
  sedes: Sede[];
  roles?: RolTenant[];
  esAdmin?: boolean;
  alCerrar: () => void;
  alAgregado: () => void;
  // Inyectadas para reutilizar el modal con distintas APIs (tenant vs SA)
  buscarFn: (email: string) => Promise<AccesoUsuarioEnCuenta[]>;
  agregarFn: (datos: { email: string; rol: string; sede_ids: string[] }) => Promise<unknown>;
  // Opcional: si se provee, en lugar del input de email el modal muestra un
  // Autocomplete poblado con los candidatos de la cuenta. Solo se usa desde
  // el panel SA; el panel tenant mantiene el flujo clásico por email.
  listarCandidatosFn?: () => Promise<CandidatoUsuarioCuenta[]>;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;

const OPCIONES_ROL_FALLBACK = [
  { valor: 'ADMIN', etiqueta: 'Administrador — Acceso total' },
  { valor: 'SOPORTE', etiqueta: 'Soporte — Gestión de reclamos' },
];

export function ModalAgregarUsuarioExistente({
  abierto,
  sedes,
  roles,
  esAdmin,
  alCerrar,
  alAgregado,
  buscarFn,
  agregarFn,
  listarCandidatosFn,
}: Props) {
  const modoSelector = Boolean(listarCandidatosFn);

  const [email, setEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [accesos, setAccesos] = useState<AccesoUsuarioEnCuenta[]>([]);

  // Modo selector (SA): lista de candidatos + candidato seleccionado
  const [candidatos, setCandidatos] = useState<CandidatoUsuarioCuenta[]>([]);
  const [cargandoCandidatos, setCargandoCandidatos] = useState(false);
  const [candidatoSel, setCandidatoSel] = useState<CandidatoUsuarioCuenta | null>(null);

  const [rol, setRol] = useState('SOPORTE');
  const [sedeIds, setSedeIds] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!abierto) {
      setEmail('');
      setBusquedaHecha(false);
      setAccesos([]);
      setCandidatos([]);
      setCandidatoSel(null);
      setCargandoCandidatos(false);
      setRol('SOPORTE');
      setSedeIds([]);
      setGuardando(false);
      setBuscando(false);
    }
  }, [abierto]);

  // En modo selector, al abrir el modal cargamos los candidatos de la cuenta.
  useEffect(() => {
    if (!abierto || !listarCandidatosFn) return;
    let cancelado = false;
    setCargandoCandidatos(true);
    listarCandidatosFn()
      .then((lista) => {
        if (cancelado) return;
        setCandidatos(lista);
      })
      .catch((err) => {
        if (cancelado) return;
        manejarError(err);
      })
      .finally(() => {
        if (cancelado) return;
        setCargandoCandidatos(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, listarCandidatosFn]);

  const emailNormalizado = modoSelector
    ? (candidatoSel?.email ?? '').trim().toLowerCase()
    : email.trim().toLowerCase();
  const emailValido = EMAIL_REGEX.test(emailNormalizado);

  // Datos del usuario encontrado. En modo selector derivamos del candidato
  // elegido; en modo clásico, de los resultados de la búsqueda por email.
  const usuarioEncontrado: { nombre_completo: string } | null = modoSelector
    ? candidatoSel
      ? { nombre_completo: candidatoSel.nombre_completo }
      : null
    : accesos.length > 0
      ? accesos[0]
      : null;
  const empresasConAcceso = modoSelector
    ? (candidatoSel?.empresas ?? []).filter((a) => a.activo)
    : accesos.filter((a) => a.activo);

  const buscar = async () => {
    if (!emailValido) {
      notificar.advertencia('Ingresa un email con formato válido');
      return;
    }
    setBuscando(true);
    setBusquedaHecha(false);
    setAccesos([]);
    try {
      const resultados = await buscarFn(emailNormalizado);
      setAccesos(resultados);
      setBusquedaHecha(true);
      if (resultados.length === 0) {
        notificar.info('No se encontró ningún usuario con ese email en otras empresas de la cuenta');
      }
    } catch (err) {
      manejarError(err);
    } finally {
      setBuscando(false);
    }
  };

  const puedeGuardar =
    usuarioEncontrado != null &&
    rol.trim() !== '' &&
    !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await agregarFn({
        email: emailNormalizado,
        rol,
        sede_ids: sedeIds,
      });
      notificar.exito('Usuario agregado correctamente a la empresa');
      alAgregado();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const opcionesRol =
    roles && roles.length > 0
      ? roles
          .filter((r) => esAdmin || r.slug.toUpperCase() !== 'ADMIN')
          .map((r) => ({
            valor: r.slug.toUpperCase(),
            etiqueta: `${r.nombre} — ${r.descripcion || r.slug}`,
          }))
      : esAdmin
        ? OPCIONES_ROL_FALLBACK
        : OPCIONES_ROL_FALLBACK.filter((o) => o.valor !== 'ADMIN');

  return (
    <ModalBase
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Agregar usuario existente"
      maxAncho="sm"
      pie={
        <>
          <BotonModal texto="Cancelar" variante="secundario" onClick={alCerrar} deshabilitado={guardando} />
          <BotonModal
            texto="Agregar a esta empresa"
            variante="primario"
            onClick={guardar}
            cargando={guardando}
            deshabilitado={!puedeGuardar}
          />
        </>
      }
    >
      <UiPila direccion="columna" espaciado={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {modoSelector
            ? 'Elige un usuario que ya exista en otra empresa de la cuenta. Se reutilizará su contraseña y nombre actuales — no se le enviará ningún correo.'
            : 'Busca un usuario que ya exista en otra empresa de tu cuenta. Se reutilizará su contraseña y nombre actuales — no se le enviará ningún correo.'}
        </Typography>

        {/* ── Selector de usuarios (modo SA) ── */}
        {modoSelector ? (
          <Autocomplete<CandidatoUsuarioCuenta>
            value={candidatoSel}
            onChange={(_, nuevo) => setCandidatoSel(nuevo)}
            options={candidatos}
            loading={cargandoCandidatos}
            loadingText="Cargando usuarios de la cuenta..."
            noOptionsText={
              cargandoCandidatos
                ? 'Cargando...'
                : 'No hay usuarios en otras empresas de la cuenta'
            }
            getOptionLabel={(opt) => `${opt.nombre_completo} <${opt.email}>`}
            isOptionEqualToValue={(a, b) => a.email === b.email}
            getOptionDisabled={(opt) => opt.ya_en_destino}
            slotProps={{
              listbox: {
                sx: { maxHeight: 320, overflowY: 'auto' },
              },
            }}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return opts;
              return opts.filter((o) => {
                if (o.email.toLowerCase().includes(q)) return true;
                if (o.nombre_completo.toLowerCase().includes(q)) return true;
                // Buscar también por empresa donde ya tiene acceso
                return o.empresas.some((e) =>
                  e.razon_social.toLowerCase().includes(q),
                );
              });
            }}
            renderOption={(props, opt) => {
              const { key, ...rest } = props as typeof props & { key: string };
              return (
                <li
                  key={key}
                  {...rest}
                  style={{
                    display: 'block',
                    padding: '8px 12px',
                    opacity: opt.ya_en_destino ? 0.55 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--ui-texto)',
                    }}
                  >
                    <span>{opt.nombre_completo}</span>
                    {opt.ya_en_destino && (
                      <Chip
                        label="Ya asignado"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 600,
                          backgroundColor: 'rgba(133,126,112,0.15)',
                          color: 'text.secondary',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ui-texto-2)' }}>
                    {opt.email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ui-texto-2)', marginTop: 2 }}>
                    {opt.empresas.map((e) => `${e.razon_social} (${e.rol})`).join(' · ')}
                  </div>
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar usuario por nombre, email o empresa"
                placeholder="Empieza a escribir..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {cargandoCandidatos ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        ) : (
          <>
            {/* ── Búsqueda por email ── */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <UiCampoTexto
                  etiqueta="Email del usuario"
                  valor={email}
                  alCambiar={(e) => setEmail(e.target.value)}
                  tipo="email"
                  textoAyuda={
                    busquedaHecha && accesos.length === 0
                      ? 'Sin resultados — crea el usuario normalmente si es nuevo'
                      : undefined
                  }
                />
              </div>
              <div style={{ paddingTop: 22 }}>
                <UiBoton
                  texto={buscando ? 'Buscando...' : 'Buscar'}
                  variante="secundario"
                  alHacerClick={buscar}
                  disabled={!emailValido || buscando}
                />
              </div>
            </div>

            {/* ── Resultado de búsqueda ── */}
            {buscando && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                <CircularProgress size={24} />
              </div>
            )}
          </>
        )}

        {usuarioEncontrado && (
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--ui-r-lg)',
              border: '1.5px solid var(--ui-borde, #e5e0d4)',
              background: 'rgba(154,74,36,0.04)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {usuarioEncontrado.nombre_completo}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              {emailNormalizado}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
              Empresas donde ya tiene acceso:
            </Typography>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {empresasConAcceso.length === 0 ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Ninguna empresa activa — solo filas inactivas
                </Typography>
              ) : (
                empresasConAcceso.map((a) => (
                  <Chip
                    key={a.tenant_id}
                    label={`${a.razon_social} (${a.rol})`}
                    size="small"
                    sx={{ fontSize: 11 }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Formulario de asignación (solo si hay usuario encontrado) ── */}
        {usuarioEncontrado && (
          <>
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
              Rol y sedes en esta empresa
            </Typography>

            <UiSelector
              etiqueta="Rol base"
              opciones={opcionesRol}
              value={rol}
              onChange={(e: EventoSelector) =>
                setRol((e.target.value ?? '').toString())
              }
            />

            {sedes.length > 0 && (
              <div>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'text.secondary',
                    mb: 0.5,
                    display: 'block',
                  }}
                >
                  Sedes asignadas
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mb: 1 }}
                >
                  {sedeIds.length === 0
                    ? 'Sin sedes seleccionadas — tendrá acceso global a todas'
                    : `${sedeIds.length} sede${sedeIds.length > 1 ? 's' : ''} seleccionada${sedeIds.length > 1 ? 's' : ''}`}
                </Typography>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                  }}
                >
                  {sedes.map((sede) => {
                    const checked = sedeIds.includes(sede.id);
                    return (
                      <label
                        key={sede.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 'var(--ui-r-lg)',
                          cursor: 'pointer',
                          border: checked ? '1.5px solid #9a4a24' : '1.5px solid var(--ui-borde, #e5e0d4)',
                          background: checked ? 'rgba(154,74,36,0.06)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSedeIds((prev) =>
                              checked ? prev.filter((id) => id !== sede.id) : [...prev, sede.id],
                            );
                          }}
                        />
                        <span style={{ fontSize: 13 }}>{sede.nombre}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </UiPila>
    </ModalBase>
  );
}
