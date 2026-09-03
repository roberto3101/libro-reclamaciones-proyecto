# Puesta en producción

Estado a 3 de septiembre de 2026. Marca lo que vayas completando.

---

## Lo que ya está resuelto

- Código sin rastros del sistema del que salió esta copia.
- Backend, frontend y base funcionando en local; 182 rutas probadas, **0 errores de servidor**.
- `Dockerfile` para backend y frontend, `nginx.conf` y `docker-compose.yml` listos.
- Un solo puerto expuesto (80). Base y backend quedan en la red interna de Docker.
- Todo bajo el mismo origen a través de nginx, así que **no hay CORS que configurar**.

---

## Bloqueantes: sin esto no se puede cobrar ni operar

### 1. Servidor y dominio

Hace falta una máquina con IP pública y un dominio apuntando a ella.

Para el tamaño inicial basta un VPS de 2 vCPU y 4 GB. Proveedores con presencia
cercana a Perú: DigitalOcean, Hetzner, Vultr, Contabo.

Una vez tengas la máquina:

```bash
git clone <tu-repo> && cd LibroReclamaciones
cp .env.produccion.ejemplo .env
nano .env                 # rellenar (ver abajo)
docker compose up -d --build
```

### 2. HTTPS

Sin certificado, el navegador marca el sitio como no seguro y **los WebSockets
`wss://` no conectan**. Además Culqi no acepta webhooks por HTTP.

La vía más corta es poner Cloudflare delante (plan gratuito): apuntas el dominio
a sus servidores DNS, activas el proxy y el certificado lo pone Cloudflare.
No hay que tocar nginx.

### 3. `JWT_SECRET`

Ahora mismo vale `dev-...`, un valor de desarrollo. Quien lo conozca puede
**firmar tokens válidos y entrar como cualquier usuario, incluido superadmin**.

Ya te generé uno fuerte; está en el chat, no en ningún archivo.

### 4. Pasarela de cobro

El código de Culqi **ya está escrito** (`culqi_client.go`, `pago_service.go`,
rutas y controlador). Solo faltan las credenciales. Sin ellas no hay
monetización posible.

Regístrate en <https://culqi.com> → panel → Desarrollo → Llaves. Necesitas:

| Variable | Dónde sale |
|---|---|
| `CULQI_PUBLIC_KEY` | Llave pública (`pk_live_...`) |
| `CULQI_SECRET_KEY` | Llave secreta (`sk_live_...`) |
| `CULQI_WEBHOOK_SECRET` | Al crear el webhook |
| `CULQI_API_URL` | `https://api.culqi.com/v2` |

El webhook apunta a `https://TU-DOMINIO/webhook/culqi`.

### Mercado Pago (suscripción recurrente)

Las dos pasarelas cubren casos distintos y conviene tener ambas: Culqi cobra
una vez con tarjeta, Mercado Pago cobra **todos los meses solo**. Para un SaaS
lo segundo es lo que sostiene el negocio.

Panel de Mercado Pago → Tus integraciones → Credenciales de producción:

| Variable | Dónde sale |
|---|---|
| `MP_PUBLIC_KEY` | Public key |
| `MP_ACCESS_TOKEN` | Access token |
| `MP_WEBHOOK_SECRET` | Al configurar la notificación |
| `MP_API_URL` | `https://api.mercadopago.com` |

Webhook: `https://TU-DOMINIO/webhook/mercadopago`

> Si dejas `MP_WEBHOOK_SECRET` vacío la firma **no se verifica** y cualquiera
> podría enviar avisos falsos de pago. Rellénalo antes de cobrar de verdad.

### 5. Limpiar los datos de prueba

La base local arrastra registros de las pruebas del sistema anterior:

- 9 correos `@codeplex.dev` en `usuarios_admin`
- 1 empresa con esa marca en razón social y slug
- 1 empresa `demo` (UNIVERSIDAD DE PIURA) con 106 reclamos inventados

**No lo he borrado.** En producción se arranca con base vacía y se aplican las
26 migraciones; no arrastres la local.

---

## No bloqueantes: cada uno apaga su módulo

| Servicio | Si falta | Dónde se saca |
|---|---|---|
| SMTP | No salen correos de reclamo ni de resolución | Tu proveedor, o Resend / Brevo |
| Almacenamiento | No se pueden adjuntar archivos | Cloudflare R2, S3, MinIO |
| Turnstile | El libro público queda sin CAPTCHA | Cloudflare → Turnstile |
| Claves de IA | Asistente y chatbots apagados | Groq, OpenAI, Google |
| SQL Server | La consulta de RUC/DNI da 502 controlado | Tu servicio actual |
| WhatsApp | Canal desactivado | Meta for Developers |

Nada de esto tumba la aplicación: cada módulo degrada solo.

---

## Comprobación después de desplegar

```bash
curl https://TU-DOMINIO/api/v1/../health      # {"db":"connected","status":"healthy"}
curl https://TU-DOMINIO/libro/<slug>/tenant   # 200 con datos
```

Y en el navegador: entrar al panel, abrir el libro público, registrar un reclamo
de prueba y comprobar que el WebSocket conecta (la campana recibe el aviso).

---

## Orden recomendado

1. Contratar VPS y dominio.
2. Cloudflare delante (DNS + proxy + HTTPS).
3. `docker compose up -d --build` con el `.env` relleno.
4. Crear la primera cuenta real y tu superadmin.
5. Culqi en modo prueba → una compra de prueba → pasar a producción.
6. Recién ahí, marketing.

El paso 6 al final no es capricho: mandar gente a un sitio donde no se puede
pagar quema la primera impresión, que solo se tiene una vez.
