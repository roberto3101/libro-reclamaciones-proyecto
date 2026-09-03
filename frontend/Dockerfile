# ── Frontend ───────────────────────────────────────────────────────────
# Se compila con Node y se sirve con nginx. La imagen final no lleva Node
# ni node_modules: son archivos estáticos y un servidor web.

FROM node:22-alpine AS compilacion

WORKDIR /origen

# npm ci (no npm install) instala exactamente lo que fija el lockfile.
# En un despliegue eso es lo que quieres: la misma versión que probaste,
# no la que resuelva el registro ese día.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Las variables VITE_* se hornean en el bundle en tiempo de compilación,
# no se leen al arrancar. Por eso viajan como argumentos de build: si las
# pones como variables de entorno del contenedor, el paquete ya está hecho
# y las ignora.
#
# Vacías por defecto = rutas relativas = todo sale por nginx bajo el mismo
# origen. Solo hay que rellenarlas si el API vive en otro dominio.
ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_STORAGE_API_URL=

ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_STORAGE_API_URL=$VITE_STORAGE_API_URL

RUN npm run build


FROM nginx:1.27-alpine

COPY --from=compilacion /origen/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
