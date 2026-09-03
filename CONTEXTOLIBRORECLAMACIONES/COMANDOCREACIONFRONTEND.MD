# =============================================================================
# ESTRUCTURA FRONTEND — SaaS Libro de Reclamaciones
# Ejecutar desde: C:\Users\user\Desktop\SaasLibroReclamaciones\frontend
# =============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Creando estructura frontend..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# --- 1. Inicializar proyecto con Vite + React + TypeScript ---
Write-Host "`n[1/4] Inicializando Vite..." -ForegroundColor Yellow
bun create vite@latest . -- --template react-ts

# --- 2. Instalar dependencias ---
Write-Host "`n[2/4] Instalando dependencias..." -ForegroundColor Yellow
bun add react-router-dom axios zustand
bun add react-hot-toast sweetalert2 @headlessui/react
bun add @tanstack/react-table date-fns clsx react-icons
bun add -d tailwindcss @tailwindcss/vite

# --- 3. Crear estructura de carpetas y archivos ---
Write-Host "`n[3/4] Creando estructura src/..." -ForegroundColor Yellow

# === src/ root ===
New-Item -ItemType File -Path "src\main.tsx" -Force
New-Item -ItemType File -Path "src\App.tsx" -Force
New-Item -ItemType File -Path "src\index.css" -Force

# === api/ — Capa HTTP centralizada ===
New-Item -ItemType File -Path "src\api\http.ts" -Force
New-Item -ItemType File -Path "src\api\auth.ts" -Force

# === aplicacion/ — Core de la app (router, guards, estado global) ===
New-Item -ItemType File -Path "src\aplicacion\Enrutador.tsx" -Force
New-Item -ItemType File -Path "src\aplicacion\ProtectorRutas.tsx" -Force

# aplicacion/estado — Estado global (Zustand stores)
New-Item -ItemType File -Path "src\aplicacion\estado\estadoAuth.ts" -Force
New-Item -ItemType File -Path "src\aplicacion\estado\estadoUI.ts" -Force

# aplicacion/ganchos — Hooks globales
New-Item -ItemType File -Path "src\aplicacion\ganchos\usarAuth.ts" -Force

# aplicacion/helpers — Utilidades puras
New-Item -ItemType File -Path "src\aplicacion\helpers\confirmar.ts" -Force
New-Item -ItemType File -Path "src\aplicacion\helpers\errores.ts" -Force
New-Item -ItemType File -Path "src\aplicacion\helpers\jwt.ts" -Force
New-Item -ItemType File -Path "src\aplicacion\helpers\sesion.ts" -Force
New-Item -ItemType File -Path "src\aplicacion\helpers\toast.ts" -Force
New-Item -ItemType File -Path "src\aplicacion\helpers\formato.ts" -Force

# aplicacion/layouts — Layouts compartidos
New-Item -ItemType File -Path "src\aplicacion\layouts\LayoutPrincipal.tsx" -Force
New-Item -ItemType File -Path "src\aplicacion\layouts\LayoutPublico.tsx" -Force

# === componentes/ui — Componentes reutilizables (design system) ===
New-Item -ItemType File -Path "src\componentes\ui\Boton.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Entrada.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Tarjeta.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Modal.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Tabla.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Badge.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Spinner.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\Select.tsx" -Force
New-Item -ItemType File -Path "src\componentes\ui\ModalSesionExpirada.tsx" -Force

# === tipos/ — TypeScript types/interfaces (mirror del backend) ===
New-Item -ItemType File -Path "src\tipos\auth.ts" -Force
New-Item -ItemType File -Path "src\tipos\plan.ts" -Force
New-Item -ItemType File -Path "src\tipos\suscripcion.ts" -Force
New-Item -ItemType File -Path "src\tipos\tenant.ts" -Force
New-Item -ItemType File -Path "src\tipos\sede.ts" -Force
New-Item -ItemType File -Path "src\tipos\usuario.ts" -Force
New-Item -ItemType File -Path "src\tipos\reclamo.ts" -Force
New-Item -ItemType File -Path "src\tipos\respuesta.ts" -Force
New-Item -ItemType File -Path "src\tipos\mensaje.ts" -Force
New-Item -ItemType File -Path "src\tipos\chatbot.ts" -Force
New-Item -ItemType File -Path "src\tipos\dashboard.ts" -Force
New-Item -ItemType File -Path "src\tipos\api.ts" -Force

# === paginas/ — Páginas globales (login, inicio) ===
New-Item -ItemType File -Path "src\paginas\acceso\PaginaLogin.tsx" -Force
New-Item -ItemType File -Path "src\paginas\inicio\PaginaInicio.tsx" -Force
New-Item -ItemType File -Path "src\paginas\panel\PaginaPanel.tsx" -Force
New-Item -ItemType File -Path "src\paginas\no-encontrado\Pagina404.tsx" -Force

# === modulos/ — Feature modules (cada módulo es independiente) ===

