# =============================================================================
# Ejecuta migraciones de la base de datos en CockroachDB (Windows)
# Uso: .\run_migration.ps1 ..\migrations\002_asistente_historial.sql
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$SqlFile
)

$CRDB_HOST = if ($env:CRDB_HOST) { $env:CRDB_HOST } else { "localhost" }
$CRDB_PORT = if ($env:CRDB_PORT) { $env:CRDB_PORT } else { "26257" }
$CRDB_USER = if ($env:CRDB_USER) { $env:CRDB_USER } else { "root" }
$CRDB_DATABASE = if ($env:CRDB_DATABASE) { $env:CRDB_DATABASE } else { "libroreclamaciones" }
$CRDB_SSLMODE = if ($env:CRDB_SSLMODE) { $env:CRDB_SSLMODE } else { "disable" }

if (-not (Test-Path $SqlFile)) {
    Write-Error "No se encontro el archivo: $SqlFile"
    exit 1
}

$DSN = "postgresql://${CRDB_USER}@${CRDB_HOST}:${CRDB_PORT}/${CRDB_DATABASE}?sslmode=${CRDB_SSLMODE}"

Write-Host "========================================="
Write-Host " Ejecutando migracion"
Write-Host " Archivo: $SqlFile"
Write-Host " Host:    ${CRDB_HOST}:${CRDB_PORT}"
Write-Host " DB:      $CRDB_DATABASE"
Write-Host "========================================="

Get-Content $SqlFile | cockroach sql --url="$DSN"

Write-Host "========================================="
Write-Host " Migracion ejecutada correctamente"
Write-Host "========================================="