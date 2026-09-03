# Onboarding (Registro de Empresa Nueva)

## Que es y para que sirve

El onboarding es el proceso de registro de una empresa nueva en la plataforma. En un solo paso, se crea todo lo necesario para que la empresa empiece a funcionar: la configuracion del tenant, la sede principal, el usuario administrador y la suscripcion de prueba.

Es un endpoint **publico** (no requiere autenticacion) porque la empresa aun no tiene cuenta.

---

## Que datos se piden

```json
// POST /api/v1/onboarding
{
  "razon_social": "Mi Empresa S.A.C.",     // Obligatorio
  "ruc": "20123456789",                     // Obligatorio (11 digitos)
  "email": "admin@miempresa.com",           // Obligatorio (sera el email de login)
  "password": "miPasswordSeguro123",        // Obligatorio (minimo 8 caracteres)
  "nombre_admin": "Juan Perez",             // Opcional (default: "Administrador")
  "telefono": "999888777",                  // Opcional
  "dias_trial": 30                          // Opcional (default: 30)
}
```

---

## Que pasa internamente (todo en una sola transaccion)

Si algo falla en cualquier paso, **todo se revierte** y no queda nada a medias.

```
1. Validar datos
   - RUC tiene 11 digitos?
   - RUC ya esta registrado en el sistema?
   - Password tiene minimo 8 caracteres?
     ↓
2. Crear configuracion del tenant
   - tenant_id: nuevo UUID
   - slug: generado del nombre ("Mi Empresa SAC" → "mi-empresa-sac")
   - color_primario: "#1a56db" (azul por defecto)
   - plazo_respuesta_dias: 15 (INDECOPI)
   - notificar_email: true (activado por defecto)
     ↓
3. Crear Sede Principal
   - nombre: "Sede Principal"
   - slug: "principal"
   - direccion: "Direccion por configurar"
   - es_principal: true
     ↓
4. Crear Usuario Administrador
   - email: el que puso en el formulario
   - rol: "ADMIN"
   - password: hasheada con bcrypt
   - activo: true
     ↓
5. Crear Suscripcion Trial
   - plan: DEMO
   - estado: "TRIAL"
   - dias_trial: 30
   - fecha_fin_trial: hoy + 30 dias
   - activado_por: "ONBOARDING"
```

---

## Generacion del slug

El slug es la URL amigable de la empresa. Se usa en las URLs publicas del libro de reclamaciones:

```
https://tudominio.com/libro/mi-empresa-sac
```

Proceso de generacion:
1. Toma la razon social: "Polleria El Rey S.A.C."
2. Quita acentos y caracteres especiales
3. Convierte a minusculas
4. Reemplaza espacios con guiones
5. Resultado: "polleria-el-rey-sac"

Si el slug ya existe (otra empresa tiene nombre parecido), le agrega los primeros 4 digitos del RUC:
```
"polleria-el-rey-sac" ya existe → "polleria-el-rey-sac-2012"
```

---

## Respuesta exitosa

```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "mi-empresa-sac",
    "usuario": {
      "id": "uuid-del-usuario",
      "email": "admin@miempresa.com",
      "rol": "ADMIN"
    },
    "suscripcion": {
      "plan_codigo": "DEMO",
      "estado": "TRIAL",
      "dias_trial": 30
    }
  },
  "message": "Empresa registrada exitosamente"
}
```

---

## Errores comunes

| Error | Causa | Solucion |
|-------|-------|----------|
| "Ya existe un tenant registrado con el RUC X" | Otra empresa ya uso ese RUC | Verificar que el RUC sea correcto |
| "Plan DEMO no encontrado" | No se ejecutaron las migraciones | Ejecutar las migraciones de BD |
| "Password debe tener minimo 8 caracteres" | Password muy corta | Usar una contrasena mas larga |
| "RUC debe tener 11 digitos" | RUC incorrecto | Verificar el numero de RUC |

---

## Despues del onboarding

Una vez registrada, la empresa puede:
1. Iniciar sesion con el email y password que registro
2. Completar su perfil (logo, color, datos de contacto)
3. Crear sedes adicionales
4. Crear usuarios de soporte
5. Empezar a recibir reclamos via su URL publica
6. Antes de que termine el trial (30 dias), elegir un plan de pago
