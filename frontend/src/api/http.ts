import axios from 'axios';
import { obtenerToken, limpiarSesion } from '@/aplicacion/helpers/sesion';
import { manejarErrorPlan } from '@/aplicacion/helpers/plan-guard';
import { capturadorBreadcrumbs } from '@/infraestructura/breadcrumbs/capturador-breadcrumbs';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
  withCredentials: true, // enviar cookie httpOnly en cada request
});

// ── Request: inyectar JWT ──
http.interceptors.request.use((config) => {
  const token = obtenerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: capturar breadcrumbs + manejar 401 y 403 de plan ──
http.interceptors.response.use(
  (response) => {
    capturadorBreadcrumbs.registrarLlamadaAPI(response.config.method?.toUpperCase() || 'GET', response.config.url || '', response.status);
    return response;
  },
  (error) => {
    if (error.response) {
      capturadorBreadcrumbs.registrarLlamadaAPI(error.config?.method?.toUpperCase() || '?', error.config?.url || '', error.response.status);
    }
    const status = error.response?.status;
    const data = error.response?.data;

    // 401 → sesión expirada (silenciar para evitar toasts múltiples)
    if (status === 401) {
      limpiarSesion();
      window.location.href = '/acceso';
      const silenciado = new axios.Cancel('Sesión expirada');
      return Promise.reject(silenciado);
    }

    // 403 → verificar si es error de plan/suscripción
    if (status === 403 && manejarErrorPlan(status, data)) {
      // El modal ya se mostró, rechazamos silenciosamente
      // para que el catch del componente no muestre doble error
      const silenciado = new axios.Cancel('Plan limit — modal shown');
      return Promise.reject(silenciado);
    }

    return Promise.reject(error);
  },
);