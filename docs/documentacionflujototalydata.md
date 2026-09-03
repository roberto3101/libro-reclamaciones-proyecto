# Libro de Reclamaciones — Documentación de Base de Datos v5

## SaaS Multitenant con CockroachDB — Planes + Chatbots + Asistente IA

---

## ¿Qué es este sistema?

Es un **Libro de Reclamaciones Virtual** para empresas peruanas, cumpliendo normativa de INDECOPI (D.S. 011-2011-PCM y Ley N° 29571). Funciona como un servicio SaaS: muchas empresas usan el mismo sistema, cada una ve solo sus propios datos.

El sistema forma parte de un **ecosistema de SaaS** que vive dentro de una red social, pero es **independiente**: si otro módulo se cae, este sigue funcionando. Mantiene su propia base de datos, sus propios planes de suscripción y su propia autenticación de API.

### URLs públicas

- Empresa con una sola sede: `tuapp.com/libro/polleria-rey`
- Empresa con múltiples sedes: `tuapp.com/libro/polleria-rey/miraflores`

---

## Resumen de versiones

| Versión | Tablas | Qué se agregó |
|---------|--------|---------------|
| v1 | 8 | Schema base (reclamos, respuestas, historial, etc.) |
| v2 | 8 | Optimización (STORING, soft deletes, TTL, optimistic locking) |
| v3 | 9 | Tabla `sedes` (multi-sede por ley) |
| v4 | 14 | `planes`, `suscripciones`, `chatbots`, `chatbot_api_keys`, `chatbot_logs` + vista `v_uso_tenant` |
| **v5** | **16** | **`asistente_conversaciones`, `asistente_mensajes` — Historial del asistente IA interno** |

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                    DB CENTRAL (DEL JEFE)                 │
│         Login global, usuarios, empresas, pagos         │
│                  Emite JWT con tenant_id                 │
└─────────────────────┬───────────────────────────────────┘
                      │ JWT
                      ▼
┌─────────────────────────────────────────────────────────┐
│          LIBRO DE RECLAMACIONES (esta DB)                │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PLANES   │  │ SUSCRIPCIONES│  │ CONFIGURACION    │  │
│  │ (global)  │──│ (por tenant) │──│ TENANT           │  │
│  └──────────┘  └──────────────┘  └──────┬───────────┘  │
│                                         │               │
│                    ┌────────────────────┬┘               │
│                    │                    │                │
│               ┌────┴─────┐      ┌──────┴──────┐        │
│               │  SEDES   │      │  USUARIOS   │        │
│               └────┬─────┘      │  ADMIN      │        │
│                    │            └──┬───┬──────┘        │
│                    │               │   │                │
│               ┌────┴───────────────┘   │                │
│               │     RECLAMOS           │                │
│               └──┬────┬────┬───────────┘                │
│                  │    │    │                             │
│            ┌─────┴┐ ┌┴────┴─┐  ┌─────────────┐        │
│            │RESP. │ │HIST.  │  │  CHATBOTS   │        │
│            └──────┘ │MENSAJ.│  │  ┌─API KEYS │        │
│                     └───────┘  │  └─LOGS     │        │
│                                └─────────────┘        │
│                                                         │
│               ┌─────────────────────┐                   │
│               │  ASISTENTE IA (v5)  │                   │
│               │  ┌─CONVERSACIONES  │                   │
│               │  └─MENSAJES        │                   │
│               └─────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## Las 16 tablas

### Tabla de relaciones y FKs

```
planes (GLOBAL, sin tenant_id)
   │
   └── suscripciones ── configuracion_tenant
                              │
                    ┌─────────┴─────────┐
                    │                   │
                  sedes          usuarios_admin
                    │                   │
                    │            ┌──────┼──────────────────┐
                    │            │      │                  │
                    │      sesiones  auditoria    asistente_conversaciones
                    │                                      │
                 reclamos                          asistente_mensajes
                    │
          ┌─────────┼─────────┐
          │         │         │
     respuestas  historial  mensajes
                                          chatbots
                                             │
                                      ┌──────┴──────┐
                                      │             │
                                  api_keys        logs
```

---

## BLOQUE 1: Planes y suscripciones

### 1. planes

**Propósito**: Catálogo de planes disponibles. Es la **única tabla sin `tenant_id`** porque los planes son globales — todos los tenants ven los mismos planes.

**Se llena cuando**: Una sola vez al desplegar el sistema (seed data). Se incluyen 4 planes por defecto.

