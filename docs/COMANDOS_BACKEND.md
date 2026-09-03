# Backend — Comandos Rápidos

## Requisitos
- Go 1.21+
- CockroachDB corriendo en `localhost:26257`
- Archivo `.env` en `backend/`

## Iniciar backend

```powershell
cd C:\Users\user\Desktop\SaasLibroReclamaciones\backend
go run ./cmd/plataforma_api/
```


# 1. Iniciar ngrok (túnel HTTPS para WhatsApp webhook)
ngrok http 8080

# 2. Copiar la URL https://xxxx.ngrok-free.app y pegarla en:
# https://developers.facebook.com/apps/1816874562360908/use_cases/customize/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING
# → Webhook → Edit → Callback URL: https://xxxx.ngrok-free.app/webhook/whatsapp
# → Verify Token: libro_reclamos_2026

# 3. Iniciar backend
cd backend && go run ./cmd/plataforma_api/

# script para crear nuevos tenants (cambiar datos)
Invoke-WebRequest -Uri "http://localhost:8080/api/v1/onboarding" -Method POST -ContentType "application/json" -Body '{"razon_social":"Polleria El Rey SAC","ruc":"20512345678","email":"admin@polleria.com","password":"Admin1234","nombre_admin":"Juan Perez","telefono":"987654321"}'






Salida esperada:
```
✓ CockroachDB conectado: localhost:26257/libroreclamaciones
✓ Servidor iniciado en :8080 [development]
```

## Compilar (sin ejecutar)

```powershell
go build ./...
```

## Tests

```powershell
# Todos los tests
go test ./tests/... -v

# Solo E2E (sin DB)
go test ./tests/e2e/... -v

# Solo integración (requiere CockroachDB)
go test ./tests/integration/... -v
```

## Health check

```
GET http://localhost:8080/health
```
