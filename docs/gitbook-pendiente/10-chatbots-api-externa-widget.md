# Chatbots, API Externa y Widget Embebido

## Que es y para que sirve

El sistema de chatbots permite a las empresas crear **bots automatizados** que pueden interactuar con sus reclamos a traves de una API. Ademas, se puede incrustar un **widget de chat** en cualquier sitio web externo para que los clientes consulten sus reclamos sin salir de la pagina.

---

## Chatbots (Panel de Administracion)

### Que es un chatbot en este sistema

Un chatbot es una entidad con:
- Nombre y descripcion
- Configuracion de IA (modelo, prompt, temperatura)
- **Permisos granulares** (que puede y que no puede hacer)
- **API keys** para autenticarse desde sistemas externos

### Permisos por chatbot

Cada chatbot tiene permisos individuales que se activan/desactivan:

| Permiso | Que permite |
|---------|-----------|
| `puede_leer_reclamos` | Consultar la lista de reclamos y ver detalles |
| `puede_responder` | Enviar respuestas oficiales a reclamos |
| `puede_cambiar_estado` | Cambiar el estado de un reclamo (PENDIENTE → EN_PROCESO, etc.) |
| `puede_enviar_mensajes` | Enviar mensajes al cliente dentro de un reclamo |
| `puede_leer_metricas` | Consultar estadisticas del dashboard |
| `requiere_aprobacion` | Las acciones necesitan aprobacion manual antes de ejecutarse |

### API Keys

Para que un sistema externo se conecte como chatbot, necesita una API key:

```
Generacion:
1. Admin crea chatbot en el panel
2. Hace clic en "Generar API Key"
3. Sistema genera: cb_aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2u
4. Se muestra UNA SOLA VEZ (luego solo se ve enmascarada)
5. Se almacena como hash SHA256 en la base de datos
```

Caracteristicas de las API keys:
- Prefijo configurable (ej: `cb_`)
- 32 caracteres aleatorios
- Expiran en 1 anio
- Se pueden revocar inmediatamente
- Nunca se almacenan en texto plano (solo el hash)
- Al desactivar un chatbot, se revocan TODAS sus keys

---

## API Externa para Bots (`/api/bot/v1/`)

Esta es la API que usan los sistemas externos (bots, integraciones) para interactuar con los reclamos:

### Autenticacion

Se usa el header `X-API-Key`:

```bash
curl -H "X-API-Key: cb_aB3cD4eF5..." \
     https://api.tudominio.com/api/bot/v1/reclamos
```

### Endpoints disponibles

| Metodo | Endpoint | Permiso requerido | Que hace |
|--------|----------|------------------|----------|
| GET | `/api/bot/v1/reclamos` | puede_leer_reclamos | Listar reclamos (paginado) |
| GET | `/api/bot/v1/reclamos/:id` | puede_leer_reclamos | Ver detalle de un reclamo |
| POST | `/api/bot/v1/reclamos/:id/mensajes` | puede_enviar_mensajes | Enviar mensaje al cliente |
| PATCH | `/api/bot/v1/reclamos/:id/estado` | puede_cambiar_estado | Cambiar estado |

### Logging automatico

Cada llamada a la API se registra automaticamente en la tabla `chatbot_logs`:
- Endpoint llamado
- Metodo HTTP
- Codigo de respuesta
- Duracion (ms)
- IP de origen
- Fecha y hora

Esto permite auditar que hizo cada chatbot y cuando.

### Validacion de permisos (scopes)

El middleware verifica en cada request que el chatbot tiene el permiso necesario:

```go
// Ejemplo: el endpoint de listar reclamos requiere "puede_leer_reclamos"
router.GET("/reclamos",
    ChatbotScopeMiddleware("puede_leer_reclamos"),
    controller.GetReclamos)

// Si el chatbot no tiene ese permiso → 403 Forbidden
```

---

## Widget Embebido

### Que es