| Plan | Precio/mes | Sedes | Usuarios | Reclamos/mes | Chatbots | WhatsApp | Reportes | API | Marca blanca |
|------|-----------|-------|----------|-------------|----------|----------|----------|-----|-------------|
| **DEMO** | Gratis | 1 | 1 | 20 | 0 | ❌ | ❌ | ❌ | ❌ |
| **BRONZE** | S/29.90 | 1 | 3 | 100 | 0 | ✅ | PDF | ❌ | ❌ |
| **IRON** | S/79.90 | 5 | 10 | 500 | 1 | ✅ | PDF+Excel | ✅ | ❌ |
| **GOLD** | S/199.90 | ∞ | ∞ | ∞ | 5 | ✅ | PDF+Excel | ✅ | ✅ |

**Columnas clave**:

| Columna | Para qué sirve |
|---------|---------------|
| `codigo` | Identificador único: `DEMO`, `BRONZE`, `IRON`, `GOLD` |
| `max_sedes` | Máximo de sedes activas. `-1` = ilimitado |
| `max_usuarios` | Máximo de admins activos. `-1` = ilimitado |
| `max_reclamos_mes` | Máximo de reclamos por mes calendario. `-1` = ilimitado |
| `max_chatbots` | Máximo de chatbots activos |
| `permite_chatbot` | Si el plan habilita la funcionalidad de chatbots |
| `permite_whatsapp` | Si puede enviar notificaciones por WhatsApp |
| `permite_api` | Si puede usar la API directamente (sin chatbot) |
| `permite_marca_blanca` | Si puede quitar el branding de la plataforma |
| `max_storage_mb` | MB totales para archivos adjuntos |
| `destacado` | Para resaltar un plan en la página de precios (el IRON está destacado) |

---

### 2. suscripciones

**Propósito**: Relación entre un tenant y su plan. Un tenant tiene **una sola suscripción activa** a la vez (garantizado por un índice único).

**Se llena cuando**: La empresa se registra (se crea con plan DEMO) o cambia de plan.

| Columna | Para qué sirve |
|---------|---------------|
| `plan_id` | FK al plan contratado |
| `estado` | `ACTIVA`, `TRIAL`, `SUSPENDIDA`, `CANCELADA`, `VENCIDA` |
| `ciclo` | `MENSUAL` o `ANUAL` |
| `fecha_proximo_cobro` | Para alertas de renovación |
| `es_trial` | Si está en período de prueba |
| `fecha_fin_trial` | Cuándo termina el trial (15 días para DEMO) |
| `override_max_*` | Sobreescritura de límites para negociaciones especiales |
| `referencia_pago` | ID de la transacción en el sistema de pagos externo |
| `metodo_pago` | `TARJETA`, `TRANSFERENCIA`, `YAPE`, `PLIN` |
| `activado_por` | Quién activó: `ONBOARDING`, `UPGRADE`, `ADMIN_MANUAL`, `RENOVACION` |

**Overrides**: Si una empresa negocia un trato especial (ej: paga IRON pero quiere 8 sedes en vez de 5), se pone `override_max_sedes = 8`. El backend siempre usa `COALESCE(override, plan.limite)` para determinar el límite real.

**Índice único de suscripción activa**:
```sql
CREATE UNIQUE INDEX idx_suscripcion_activa ON suscripciones (tenant_id)
    WHERE estado IN ('ACTIVA', 'TRIAL');
```
Esto garantiza a nivel de base de datos que un tenant no puede tener dos suscripciones activas al mismo tiempo.

---

### Vista: v_uso_tenant

**Para qué**: El backend la consulta **antes de cada operación limitada** para saber si el tenant puede hacerla.

```sql
SELECT * FROM v_uso_tenant WHERE tenant_id = $1;
```

Devuelve:

| Campo | Ejemplo | Descripción |
|-------|---------|-------------|
| `plan_codigo` | `IRON` | Plan actual |
| `limite_sedes` | 5 | Máximo permitido (ya con override aplicado) |
| `uso_sedes` | 3 | Cuántas sedes activas tiene |
| `limite_usuarios` | 10 | Máximo de admins |
| `uso_usuarios` | 7 | Cuántos admins activos tiene |
| `limite_reclamos_mes` | 500 | Máximo de reclamos este mes |
| `uso_reclamos_mes` | 342 | Cuántos reclamos van este mes |
| `limite_chatbots` | 1 | Máximo de chatbots |
| `uso_chatbots` | 1 | Cuántos chatbots activos tiene |
| `permite_chatbot` | true | Si puede usar chatbots |
| `permite_whatsapp` | true | Si puede enviar WhatsApp |

