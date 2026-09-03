$slug = "demo"
$base = "http://localhost:8080"

for ($i = 1; $i -le 25; $i++) {
    $body = @{
        tipo_solicitud    = "RECLAMO"
        nombre_completo   = "Test Usuario $i"
        tipo_documento    = "DNI"
        numero_documento  = "7000000$($i.ToString('D2'))"
        telefono          = "9000000$($i.ToString('D2'))"
        email             = "test$i@test.com"
        descripcion_bien  = "Producto de prueba $i"
        fecha_incidente   = "2026-02-23"
        detalle_reclamo   = "Reclamo de prueba numero $i para validar limite de plan"
        pedido_consumidor = "Solucion al problema $i"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$base/libro/$slug/reclamos" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        Write-Host "Reclamo $i - OK ($($response.StatusCode))" -ForegroundColor Green
    } catch {
        $status = $_.Exception.Response.StatusCode.Value__
        Write-Host "Reclamo $i - BLOQUEADO ($status)" -ForegroundColor Red
    }
}