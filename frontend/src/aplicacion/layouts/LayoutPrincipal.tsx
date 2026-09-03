import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { UiArmazon } from '@/ui';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import { ModalGlobal } from '@/componentes/ui/ModalGlobal';
import {
  UiIconoDiseno,
  UiIconoCaja,
  UiIconoUsuario,
  UiIconoEdificio,
  UiIconoChat,
  UiIconoLlave,
  UiIconoHerramientas,
  UiIconoCorreo,
  UiIconoBilletera,
  UiIcono,
} from '@/ui';
import { usarEstadoAuth } from '@/aplicacion/estado/estadoAuth';
import { usarEstadoUI } from '@/aplicacion/estado/estadoUI';
import { usarPermisos } from '@/aplicacion/ganchos/usarPermisos';
import { usarTenant } from '@/modulos/tenant/ganchos/usarTenant';
import { ModalSesionExpirada } from '@/componentes/ui/ModalSesionExpirada';

import BannerTrial from '@/aplicacion/componentes/BannerTrial';
import { ToggleTema } from '@/aplicacion/componentes/ToggleTema';
import { CampanaNotificaciones } from '@/modulos/notificaciones/componentes/CampanaNotificaciones';
import { SelectorEmpresa } from '@/aplicacion/componentes/SelectorEmpresa';
import { usarTema } from '@/ui';

