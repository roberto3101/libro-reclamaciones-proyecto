import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { usarEstadoSuperAdmin } from '@/aplicacion/estado/estadoSuperAdmin';
import { UiCargando } from '@/ui';
import { UiCaja } from '@/ui';
import ProtectorRutas from './ProtectorRutas';
import LayoutPrincipal from './layouts/LayoutPrincipal';
import LayoutPublico from './layouts/LayoutPublico';
import { ProtectorModulo } from './componentes/ProtectorModulo';

// ── Lazy imports ──
const PaginaLogin = lazy(() => import('@/paginas/acceso/PaginaLogin'));
const PaginaSeleccionarEmpresa = lazy(() => import('@/paginas/acceso/PaginaSeleccionarEmpresa'));
const PaginaDashboard = lazy(() => import('@/modulos/dashboard/paginas/PaginaDashboard'));
const PaginaReclamos = lazy(() => import('@/modulos/reclamos/paginas/PaginaReclamos'));
const PaginaDetalleReclamo = lazy(() => import('@/modulos/reclamos/paginas/PaginaDetalleReclamo'));
const PaginaUsuarios = lazy(() => import('@/modulos/usuarios/paginas/PaginaUsuarios'));
const PaginaSedes = lazy(() => import('@/modulos/sedes/paginas/PaginaSedes'));
const PaginaChatbots = lazy(() => import('@/modulos/chatbots/paginas/PaginaChatbots'));
const PaginaDetalleChatbot = lazy(() => import('@/modulos/chatbots/paginas/PaginaDetalleChatbot'));
const PaginaPlanes = lazy(() => import('@/modulos/planes/paginas/PaginaPlanes'));
const PaginaSuscripcion = lazy(() => import('@/modulos/suscripcion/paginas/PaginaSuscripcion'));
const PaginaPagos = lazy(() => import('@/modulos/suscripcion/paginas/PaginaPagos'));
const PaginaConfigTenant = lazy(() => import('@/modulos/tenant/paginas/PaginaConfigTenant'));
const PaginaLibroPublico = lazy(() => import('@/modulos/libro-publico/paginas/PaginaLibroPublico'));
const PaginaConfirmacion = lazy(() => import('@/modulos/libro-publico/paginas/PaginaConfirmacion'));
const PaginaSeguimiento = lazy(() => import('@/modulos/libro-publico/paginas/PaginaSeguimiento'));
const PaginaAsistente = lazy(() => import('@/modulos/asistente/paginas/PaginaAsistente'));
const PaginaCanalesWhatsApp = lazy(() => import('@/modulos/canales-whatsapp/paginas/PaginaCanalesWhatsApp'));
const PaginaSolicitudesAsesor = lazy(() => import('@/modulos/atencion-vivo/paginas/PaginaSolicitudesAsesor'));
const PaginaMisAsignaciones = lazy(() => import('@/modulos/mis-asignaciones/paginas/PaginaMisAsignaciones'));
const AdminPlanes = lazy(() => import('@/modulos/planes/paginas/AdminPlanes'));
const PaginaRoles = lazy(() => import('@/modulos/roles/paginas/PaginaRoles'));
const PaginaPlantillasEmail = lazy(() => import('@/modulos/plantillas-email/paginas/PaginaPlantillasEmail'));
const PaginaNotificaciones = lazy(() => import('@/modulos/notificaciones/paginas/PaginaNotificaciones'));
const PaginaConfigNotificaciones = lazy(() => import('@/modulos/notificaciones/paginas/PaginaConfigNotificaciones'));

// ── SuperAdmin (lazy) ──
const SALogin = lazy(() => import('@/paginas/superadmin/SALogin'));
const SADashboard = lazy(() => import('@/paginas/superadmin/SADashboard'));
const SACuentas = lazy(() => import('@/paginas/superadmin/SACuentas'));
const SADetalleCuenta = lazy(() => import('@/paginas/superadmin/SADetalleCuenta'));
const SAEmpresas = lazy(() => import('@/paginas/superadmin/SAEmpresas'));
const SADetalleEmpresa = lazy(() => import('@/paginas/superadmin/SADetalleEmpresa'));
const SAPlanes = lazy(() => import('@/paginas/superadmin/SAPlanes'));
const SAStaff = lazy(() => import('@/paginas/superadmin/SAStaff'));
const SAActividad = lazy(() => import('@/paginas/superadmin/SAActividad'));
const SAErrores = lazy(() => import('@/paginas/superadmin/SAErrores'));
const LayoutSuperAdmin = lazy(() => import('@/aplicacion/layouts/LayoutSuperAdmin'));

const Pagina404 = lazy(() => import('@/paginas/no-encontrado/Pagina404'));

function CargaFallback() {
  return (
    <UiCaja centrado sx={{ minHeight: '60vh' }}>
      <UiCargando tipo="anillo" etiqueta="Cargando módulo..." />
    </UiCaja>
  );
}

/** Helper: envuelve una página con protección de permisos por módulo */
function P({ modulo, etiqueta, children }: { modulo: string; etiqueta: string; children: React.ReactNode }) {
  return <ProtectorModulo modulo={modulo} etiqueta={etiqueta}>{children}</ProtectorModulo>;
}

