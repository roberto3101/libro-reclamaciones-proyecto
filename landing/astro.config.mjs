import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './src/data/site.json';

/* `site` en site.json va vacío hasta que se decida el dominio. Astro exige
   una URL válida ahí y falla al arrancar si recibe una cadena vacía, así
   que la opción solo se pasa cuando hay valor. El sitemap depende de ella,
   de modo que se activa junto con el dominio: sin dominio no habría URLs
   absolutas que publicar. */
const dominio = (site.url || '').trim();

export default defineConfig({
  ...(dominio ? { site: dominio, integrations: [sitemap()] } : { integrations: [] }),
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
