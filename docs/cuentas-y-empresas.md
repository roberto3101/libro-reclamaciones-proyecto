# Cuentas y Empresas — cómo funciona, en simple

Este documento explica en palabras humanas cómo se organizan los clientes, sus empresas y sus usuarios en el sistema. Sin tecnicismos.

---

## La idea en una frase

Un **cliente** (Cuenta) puede tener **varias empresas**, y los usuarios de ese cliente pueden trabajar en una o en varias de esas empresas usando la misma contraseña.

---

## Los 3 niveles

Pensalo como una caja dentro de otra:

1. **Cuenta** → el cliente real de la plataforma. Ej: "Grupo Quma SAC".
2. **Empresa** → cada negocio del cliente. Ej: "Restaurante Quma", "Hotel Quma", "Delivery Quma".
3. **Usuarios** → las personas que trabajan en una o varias empresas de ese cliente.

```
Cuenta: Grupo Quma SAC
 ├── Empresa 1: Restaurante Quma
 │    ├── Juan (admin)
 │    └── María (soporte)
 ├── Empresa 2: Hotel Quma
 │    ├── Juan (admin)       ← mismo Juan, misma contraseña
 │    └── Pedro (soporte)
 └── Empresa 3: Delivery Quma
      └── Juan (admin)       ← sigue siendo el mismo
```

Cada **empresa** es lo que en tu día a día llamas "tenant": tiene su propio libro de reclamaciones, sus sedes, sus reclamos, su plan.

---

## ¿Quién crea cuentas?

**Solo tú**, como SuperAdmin. No existe un "registro público" donde alguien llega solo y crea su cuenta. Siempre pasa por vos.

### Cómo crear una cuenta

Desde el panel SuperAdmin → **Cuentas** → **Nueva cuenta**. Completás:

- Nombre del cliente (ej: "Grupo Quma SAC")
- Email de contacto
- Teléfono, RUC, dirección, notas (opcionales)

**Importante:** al crear una cuenta **no se crea ninguna empresa todavía**. La cuenta queda como una carpeta vacía esperando que le metas empresas adentro.

---

## ¿Quién crea empresas?

**Solo tú**, también desde el panel SuperAdmin. Un admin de una empresa **no puede** crear empresas hermanas por su cuenta — siempre pasa por vos.

### Cómo crear una empresa

Desde el panel SuperAdmin → entrás al detalle de una cuenta → **Crear empresa**. Completás:

- Razón social, RUC (11 dígitos)
- Email, contraseña y nombre del primer usuario admin
- Plan (o DEMO por defecto)
- Si querés darle trial, cuántos días

### Lo que pasa por debajo cuando creás una empresa

El sistema hace todo esto de un solo golpe, en una sola operación (si algo falla, no queda nada a medias):

1. **Crea la empresa** con su RUC, razón social y un `slug` único (la URL pública del libro, ej: `/libro/restaurante-quma`). Si el slug choca con otro, el sistema le pega un sufijo del RUC para hacerlo único.
2. **Crea una "Sede Principal"** por defecto (después podés agregar más).
3. **Crea el primer usuario admin** con el email y contraseña que le diste.
4. **Crea los roles base** (ADMIN y SOPORTE) con sus permisos predefinidos.
5. **Crea la suscripción** al plan elegido (activa o en trial).

Todo queda ligado a la cuenta padre automáticamente.

---

## La parte interesante: un mismo usuario en varias empresas

Esto es lo que hace al sistema multi-empresa.

### El escenario

Juan es el admin financiero del "Grupo Quma SAC". Tiene que entrar a tres empresas del cliente: Restaurante, Hotel y Delivery. **No queremos que Juan tenga tres contraseñas distintas.**

### Lo que hace el sistema

Cuando agregás a Juan a una segunda empresa de la misma cuenta (desde el botón **"Agregar usuario existente"** en el panel SA), el sistema:

1. Busca si el email de Juan ya existe en otra empresa de la **misma cuenta**.
2. Si existe, **reutiliza exactamente la misma contraseña** (sin pedírsela de nuevo y sin enviar correos).
3. Lo agrega a la nueva empresa con el rol y sedes que elijas.

**Resultado:** Juan entra con el mismo email + la misma contraseña, y el sistema lo reconoce en todas las empresas donde lo agregaste.

### Qué pasa cuando Juan inicia sesión

- **Si Juan está en una sola empresa:** entra directo a esa empresa.
- **Si Juan está en varias empresas:** después de poner email + contraseña, le sale una pantalla de **"elegir empresa"** con la lista de las empresas a las que tiene acceso. Clickea una y entra a esa. Dentro del sistema también tiene un botón para **cambiar de empresa** sin volver a poner la contraseña.

### Reglas importantes

- Un email puede estar en muchas empresas **siempre y cuando sean de la misma cuenta**. No se cruzan emails entre clientes distintos.
- Si cambiás la contraseña de Juan en una empresa, se cambia en **todas** las empresas de esa cuenta automáticamente (porque el sistema comparte el hash). No hay versiones desfasadas de la contraseña.
- Podés darle a Juan roles distintos en cada empresa: admin en Restaurante, soporte en Hotel, etc.

