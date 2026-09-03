# Sistema de Suscripciones y Planes

## Que es y para que sirve

El sistema de planes controla **que puede hacer cada empresa** dentro de la plataforma. Funciona como Netflix o Spotify: eliges un plan, pagas, y se te desbloquean funcionalidades segun el nivel que contrataste.

Cada empresa (tenant) tiene **una suscripcion activa** que apunta a un plan. El plan define dos cosas:
1. **Limites de recursos** - cuantas sedes, usuarios, chatbots, etc. puedes crear
2. **Funcionalidades habilitadas** - si puedes usar WhatsApp, exportar PDF, chatbot IA, etc.

---

## Los 4 planes disponibles

| Plan | Precio Mensual | Precio Anual | Sedes | Usuarios | Reclamos/mes | Chatbots | WhatsApp |
|------|---------------|-------------|-------|----------|-------------|----------|----------|
| **DEMO** | Gratis | - | 1 | 1 | 20 | 0 | 0 |
| **EMPRENDEDOR** | S/ 19.90 | S/ 179.90 | 3 | 1 | Ilimitado | 1 | 1 |
| **PYME** | S/ 44.90 | S/ 449.90 | 15 | 5 | Ilimitado | 2 | 1 |
| **PRO** | S/ 84.90 | S/ 899.90 | 50 | 10 | Ilimitado | 5 | 2 |

### Que incluye cada plan

- **DEMO**: Solo email. Ideal para probar.
- **EMPRENDEDOR**: Email + PDF + Excel + Asistente IA + Atencion en vivo.
- **PYME**: Todo lo del Emprendedor + ChatBot IA + WhatsApp. Es el plan **recomendado**.
- **PRO**: Todo habilitado, incluyendo marca blanca, multi-idioma y acceso API.

### Precio por recurso extra

Si necesitas mas sedes o usuarios sin cambiar de plan, puedes comprar extras:

| Plan | Sede extra | Usuario extra |
|------|-----------|--------------|
| EMPRENDEDOR | S/ 20 | S/ 15 |
| PYME | S/ 20 | S/ 10 |
| PRO | S/ 15 | S/ 8 |

---

## Como funciona la suscripcion

### Estados de la suscripcion

```
TRIAL ──────> ACTIVA (pago exitoso)
  │              │
  │              ├──> SUSPENDIDA (fallo de pago)
  │              │
  │              └──> CANCELADA (el usuario cancela)
  │
  └──────> VENCIDA (se acabaron los dias de prueba)
```

- **TRIAL**: Periodo de prueba gratuito (30 dias por defecto). Se crea automaticamente al registrar una empresa.
- **ACTIVA**: Suscripcion pagada y funcionando.
- **SUSPENDIDA**: Pago fallido, temporalmente pausada.
- **CANCELADA**: El usuario decidio cancelar.
- **VENCIDA**: El trial se acabo sin contratar un plan.

### Ciclos de facturacion

- **MENSUAL**: Se cobra cada mes.
- **ANUAL**: Se cobra una vez al anio (con descuento).

### Metodos de pago soportados

- Tarjeta
- Transferencia bancaria
- Yape
- Plin

---

## Validacion de limites (como se controla)

El sistema tiene **3 capas de validacion** para asegurarse de que nadie cree mas recursos de los que su plan permite:

### Capa 1: La vista de base de datos (`v_uso_tenant`)

Una vista SQL que calcula en tiempo real cuanto esta usando cada empresa vs cuanto le permite su plan:

```sql
-- Ejemplo simplificado de lo que calcula la vista
SELECT
    -- Limites efectivos (el override o el del plan)
    COALESCE(suscripcion.override_max_sedes, plan.max_sedes) AS limite_sedes,

    -- Uso actual (cuantas sedes activas tiene)
    (SELECT COUNT(*) FROM sedes WHERE tenant_id = X AND activo = true) AS uso_sedes

FROM configuracion_tenant
JOIN suscripciones ON ...
JOIN planes ON ...
WHERE suscripcion.estado IN ('ACTIVA', 'TRIAL');
```

### Capa 2: El modelo `UsoTenant`

Una estructura Go que recibe los datos de la vista y tiene metodos inteligentes:

```go
// Puede crear una sede mas?
func (u *UsoTenant) PuedeCrear(recurso) bool {
    uso, limite := u.LimiteDeRecurso(recurso)
    // -1 significa ilimitado
    return limite == -1 || uso < limite
}

// Que porcentaje lleva? (para las barras de progreso)
func (u *UsoTenant) PorcentajeUso(recurso) int {
    // Retorna 0-100, o -1 si es ilimitado
}
```

