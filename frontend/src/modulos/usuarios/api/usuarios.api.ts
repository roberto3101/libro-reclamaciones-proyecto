import { http } from '@/api/http';
import type {
  ApiResponse,
  Usuario,
  CrearUsuarioRequest,
  ActualizarUsuarioRequest,
  AccesoUsuarioEnCuenta,
  AgregarUsuarioExistenteRequest,
} from '@/tipos';

export const usuariosApi = {
  listar: () =>
    http.get<ApiResponse<Usuario[]>>('/usuarios').then((r) => r.data.data),

  crear: (datos: CrearUsuarioRequest) =>
    http.post<ApiResponse<Usuario>>('/usuarios', datos).then((r) => r.data.data),

  actualizar: (id: string, datos: ActualizarUsuarioRequest) =>
    http.put<ApiResponse<void>>(`/usuarios/${id}`, datos).then((r) => r.data),

 eliminar: (id: string) =>
    http.delete<ApiResponse<void>>(`/usuarios/${id}`).then((r) => r.data),

  reactivar: (id: string) =>
    http.post<ApiResponse<void>>(`/usuarios/${id}/reactivar`).then((r) => r.data),

  cambiarPassword: (id: string, password: string) =>
    http.patch<ApiResponse<void>>(`/usuarios/${id}/password`, { password }).then((r) => r.data),

  // Busca un email en todas las empresas de la cuenta del tenant actual.
  // Devuelve array vacío si no existe en ninguna empresa.
  buscarEnCuenta: (email: string) =>
    http
      .get<ApiResponse<AccesoUsuarioEnCuenta[] | null>>('/usuarios/buscar-en-cuenta', { params: { email } })
      .then((r) => r.data.data ?? []),

  // Vincula un usuario existente (de otra empresa de la cuenta) al tenant actual.
  agregarExistente: (datos: AgregarUsuarioExistenteRequest) =>
    http.post<ApiResponse<Usuario>>('/usuarios/agregar-existente', datos).then((r) => r.data.data),
};