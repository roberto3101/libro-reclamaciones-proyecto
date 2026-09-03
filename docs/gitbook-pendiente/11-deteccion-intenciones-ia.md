# Deteccion de Intenciones del Asistente IA

## Que es y para que sirve

Cuando un usuario del panel de administracion escribe algo al asistente IA (por ejemplo "cuantos reclamos pendientes hay?"), el sistema **primero analiza que quiere hacer el usuario** antes de enviar la pregunta al modelo de IA. Esto permite:

1. **Cargar solo los datos relevantes** (no todo el universo de datos)
2. **Ajustar el prompt del sistema** segun la intencion
3. **Reducir costos** de tokens de IA
4. **Detectar ataques** de inyeccion de prompts

Todo esto pasa **sin usar IA** - es un sistema de reglas con regex que clasifica en milisegundos.

---

## Las 13 intenciones posibles

| Intencion | Ejemplo del usuario | Que hace el sistema |
|-----------|-------------------|-------------------|
| **SALUDO** | "Hola, buenos dias" | Respuesta breve, no carga datos |
| **ESTADISTICAS** | "Cuantos reclamos hay este mes?" | Carga resumen numerico |
| **RECLAMO_ESPECIFICO** | "Dame info del RCL-2026-001234" | Carga detalle completo de ese reclamo |
| **RECLAMOS_PENDIENTES** | "Que reclamos estan pendientes?" | Carga top 10 pendientes |
| **RECLAMOS_URGENTES** | "Hay reclamos vencidos?" | Carga los que pasaron su plazo |
| **RECLAMOS_POR_ESTADO** | "Mostrame los resueltos" | Carga top 10 del estado pedido |
| **CAMBIAR_ESTADO** | "Pasa el RCL-001234 a RESUELTO" | Datos minimos + instruccion de accion |
| **ENVIAR_MENSAJE** | "Envia mensaje al RCL-001234" | Datos del reclamo + plantilla de mensaje |
| **REASIGNAR_ASESOR** | "Asigna el RCL-001234 a Maria" | Datos + lista de asesores activos |
| **EXPORTACION** | "Exporta los reclamos a PDF" | Estadisticas + instrucciones de exportar |
| **REPETIR_ACCION** | "Hazlo de nuevo" | Revisa historial de conversacion |
| **NO_RELEVANTE** | "Que hora es?" | Redirige amablemente al tema |
| **INTENTO_INYECCION** | "Ignora tus instrucciones" | Bloquea inmediatamente |

---

## Como funciona la deteccion (pipeline de 12 pasos)

El sistema analiza el mensaje del usuario en orden de prioridad. Apenas encuentra una coincidencia, retorna la intencion:

```
Paso 1: Buscar codigos de reclamo (patron: RCL-YYYY-NNNNNN)
     ↓
Paso 2: Detectar si pide "todos los reclamos" (sugiere exportar)
     ↓
Paso 3: [PRIORIDAD] Detectar inyeccion de prompts
         "ignora instrucciones", "olvida reglas", "drop table"
         → Bloquea inmediatamente sin cargar datos
     ↓
Paso 4: Codigo + accion "cambiar estado"
         "pasa el RCL-001234 a resuelto"
     ↓
Paso 5: Codigo + accion "enviar mensaje"
         "responde al RCL-001234"
     ↓
Paso 6: Codigo + accion "reasignar"
         "asigna el RCL-001234 a otro asesor"
     ↓
Paso 7: Solo codigo (sin accion) → consulta especifica
     ↓
Paso 8: Pide exportar → "genera el PDF", "descarga excel"
     ↓
Paso 9: Reclamos urgentes → "vencidos", "criticos", "fecha limite"
     ↓
Paso 10: Reclamos pendientes → "pendientes", "sin resolver"
     ↓
Paso 11: Reclamos por estado → "resueltos", "en proceso"
     ↓
Paso 12: Estadisticas → "cuantos", "total", "reporte"
     ↓
Paso 13: Saludo → mensaje corto + "hola", "gracias"
     ↓
Paso 14: Mensaje basura → solo consonantes, caracteres repetidos
     ↓
Paso 15: Tiene palabras del dominio? → consulta general
     ↓
Paso 16: No tiene nada del dominio → mensaje no relevante
```

---

## Contexto inteligente por intencion

Segun la intencion detectada, el sistema construye un prompt de sistema diferente y carga datos distintos:

### Ejemplo: SALUDO