# modulos/dashboard
New-Item -ItemType File -Path "src\modulos\dashboard\api\dashboard.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\dashboard\ganchos\usarDashboard.ts" -Force
New-Item -ItemType File -Path "src\modulos\dashboard\paginas\PaginaDashboard.tsx" -Force
New-Item -ItemType File -Path "src\modulos\dashboard\componentes\TarjetaUso.tsx" -Force
New-Item -ItemType File -Path "src\modulos\dashboard\componentes\GraficoReclamos.tsx" -Force

# modulos/reclamos
New-Item -ItemType File -Path "src\modulos\reclamos\api\reclamos.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\ganchos\usarReclamos.ts" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\paginas\PaginaReclamos.tsx" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\paginas\PaginaDetalleReclamo.tsx" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\componentes\TablaReclamos.tsx" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\componentes\FiltrosReclamos.tsx" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\componentes\TimelineReclamo.tsx" -Force
New-Item -ItemType File -Path "src\modulos\reclamos\componentes\FormCambiarEstado.tsx" -Force

# modulos/respuestas
New-Item -ItemType File -Path "src\modulos\respuestas\api\respuestas.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\respuestas\ganchos\usarRespuestas.ts" -Force
New-Item -ItemType File -Path "src\modulos\respuestas\componentes\FormRespuesta.tsx" -Force
New-Item -ItemType File -Path "src\modulos\respuestas\componentes\ListaRespuestas.tsx" -Force

# modulos/mensajes
New-Item -ItemType File -Path "src\modulos\mensajes\api\mensajes.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\mensajes\ganchos\usarMensajes.ts" -Force
New-Item -ItemType File -Path "src\modulos\mensajes\componentes\ChatMensajes.tsx" -Force
New-Item -ItemType File -Path "src\modulos\mensajes\componentes\FormMensaje.tsx" -Force

# modulos/usuarios
New-Item -ItemType File -Path "src\modulos\usuarios\api\usuarios.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\usuarios\ganchos\usarUsuarios.ts" -Force
New-Item -ItemType File -Path "src\modulos\usuarios\paginas\PaginaUsuarios.tsx" -Force
New-Item -ItemType File -Path "src\modulos\usuarios\componentes\TablaUsuarios.tsx" -Force
New-Item -ItemType File -Path "src\modulos\usuarios\componentes\FormUsuario.tsx" -Force

# modulos/sedes
New-Item -ItemType File -Path "src\modulos\sedes\api\sedes.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\sedes\ganchos\usarSedes.ts" -Force
New-Item -ItemType File -Path "src\modulos\sedes\paginas\PaginaSedes.tsx" -Force
New-Item -ItemType File -Path "src\modulos\sedes\componentes\TablaSedes.tsx" -Force
New-Item -ItemType File -Path "src\modulos\sedes\componentes\FormSede.tsx" -Force

# modulos/planes
New-Item -ItemType File -Path "src\modulos\planes\api\planes.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\planes\ganchos\usarPlanes.ts" -Force
New-Item -ItemType File -Path "src\modulos\planes\paginas\PaginaPlanes.tsx" -Force
New-Item -ItemType File -Path "src\modulos\planes\componentes\TarjetaPlan.tsx" -Force

# modulos/suscripcion
New-Item -ItemType File -Path "src\modulos\suscripcion\api\suscripcion.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\suscripcion\ganchos\usarSuscripcion.ts" -Force
New-Item -ItemType File -Path "src\modulos\suscripcion\paginas\PaginaSuscripcion.tsx" -Force

# modulos/tenant
New-Item -ItemType File -Path "src\modulos\tenant\api\tenant.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\tenant\ganchos\usarTenant.ts" -Force
New-Item -ItemType File -Path "src\modulos\tenant\paginas\PaginaConfigTenant.tsx" -Force
New-Item -ItemType File -Path "src\modulos\tenant\componentes\FormTenant.tsx" -Force

# modulos/chatbots
New-Item -ItemType File -Path "src\modulos\chatbots\api\chatbots.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\ganchos\usarChatbots.ts" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\paginas\PaginaChatbots.tsx" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\paginas\PaginaDetalleChatbot.tsx" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\componentes\TablaChatbots.tsx" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\componentes\FormChatbot.tsx" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\componentes\TablaAPIKeys.tsx" -Force
New-Item -ItemType File -Path "src\modulos\chatbots\componentes\FormAPIKey.tsx" -Force

# modulos/libro-publico (formulario público de reclamos)
New-Item -ItemType File -Path "src\modulos\libro-publico\api\publico.api.ts" -Force
New-Item -ItemType File -Path "src\modulos\libro-publico\paginas\PaginaLibroPublico.tsx" -Force
New-Item -ItemType File -Path "src\modulos\libro-publico\paginas\PaginaConfirmacion.tsx" -Force
New-Item -ItemType File -Path "src\modulos\libro-publico\componentes\FormReclamo.tsx" -Force
New-Item -ItemType File -Path "src\modulos\libro-publico\componentes\PasoConsumidor.tsx" -Force
New-Item -ItemType File -Path "src\modulos\libro-publico\componentes\PasoBien.tsx" -Force
New-Item -ItemType File -Path "src\modulos\libro-publico\componentes\PasoDetalle.tsx" -Force

# --- 4. Resumen ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Estructura creada exitosamente" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Yellow
Write-Host "  bun dev" -ForegroundColor Cyan
Write-Host ""