---

## Lo que NO se puede hacer (por ahora)

Estas cosas están cerradas por diseño, para que no hagas un lío sin darte cuenta:

- **Mover una empresa de una cuenta a otra.** Una empresa nace ligada a su cuenta y se queda ahí. Si te equivocaste al crearla, lo más limpio es crearla de nuevo en la cuenta correcta.
- **Crear una empresa "suelta" sin cuenta.** Toda empresa tiene que tener un cliente arriba. No hay empresas huérfanas.
- **Que un admin de tenant cree empresas hermanas por su cuenta.** Solo el SuperAdmin puede hacerlo.
- **Registro público de cuentas.** Nadie llega desde la calle y crea su cuenta solo. Siempre pasás tú primero.

---

## Qué podés hacer con una cuenta desde el panel SA

Cuando entrás al detalle de una cuenta en el panel SuperAdmin tenés:

- **Ver y editar** los datos (nombre, email, RUC, dirección, notas).
- **Activar / desactivar la cuenta entera.** Ojo: si desactivás la cuenta, **todas sus empresas se desactivan también**. No se borran, solo quedan apagadas hasta que las vuelvas a activar.
- **Notas.** Tenés un mini CRM: podés ir dejando notas sobre el cliente (llamadas, acuerdos, observaciones). Cada nota guarda quién la escribió y cuándo.
- **Facturación y health-score** (pantallas ya conectadas al detalle).
- **Lista de empresas** de esa cuenta con acceso rápido al detalle de cada una.

---

## Qué podés hacer con una empresa desde el panel SA

En el detalle de cada empresa tenés varias pestañas:

- **Información:** razón social, RUC, slug, estado. Podés activar/desactivar la empresa sola (sin tocar la cuenta).
- **Sedes:** ver y activar/desactivar sedes.
- **Usuarios:** crear, editar, cambiar rol, resetear contraseña, desactivar, y el famoso **"Agregar usuario existente"** para jalar gente de otras empresas de la misma cuenta.
- **Reclamos:** ver los reclamos de esa empresa con búsqueda y detalle completo.
- **Facturación:** ver su suscripción actual, cambiar plan, ajustar ciclo, días de trial.

Además, podés **"Ingresar como empresa"** (impersonar) para ver el sistema como si fueras un admin de ese tenant, sin cambiar su contraseña.

---

## Auditoría: todo queda grabado

Cada vez que hacés algo importante desde el panel SuperAdmin — crear cuenta, crear empresa, desactivar, cambiar plan, resetear contraseña, impersonar a alguien — queda registrado en la auditoría global con:

- **Quién** lo hizo (qué SuperAdmin)
- **Qué acción** (ej. "CREAR_CUENTA")
- **Sobre qué** (cuál cuenta o empresa)
- **Detalles** específicos (datos antes/después)
- **Desde qué IP**
- **Cuándo**

Podés consultarlo en la pestaña **Actividad** del panel SA.

---

## Un ejemplo completo de principio a fin

Entra un cliente nuevo: "Grupo Quma SAC" con tres marcas. Paso a paso:

1. Creás la **cuenta** "Grupo Quma SAC" con el email del contacto principal. (Carpeta vacía.)
2. Entrás al detalle de la cuenta y creás la **empresa 1**: "Restaurante Quma" con RUC, un plan PYME, email de Juan (admin) y contraseña.
   - El sistema crea tenant + sede principal + usuario Juan + roles + suscripción.
3. Creás la **empresa 2**: "Hotel Quma" con otro RUC, plan PRO, email de **Pedro**.
4. Querés que **Juan también tenga acceso al Hotel**. Entrás al detalle del Hotel → pestaña Usuarios → **Agregar usuario existente** → elegís a Juan del selector.
   - El sistema reconoce que Juan ya existe en Restaurante (misma cuenta), reutiliza su contraseña, lo agrega al Hotel con el rol que elijas.
5. Creás la **empresa 3**: "Delivery Quma".
6. Agregás a Juan también al Delivery por el mismo flujo.
7. Juan inicia sesión con su email y contraseña (la única que tiene). El sistema le muestra el selector **"¿A qué empresa querés entrar?"** con las tres opciones.
8. Juan elige Hotel, entra al panel del Hotel, atiende sus reclamos. Después clickea "Cambiar empresa" y salta al Delivery sin volver a loguearse.

Ese es el flujo completo, puerta a puerta.

---

## Resumen en 10 segundos

- **Cuenta** = cliente (vos lo creás).
- **Empresa** = un negocio del cliente (vos lo creás dentro de la cuenta).
- **Usuarios** = personas de ese cliente, pueden estar en varias empresas de la misma cuenta con la misma contraseña.
- **Login multi-empresa** = si el usuario está en varias, elige cuál al entrar.
- **Todo pasa por vos** como SuperAdmin. No hay registro público ni creación automática.
- **Todo queda auditado.**
