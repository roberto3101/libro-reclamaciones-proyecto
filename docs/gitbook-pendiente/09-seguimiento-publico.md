# Seguimiento Publico de Reclamos

## Que es y para que sirve

El seguimiento publico permite que cualquier persona que haya registrado un reclamo pueda **ver el estado de su caso** y **comunicarse con la empresa** sin necesidad de crear cuenta ni iniciar sesion.

El cliente solo necesita su **codigo de reclamo** (que recibio por email al registrar el reclamo) para acceder.

---

## Flujo del seguimiento

```
1. Cliente registra reclamo en /libro/mi-empresa/
   Recibe por email: "Tu codigo es RCL-2026-001234"
     ↓
2. Cliente visita /libro/mi-empresa/seguimiento/RCL-2026-001234
     ↓
3. Sistema muestra:
   - Estado actual (PENDIENTE, EN_PROCESO, RESUELTO, etc.)
   - Respuesta oficial de la empresa (si existe)
   - Historial de mensajes
     ↓
4. Cliente puede enviar mensajes a la empresa
     ↓
5. Opcionalmente, se conecta por WebSocket para
   recibir actualizaciones en tiempo real
```

---

## Registro de reclamo (formulario publico)

### El formulario multi-paso

El registro se hace en 3 pasos:

**Paso 1: Datos del consumidor** (`PasoConsumidor.tsx`)
- Tipo de documento (DNI, CE, Pasaporte, RUC)
- Numero de documento (se auto-consulta PSE Peru para obtener nombre)
- Nombre completo (se llena automaticamente si PSE responde)
- Domicilio
- Telefono
- Email
- Es menor de edad?

**Paso 2: Datos del bien/servicio** (`PasoBien.tsx`)
- Tipo: Producto o Servicio
- Descripcion del bien contratado
- Monto reclamado (en soles)
- Fecha del incidente

**Paso 3: Detalle del reclamo** (`PasoDetalle.tsx`)
- Tipo de solicitud: Reclamo o Queja
- Detalle del reclamo (texto libre)
- Pedido del consumidor (que solucion espera)
- Archivos adjuntos (opcional)

### Proteccion anti-bot

El formulario usa **Cloudflare Turnstile** para verificar que es una persona real (no un bot). El token se valida en el backend antes de aceptar el reclamo.

### Rate limiting

- **3 reclamos por minuto** por IP (evita spam masivo)
- **5 mensajes por minuto** por IP (evita flood de mensajes)

---

## Pagina de seguimiento

### URL

```
/libro/{slug-empresa}/seguimiento/{codigo-reclamo}
```

### Que muestra

```
┌─────────────────────────────────────────────────┐
│  Mi Empresa S.A.C.                    [Logo]     │
│  Libro de Reclamaciones                          │
├─────────────────────────────────────────────────┤
│                                                  │
│  Reclamo: RCL-2026-001234                        │
│  Estado: [EN_PROCESO]  ← badge de color          │
│  Fecha: 15/03/2026                               │
│  Plazo de respuesta: 30/03/2026                  │
│                                                  │
│  ── Respuesta de la empresa ──                   │
│  "Estimado cliente, hemos recibido su reclamo    │
│   y estamos trabajando en una solucion..."       │
│                                                  │
│  ── Mensajes ──                                  │
│  [15/03 14:30] Cliente: Hola, quiero saber...    │
│  [16/03 09:15] Empresa: Buenos dias, le...       │
│  [16/03 10:00] Cliente: Gracias, esperare        │
│                                                  │
│  ┌───────────────────────────────┐ [Enviar]      │
│  │ Escribir mensaje...           │               │
│  └───────────────────────────────┘               │
└─────────────────────────────────────────────────┘
```

---

## WebSocket para actualizaciones en tiempo real

Si el cliente mantiene la pagina de seguimiento abierta, se conecta automaticamente a un WebSocket para recibir actualizaciones sin recargar:

```
GET /ws/publico/seguimiento/:slug/:codigoReclamo
```

Caracteristicas:
- **No requiere autenticacion** (es un endpoint publico)
- **Rate limit**: Maximo 5 conexiones WebSocket por IP
- **Auto-desconexion**: Se desconecta automaticamente despues de 30 minutos (ahorra recursos del servidor)
- **Sala unica**: `seguimiento:{tenantId}:{codigoReclamo}`

Eventos que recibe:
- Cambio de estado del reclamo
- Nueva respuesta de la empresa
- Nuevo mensaje en el hilo

---

## Canal QR

Los reclamos pueden registrarse escaneando un codigo QR que la empresa coloca en su local. El QR lleva directamente a:

```
/libro/{slug-empresa}
```

El modelo de datos tiene un campo `canal_origen` que puede ser:
- **WEB**: Registro desde el navegador
- **WHATSAPP**: Registro desde WhatsApp
- **QR**: Registro escaneando un codigo QR

---

## Endpoints publicos

Todos estos endpoints son publicos (no requieren JWT):

| Metodo | Endpoint | Rate Limit | Que hace |
|--------|----------|-----------|----------|
| GET | `/libro/:slug/tenant` | 30/min | Info publica de la empresa |
| GET | `/libro/:slug/sedes` | 30/min | Lista de sedes |
| POST | `/libro/:slug/reclamos` | 3/min | Registrar reclamo |
| GET | `/libro/:slug/seguimiento/:codigo` | 30/min | Ver estado del reclamo |
| GET | `/libro/:slug/seguimiento/:codigo/mensajes` | 30/min | Ver mensajes |
| POST | `/libro/:slug/seguimiento/:codigo/mensajes` | 5/min | Enviar mensaje |
| GET | `/libro/:slug/consulta-documento/:numero` | 30/min | Consultar DNI/RUC en PSE Peru |
| GET | `/libro/:slug/validar-empresa/:ruc` | 30/min | Validar empresa por RUC |

---

## Consulta automatica de documento

Cuando el cliente escribe su numero de documento (DNI, RUC, etc.), el sistema consulta automaticamente el servicio **PSE Peru** para obtener:
- Nombre completo (para DNI)
- Razon social (para RUC)
- Direccion

Esto ahorra tiempo al cliente y reduce errores de tipeo.

```
Cliente escribe: 12345678
     ↓
Sistema consulta: pseperu.pe/api/dni/12345678
     ↓
Respuesta: { nombre: "Juan Perez Garcia", direccion: "..." }
     ↓
Se auto-llenan los campos del formulario
```

### Seguridad de la consulta
- Rate limit dedicado: 30 consultas/min por IP
- Timeout de 8 segundos
- Solo acepta documentos de 6-11 caracteres alfanumericos
- El slug del tenant se valida contra la base de datos
