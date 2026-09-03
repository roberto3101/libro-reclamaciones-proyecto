# Atencion en Vivo (Live Chat con Asesor)

## Que es y para que sirve

La atencion en vivo permite que un cliente que esta hablando con el chatbot de WhatsApp pueda pedir **hablar con un humano**. Cuando eso pasa, se crea una "solicitud de asesor" que aparece en el panel de administracion. Un asesor la toma y empieza un chat en tiempo real con el cliente.

Es como cuando llamas a una empresa y el bot te dice "presione 1 para hablar con un asesor" - pero en WhatsApp y en tiempo real.

---

## Flujo completo paso a paso

```
1. Cliente en WhatsApp escribe: "quiero hablar con un asesor"
     ↓
2. El chatbot detecta la intencion y crea una solicitud
   Estado: PENDIENTE | Prioridad: NORMAL
     ↓
3. El sistema envia notificacion WebSocket a todos los asesores
   "Nueva solicitud de atencion en vivo"
     ↓
4. Un asesor ve la solicitud en su panel y hace clic en "Tomar"
   Estado cambia a: EN_ATENCION
     ↓
5. El cliente recibe en WhatsApp:
   "A partir de ahora te atendera Maria Garcia..."
     ↓
6. Comienza el chat en tiempo real:
   - Cliente escribe en WhatsApp → mensaje llega al panel del asesor
   - Asesor escribe en el panel → mensaje llega al WhatsApp del cliente
     ↓
7. Cuando se resuelve, el asesor hace clic en "Resolver"
   Estado cambia a: RESUELTO
   Cliente recibe: "Tu consulta ha sido resuelta..."
```

---

## Estados de una solicitud

```
PENDIENTE ──────> EN_ATENCION ──────> RESUELTO
                      │
                      └──────> CANCELADO
```

| Estado | Significa | Quien lo cambia |
|--------|----------|----------------|
| **PENDIENTE** | Nadie lo ha tomado todavia | Se crea automaticamente |
| **EN_ATENCION** | Un asesor esta atendiendo | Asesor hace clic en "Tomar" |
| **RESUELTO** | Se resolvio el problema | Asesor hace clic en "Resolver" |
| **CANCELADO** | Se cancelo sin resolver | Cliente escribe "salir" o asesor cancela |

---

## Sistema de prioridades

Las solicitudes se ordenan por prioridad (las urgentes aparecen primero):

| Prioridad | Color | Cuando se usa |
|-----------|-------|-------------|
| **URGENTE** | Rojo | Cliente escribe "urgente" en WhatsApp |
| **ALTA** | Naranja | Asignada manualmente |
| **NORMAL** | Azul | Por defecto |
| **BAJA** | Gris | Consultas menores |

**Orden en la tabla**: URGENTE > ALTA > NORMAL > BAJA, y dentro de cada prioridad, las mas antiguas primero.

---

## Chat en tiempo real con WebSocket

### Como funciona la comunicacion

```
WhatsApp del cliente          Panel del asesor
      │                             │
      │  "Hola, tengo un problema"  │
      ├────────────────────────────>│  (via WhatsApp API → Backend → WebSocket)
      │                             │
      │  "Hola! En que puedo        │
      │   ayudarte?"                │
      │<────────────────────────────┤  (via Backend → WhatsApp API)
      │                             │
```

### Endpoint WebSocket

```
GET /ws/atencion-vivo/:solicitudId?token={jwt}
```

- Requiere autenticacion JWT (solo asesores)
- Crea una "sala" unica: `atencion-vivo:{tenantId}:{solicitudId}`
- Ping cada 27 segundos para mantener la conexion viva

### Eventos WebSocket

| Evento | Cuando se dispara | Datos |
|--------|------------------|-------|
| `SOLICITUD_ATENCION_NUEVA` | Se crea una solicitud | nombre, motivo, canal, prioridad |
| `MENSAJE_ATENCION_CLIENTE_RECIBIDO` | Cliente envia mensaje | contenido, fecha |
| `MENSAJE_ATENCION_ASESOR_ENVIADO` | Asesor envia mensaje | contenido, fecha, asesor_id |

---

## Integracion con WhatsApp

### Cuando el cliente tiene una solicitud abierta

El backend revisa cada mensaje de WhatsApp entrante:

