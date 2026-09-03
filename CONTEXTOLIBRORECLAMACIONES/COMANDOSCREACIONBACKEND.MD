# =============================================================================
# LIBRO DE RECLAMACIONES - Backend Go (Estructura de carpetas)
# Ejecutar desde: C:\Users\user\Desktop\SaasLibroReclamaciones\backend
# =============================================================================

# --- Carpetas que YA EXISTEN (no se tocan) ---
# cmd/plataforma_api/main.go
# internal/config/config.go
# internal/db/mssql.go
# internal/model/sp.go
# internal/repo/plataforma_repo.go
# internal/router/plataforma.go
# internal/server/http.go
# apigateway/cmd/gateway/main.go
# .env, .env.example, go.mod, go.sum

# =============================================================================
# 1. NUEVA DB: CockroachDB (junto a mssql.go que ya existe)
# =============================================================================
New-Item -ItemType File -Path "internal/db/cockroach.go" -Force

# =============================================================================
# 2. MODELOS — uno por tabla/entidad de la DB
# =============================================================================
# sp.go ya existe para el sistema anterior, no se toca
New-Item -ItemType File -Path "internal/model/plan.go" -Force
New-Item -ItemType File -Path "internal/model/suscripcion.go" -Force
New-Item -ItemType File -Path "internal/model/tenant.go" -Force
New-Item -ItemType File -Path "internal/model/sede.go" -Force
New-Item -ItemType File -Path "internal/model/usuario_admin.go" -Force
New-Item -ItemType File -Path "internal/model/reclamo.go" -Force
New-Item -ItemType File -Path "internal/model/respuesta.go" -Force
New-Item -ItemType File -Path "internal/model/historial.go" -Force
New-Item -ItemType File -Path "internal/model/mensaje.go" -Force
New-Item -ItemType File -Path "internal/model/chatbot.go" -Force
New-Item -ItemType File -Path "internal/model/api_key.go" -Force
New-Item -ItemType File -Path "internal/model/chatbot_log.go" -Force
New-Item -ItemType File -Path "internal/model/sesion.go" -Force
New-Item -ItemType File -Path "internal/model/auditoria.go" -Force
# DTOs (request/response) separados de los modelos de DB
New-Item -ItemType File -Path "internal/model/dto/reclamo_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/respuesta_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/sede_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/tenant_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/usuario_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/chatbot_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/plan_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/suscripcion_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/auth_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/dashboard_dto.go" -Force
New-Item -ItemType File -Path "internal/model/dto/pagination_dto.go" -Force

# =============================================================================
# 3. REPOSITORIOS — uno por entidad, solo SQL puro
# =============================================================================
# plataforma_repo.go ya existe, no se toca
New-Item -ItemType File -Path "internal/repo/plan_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/suscripcion_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/tenant_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/sede_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/usuario_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/reclamo_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/respuesta_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/historial_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/mensaje_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/chatbot_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/api_key_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/chatbot_log_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/sesion_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/auditoria_repo.go" -Force
New-Item -ItemType File -Path "internal/repo/dashboard_repo.go" -Force

# =============================================================================
# 4. SERVICES — lógica de negocio (CAPA NUEVA)
# =============================================================================
New-Item -ItemType File -Path "internal/service/plan_service.go" -Force
New-Item -ItemType File -Path "internal/service/suscripcion_service.go" -Force
New-Item -ItemType File -Path "internal/service/tenant_service.go" -Force
New-Item -ItemType File -Path "internal/service/sede_service.go" -Force
New-Item -ItemType File -Path "internal/service/usuario_service.go" -Force
New-Item -ItemType File -Path "internal/service/reclamo_service.go" -Force
New-Item -ItemType File -Path "internal/service/respuesta_service.go" -Force
New-Item -ItemType File -Path "internal/service/mensaje_service.go" -Force
New-Item -ItemType File -Path "internal/service/chatbot_service.go" -Force
New-Item -ItemType File -Path "internal/service/auth_service.go" -Force
New-Item -ItemType File -Path "internal/service/dashboard_service.go" -Force
New-Item -ItemType File -Path "internal/service/onboarding_service.go" -Force
New-Item -ItemType File -Path "internal/service/notificacion_service.go" -Force

