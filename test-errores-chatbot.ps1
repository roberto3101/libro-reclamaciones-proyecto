# ═══════════════════════════════════════════════════════════════
# Test de errores para la campana del health check de chatbots
#
# Uso:
#   .\test-errores-chatbot.ps1              → ciclo completo
#   .\test-errores-chatbot.ps1 todo-mal     → genera errores
#   .\test-errores-chatbot.ps1 restaurar    → limpia errores
#   .\test-errores-chatbot.ps1 desactivar
#   .\test-errores-chatbot.ps1 activar
#   .\test-errores-chatbot.ps1 sin-permisos
#   .\test-errores-chatbot.ps1 con-permisos
# ═══════════════════════════════════════════════════════════════

param([string]$Accion = "ciclo")

$API = "http://localhost:8080/api/v1"
$EMAIL = "admin@demo.com"
$PASSWORD = "admin123"

Write-Host "=== TEST CAMPANA ERRORES ===" -ForegroundColor Cyan
Write-Host ""

# ── Login ──
Write-Host "Iniciando sesion..." -ForegroundColor Yellow
$loginBody = @{ email = $EMAIL; password = $PASSWORD } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$API/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
} catch {
    Write-Host "Login fallido. Verifica que el backend este corriendo." -ForegroundColor Red
    exit 1
}

$token = $loginResp.data.token
if (-not $token) { $token = $loginResp.token }
if (-not $token) {
    Write-Host "Login fallido. No se obtuvo token." -ForegroundColor Red
    Write-Host "Respuesta: $($loginResp | ConvertTo-Json -Depth 3)"
    exit 1
}

Write-Host "Login exitoso" -ForegroundColor Green
Write-Host ""

$headers = @{ Authorization = "Bearer $token" }

# ── Obtener chatbot ──
Write-Host "Buscando chatbot..." -ForegroundColor Yellow
$chatbots = Invoke-RestMethod -Uri "$API/chatbots" -Headers $headers
$lista = $chatbots.data
if (-not $lista) { $lista = $chatbots }
if ($lista -is [array]) { $bot = $lista[0] } else { $bot = $lista }

if (-not $bot.id) {
    Write-Host "No se encontro ningun chatbot." -ForegroundColor Red
    exit 1
}

$id = $bot.id
$nombre = $bot.nombre
$tipo = $bot.tipo
Write-Host "Chatbot: $nombre ($id)" -ForegroundColor Green
Write-Host ""

# ── Funciones ──

function Desactivar {
    Write-Host "[X] Desactivando bot..." -ForegroundColor Red
    Invoke-RestMethod -Uri "$API/chatbots/$id/deactivate" -Method POST -Headers $headers | Out-Null
    Write-Host "    Error generado: 'Bot desactivado'" -ForegroundColor DarkRed
}

function Activar {
    Write-Host "[O] Activando bot..." -ForegroundColor Green
    Invoke-RestMethod -Uri "$API/chatbots/$id/reactivate" -Method POST -Headers $headers | Out-Null
    Write-Host "    Restaurado" -ForegroundColor DarkGreen
}

function QuitarPermisos {
    Write-Host "[X] Quitando permisos..." -ForegroundColor Red
    $body = @{
        nombre = $nombre; tipo = $tipo; activo = $true
        puede_leer_reclamos = $false; puede_enviar_mensajes = $false; puede_cambiar_estado = $false
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$API/chatbots/$id" -Method PUT -Headers $headers -Body $body -ContentType "application/json" | Out-Null
    Write-Host "    Error generado: 'Sin permisos configurados'" -ForegroundColor DarkRed
}

function RestaurarPermisos {
    Write-Host "[O] Restaurando permisos..." -ForegroundColor Green
    $body = @{
        nombre = $nombre; tipo = $tipo; activo = $true
        puede_leer_reclamos = $true; puede_enviar_mensajes = $true; puede_cambiar_estado = $true
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$API/chatbots/$id" -Method PUT -Headers $headers -Body $body -ContentType "application/json" | Out-Null
    Write-Host "    Restaurado" -ForegroundColor DarkGreen
}

# ── Ejecutar ──

switch ($Accion) {
    "desactivar"   { Desactivar }
    "activar"      { Activar }
    "sin-permisos" { QuitarPermisos }
    "con-permisos" { RestaurarPermisos }
    "todo-mal" {
        Desactivar
        QuitarPermisos
        Write-Host ""
        Write-Host "La campana deberia mostrar 2 errores" -ForegroundColor Magenta
    }
    "restaurar" {
        Activar
        RestaurarPermisos
        Write-Host ""
        Write-Host "Campana limpia" -ForegroundColor Green
    }
    "ciclo" {
        Write-Host "Abre el panel del chatbot y mira la campana..." -ForegroundColor Cyan
        Start-Sleep 2

        Desactivar
        Write-Host "    Esperando 5s..." -ForegroundColor DarkGray
        Start-Sleep 5

        QuitarPermisos
        Write-Host "    Esperando 5s..." -ForegroundColor DarkGray
        Start-Sleep 5

        Write-Host ""
        Write-Host "Deberias ver 2 errores en la campana" -ForegroundColor Magenta
        Write-Host "    Esperando 8s antes de restaurar..." -ForegroundColor DarkGray
        Start-Sleep 8
        Write-Host ""

        Activar
        Start-Sleep 3
        RestaurarPermisos
        Write-Host "    Esperando 5s..." -ForegroundColor DarkGray
        Start-Sleep 5

        Write-Host ""
        Write-Host "Ciclo completo - campana limpia" -ForegroundColor Green
    }
    default {
        Write-Host "Accion no reconocida: $Accion" -ForegroundColor Red
        Write-Host "Opciones: desactivar|activar|sin-permisos|con-permisos|todo-mal|restaurar|ciclo"
        exit 1
    }
}

Write-Host ""
Write-Host "=== FIN ===" -ForegroundColor Cyan