```go
// Pseudocodigo simplificado
func ProcesarMensaje(telefono, textoUsuario) {
    // Busca si este telefono tiene solicitud EN_ATENCION
    solicitudActiva := BuscarActivaPorTelefono(telefono)

    if solicitudActiva != nil {
        // El cliente tiene chat activo con asesor

        if textoUsuario == "salir" || textoUsuario == "cancelar" {
            // Cierra la solicitud
            Cancelar(solicitudActiva.ID)
            return "Sesion finalizada"
        }

        if textoUsuario == "urgente" {
            // Sube la prioridad
            ActualizarPrioridad(solicitudActiva.ID, URGENTE)
        }

        // Guarda el mensaje y lo envia al asesor por WebSocket
        GuardarMensajeCliente(solicitudActiva.ID, textoUsuario)
        return "Mensaje recibido (leido por asesor)"

    } else {
        // No tiene solicitud → lo atiende el chatbot normal
        return RespuestaDelBot(textoUsuario)
    }
}
```

---

## Panel del asesor en el frontend

### Tabla de solicitudes (`PaginaSolicitudesAsesor.tsx`)

- Filtros: Abiertas, Resueltas, Canceladas, "Mis solicitudes"
- Columnas: Nombre/Telefono, Motivo, Canal (badge), Estado, Prioridad (barra de color), Asignado a, Tiempo
- Boton rapido "Tomar" para auto-asignarse
- Contador de pendientes en el sidebar (badge rojo)

### Detalle de solicitud (`DetalleSolicitud.tsx`)

Al hacer clic en una solicitud se abre un modal con:
- Informacion del cliente (nombre, telefono, motivo)
- Resumen de la conversacion con el bot (antes del handoff)
- **Chat en tiempo real** con el cliente
- Campo de notas internas (solo visible para asesores)
- Botones de accion: Tomar, Resolver, Cancelar, Cambiar prioridad

### Chat en tiempo real (`ChatAtencion.tsx`)

- Mensajes del cliente a la izquierda (azul)
- Mensajes del asesor a la derecha (azul oscuro)
- Mensajes del sistema al centro (amarillo) - "A partir de ahora te atendera..."
- Agrupados por fecha
- Input deshabilitado si la solicitud esta cerrada
- Enter para enviar, Shift+Enter para nueva linea
- Auto-scroll al ultimo mensaje

---

## Endpoints de la API

### Solicitudes

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/solicitudes-asesor` | Listar abiertas (PENDIENTE + EN_ATENCION) |
| GET | `/api/v1/solicitudes-asesor/pendientes/count` | Contar pendientes (para badge) |
| GET | `/api/v1/solicitudes-asesor/mis-solicitudes` | Mis solicitudes asignadas |
| GET | `/api/v1/solicitudes-asesor/estado/:estado` | Filtrar por estado |
| GET | `/api/v1/solicitudes-asesor/:id` | Ver detalle |
| POST | `/api/v1/solicitudes-asesor` | Crear solicitud |
| POST | `/api/v1/solicitudes-asesor/:id/tomar` | Auto-asignarme |
| POST | `/api/v1/solicitudes-asesor/:id/asignar` | Admin asigna a otro asesor |
| POST | `/api/v1/solicitudes-asesor/:id/resolver` | Cerrar como resuelto |
| POST | `/api/v1/solicitudes-asesor/:id/cancelar` | Cancelar |
| PATCH | `/api/v1/solicitudes-asesor/:id/prioridad` | Cambiar prioridad |
| PATCH | `/api/v1/solicitudes-asesor/:id/nota` | Editar nota interna |

### Mensajes

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/solicitudes-asesor/:id/mensajes` | Ver historial de chat |
| POST | `/api/v1/solicitudes-asesor/:id/mensajes` | Asesor envia mensaje |

---

## Seguridad y limites

- **Rate limit**: Maximo 5 solicitudes abiertas por telefono (evita spam)
- **Permisos**: Se requiere permiso `ModuloAtencionVivo` con acciones Ver, Asignar, CambiarEstado
- **Aislamiento**: Cada tenant solo ve sus propias solicitudes
- **Mensajes del sistema**: Se envian automaticamente en transiciones de estado (son mensajes tipo SISTEMA, no los escribe el asesor)
