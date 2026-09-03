# Roles y Permisos

## Que es y para que sirve

El sistema de roles controla **quien puede hacer que** dentro del panel de administracion. Cada usuario tiene un rol asignado, y ese rol determina a que modulos y acciones tiene acceso.

---

## Roles del sistema

| Rol | Que puede hacer | Restriccion |
|-----|----------------|-------------|
| **ADMIN** | Todo. Crear usuarios, gestionar sedes, chatbots, configuracion, planes. | Sin restricciones |
| **SOPORTE** | Ver reclamos, responder, enviar mensajes, atencion en vivo. | Solo ve su sede asignada |

### Diferencias clave

```
ADMIN puede:
  ✓ Crear y eliminar usuarios
  ✓ Ver TODAS las sedes
  ✓ Gestionar chatbots
  ✓ Cambiar configuracion de la empresa
  ✓ Cambiar plan/suscripcion
  ✓ Exportar reportes

SOPORTE puede:
  ✓ Ver reclamos (solo de su sede)
  ✓ Responder reclamos
  ✓ Enviar mensajes a clientes
  ✓ Atender solicitudes en vivo
  ✗ NO puede crear usuarios
  ✗ NO puede gestionar chatbots
  ✗ NO puede cambiar configuracion
```

---

## Como funciona la autorizacion

### En el JWT

Cuando un usuario inicia sesion, el JWT incluye:

```json
{
  "tenant_id": "uuid-de-la-empresa",
  "user_id": "uuid-del-usuario",
  "role": "ADMIN",
  "sede_id": "uuid-de-la-sede"  // solo si es SOPORTE con sede asignada
}
```

### En el backend

Los endpoints protegidos usan middlewares:

```go
// Solo ADMIN puede acceder
router.POST("/usuarios", RoleMiddleware("ADMIN"), controller.Crear)

// ADMIN y SOPORTE pueden acceder
router.GET("/reclamos", RoleMiddleware("ADMIN", "SOPORTE"), controller.Listar)
```

### Filtrado por sede

Si un usuario SOPORTE tiene `sede_id` asignado:
- Al consultar reclamos → solo ve los de su sede
- Al ver el dashboard → las metricas se filtran por su sede
- Al exportar → solo exporta datos de su sede

Esto se aplica automaticamente en el backend, no depende del frontend.

---

## Modelo de usuario

```go
type UsuarioAdmin struct {
    ID                  uuid.UUID  // Identificador unico
    TenantID            uuid.UUID  // A que empresa pertenece
    Email               string     // Email de login (unico por tenant)
    NombreCompleto      string     // Nombre para mostrar
    PasswordHash        string     // Contrasena hasheada (nunca en texto plano)
    Rol                 string     // "ADMIN" o "SOPORTE"
    Activo              bool       // Si esta desactivado, no puede entrar
    DebeCambiarPassword bool       // Fuerza cambio en el proximo login
    UltimoAcceso        time.Time  // Ultima vez que inicio sesion
    SedeID              *uuid.UUID // Sede asignada (NULL = todas)
    CreadoPor           *uuid.UUID // Quien lo creo (auditoria)
}
```

---

## Endpoints de la API

| Metodo | Endpoint | Quien puede | Que hace |
|--------|----------|------------|----------|
| GET | `/api/v1/usuarios` | Todos | Listar usuarios del tenant |
| GET | `/api/v1/usuarios/:id` | Todos | Ver detalle de un usuario |
| POST | `/api/v1/usuarios` | Solo ADMIN | Crear usuario |
| PUT | `/api/v1/usuarios/:id` | Solo ADMIN | Actualizar usuario |
| PUT | `/api/v1/usuarios/password` | Todos | Cambiar mi propia contrasena |
| PATCH | `/api/v1/usuarios/:id/password` | Solo ADMIN | Resetear contrasena de otro |
| DELETE | `/api/v1/usuarios/:id` | Solo ADMIN | Desactivar usuario |

---

## En el frontend

### Pagina de usuarios (`PaginaUsuarios.tsx`)

- Tabla con: Email, Nombre, Rol, Sede asignada, Estado (activo/inactivo), Ultimo acceso
- Boton "Nuevo Usuario" (solo visible para ADMIN)
- Formulario con campos: email, nombre, contrasena, rol (dropdown ADMIN/SOPORTE), sede (dropdown opcional)
- Al asignar rol SOPORTE, aparece el selector de sede
