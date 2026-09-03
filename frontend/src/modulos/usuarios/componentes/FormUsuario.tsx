import { useState, useEffect } from 'react';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { UiCampoTexto, UiSelector } from '@/ui';
import { UiPila } from '@/ui';
import type { EventoSelector } from '@/ui';
import { Typography, Divider, IconButton } from '@mui/material';
import type { RolUsuario, Usuario, Sede, RolTenant } from '@/tipos';
import { usuariosApi } from '../api/usuarios.api';
import { notificar } from '@/aplicacion/helpers/toast';
import { manejarError } from '@/aplicacion/helpers/errores';

interface Props {
  abierto: boolean;
  usuario?: Usuario | null;
  sedes: Sede[];
  roles?: RolTenant[];
  esAdmin?: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}

/* Estilos de inputs en dialogs manejados globalmente via runtime CSS
   en main.tsx (inyectados después de MUI Emotion para ganar cascada) */

const OPCIONES_ROL_FALLBACK = [
  { valor: 'ADMIN', etiqueta: 'Administrador — Acceso total' },
  { valor: 'SOPORTE', etiqueta: 'Soporte — Gestión de reclamos' },
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
const RE_NOMBRE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

const LIMITES = {
  nombre: { min: 3, max: 60 },
  email: { max: 80 },
  password: { min: 8, max: 72 },
} as const;

function validarNombre(valor: string) {
  if (!valor) return { error: false, mensaje: undefined };
  const v = valor.trim();
  if (v.length < LIMITES.nombre.min) return { error: true, mensaje: `Mínimo ${LIMITES.nombre.min} caracteres` };
  if (!RE_NOMBRE.test(v)) return { error: true, mensaje: 'Solo letras y espacios' };
  return { error: false, mensaje: undefined };
}

function validarEmail(valor: string) {
  if (!valor) return { error: false, mensaje: undefined };
  if (valor.length > LIMITES.email.max) return { error: true, mensaje: `Máximo ${LIMITES.email.max} caracteres` };
  if (!EMAIL_REGEX.test(valor)) return { error: true, mensaje: 'Formato de email inválido' };
  return { error: false, mensaje: undefined };
}

function validarPassword(valor: string, requerido: boolean) {
  if (!valor) return { error: false, mensaje: requerido ? undefined : undefined };
  const len = valor.length;
  if (len < LIMITES.password.min) return { error: true, mensaje: `Mínimo ${LIMITES.password.min} caracteres (${len}/${LIMITES.password.min})` };
  if (len > LIMITES.password.max) return { error: true, mensaje: `Máximo ${LIMITES.password.max} caracteres` };
  const tieneMayus = /[A-Z]/.test(valor);
  const tieneMinus = /[a-z]/.test(valor);
  const tieneNumero = /\d/.test(valor);
  const tieneEspecial = /[^a-zA-Z0-9]/.test(valor);
  const requisitos = [tieneMayus, tieneMinus, tieneNumero, tieneEspecial].filter(Boolean).length;
  if (requisitos < 3) return { error: true, mensaje: 'Debe incluir mayúsculas, minúsculas, números y/o caracteres especiales' };
  return { error: false, mensaje: 'Contraseña segura' };
}

export function FormUsuario({ abierto, usuario, sedes, roles, esAdmin = false, alCerrar, alGuardar }: Props) {
  const esEdicion = !!usuario;

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('SOPORTE');
  const [sedeIds, setSedeIds] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre_completo);
      setEmail(usuario.email);
      setRol(usuario.rol as RolUsuario);
      setSedeIds(usuario.sede_ids ?? []);
      setPassword('');
    } else {
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('SOPORTE');
      setSedeIds([]);
    }
    setVerPassword(false);
  }, [usuario, abierto]);

  const alternarSede = (sedeId: string) => {
    setSedeIds((prev) =>
      prev.includes(sedeId) ? prev.filter((id) => id !== sedeId) : [...prev, sedeId],
    );
  };

  const vNombre = validarNombre(nombre);
  const vEmail = validarEmail(email);
  const vPassword = validarPassword(password, !esEdicion);

  const manejarGuardar = async () => {
    if (!nombre.trim() || !email.trim()) {
      notificar.advertencia('Nombre y email son obligatorios');
      return;
    }
    if (vNombre.error) {
      notificar.advertencia(`Nombre: ${vNombre.mensaje}`);
      return;
    }
    if (vEmail.error) {
      notificar.advertencia(`Email: ${vEmail.mensaje}`);
      return;
    }
    if (!esEdicion && !password) {
      notificar.advertencia('La contrasena es obligatoria para nuevos usuarios');
      return;
    }
    if (password && vPassword.error) {
      notificar.advertencia(`Contrasena: ${vPassword.mensaje}`);
      return;
    }

    setCargando(true);
    try {
      if (esEdicion && usuario) {
        await usuariosApi.actualizar(usuario.id, {
          nombre_completo: nombre.trim(),
          rol,
          sede_ids: sedeIds.length > 0 ? sedeIds : undefined,
          activo: true,
        });
        if (password.trim()) {
          await usuariosApi.cambiarPassword(usuario.id, password);
        }
        notificar.exito('Usuario actualizado');
      } else {
        await usuariosApi.crear({
          email: email.trim().toLowerCase(),
          nombre_completo: nombre.trim(),
          password,
          rol,
          sede_ids: sedeIds.length > 0 ? sedeIds : undefined,
        });
        notificar.exito('Usuario creado exitosamente');
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
      titulo={esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}
      maxAncho="sm"
      pie={
        <>
          <BotonModal texto="Cancelar" variante="secundario" onClick={alCerrar} />
          <BotonModal
            texto={esEdicion ? 'Guardar Cambios' : 'Crear Usuario'}
            onClick={manejarGuardar}
            cargando={cargando}
          />
        </>
      }
    >
      <UiPila direccion="columna" espaciado={2} sx={{ py: { xs: 1, sm: 0 } }}>
        <UiCampoTexto
          etiqueta="Nombre Completo"
          valor={nombre}
          alCambiar={(e) => {
            const v = e.target.value.slice(0, LIMITES.nombre.max);
            if (v && !RE_NOMBRE.test(v)) return;
            setNombre(v);
          }}
          error={vNombre.error}
          mensajeError={vNombre.mensaje}
          textoAyuda={vNombre.error ? undefined : `Solo letras y espacios. Máx. ${LIMITES.nombre.max} caracteres.`}
        />
        <UiCampoTexto
          etiqueta="Correo Electrónico"
          valor={email}
          alCambiar={(e) => {
            const v = e.target.value.slice(0, LIMITES.email.max).toLowerCase();
            if (v && /\s/.test(v)) return;
            setEmail(v);
          }}
          deshabilitado={esEdicion}
          error={vEmail.error}
          mensajeError={!esEdicion ? vEmail.mensaje : undefined}
          tipo="email"
        />
        <UiCampoTexto
          etiqueta={esEdicion ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
          valor={password}
          alCambiar={(e) => setPassword(e.target.value.slice(0, LIMITES.password.max))}
          tipo={verPassword ? 'text' : 'password'}
          error={vPassword.error}
          mensajeError={vPassword.mensaje}
          textoAyuda={vPassword.error ? undefined : (password && !vPassword.error && vPassword.mensaje ? vPassword.mensaje : `Mín. ${LIMITES.password.min} chars. Incluir mayúsculas, minúsculas, números o especiales.`)}
          iconoFin={
            <IconButton
              onClick={() => setVerPassword((v) => !v)}
              edge="end"
              size="small"
              tabIndex={-1}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </IconButton>
          }
        />

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
          Permisos y asignacion
        </Typography>

        <UiSelector
          etiqueta="Rol"
          opciones={
            roles && roles.length > 0
              ? roles
                  .filter((r) => esAdmin || r.slug.toUpperCase() !== 'ADMIN')
                  .map((r) => ({
                    valor: r.slug.toUpperCase(),
                    etiqueta: `${r.nombre} — ${r.descripcion || r.slug}`,
                  }))
              : esAdmin ? OPCIONES_ROL_FALLBACK : OPCIONES_ROL_FALLBACK.filter((o) => o.valor !== 'ADMIN')
          }
          value={rol}
          onChange={(e: EventoSelector) => setRol(e.target.value as RolUsuario)}
        />

        {sedes.length > 0 && (
          <div>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.5, display: 'block' }}
            >
              Sedes asignadas
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mb: 1 }}>
              {sedeIds.length === 0 ? 'Acceso global — ve todas las sedes' : `${sedeIds.length} sede${sedeIds.length > 1 ? 's' : ''} seleccionada${sedeIds.length > 1 ? 's' : ''}`}
            </Typography>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {sedes.map((sede) => (
                <label
                  key={sede.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 'var(--ui-r-lg)',
                    cursor: 'pointer',
                    border: sedeIds.includes(sede.id) ? '1.5px solid #9a4a24' : '1.5px solid var(--ui-borde, #e5e0d4)',
                    background: sedeIds.includes(sede.id) ? 'rgba(154,74,36,0.06)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sedeIds.includes(sede.id)}
                    onChange={() => alternarSede(sede.id)}
                    style={{ accentColor: '#9a4a24', width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 14 }}>{sede.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </UiPila>
    </ModalBase>
  );
}
