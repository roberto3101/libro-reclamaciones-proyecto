@echo off
setlocal enabledelayedexpansion
title Libro Reclamaciones (LOCAL) : :8060

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

REM ========== 3) Env de desarrollo ==========
set "SERVER_PORT=8060"
set "SERVER_ENV=development"

REM CockroachDB (Local default)
set "CRDB_HOST=localhost"
set "CRDB_PORT=26257"
set "CRDB_USER=root"
set "CRDB_PASSWORD="              REM <-- RELLENAR
set "CRDB_DATABASE=libroreclamaciones"
set "CRDB_SSLMODE=disable"

REM JWT (Local)
set "JWT_SECRET="                 REM <-- RELLENAR (minimo 32 caracteres)
set "JWT_EXPIRATION_HOURS=24"

REM CORS (Local origins)
set "CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8060"

REM ========== 4) Logs ==========
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString(\"yyyyMMdd\")"') do set YYYYMMDD=%%i
set "LOGFILE=%LOG_DIR%\libro_reclamaciones_local_%YYYYMMDD%.log"

REM ========== 5) Compilar ==========
pushd "%MS_DIR%"
echo [BUILD] Compilando Backend Libro Reclamaciones (LOCAL)...
go build -o api.exe .
if errorlevel 1 (
  echo [ERROR] go build fallo.
  popd & popd & pause & exit /b 1
)
popd

REM ========== 6) Cerrar anterior si existe ==========
for /f "tokens=5" %%p in ('netstat -ano ^| find ":8060" ^| find "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)

REM ========== 7) Lanzar (HTTP para LOCAL) ==========
echo [LOCAL] Lanzando Libro Reclamaciones en http://localhost:8060 >> "%LOGFILE%"
start "" /b cmd /c ""%MS_EXE%" -addr :8060 >> "%LOGFILE%" 2>&1"

REM ========== 8) Verificar ==========
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