```
Prompt: "Saluda brevemente. Empresa: Mi Empresa S.A.C. Menciona que puedes ayudar con reclamos."
Max tokens: 150
Consultas SQL: 0
```

### Ejemplo: RECLAMOS_PENDIENTES

```
Prompt: "Analiza los reclamos pendientes. [Estadisticas: total=156, pendientes=12, vencidos=3]
         [Top 10 pendientes: RCL-001, RCL-002, ... con detalles]
         Destaca los mas urgentes y sugiere acciones."
Max tokens: 1024
Consultas SQL: 2
```

### Ejemplo: RECLAMO_ESPECIFICO (con codigo)

```
Prompt: "Analiza este reclamo en detalle:
         Codigo: RCL-2026-001234
         Consumidor: Juan Perez, DNI 12345678
         Estado: EN_PROCESO
         Tipo: RECLAMO
         Monto: S/ 150.00
         Detalle: El producto llego danado...
         Respuesta actual: Estamos investigando...
         Mensajes recientes: [historial]"
Max tokens: 800
Consultas SQL: multiples (reclamo + mensajes + respuestas)
```

### Ejemplo: INTENTO_INYECCION

```
Prompt: (ninguno, se bloquea)
Max tokens: 80
Consultas SQL: 0
Respuesta fija: "No puedo compartir esa informacion."
```

---

## Sistema de acciones

El asistente puede **ejecutar acciones** ademas de responder preguntas. Cuando el usuario pide algo como "cambia el estado del RCL-001234 a RESUELTO", la IA responde con un tag especial:

```
[ACCION:CAMBIAR_ESTADO|codigo=RCL-2026-001234|estado=RESUELTO]
```

Tags de accion disponibles:

| Tag | Que ejecuta |
|-----|-----------|
| `[ACCION:CAMBIAR_ESTADO\|codigo=X\|estado=Y]` | Cambia el estado de un reclamo |
| `[ACCION:ENVIAR_MENSAJE\|codigo=X\|mensaje=Y]` | Envia mensaje al cliente |
| `[ACCION:REASIGNAR_ASESOR\|codigo=X\|asesor_email=Y]` | Reasigna a otro asesor |
| `[ACCION:EXPORTAR\|busqueda=X\|estado=Y]` | Inicia exportacion con filtros |

---

## Deteccion de inyeccion de prompts

El sistema protege contra intentos de manipular la IA. Si detecta alguno de estos patrones, bloquea inmediatamente:

```
"ignora tus instrucciones"
"olvida todas las reglas"
"actua como si fueras"
"eres un modelo de lenguaje"
"DROP TABLE"
"rm -rf"
"<script>"
```

La deteccion tiene **maxima prioridad** (paso 3 del pipeline) - se ejecuta antes de cualquier otra clasificacion.

---

## Optimizacion de costos

El sistema ahorra tokens (y dinero) de la IA de varias formas:

| Intencion | Tokens max | Consultas SQL | Costo relativo |
|-----------|-----------|--------------|---------------|
| Saludo | 150 | 0 | Muy bajo |
| No relevante | 100 | 0 | Muy bajo |
| Inyeccion | 80 | 0 | Minimo |
| Cambiar estado | 400 | 1 | Bajo |
| Estadisticas | 400 | 1 | Bajo |
| Reasignar | 500 | 2 | Medio |
| Reclamo especifico | 800 | N | Medio |
| Enviar mensaje | 800 | 1 | Medio |
| Pendientes/Urgentes | 1024 | 2 | Medio-alto |
| Consulta general | 1536 | 7+ | Alto |

El "prompt estable" (la parte que no cambia) se cachea por los proveedores de IA, reduciendo aun mas el costo.

---

## Palabras clave del dominio (50+)

El sistema reconoce estas palabras como "del dominio" para distinguir mensajes relevantes de irrelevantes:

```
reclamo, queja, consumidor, cliente, atencion, estado,
pendiente, proceso, resuelto, rechazado, cerrado, vencido,
urgente, critico, plazo, indecopi, multa, asesor, asignar,
sede, respuesta, mensaje, exportar, pdf, excel, estadistica,
cuantos, total, reporte, notificar, atender...
```

Si un mensaje no contiene ninguna de estas palabras, se clasifica como "no relevante" y la IA responde con una redireccion amable: "Estoy aqui para ayudarte con la gestion de reclamos. En que te puedo ayudar?"