---

## BLOQUE 2: Chatbots

### Decisión de diseño: ¿Qué puede hacer un chatbot?

Los chatbots tienen **lectura completa + escritura limitada**:

| Acción | Permitido | Controlado por |
|--------|-----------|---------------|
| Leer reclamos (listar, detalle) | ✅ Siempre | `puede_leer_reclamos` |
| Leer métricas del dashboard | ✅ Siempre | `puede_leer_metricas` |
| Enviar mensajes de seguimiento | ✅ | `puede_enviar_mensajes` |
| Responder reclamos | ⚠️ Configurable | `puede_responder` + `requiere_aprobacion` |
| Cambiar estado (PENDIENTE → EN_PROCESO) | ⚠️ Configurable | `puede_cambiar_estado` |
| Crear reclamos | ❌ No | Los reclamos los crea el consumidor, no el bot |
| Eliminar reclamos | ❌ No | Nunca. Ni siquiera soft delete |
| Modificar configuración | ❌ No | Solo los admins humanos |
| Gestionar usuarios | ❌ No | Solo los admins humanos |

---

### 3. chatbots

**Propósito**: Configuración de chatbots por tenant. Un chatbot es una integración externa (IA, WhatsApp bot, Telegram bot) que interactúa con los reclamos de forma automatizada.

| Columna | Para qué sirve |
|---------|---------------|
| `nombre` | "Asistente IA de Reclamos" |
| `tipo` | `ASISTENTE_IA`, `WHATSAPP_BOT`, `TELEGRAM_BOT`, `CUSTOM` |
| `modelo_ia` | Si es IA: qué modelo usa ("gpt-4o", "claude-sonnet") |
| `prompt_sistema` | Prompt base que define el comportamiento del bot |
| `puede_leer_reclamos` | Scope: leer reclamos |
| `puede_responder` | Scope: crear respuestas |
| `puede_cambiar_estado` | Scope: mover reclamos entre estados |
| `requiere_aprobacion` | Si las respuestas quedan como borrador |
| `max_respuestas_dia` | Rate limit diario (100 por defecto) |

---

### 4. chatbot_api_keys

**Propósito**: Credenciales de acceso para los chatbots. La API key **nunca** se almacena en texto plano. Solo se guarda el hash SHA256.

**Formato del token**: `crb_{entorno}_{random}`

| Columna | Para qué sirve |
|---------|---------------|
| `key_prefix` | Primeros 12 caracteres del token (para identificar sin exponer) |
| `key_hash` | SHA256 del token completo |
| `entorno` | `LIVE` o `TEST` |
| `fecha_expiracion` | Cuándo expira. NULL = no expira |
| `ips_permitidas` | JSON con IPs permitidas. NULL = cualquier IP |
| `requests_por_minuto` | Rate limit por minuto (60 default) |
| `requests_por_dia` | Rate limit por día (5000 default) |

---

### 5. chatbot_logs

**Propósito**: Log de todas las llamadas API de los chatbots. TTL de **90 días**.

---

## BLOQUE 3: Asistente IA interno (NUEVO en v5)

### Diferencia entre Chatbot y Asistente IA

| | Chatbot (v4) | Asistente IA (v5) |
|---|---|---|
| **Quién lo usa** | Integración externa (bots, APIs) | Personal interno de la plataforma |
| **Autenticación** | API Key (SHA256) | JWT (misma sesión del panel admin) |
| **Propósito** | Automatizar respuestas a reclamos | Ayudar al staff con consultas, redacción, análisis |
| **Acceso a datos** | Scopes limitados por chatbot | Lee todo el contexto del tenant |
| **Tablas** | `chatbots`, `chatbot_api_keys`, `chatbot_logs` | `asistente_conversaciones`, `asistente_mensajes` |
| **Persistencia** | Logs de auditoría (90 días TTL) | Conversaciones efímeras (7 días TTL) |

---

### 15. asistente_conversaciones

**Propósito**: Una conversación es una sesión de chat entre un usuario admin y el asistente IA. Se auto-eliminan después de **7 días** con TTL de CockroachDB.

**Límites**:
- Máximo **10 conversaciones activas** por usuario. Al crear la 11va, el backend borra la más vieja con un DELETE inline (sin crons ni jobs).
- Máximo **50 mensajes** por conversación.

