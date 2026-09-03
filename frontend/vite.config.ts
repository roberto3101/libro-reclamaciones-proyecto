import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    // 5173 y 5175 los ocupan otros proyectos en local. Las llamadas al API
    // salen por el proxy de abajo, así que el puerto no afecta al CORS.
    port: 5174,
    // Vite rechaza cualquier petición cuya cabecera Host no reconozca; es
    // la defensa contra el rebinding de DNS. Un túnel llega con el Host del
    // dominio público, así que sin esto responde «Blocked request» y no se
    // ve nada.
    //
    // Solo se abre el dominio de los túneles rápidos de Cloudflare. Es una
    // comodidad de desarrollo: quien tenga la dirección entra al entorno
    // local, así que conviene cerrar el túnel al terminar.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '^/libro/.*/(tenant|sedes|reclamos|mensajes)$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '^/libro/.*/seguimiento/[^/]+$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '^/libro/.*/consulta-documento/.*': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '^/libro/.*/validar-empresa/.*': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
      '/storage-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // El kit propio es CSS + componentes ligeros y viaja con la app.
          // Lo que conviene aislar es MUI, que es lo pesado de verdad.
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
});