### Capa 3: El servicio `LimitesService`

El guardian que se ejecuta **antes** de cualquier operacion de creacion:

```go
// Antes de crear una sede, se valida asi:
err := limitesService.ValidarCreacion(ctx, tenantID, RecursoSede)
if err != nil {
    // "Has alcanzado el limite de sedes de tu Plan EMPRENDEDOR (3/3).
    //  Actualiza tu plan para continuar."
    return err
}

// Antes de usar una funcionalidad, se valida asi:
err := limitesService.ValidarFuncionalidad(ctx, tenantID, FuncWhatsApp)
if err != nil {
    // "La funcionalidad de WhatsApp no esta disponible en tu Plan DEMO.
    //  Actualiza tu plan para habilitarla."
    return err
}
```

> **Nota de desarrollo**: En entorno `development`, las validaciones se saltan automaticamente para no bloquear el trabajo de los desarrolladores.

---

## Sistema de overrides (limites personalizados)

A veces necesitas darle a un cliente especial un limite diferente sin cambiarle el plan. Para eso existen los **overrides**:

```
Plan EMPRENDEDOR dice: max_sedes = 3
Pero este cliente tiene: override_max_sedes = 10

Resultado: el cliente puede crear hasta 10 sedes
```

Esto se maneja en la tabla `suscripciones` con campos nullable:
- Si el override es `NULL` -> usa el limite del plan
- Si el override tiene un valor -> usa ese valor

---

## Endpoints de la API

### Para las empresas (requiere autenticacion)

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/planes` | Ver planes disponibles (para la pagina de precios) |
| GET | `/api/v1/suscripcion` | Ver mi suscripcion actual + plan |
| GET | `/api/v1/suscripcion/uso` | Ver cuanto estoy usando vs mis limites |
| GET | `/api/v1/suscripcion/historial` | Ver todas mis suscripciones pasadas |
| POST | `/api/v1/suscripcion/cambiar-plan` | Cambiar a otro plan |

### Cambiar de plan - ejemplo

```json
// POST /api/v1/suscripcion/cambiar-plan
{
  "plan_codigo": "PYME",
  "ciclo": "ANUAL",
  "metodo_pago": "YAPE",
  "referencia_pago": "OP-12345",
  "notas": "Upgrade desde EMPRENDEDOR"
}
```

Lo que pasa internamente:
1. Valida que el plan exista y este activo
2. Verifica que no sea el mismo plan que ya tienes
3. Cancela la suscripcion actual
4. Crea una nueva suscripcion con el nuevo plan
5. Calcula la proxima fecha de cobro (1 mes o 1 anio segun el ciclo)

---

## En el frontend

### Pagina de planes (`PaginaPlanes.tsx`)

Muestra los 4 planes en tarjetas con:
- Toggle mensual/anual (muestra el ahorro anual)
- Lista de funcionalidades con check/cruz
- Badge "Recomendado" en el plan PYME
- Badge "Tu plan actual" si ya lo tienes
- Precios por recurso extra

### Dashboard de suscripcion (`PaginaSuscripcion.tsx`)

Tiene 3 pestanias:

1. **Resumen**: Estado actual, barras de uso por recurso, funcionalidades
   - Barras de colores: verde (bien), amarillo (70%+), rojo (90%+), azul (ilimitado)
2. **Cambiar Plan**: Seleccion de nuevo plan con confirmacion
3. **Historial**: Tabla de todas las suscripciones con quien las activo

### Widget de uso (`UsoWidget.tsx`)

Un componente compacto para el dashboard principal que muestra:
- Nombre del plan + estado (ACTIVA/TRIAL)
- 5 barras de progreso (sedes, usuarios, reclamos, chatbots, whatsapp)
- Link a la pagina completa de suscripcion

---

## Flujo completo: registro de empresa nueva

```
1. Empresa se registra (onboarding)
     ↓
2. Se crea suscripcion TRIAL con plan DEMO (30 dias)
     ↓
3. La empresa usa la plataforma con limites DEMO
     ↓
4. Si quiere mas funcionalidades → cambia de plan
     ↓
5. Se cancela el TRIAL y se crea suscripcion ACTIVA
     ↓
6. Se desbloquean los nuevos limites y funcionalidades
```

## Auditoria

Cada cambio de suscripcion queda registrado con:
- **Quien lo hizo**: usuario_id del que realizo el cambio
- **Como se activo**: ONBOARDING, UPGRADE, ADMIN_MANUAL, RENOVACION
- **Referencia de pago**: numero de operacion
- **Notas**: observaciones adicionales
