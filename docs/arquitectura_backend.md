# Backend Go — Estructura de Carpetas y Archivos

## Flujo de una petición HTTP

```
Request → Router → Middleware → Controller → Service → Repo → CockroachDB
```

---

## Carpetas

### `cmd/plataforma_api/`
Punto de entrada. `main.go` inicia el servidor, carga config, conecta DB e inyecta dependencias.

### `apigateway/`
API Gateway independiente. Enruta requests a distintos microservicios si se necesita en el futuro.

### `internal/config/`
`config.go` — Carga variables de entorno (.env): puertos, credenciales de DB, secrets de JWT, etc.

### `internal/db/`
- `mssql.go` — Conexión a SQL Server (sistema anterior/central).
- `cockroach.go` — Conexión a CockroachDB (libro de reclamaciones). Pool de conexiones.

### `internal/model/`
Structs que representan las tablas de la DB. Un archivo por tabla.
- `plan.go`, `suscripcion.go`, `tenant.go`, `sede.go`, `usuario_admin.go`
- `reclamo.go`, `respuesta.go`, `historial.go`, `mensaje.go`
- `chatbot.go`, `api_key.go`, `chatbot_log.go`
- `sesion.go`, `auditoria.go`

### `internal/model/dto/`
Data Transfer Objects. Structs para request/response HTTP. Separa lo que entra/sale por API de lo que se guarda en DB (ej: nunca exponer `password_hash`).
- `reclamo_dto.go` — CreateReclamoRequest, ReclamoResponse
- `auth_dto.go` — LoginRequest, TokenResponse
- `dashboard_dto.go` — DashboardResponse, MetricasResponse
- `pagination_dto.go` — PaginationRequest, PaginatedResponse

### `internal/repo/`
Repositorios. **Solo SQL puro**. No contienen lógica de negocio. Cada método recibe `tenant_id` como primer parámetro.
- `reclamo_repo.go` — INSERT, SELECT, UPDATE de reclamos
- `dashboard_repo.go` — Queries a las vistas (v_dashboard_reclamos, v_uso_tenant)
- `historial_repo.go` — INSERT en historial_reclamos
- Un repo por entidad.

### `internal/service/`
**Lógica de negocio**. La capa más importante. Aquí vive:
- `reclamo_service.go` — Validar límites del plan, calcular `fecha_limite_respuesta`, generar `codigo_reclamo`, copiar snapshots de proveedor/sede, insertar historial.
- `chatbot_service.go` — Validar scopes, verificar rate limit, registrar logs.
- `onboarding_service.go` — Crear tenant + sede principal + suscripción DEMO + admin inicial (todo en una transacción).
- `auth_service.go` — Validar JWT, crear/invalidar sesiones, hashear passwords.
- `dashboard_service.go` — Orquestar queries de métricas.
- `notificacion_service.go` — Enviar email/WhatsApp al consumidor.
- `plan_service.go` — CRUD de planes, validar upgrades/downgrades.
- `suscripcion_service.go` — Cambiar plan, suspender, cancelar, renovar.

### `internal/controller/`
Recibe el request HTTP, extrae datos del body/params/context, llama al service y devuelve la response. **No tiene lógica de negocio.**
- `reclamo_controller.go` — Parsea JSON, extrae tenant_id del context, llama a reclamo_service, devuelve JSON.
- `public_controller.go` — Endpoints públicos (formulario de reclamos, no requiere JWT).
- Un controller por módulo.

### `internal/router/`
Define rutas y asigna middlewares. Un archivo por módulo.
- `router.go` — Agrupa todas las rutas y aplica middlewares globales.
- `reclamo_routes.go` — `POST /api/v1/reclamos`, `GET /api/v1/reclamos/:id`, etc.
- `public_routes.go` — `GET /libro/:slug`, `POST /libro/:slug/reclamo` (sin auth).
- `api_v1_routes.go` — Rutas para chatbots (`Authorization: Bearer crb_live_...`).
- `auth_routes.go` — `POST /auth/login`, `POST /auth/logout`.

### `internal/middleware/`
Funciones que interceptan el request antes de llegar al controller.
- `auth.go` — Valida JWT, extrae tenant_id y user_id, los inyecta en el context.
- `tenant.go` — Verifica que el tenant esté activo y su suscripción vigente.
- `api_key.go` — Autentica chatbots: hashea el Bearer token, busca en `chatbot_api_keys`, extrae tenant_id y scopes.
- `rate_limiter.go` — Cuenta requests en `chatbot_logs` y rechaza si excede el límite.
- `plan_guard.go` — Verifica funcionalidades del plan (ej: si `permite_chatbot = false`, bloquea el endpoint).
- `cors.go` — Headers CORS para el frontend.
- `logger.go` — Loguea cada request (método, path, duración, status).
- `recovery.go` — Atrapa panics y devuelve 500 en vez de crashear el servidor.

### `internal/helper/`
Funciones utilitarias reutilizables. Sin estado, sin dependencias de DB.
- `response.go` — Funciones para respuestas JSON estandarizadas: `Success()`, `Error()`, `Paginated()`.
- `validator.go` — Validar RUC, DNI, email, campos obligatorios de INDECOPI.
- `hash.go` — SHA256 para API keys, bcrypt para passwords.
- `code_generator.go` — Genera códigos de reclamo: `2026-POLLREY-MIR-00042`.
- `date.go` — Calcular `fecha_limite_respuesta`, verificar si un reclamo está vencido.
- `pagination.go` — Parsear page/limit del query string, calcular offset.
- `context.go` — Extraer `tenant_id`, `user_id`, `chatbot_id` del context de Go.

### `internal/apperror/`
Errores tipados con status code HTTP incluido. El controller los traduce automáticamente.
- `errors.go` — Struct `AppError` base y handler global.
- `plan_errors.go` — `PlanLimitSedes`, `PlanLimitReclamos`, `PlanSinChatbot`, etc.
- `auth_errors.go` — `ApiKeyInvalida`, `ApiKeyExpirada`, `TokenInvalido`, `RateLimitExcedido`.

### `migrations/`
Scripts SQL versionados para crear/modificar la DB.
- `001_initial_schema.sql` — Schema completo v4 (14 tablas + vistas).
- `002_seed_planes.sql` — INSERT de los 4 planes (DEMO, BRONZE, IRON, GOLD).
- `README.md` — Instrucciones de cómo ejecutar migraciones.

### `docs/`
- `db_schema_v4.md` — Documentación completa de la base de datos.
- `api_endpoints.md` — Lista de todos los endpoints con request/response.
- `chatbot_integration.md` — Guía para integrar chatbots externos.
- `deployment.md` — Instrucciones de despliegue.

### `scripts/`
- `run_dev.ps1` — Levantar el servidor en modo desarrollo.
- `run_migrations.ps1` — Ejecutar migraciones contra CockroachDB.
- `generate_api_key.go` — Utilidad para generar API keys de chatbot.

---

## Regla de dependencias

```
router → controller → service → repo → db
                         ↓
                      helper
                      apperror
                      model/dto
```

- **Router** solo conoce controllers y middlewares.
- **Controller** solo conoce services y DTOs.
- **Service** conoce repos, helpers, apperrors y modelos.
- **Repo** solo conoce modelos y la conexión a DB.
- **Ninguna capa referencia a una capa superior.**
