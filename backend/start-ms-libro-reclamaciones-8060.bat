@echo off
setlocal enabledelayedexpansion
title Libro Reclamaciones (PROD) : TLS :8060
REM ========== 1) Detectar RAIZ del repo ==========
for %%I in ("%~dp0") do set "THISDIR=%%~fI"
set "ROOT=%THISDIR%"
if not exist "%ROOT%\cmd\api" (
  echo [ERROR] No encuentro "%ROOT%\cmd\api".
  pause & exit /b 1
)
pushd "%ROOT%"
REM ========== 2) Rutas ==========
set "MS_DIR=%ROOT%\cmd\api"
set "MS_EXE=%MS_DIR%\api.exe"
set "LOG_DIR=%ROOT%\logs"
set "CERT="                       REM <-- RELLENAR: ruta al fullchain.pem
set "KEY="                        REM <-- RELLENAR: ruta al privkey.pem
REM ========== 3) Env de produccion ==========
REM --- Servidor ---
set "SERVER_PORT=8060"
set "SERVER_ENV=production"
REM --- CockroachDB ---
REM Apunta a la instalacion LOCAL. Antes figuraba aqui el servidor y la
REM base del sistema del que salio esta copia; arrancar asi habria escrito
REM en la base de produccion de aquel sistema.
REM Al montar tu servidor: cambia HOST/USER/PASSWORD y pon SSLMODE=require.
set "CRDB_HOST=localhost"
set "CRDB_PORT=26257"
set "CRDB_USER=root"
set "CRDB_PASSWORD="
set "CRDB_DATABASE=libroreclamaciones"
set "CRDB_SSLMODE=disable"
set "CRDB_MAX_OPEN_CONNS=25"
set "CRDB_MAX_IDLE_CONNS=10"
set "CRDB_CONN_MAX_LIFETIME_MIN=30"
REM --- JWT ---
set "JWT_SECRET="                 REM <-- RELLENAR (minimo 32 caracteres)
set "JWT_EXPIRATION_HOURS=24"
REM --- API Keys ---
set "API_KEY_PREFIX=crb"
REM --- Rate Limiting ---
set "RATE_LIMIT_REQUESTS_PER_MIN=60"
set "RATE_LIMIT_REQUESTS_PER_DAY=5000"
REM --- CORS ---
set "CORS_ALLOWED_ORIGINS="       REM <-- RELLENAR: tus dominios, separados por coma
REM --- SMTP / Correo ---
set "SMTP_HOST="                  REM <-- RELLENAR
set "SMTP_PORT=465"
set "SMTP_USER="                  REM <-- RELLENAR
set "SMTP_PASS="                  REM <-- RELLENAR

set "SMTP_FROM="                  REM <-- RELLENAR
REM --- Asistente IA (principal: Groq) ---
set "AI_PROVIDER=openai"
set "AI_API_KEY="                 REM <-- RELLENAR
set "AI_MODEL=llama-3.3-70b-versatile"
set "AI_BASE_URL=https://api.groq.com/openai/v1"
REM --- Fallback automatico si Groq falla (SambaNova, 200K tokens/dia gratis) ---
set "AI_FALLBACK_PROVIDER=openai"
set "AI_FALLBACK_API_KEY="        REM <-- RELLENAR
set "AI_FALLBACK_MODEL=Meta-Llama-3.3-70B-Instruct"
set "AI_FALLBACK_BASE_URL=https://api.sambanova.ai/v1"
REM --- Proveedores extras (cadena de fallback extendida) ---
set "AI_EXTRA_1_ID=cerebras"
set "AI_EXTRA_1_PROVIDER=openai"
set "AI_EXTRA_1_API_KEY="
set "AI_EXTRA_1_MODEL=llama-3.3-70b"
set "AI_EXTRA_1_BASE_URL=https://api.cerebras.ai/v1"
set "AI_EXTRA_2_ID=mistral"
set "AI_EXTRA_2_PROVIDER=openai"
set "AI_EXTRA_2_API_KEY="
set "AI_EXTRA_2_MODEL=mistral-small-latest"
set "AI_EXTRA_2_BASE_URL=https://api.mistral.ai/v1"
set "AI_EXTRA_3_ID=gemini"
set "AI_EXTRA_3_PROVIDER=google"
set "AI_EXTRA_3_API_KEY="
set "AI_EXTRA_3_MODEL=gemini-2.5-flash"
set "AI_EXTRA_3_BASE_URL="
set "AI_EXTRA_4_ID=nvidia"
set "AI_EXTRA_4_PROVIDER=openai"
set "AI_EXTRA_4_API_KEY="
set "AI_EXTRA_4_MODEL=meta/llama-4-maverick-17b-128e-instruct"
set "AI_EXTRA_4_BASE_URL=https://integrate.api.nvidia.com/v1"
set "AI_EXTRA_5_ID=huggingface"
set "AI_EXTRA_5_PROVIDER=openai"
set "AI_EXTRA_5_API_KEY="
set "AI_EXTRA_5_MODEL=meta-llama/Llama-3.3-70B-Instruct"
set "AI_EXTRA_5_BASE_URL=https://router.huggingface.co/v1"
set "AI_EXTRA_6_ID=llm7"
set "AI_EXTRA_6_PROVIDER=openai"
set "AI_EXTRA_6_API_KEY="
set "AI_EXTRA_6_MODEL=meta-llama/Llama-3.3-70B-Instruct"
set "AI_EXTRA_6_BASE_URL=https://api.llm7.io/v1"
set "AI_EXTRA_7_ID=github"
set "AI_EXTRA_7_PROVIDER=openai"
set "AI_EXTRA_7_API_KEY="
set "AI_EXTRA_7_MODEL=gpt-4o-mini"
set "AI_EXTRA_7_BASE_URL=https://models.inference.ai.azure.com"