| Columna | Para qué sirve |
|---------|---------------|
| `usuario_id` | FK al admin que inició la conversación |
| `titulo` | Se auto-genera del primer mensaje del usuario (primeros 80 chars) |
| `activa` | Si la conversación está activa o fue archivada |
| `total_mensajes` | Contador actualizado por el backend al insertar mensajes |
| `total_tokens_prompt` | Tokens consumidos en prompts (para monitoreo de costos) |
| `total_tokens_output` | Tokens generados por la IA |
| `proveedor_ia` | Qué proveedor se usó: `ollama/llama3.1`, `anthropic`, `google`, etc. |
| `fecha_expiracion` | TTL de 7 días. CockroachDB elimina automáticamente |

**Índice principal**:
```sql
CREATE INDEX idx_asistente_conv_usuario
    ON asistente_conversaciones (tenant_id, usuario_id, fecha_actualizacion DESC)
    STORING (titulo, activa, total_mensajes, proveedor_ia)
    WHERE activa = true;
```
Optimizado para la query más frecuente: listar conversaciones activas de un usuario, ordenadas por la más reciente.

---

### 16. asistente_mensajes

**Propósito**: Mensajes individuales de cada conversación. CASCADE delete con la conversación padre.

| Columna | Para qué sirve |
|---------|---------------|
| `conversacion_id` | FK a la conversación |
| `rol` | `USER` (pregunta del admin) o `ASSISTANT` (respuesta de la IA) |
| `contenido` | Texto del mensaje |
| `tokens_prompt` | Tokens del prompt (solo para `rol=ASSISTANT`) |
| `tokens_output` | Tokens de la respuesta (solo para `rol=ASSISTANT`) |
| `proveedor` | `ollama/llama3.1`, `anthropic`, etc. |
| `duracion_ms` | Tiempo de respuesta de la IA en milisegundos |

---

### Flujo: Usuario chatea con el asistente

```
1. Usuario abre el asistente en el panel
2. Frontend: GET /api/v1/assistant/conversations
   → Lista las conversaciones activas del usuario (máximo 10)
3. Usuario selecciona una conversación o crea una nueva
4. Frontend: POST /api/v1/assistant/conversations
   → Backend crea la conversación
   → Si ya hay 10, borra la más vieja (DELETE inline)
5. Usuario envía mensaje
6. Frontend: POST /api/v1/assistant/chat
   Body: { conversation_id, message }
7. Backend:
   a. Carga historial de la conversación desde asistente_mensajes
   b. Inyecta contexto del tenant (estadísticas, reclamos urgentes)
   c. Llama al proveedor de IA (Ollama/Anthropic/OpenAI/Google)
   d. Guarda mensaje del usuario en asistente_mensajes (rol=USER)
   e. Guarda respuesta de la IA en asistente_mensajes (rol=ASSISTANT)
   f. Actualiza contadores en asistente_conversaciones
   g. Retorna la respuesta al frontend
8. Después de 7 días sin actividad → CockroachDB borra la conversación y sus mensajes
```

### Contexto inyectado al asistente

El backend ejecuta queries dedicadas (`assistant_repo.go`) para construir el contexto:

```sql
-- Estadísticas reales (no paginadas)
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE estado = 'PENDIENTE') AS pendientes,
    COUNT(*) FILTER (WHERE estado = 'EN_PROCESO') AS en_proceso,
    COUNT(*) FILTER (WHERE estado = 'RESUELTO') AS resueltos,
    COUNT(*) FILTER (WHERE estado = 'CERRADO') AS cerrados,
    COUNT(*) FILTER (WHERE estado IN ('PENDIENTE','EN_PROCESO')
        AND fecha_limite_respuesta < NOW()) AS vencidos
FROM reclamos WHERE tenant_id = $1 AND deleted_at IS NULL;

-- Top 10 reclamos más urgentes
SELECT codigo_reclamo, estado, nombre_completo, email,
    fecha_limite_respuesta,
    EXTRACT(DAY FROM fecha_limite_respuesta - NOW()) AS dias_restantes
FROM reclamos
WHERE tenant_id = $1 AND estado IN ('PENDIENTE', 'EN_PROCESO')
ORDER BY fecha_limite_respuesta ASC
LIMIT 10;
```

### Proveedores de IA soportados

El gateway (`internal/ai/gateway.go`) abstrae el proveedor. Se cambia con 3 variables de entorno:

