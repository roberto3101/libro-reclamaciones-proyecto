import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { UiProveedorTema, UiProveedorMui } from '@/ui';
import { UiProveedorFechas } from '@/ui/tema/ProveedorFechas';
import { anclarDesplegables } from '@/ui/tema/anclarDesplegables';

import App from './App';
import './index.css';
import './ui/terceros.css';
import { capturadorBreadcrumbs } from './infraestructura/breadcrumbs/capturador-breadcrumbs';

capturadorBreadcrumbs.inicializar();
anclarDesplegables();

if (import.meta.env.PROD) {
  const reportarAlBackend = (mensaje: string, stack?: string) => {
    const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';
    const token = localStorage.getItem('lr_token');
    const leerToken = (campo: string) => {
      if (!token) return undefined;
      try {
        return JSON.parse(atob(token.split('.')[1]))[campo];
      } catch {
        return undefined;
      }
    };

    fetch(`${baseURL}/error-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje,
        stack: stack || '',
        ruta: location.pathname,
        tenant_id: leerToken('tenant_id'),
        usuario_id: leerToken('user_id'),
        breadcrumbs: capturadorBreadcrumbs.obtenerBreadcrumbsJSON(),
      }),
    }).catch(() => {});
  };

  window.addEventListener('error', (e) => {
    reportarAlBackend(e.message, e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason);
    reportarAlBackend(`Promesa rechazada sin capturar: ${msg}`, e.reason?.stack);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProveedorTema temaPorDefecto="light">
      <UiProveedorMui>
        <UiProveedorFechas idioma="es">
          <BrowserRouter>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                // El aspecto se define en ui/terceros.css con tokens, para
                // que el aviso siga al tema sin releerlo en cada render.
                className: 'toast-app',
                style: { maxWidth: '360px', fontSize: '0.875rem' },
              }}
              containerStyle={{ top: 16, right: 16 }}
            />
          </BrowserRouter>
        </UiProveedorFechas>
      </UiProveedorMui>
    </UiProveedorTema>
  </StrictMode>,
);
