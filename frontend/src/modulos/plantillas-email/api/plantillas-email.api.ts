import { http } from '@/api/http';
import type {
  ApiResponse,
  PlantillaEmail,
  ActualizarPlantillaEmailRequest,
  DefinicionPlantillasEmail,
} from '@/tipos';

export const plantillasEmailApi = {
  listar: () =>
    http.get<ApiResponse<PlantillaEmail[]>>('/plantillas-email').then((r) => r.data.data),

  obtenerPorId: (id: string) =>
    http.get<ApiResponse<PlantillaEmail>>(`/plantillas-email/${id}`).then((r) => r.data.data),

  actualizar: (id: string, datos: ActualizarPlantillaEmailRequest) =>
    http.put<ApiResponse<PlantillaEmail>>(`/plantillas-email/${id}`, datos).then((r) => r.data.data),

  restaurarDefecto: (id: string) =>
    http.post<ApiResponse<PlantillaEmail>>(`/plantillas-email/${id}/restaurar`).then((r) => r.data.data),

  obtenerDefinicion: () =>
    http.get<ApiResponse<DefinicionPlantillasEmail>>('/plantillas-email/definicion').then((r) => r.data.data),
};