| Proveedor | `AI_PROVIDER` | `AI_MODEL` | `AI_API_KEY` | Costo |
|-----------|--------------|-----------|-------------|-------|
| **Ollama** (local) | `ollama` | `llama3.1`, `llama3.2:3b` | No requiere | Gratis |
| Anthropic | `anthropic` | `claude-sonnet-4-5-20250929` | Requerida | $5 crédito inicial |
| OpenAI | `openai` | `gpt-4o-mini` | Requerida | $5 mínimo |
| Google | `google` | `gemini-2.0-flash` | Requerida | Free tier limitado |

---

## BLOQUE 4: Tablas core

### 6. configuracion_tenant

Datos de la empresa, slug, branding, config del libro. Sin cambios desde v3.

### 7. sedes

Establecimientos físicos con slug para URL pública. Límite validado por plan.

### 8. usuarios_admin

Admins del panel con roles y asignación de sede. Límite validado por plan.

### 9. reclamos

Tabla principal. `canal_origen` incluye `CHATBOT`. Límite mensual validado por plan.

### 10. respuestas

Campo `origen` distingue `PANEL`, `CHATBOT`, `API`. Campo `chatbot_id` si fue un bot.

### 11. historial_reclamos

Trazabilidad. Incluye `chatbot_id` y `tipo_accion = 'CHATBOT_RESPUESTA'`.

### 12. mensajes_seguimiento

Chat de seguimiento. `tipo_mensaje` incluye `CHATBOT`.

### 13. sesiones_admin

TTL automático de CockroachDB.

### 14. auditoria_admin

Incluye acciones de chatbots y suscripciones.

---

## Las 4 vistas

| Vista | Para qué |
|-------|---------|
| `v_dashboard_reclamos` | Métricas por tenant y sede |
| `v_reclamos_pendientes` | Lista de reclamos pendientes con prioridad |
| `v_detalle_reclamo` | Detalle completo de un reclamo con última respuesta |
| `v_uso_tenant` | Uso actual vs límites del plan (para validaciones) |

---

## TTL automático

| Tabla | TTL | Frecuencia de limpieza |
|-------|-----|----------------------|
| `sesiones_admin` | Cuando `fecha_expiracion` pasa | Cada hora |
| `chatbot_logs` | 90 días | Cada día |
| **`asistente_conversaciones`** | **7 días** | **Cada hora** |

`asistente_mensajes` no necesita TTL propio — se borran en cascada con la conversación padre.

---

## Migraciones

| Archivo | Contenido | Cuándo ejecutar |
|---------|-----------|----------------|
| `schema_v4.sql` | Schema base completo (14 tablas + vistas + seed data) | Setup inicial |
| `002_asistente_historial.sql` | Tablas 15-16 del asistente IA | Después del schema base |

**Ejecutar migración** (Windows):
```powershell
cd scripts
.\run_migration.ps1 ..\migrations\002_asistente_historial.sql
```

**Ejecutar migración** (Linux/Mac):
```bash
cd scripts
chmod +x run_migration.sh
./run_migration.sh ../migrations/002_asistente_historial.sql
```

---

## Reglas de oro para el backend (v5)

1. **Toda query lleva `WHERE tenant_id = $1`**. Sin excepciones.
2. **El `tenant_id` viene del JWT** (admins) o de la **API key** (chatbots), nunca del body.
3. **Cada cambio de estado → INSERT en `historial_reclamos`**. No hay triggers.
4. **Validar límites del plan ANTES de cada operación** usando `v_uso_tenant`.
5. **`-1` significa ilimitado** en todas las columnas de límites.
6. **API keys se guardan como SHA256**, nunca en texto plano.
7. **Rate limiting se calcula contando** filas en `chatbot_logs` del último minuto/día.
8. **`requiere_aprobacion`**: si es true, las respuestas del bot son borradores.
9. **Nunca hacer `DELETE` en reclamos**. Soft delete con `deleted_at`.
10. **Los chatbot_logs expiran a los 90 días**. Exportar antes si se necesitan.
11. **Al insertar un reclamo, copiar datos del proveedor Y sede** como snapshot.
12. **`version` se incrementa en cada UPDATE** de `configuracion_tenant`.
13. **Conversaciones del asistente: máximo 10 por usuario**. Al crear la 11va, borrar la más vieja.
14. **Mensajes del asistente: máximo 50 por conversación**. Rechazar después de 50.
15. **El asistente IA no modifica datos**. Solo lectura + generación de texto.