REM --- Cloudflare R2 Storage Microservice ---
set "STORAGE_API_URL="            REM <-- RELLENAR
set "STORAGE_API_KEY="            REM <-- RELLENAR
REM --- Cloudflare Turnstile (CAPTCHA) ---
set "TURNSTILE_SECRET_KEY="       REM <-- RELLENAR
set "TURNSTILE_ENABLED=false"    REM <-- pon true cuando tengas tu clave
REM --- WhatsApp Business API ---
set "WHATSAPP_VERIFY_TOKEN="
set "META_APP_SECRET="
REM --- SQL Server (Validacion empresas - servidor 195) ---
set "SQLSERVER_HOST="             REM <-- RELLENAR
set "SQLSERVER_PORT=1433"
set "SQLSERVER_USER="             REM <-- RELLENAR
set "SQLSERVER_PASS="
set "SQLSERVER_DB="               REM <-- RELLENAR
REM ========== 4) Logs ==========
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString(\"yyyyMMdd\")"') do set YYYYMMDD=%%i
set "LOGFILE=%LOG_DIR%\libro_reclamaciones_%YYYYMMDD%.log"
REM ========== 5) Pre-chequeos ==========
if not exist "%CERT%" ( echo [ERROR] Falta CERT: "%CERT%" & popd & pause & exit /b 1 )
if not exist "%KEY%"  ( echo [ERROR] Falta KEY : "%KEY%"  & popd & pause & exit /b 1 )
REM ========== 6) Compilar ==========
pushd "%MS_DIR%"
echo [BUILD] Compilando Backend Libro Reclamaciones...
go build -o api.exe .
if errorlevel 1 (
  echo [ERROR] go build fallo.
  popd & popd & pause & exit /b 1
)
popd
REM ========== 7) Cerrar anterior si existe ==========
for /f "tokens=5" %%p in ('netstat -ano ^| find ":8060" ^| find "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)
REM ========== 8) Abrir firewall 8060 ==========
netsh advfirewall firewall add rule name="HTTPS 8060" dir=in action=allow protocol=TCP localport=8060 >nul 2>&1
REM ========== 9) Lanzar ==========
echo [PROD] Lanzando Libro Reclamaciones en https://TU-HOST:8060 >> "%LOGFILE%"
start "" /b cmd /c ""%MS_EXE%" -addr :8060 -cert "%CERT%" -key "%KEY%" >> "%LOGFILE%" 2>&1"
REM ========== 10) Verificar ==========
timeout /t 2 >nul
tasklist | find /I "api.exe" >nul || (
  echo [ERROR] api.exe no esta corriendo. Revisa el log: %LOGFILE%
  popd & pause & exit /b 1
)
echo [OK] Backend Libro Reclamaciones iniciado en :8060.
echo [INFO] Mostrando logs en tiempo real (Ctrl+C para salir del monitoreo)...
powershell -NoProfile -Command "Get-Content -Path '%LOGFILE%' -Wait -Tail 10"
popd
pause
endlocal