export default function LayoutPrincipal() {
  const { usuario, cerrarSesion } = usarEstadoAuth();
  const { barraLateralColapsada, alternarBarraLateral } = usarEstadoUI();
  const { tienePermiso } = usarPermisos();
  const { tenant } = usarTenant();
  const { establecerTema } = usarTema();
  const razonSocial = tenant?.razon_social || 'Mi Empresa';

  // Aplicar tema por defecto del tenant si el usuario no ha elegido uno
  useEffect(() => {
    if (!tenant?.tema_por_defecto) return;
    const temaGuardado = localStorage.getItem('lr-tema');
    if (!temaGuardado) {
      establecerTema(tenant.tema_por_defecto as 'light' | 'dark');
    }
  }, [tenant?.tema_por_defecto, establecerTema]);
  const primeraLetra = razonSocial.charAt(0).toUpperCase();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [modalPerfilAbierto, setModalPerfilAbierto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  /* El cajón lateral de móvil es estado de React y nada más. Lo abre y lo
     cierra el botón de la cabecera, que UiArmazon controla mediante las
     props `movilAbierto` y `alCambiarMovil`. */

  const manejarCerrarSesion = () => {
    cerrarSesion();
    navegar('/acceso');
  };

  const elementosMenu = useMemo(() => {
    // Helper: verificar si un item debe mostrarse según permisos
    const visible = (modulo?: string) => !modulo || tienePermiso(modulo, 'ver');

    // Helper: crear item de menú
    const crearItem = (
      id: string,
      etiqueta: string,
      icono: React.ReactNode,
      ruta: string,
      opciones?: { modulo?: string; externo?: boolean },
    ) => {
      const { modulo, externo } = opciones ?? {};
      if (!visible(modulo)) return null;
      return {
        id,
        etiqueta,
        icono,
        activo: !externo && (ruta === '/dashboard'
          ? ubicacion.pathname === '/dashboard'
          : ubicacion.pathname.startsWith(ruta)),
        alHacerClick: externo
          ? () => window.open(ruta, '_blank')
          : () => navegar(ruta),
      };
    };

    // Helper: crear grupo desplegable, omitirlo si no tiene hijos visibles
    const crearGrupo = (
      id: string,
      etiqueta: string,
      icono: React.ReactNode,
      hijos: ReturnType<typeof crearItem>[],
    ) => {
      const hijosVisibles = hijos.filter(Boolean) as Exclude<ReturnType<typeof crearItem>, null>[];
      if (hijosVisibles.length === 0) return null;
      return { id, etiqueta, icono, hijos: hijosVisibles };
    };

    const menu = [
      // 1. Dashboard. Antes había que envolverlo en un grupo cuando la barra
      //    estaba plegada, porque la librería no dejaba navegar a los items
      //    sueltos en ese estado. Ya no hace falta: va directo siempre.
      crearItem('dashboard', 'Dashboard', <UiIconoDiseno />, '/dashboard', { modulo: 'dashboard' }),

      // 2. Soporte (desplegable)
      crearGrupo('grupo-soporte', 'Soporte', <UiIconoCaja />, [
        crearItem('reclamos', 'Reclamos', <UiIconoCaja />, '/reclamos', { modulo: 'reclamos' }),
        crearItem('atencion-vivo', 'Atención en Vivo', <UiIconoChat />, '/atencion-vivo', { modulo: 'atencion_vivo' }),
        crearItem('mis-asignaciones', 'Mis Asignaciones', <UiIcono nombre="assignment_ind" />, '/mis-asignaciones', { modulo: 'reclamos' }),
        crearItem('seguimiento', 'Seguimiento', <UiIcono nombre="track_changes" />, `/libro/${usuario?.tenant_slug ?? ''}/seguimiento`, { externo: true }),
      ]),

      // 3. IA (desplegable)
      crearGrupo('grupo-ia', 'Inteligencia Artificial', <UiIcono nombre="smart_toy" />, [
        crearItem('asistente', 'Asistente IA', <UiIcono nombre="psychology" />, '/asistente', { modulo: 'asistente' }),
        crearItem('chatbots', 'Chatbots', <UiIconoChat />, '/chatbots', { modulo: 'chatbots' }),
      ]),

      // 4. Plantillas / Canales (desplegable)
      crearGrupo('grupo-canales', 'Canales', <UiIconoCorreo />, [
        crearItem('plantillas-email', 'Plantillas Email', <UiIconoCorreo />, '/plantillas-email', { modulo: 'plantillas_email' }),
        crearItem('canales-whatsapp', 'WhatsApp', <UiIcono nombre="chat" />, '/canales-whatsapp', { modulo: 'canales_whatsapp' }),
      ]),

      // 5. Organización (desplegable)
      crearGrupo('grupo-organizacion', 'Organización', <UiIconoEdificio />, [
        crearItem('usuarios', 'Usuarios', <UiIconoUsuario />, '/usuarios', { modulo: 'usuarios' }),
        crearItem('roles', 'Roles', <UiIconoLlave />, '/roles', { modulo: 'roles' }),
        crearItem('sedes', 'Sedes', <UiIconoEdificio />, '/sedes', { modulo: 'sedes' }),
      ]),

      // 6. Planes y Suscripción (desplegable)
      crearGrupo('grupo-planes', 'Planes', <UiIconoBilletera />, [
        crearItem('suscripcion', 'Suscripción', <UiIconoBilletera />, '/suscripcion', { modulo: 'configuracion' }),
      ]),

      // 7. Configuración (desplegable)
      crearGrupo('grupo-configuracion', 'Configuración', <UiIconoHerramientas />, [
        crearItem('configuracion', 'Ajustes Generales', <UiIconoHerramientas />, '/configuracion', { modulo: 'configuracion' }),
      ]),
    ];

    return menu.filter(Boolean) as Exclude<(typeof menu)[number], null>[];
  }, [ubicacion.pathname, navegar, usuario, tienePermiso, barraLateralColapsada]);

  return (
    <>
      {/* Los dos botones flotantes que había aquí —la inicial en móvil y
          la doble flecha en escritorio— se han retirado. Estaban colocados
          con coordenadas fijas calculadas a partir del ancho del panel, se
          solapaban con el título y obligaban a reservarles hueco a mano.
          Ahora el plegado vive en la cabecera, dentro de UiArmazon, con un
          solo control que sirve para escritorio y para móvil. */}

      <UiArmazon
        menu={elementosMenu}
        titulo={razonSocial}
        movilAbierto={menuMovilAbierto}
        alCambiarMovil={setMenuMovilAbierto}
        headerProps={{
          titulo: undefined,
          mostrarBusqueda: false,
          usuario: {
            nombre: usuario?.nombre_completo ?? '',
            rol: usuario?.rol ?? '',
          },
          alPerfil: () => setModalPerfilAbierto(true),
          children: (
            <div className="flex items-center gap-2">
              <SelectorEmpresa />
              <CampanaNotificaciones />
              <ToggleTema />
            </div>
          ),
        }}
        sidebarProps={{
          colapsado: barraLateralColapsada,
          alAlternar: alternarBarraLateral,
          textoLogo: razonSocial,
          children: barraLateralColapsada ? (
            <div className="letra-animada-sidebar" title={razonSocial}>
              {primeraLetra}
            </div>
          ) : null,
        }}
      >
        {/* Banner de impersonación (SuperAdmin viendo como empresa) */}
        {localStorage.getItem('lr_sa_impersonando') && (
          <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-3">
            <span>Estás viendo como: <strong>{localStorage.getItem('lr_sa_impersonando')}</strong></span>
            <button
              onClick={() => {
                localStorage.removeItem('lr_token');
                localStorage.removeItem('lr_sa_impersonando');
                window.close();
              }}
              className="bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded text-xs font-semibold transition"
            >
              Salir
            </button>
          </div>
        )}
        <BannerTrial />
        <Outlet />
      </UiArmazon>
      <ModalSesionExpirada />
      <ModalGlobal />
      <ModalBase
        abierto={modalPerfilAbierto}
        alCerrar={() => setModalPerfilAbierto(false)}
        titulo="Mi Perfil"
        maxAncho="xs"
      >
        <div className="flex flex-col items-center justify-center text-center py-4">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {usuario?.nombre_completo}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {usuario?.rol}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={manejarCerrarSesion}
              className="w-full px-8 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </ModalBase>
    </>
  );
}