Un script JavaScript que cualquier empresa puede pegar en su sitio web. Muestra un boton flotante que al hacer clic abre un mini-chat donde los clientes pueden consultar el estado de su reclamo.

### Como se embebe

```html
<!-- Pegar esto en cualquier pagina web -->
<script
  src="https://tu-api.com/widget/chat.js"
  data-api-key="widget_xxx_yyy"
  data-color="#1a56db"
  data-position="right">
</script>
```

Parametros:
- `data-api-key` (obligatorio): API key del chatbot
- `data-color` (opcional): Color del boton y encabezado (default: azul)
- `data-position` (opcional): "right" o "left" (default: right)

### Como funciona

```
1. Se carga el script en la pagina del cliente
     ↓
2. Aparece un boton flotante (FAB) en la esquina
     ↓
3. El cliente hace clic y se abre un panel
     ↓
4. Pantalla de login:
   - Ingresa codigo de reclamo (ej: RCL-2026-001234)
   - Ingresa email (el mismo que uso al registrar)
     ↓
5. El widget autentica contra el backend
     ↓
6. Si es valido, muestra:
   - Estado del reclamo (con badge de color)
   - Historial de mensajes
   - Campo para enviar nuevos mensajes
     ↓
7. El widget hace polling periodico para nuevos mensajes
```

### Aislamiento de estilos

El widget usa **Shadow DOM** (modo cerrado) para que sus estilos no interfieran con la pagina donde esta embebido. Esto significa que:
- Los CSS de la pagina no afectan al widget
- Los CSS del widget no afectan a la pagina
- Funciona en cualquier sitio web sin conflictos

### Endpoints del Widget

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/widget/chat.js` | Sirve el archivo JavaScript (publico, cache 1h) |
| GET | `/api/widget/v1/config` | Retorna branding de la empresa (nombre, color, logo) |
| POST | `/api/widget/v1/auth` | Login con codigo + email |
| GET | `/api/widget/v1/reclamos/:id/mensajes` | Ver mensajes |
| POST | `/api/widget/v1/reclamos/:id/mensajes` | Enviar mensaje |

---

## Endpoints del Panel de Administracion (Chatbots)

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/chatbots` | Listar chatbots del tenant |
| GET | `/api/v1/chatbots/:id` | Ver detalle |
| POST | `/api/v1/chatbots` | Crear chatbot |
| PUT | `/api/v1/chatbots/:id` | Actualizar configuracion |
| POST | `/api/v1/chatbots/:id/deactivate` | Desactivar (revoca todas las keys) |
| POST | `/api/v1/chatbots/:id/reactivate` | Reactivar |
| DELETE | `/api/v1/chatbots/:id` | Eliminar |
| GET | `/api/v1/chatbots/:id/health` | Verificar estado |
| GET | `/api/v1/chatbots/:id/health/stream` | Health check en tiempo real (SSE) |
| POST | `/api/v1/chatbots/:id/api-keys` | Generar nueva API key |
| GET | `/api/v1/chatbots/:id/api-keys` | Listar API keys activas |
| DELETE | `/api/v1/chatbots/:id/api-keys/:keyId` | Revocar una API key |
| GET | `/api/v1/chatbots/ai-providers` | Listar proveedores IA configurados |

---

## En el frontend

### Pagina de chatbots (`PaginaChatbots.tsx`)
- Tabla de chatbots con nombre, tipo, estado, ultima actividad
- Boton "Crear Chatbot"

### Detalle de chatbot (`PaginaDetalleChatbot.tsx`)
Multiples paneles:
- **FormChatbot**: Editar nombre, descripcion, permisos, config IA
- **TablaAPIKeys**: Ver keys activas (enmascaradas), revocar
- **FormAPIKey**: Generar nueva key con nombre y entorno (dev/prod)
- **PanelProbarAPI**: Probar endpoints directamente desde el panel
- **PanelVerificarConexion**: Test de conectividad
- **PanelEstadoBot**: Estado en tiempo real via SSE
- **PanelDocumentacion**: Documentacion de la API para desarrolladores
