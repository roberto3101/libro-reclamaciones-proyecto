export { ConcentradorWebSocket } from './concentrador-websocket';

export type {
  TipoEventoWebSocket,
  MensajeWebSocket,
  DatosSolicitudAtencionNueva,
  DatosMensajeAtencionRecibido,
  DatosReclamoNuevoRegistrado,
  DatosReclamoMensajeRecibido,
  DatosReclamoEstadoCambiado,
  DatosSeguimientoPublico,
  DatosNotificacionNueva,
  DatosContadorNotificaciones,
} from './tipos-evento-websocket';

export {
  usarEventoWebSocket,
  usarWebSocketAtencionVivo,
  usarWebSocketReclamoMensajes,
  usarWebSocketSeguimientoPublico,
  conectarWebSocketNotificaciones,
  desconectarWebSocketNotificaciones,
  obtenerConcentradorNotificaciones,
} from './usarConexionWebSocket';