# =============================================================================
# 5. CONTROLLERS — recibe HTTP, valida input, llama service (CAPA NUEVA)
# =============================================================================
New-Item -ItemType File -Path "internal/controller/plan_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/suscripcion_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/tenant_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/sede_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/usuario_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/reclamo_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/respuesta_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/mensaje_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/chatbot_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/auth_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/dashboard_controller.go" -Force
New-Item -ItemType File -Path "internal/controller/public_controller.go" -Force

# =============================================================================
# 6. ROUTER — rutas agrupadas por módulo
# =============================================================================
# plataforma.go ya existe, no se toca
New-Item -ItemType File -Path "internal/router/router.go" -Force
New-Item -ItemType File -Path "internal/router/plan_routes.go" -Force
New-Item -ItemType File -Path "internal/router/suscripcion_routes.go" -Force
New-Item -ItemType File -Path "internal/router/tenant_routes.go" -Force
New-Item -ItemType File -Path "internal/router/sede_routes.go" -Force
New-Item -ItemType File -Path "internal/router/usuario_routes.go" -Force
New-Item -ItemType File -Path "internal/router/reclamo_routes.go" -Force
New-Item -ItemType File -Path "internal/router/respuesta_routes.go" -Force
New-Item -ItemType File -Path "internal/router/mensaje_routes.go" -Force
New-Item -ItemType File -Path "internal/router/chatbot_routes.go" -Force
New-Item -ItemType File -Path "internal/router/auth_routes.go" -Force
New-Item -ItemType File -Path "internal/router/dashboard_routes.go" -Force
New-Item -ItemType File -Path "internal/router/public_routes.go" -Force
New-Item -ItemType File -Path "internal/router/api_v1_routes.go" -Force

# =============================================================================
# 7. MIDDLEWARE — autenticación, tenant isolation, rate limiting
# =============================================================================
New-Item -ItemType File -Path "internal/middleware/auth.go" -Force
New-Item -ItemType File -Path "internal/middleware/tenant.go" -Force
New-Item -ItemType File -Path "internal/middleware/api_key.go" -Force
New-Item -ItemType File -Path "internal/middleware/rate_limiter.go" -Force
New-Item -ItemType File -Path "internal/middleware/cors.go" -Force
New-Item -ItemType File -Path "internal/middleware/logger.go" -Force
New-Item -ItemType File -Path "internal/middleware/recovery.go" -Force
New-Item -ItemType File -Path "internal/middleware/plan_guard.go" -Force

# =============================================================================
# 8. HELPERS / UTILS — funciones reutilizables
# =============================================================================
New-Item -ItemType File -Path "internal/helper/response.go" -Force
New-Item -ItemType File -Path "internal/helper/validator.go" -Force
New-Item -ItemType File -Path "internal/helper/hash.go" -Force
New-Item -ItemType File -Path "internal/helper/code_generator.go" -Force
New-Item -ItemType File -Path "internal/helper/date.go" -Force
New-Item -ItemType File -Path "internal/helper/pagination.go" -Force
New-Item -ItemType File -Path "internal/helper/context.go" -Force

# =============================================================================
# 9. ERRORES PERSONALIZADOS
# =============================================================================
New-Item -ItemType File -Path "internal/apperror/errors.go" -Force
New-Item -ItemType File -Path "internal/apperror/plan_errors.go" -Force
New-Item -ItemType File -Path "internal/apperror/auth_errors.go" -Force

# =============================================================================
# 10. MIGRATIONS — scripts SQL versionados
# =============================================================================
New-Item -ItemType File -Path "migrations/001_initial_schema.sql" -Force
New-Item -ItemType File -Path "migrations/002_seed_planes.sql" -Force
New-Item -ItemType File -Path "migrations/README.md" -Force

# =============================================================================
# 11. DOCS — documentación del proyecto
# =============================================================================
New-Item -ItemType File -Path "docs/db_schema_v4.md" -Force
New-Item -ItemType File -Path "docs/api_endpoints.md" -Force
New-Item -ItemType File -Path "docs/chatbot_integration.md" -Force
New-Item -ItemType File -Path "docs/deployment.md" -Force

# =============================================================================
# 12. SCRIPTS — utilidades de desarrollo
# =============================================================================
New-Item -ItemType File -Path "scripts/run_dev.ps1" -Force
New-Item -ItemType File -Path "scripts/run_migrations.ps1" -Force
New-Item -ItemType File -Path "scripts/generate_api_key.go" -Force

# =============================================================================
# VERIFICAR ESTRUCTURA
# =============================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Estructura creada exitosamente" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
tree /F