import { http } from '@/api/http';
import type {
  CanalWhatsApp,
  CrearCanalWARequest,
  ActualizarCanalWARequest,
} from '@/tipos/canal-whatsapp';

export const canalesWhatsAppApi = {
  listar: async () => {
    const { data } = await http.get<{ data: CanalWhatsApp[] }>('/canales/whatsapp');
    return data.data;
  },

  obtener: async (id: string) => {
    const { data } = await http.get<{ data: CanalWhatsApp }>(`/canales/whatsapp/${id}`);
    return data.data;
  },

  crear: async (payload: CrearCanalWARequest) => {
    const { data } = await http.post<{ data: CanalWhatsApp }>('/canales/whatsapp', payload);
    return data.data;
  },

  actualizar: async (id: string, payload: ActualizarCanalWARequest) => {
    const { data } = await http.put<{ data: CanalWhatsApp }>(`/canales/whatsapp/${id}`, payload);
    return data.data;
  },

  desactivar: async (id: string) => {
    await http.delete(`/canales/whatsapp/${id}`);
  },

  enviarSolicitudWhatsApp: async (datos: {
    negocio: string;
    ruc: string;
    celular: string;
    telefono_contacto: string;
    direccion?: string;
    correo: string;
    horario?: string;
    tenant_id?: string;
    tenant_razon_social?: string;
    tenant_ruc?: string;
    tenant_slug?: string;
    tenant_email?: string | null;
  }) => {
    const { data } = await http.post<{ data: { mensaje: string } }>('/contacto/solicitud-whatsapp', datos);
    return data.data;
  },
};