/** Protector de rutas para SuperAdmin */
function ProtectorSuperAdmin({ children }: { children: React.ReactNode }) {
  const { autenticado, cargando, inicializar } = usarEstadoSuperAdmin();
  useEffect(() => { inicializar(); }, [inicializar]);
  if (cargando) return <CargaFallback />;
  if (!autenticado) return <Navigate to="/superadmin/acceso" replace />;
  return <>{children}</>;
}

export default function Enrutador() {
  return (
    <Suspense fallback={<CargaFallback />}>
      <Routes>
        {/* Rutas públicas */}
        <Route element={<LayoutPublico />}>
          <Route path="/acceso" element={<PaginaLogin />} />
          <Route path="/seleccionar-empresa" element={<PaginaSeleccionarEmpresa />} />
          <Route path="/libro/:tenantSlug" element={<PaginaLibroPublico />} />
          <Route path="/libro/:tenantSlug/:sedeSlug" element={<PaginaLibroPublico />} />
          <Route path="/libro/:tenantSlug/confirmacion" element={<PaginaConfirmacion />} />
          <Route path="/libro/:tenantSlug/seguimiento" element={<PaginaSeguimiento />} />
        </Route>

        {/* Rutas protegidas */}
        <Route
          element={
            <ProtectorRutas>
              <LayoutPrincipal />
            </ProtectorRutas>
          }
        >
          <Route path="/dashboard" element={<PaginaDashboard />} />
          <Route path="/reclamos" element={<P modulo="reclamos" etiqueta="Reclamos"><PaginaReclamos /></P>} />
          <Route path="/reclamos/:id" element={<P modulo="reclamos" etiqueta="Reclamos"><PaginaDetalleReclamo /></P>} />
          <Route path="/usuarios" element={<P modulo="usuarios" etiqueta="Usuarios"><PaginaUsuarios /></P>} />
          <Route path="/sedes" element={<P modulo="sedes" etiqueta="Sedes"><PaginaSedes /></P>} />
          <Route path="/chatbots" element={<P modulo="chatbots" etiqueta="Chatbots"><PaginaChatbots /></P>} />
          <Route path="/chatbots/:id" element={<P modulo="chatbots" etiqueta="Chatbots"><PaginaDetalleChatbot /></P>} />
          <Route path="/planes" element={<PaginaPlanes />} />
          <Route path="/suscripcion" element={<P modulo="configuracion" etiqueta="Suscripción"><PaginaSuscripcion /></P>} />
          <Route path="/pagos" element={<P modulo="configuracion" etiqueta="Pagos"><PaginaPagos /></P>} />
          <Route path="/asistente" element={<P modulo="asistente" etiqueta="Asistente IA"><PaginaAsistente /></P>} />
          <Route path="/canales-whatsapp" element={<P modulo="canales_whatsapp" etiqueta="Canales WhatsApp"><PaginaCanalesWhatsApp /></P>} />
          <Route path="/atencion-vivo" element={<P modulo="atencion_vivo" etiqueta="Atención en Vivo"><PaginaSolicitudesAsesor /></P>} />
          <Route path="/mis-asignaciones" element={<P modulo="reclamos" etiqueta="Mis Asignaciones"><PaginaMisAsignaciones /></P>} />
          <Route path="/roles" element={<P modulo="roles" etiqueta="Roles"><PaginaRoles /></P>} />
          <Route path="/plantillas-email" element={<P modulo="plantillas_email" etiqueta="Plantillas Email"><PaginaPlantillasEmail /></P>} />
          <Route path="/notificaciones" element={<PaginaNotificaciones />} />
          <Route path="/notificaciones/configuracion" element={<PaginaConfigNotificaciones />} />
          <Route path="/admin/planes" element={<AdminPlanes />} />
          <Route path="/configuracion" element={<P modulo="configuracion" etiqueta="Configuración"><PaginaConfigTenant /></P>} />
        </Route>

        {/* ── SuperAdmin ── */}
        <Route element={<LayoutPublico />}>
          <Route path="/superadmin/acceso" element={<SALogin />} />
        </Route>
        <Route
          element={
            <ProtectorSuperAdmin>
              <LayoutSuperAdmin />
            </ProtectorSuperAdmin>
          }
        >
          <Route path="/superadmin/dashboard" element={<SADashboard />} />
          <Route path="/superadmin/cuentas" element={<SACuentas />} />
          <Route path="/superadmin/cuentas/:id" element={<SADetalleCuenta />} />
          <Route path="/superadmin/empresas" element={<SAEmpresas />} />
          <Route path="/superadmin/empresas/:id" element={<SADetalleEmpresa />} />
          <Route path="/superadmin/planes" element={<SAPlanes />} />
          <Route path="/superadmin/staff" element={<SAStaff />} />
          <Route path="/superadmin/actividad" element={<SAActividad />} />
          <Route path="/superadmin/errores" element={<SAErrores />} />
        </Route>

        {/* Redirects y 404 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Pagina404 />} />
      </Routes>
    </Suspense>
  );
}