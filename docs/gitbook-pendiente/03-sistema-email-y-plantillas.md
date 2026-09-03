# Sistema de Email y Plantillas

## Que es y para que sirve

El sistema envia emails automaticos en momentos clave del ciclo de vida de un reclamo. Cada empresa puede **personalizar** el texto, el asunto y los colores de estos emails para que reflejen su marca.

Los emails se envian via SMTP (compatible con Gmail, Outlook, etc.) y soportan:
- HTML con diseno profesional y responsivo
- Logo de la empresa
- Color primario personalizado
- Variables dinamicas (nombre del cliente, codigo, etc.)
- Adjuntos PDF (en el caso de resoluciones)

---

## Los 5 tipos de email

| Tipo | Cuando se envia | A quien | Variables disponibles |
|------|----------------|---------|----------------------|
| **Confirmacion** | Cliente registra un reclamo | Cliente | nombre_cliente, codigo_reclamo, fecha, razon_social |
| **Alerta empresa** | Nuevo reclamo recibido | Email de contacto empresa | codigo_reclamo, nombre_cliente, tipo_solicitud, fecha, razon_social |
| **Cambio de estado** | Admin cambia el estado | Cliente | nombre_cliente, codigo_reclamo, nuevo_estado, razon_social |
| **Resolucion** | Se emite la respuesta final | Cliente (+ PDF adjunto) | nombre_cliente, codigo_reclamo, respuesta_preview, razon_social |
| **Nuevo mensaje** | Empresa envia mensaje | Cliente | nombre_cliente, codigo_reclamo, mensaje_preview, razon_social, slug_tenant |

---

## Como funciona el envio

### Flujo cuando un cliente registra un reclamo

```
1. Cliente llena el formulario publico y envia
     ↓
2. Backend crea el reclamo en la base de datos
     ↓
3. Verifica si la empresa tiene activada la notificacion por email
     ↓
4. Si esta activa, en segundo plano (no bloquea la respuesta):
     a. Busca la plantilla "confirmacion_reclamo" de la empresa
     b. Si no existe o esta desactivada → usa la plantilla por defecto
     c. Reemplaza las variables: {{nombre_cliente}} → "Juan Perez"
     d. Construye el HTML con el branding de la empresa
     e. Envia via SMTP con TLS
     ↓
5. Al mismo tiempo, envia otro email a la empresa:
     - "Nuevo reclamo registrado: RCL-2026-001234"
```

### Configuracion SMTP

Se configura con variables de entorno:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-password-de-app
SMTP_FROM=no-reply@tudominio.com
```

> Si `SMTP_USER` y `SMTP_PASS` estan vacios, el sistema simplemente no envia emails (no da error).

---

## Plantillas personalizables

### Estructura de una plantilla

Cada plantilla tiene estos campos editables:

| Campo | Que es | Ejemplo |
|-------|--------|---------|
| **Asunto** | El subject del email | "Tu reclamo {{codigo_reclamo}} fue recibido" |
| **Saludo** | La primera linea del email | "Hola {{nombre_cliente}}," |
| **Cuerpo principal** | El texto central (5-2000 chars) | "Hemos recibido tu reclamo con codigo..." |
| **Texto de pie** | El texto al final | "Si tienes dudas, contactanos..." |
| **Texto del boton** | Solo para "nuevo_mensaje" | "Ver mi reclamo" |
| **Activa** | Si esta desactivada, usa la por defecto | true/false |

### Sistema de variables

Las variables se escriben con doble llave: `{{nombre_variable}}`

Ejemplo de como se ve en el editor vs el email final:

```
Editor:  "Hola {{nombre_cliente}}, tu reclamo {{codigo_reclamo}} fue registrado"
Email:   "Hola Juan Perez, tu reclamo RCL-2026-001234 fue registrado"
```

Cada tipo de plantilla solo permite ciertas variables. Si intentas usar una variable que no esta permitida, el sistema la rechaza.

### Proteccion de variables en el editor

El frontend protege las variables para que no las rompas accidentalmente:

```typescript
// Si el cursor esta dentro de {{...}} y presionas una tecla:
// → La tecla se ignora
// → La variable queda intacta

// Si intentas borrar parte de una variable:
// → Se borra la variable completa
// → No quedan restos como "{{nombre_" que romperian el email
```

---

## Estructura HTML del email

```
┌────────────────────────────────────┐
│  [Logo]  Nombre Empresa            │  ← Encabezado con borde del color primario
│────────────────────────────────────│
│                                    │
│  Hola Juan Perez,                  │  ← Saludo
│                                    │
│  Hemos recibido tu reclamo...      │  ← Cuerpo principal
│                                    │
│  ┌──────────────────────────┐      │
│  │ Codigo: RCL-2026-001234  │      │  ← Bloque especifico por tipo
│  │ Fecha: 28/03/2026        │      │     (confirmacion muestra codigo,
│  └──────────────────────────┘      │      estado muestra badge de color,
│                                    │      mensaje muestra preview + boton)
│  Si tienes dudas, contactanos...   │  ← Pie
│                                    │
│────────────────────────────────────│
│  Disclaimer legal                  │  ← Footer gris
└────────────────────────────────────┘
```

### Diseno responsivo

- Ancho maximo: 600px (estandar para emails)
- Se adapta a moviles
- Fuentes del sistema (no requiere cargar fuentes externas)
- Compatible con Gmail, Outlook, Apple Mail

---

## Toggles de notificacion

Cada empresa puede activar o desactivar emails individualmente:

| Toggle | Que controla | Default |
|--------|-------------|---------|
| `notificar_email` | Nuevo reclamo registrado | Activado |
| `notificar_email_estado` | Cambio de estado | Activado |
| `notificar_email_mensaje` | Nuevo mensaje | Activado |
| `notificar_email_resolucion` | Resolucion emitida | Activado |

Estos se configuran en la pagina de configuracion del tenant.

---

## Endpoints de la API

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/plantillas-email` | Listar las 5 plantillas |
| GET | `/api/v1/plantillas-email/:id` | Ver una plantilla |
| GET | `/api/v1/plantillas-email/definicion` | Ver tipos de eventos y defaults |
| PUT | `/api/v1/plantillas-email/:id` | Editar una plantilla |
| POST | `/api/v1/plantillas-email/:id/restaurar` | Restaurar a valores por defecto |

---

## Editor de plantillas en el frontend

El editor tiene dos columnas:

**Columna izquierda (formulario)**:
- Campos editables: asunto, saludo, cuerpo, pie, boton
- Chips de variables: haces clic en un campo y luego clic en el chip para insertar la variable
- Contador de caracteres
- Toggle activa/desactivada
- Boton "Restaurar valores por defecto"

**Columna derecha (vista previa en tiempo real)**:
- Muestra como se vera el email final
- Se actualiza al instante mientras escribes
- Usa datos de ejemplo: "Juan Perez", "RCL-2026-00042", etc.
- Aplica el logo y color de la empresa

---

## Archivos involucrados

| Capa | Archivo | Funcion |
|------|---------|---------|
| Servicio | `notificacion_service.go` | Envio SMTP + construccion HTML (810 lineas) |
| Servicio | `plantilla_email_service.go` | CRUD de plantillas + reemplazo de variables |
| Modelo | `plantilla_email.go` | Estructura + constantes de tipos |
| Repositorio | `plantilla_email_repo.go` | Acceso a base de datos |
| Controlador | `plantilla_email_controller.go` | Endpoints API |
| Migracion | `005_plantillas_email.sql` | Esquema de la tabla |
| Frontend | `modulos/plantillas-email/` | Modulo completo del editor |
