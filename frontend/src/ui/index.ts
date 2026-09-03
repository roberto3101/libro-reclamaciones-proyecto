/**
 * Kit de interfaz de la aplicación.
 *
 * Punto de entrada único para lo que se usa en casi todas las pantallas.
 * Deliberadamente NO se reexportan aquí tres módulos pesados, porque
 * entrarían en el fragmento compartido y lastrarían la carga inicial de
 * páginas que no los necesitan. Se importan por su ruta:
 *
 *   - tabla     → '@/ui/datos/Tabla'            (material-react-table)
 *   - gráficos  → '@/ui/graficos/BarChart'      (@mui/x-charts)
 *   - fechas    → '@/ui/tema/ProveedorFechas'   (@mui/x-date-pickers)
 */

/* ── Tema ──────────────────────────────────────────────────────────── */
export {
  UiProveedorTema,
  usarTema,
  ContextoTema,
  type Tema,
  type ContextoTemaTipo,
  type ProveedorTemaProps,
} from './tema/ProveedorTema';
export { UiProveedorMui } from './tema/ProveedorMui';
export { crearTemaMui } from './tema/temaMui';

/* ── Maquetación ───────────────────────────────────────────────────── */
export { UiPila, type PilaProps } from './layout/Pila';
export { UiCaja, type CajaProps } from './layout/Caja';
export { UiCuadricula, type CuadriculaProps } from './layout/Cuadricula';
export { UiContenedor, type ContenedorProps } from './layout/Contenedor';
export { UiArmazon, type ArmazonProps } from './layout/Armazon';
export {
  UiBarraLateral,
  type BarraLateralProps,
  type ElementoMenuLateral,
  type InfoUsuario,
} from './layout/BarraLateral';
export { UiCabecera, type CabeceraProps, type ElementoMigaPan } from './layout/Cabecera';

/* ── Controles ─────────────────────────────────────────────────────── */
export { UiBoton, type BotonProps, type BotonVariante, type BotonTamano } from './controles/Boton';
export { UiCampoTexto, type CampoTextoProps } from './controles/CampoTexto';
export { UiCampoNumero, type CampoNumeroProps } from './controles/CampoNumero';
export {
  UiSelector,
  type SelectorProps,
  type SelectorOpcion,
  type EventoSelector,
} from './controles/Selector';
export { UiCasilla, type CasillaProps } from './controles/Casilla';
export { UiInterruptor, type InterruptorProps } from './controles/Interruptor';

/* ── Retroalimentación ─────────────────────────────────────────────── */
export { UiAlerta, type AlertaProps, type AlertaVariante } from './retroalimentacion/Alerta';
export { UiCargando, type CargandoProps, type CargandoTipo } from './retroalimentacion/Cargando';
export {
  UiInsignia,
  type InsigniaProps,
  type InsigniaColor,
} from './retroalimentacion/Insignia';
export { UiProgreso, type ProgresoProps } from './retroalimentacion/Progreso';
export { UiEsqueleto, type EsqueletoProps } from './retroalimentacion/Esqueleto';

/* ── Superficies ───────────────────────────────────────────────────── */
export { UiTarjeta, type TarjetaProps } from './superficies/Tarjeta';

/* ── Navegación ────────────────────────────────────────────────────── */
export { UiPaginacion, type PaginacionProps } from './navegacion/Paginacion';
export { UiPasos, type PasosProps, type Paso } from './navegacion/Pasos';

/* ── Iconos ────────────────────────────────────────────────────────── */
export {
  UiIcono,
  type IconoProps,
  UiIconoAnadir,
  UiIconoBilletera,
  UiIconoBorrar,
  UiIconoBuscar,
  UiIconoCaja,
  UiIconoChat,
  UiIconoCorreo,
  UiIconoDiseno,
  UiIconoEdificio,
  UiIconoEditar,
  UiIconoEnviar,
  UiIconoExito,
  UiIconoHerramientas,
  UiIconoLlave,
  UiIconoMenu,
  UiIconoRefrescar,
  UiIconoUsuario,
} from './iconos/Icono';

/* ── Ganchos ───────────────────────────────────────────────────────── */
export { usarBloqueoScroll } from './ganchos/usarBloqueoScroll';

/* ── Utilidades ────────────────────────────────────────────────────── */
export { convertirSx, clases, type PropSx, type ObjetoSx } from './sx';
