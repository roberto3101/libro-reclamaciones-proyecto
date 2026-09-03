# Dashboard y Metricas

## Que es y para que sirve

El dashboard es la pagina principal del panel de administracion. Muestra un resumen visual de como esta la empresa en cuanto a reclamos, uso de recursos y funcionalidades del plan. Es la primera pantalla que ve el usuario al iniciar sesion.

---

## Que metricas se muestran

### Tarjetas principales (KPIs)

4 tarjetas grandes en la parte superior:

| Tarjeta | Que muestra | Dato |
|---------|------------|------|
| **Este Mes** | Reclamos registrados en el mes actual | Numero |
| **Pendientes** | Reclamos en estado PENDIENTE + EN_PROCESO | Numero |
| **Vencidos** | Reclamos cuyo plazo ya paso sin resolver | Numero (alerta roja) |
| **Resolucion** | Promedio de dias que toma resolver un reclamo | Dias promedio |

### Graficos

- **Distribucion por Estado**: Barra horizontal segmentada que muestra que porcentaje esta en cada estado (PENDIENTE, EN_PROCESO, RESUELTO, CERRADO)
- **Tipo de Solicitud**: Grafico donut que muestra la proporcion de Reclamos vs Quejas
- **Actividad Reciente**: Ultimos 7 dias, total y resueltos

### Recursos del Plan

Barras de progreso que muestran cuanto estas usando vs tu limite:

```
Sedes:       ████████░░  3/15 (20%)     ← Azul (bien)
Usuarios:    ██████████  5/5  (100%)    ← Rojo (lleno!)
Chatbots:    ████░░░░░░  1/2  (50%)     ← Azul (bien)
WhatsApp:    ██████████  1/1  (100%)    ← Rojo (lleno!)
Reclamos/mes: Ilimitado                  ← Sin barra
```

Colores de las barras:
- **Azul**: Menos del 70% usado
- **Amarillo**: Entre 70% y 90%
- **Rojo**: Mas del 90%
- **Sin barra**: Ilimitado (-1)

### Funcionalidades del Plan

Lista de features con badges activado/desactivado:

```
[✓] Email          [✓] PDF         [✓] Excel
[✓] Chatbot IA     [✓] WhatsApp    [✓] Asistente IA
[✗] Marca Blanca   [✗] Multi-idioma [✗] API
```

---

## Filtro por sede

Si la empresa tiene varias sedes, el dashboard muestra un dropdown para filtrar las metricas por sede especifica o ver "Todas las sedes".

> **Nota**: Si el usuario tiene rol SOPORTE y esta asignado a una sede, automaticamente solo ve las metricas de su sede (no puede ver las demas).

---

## Como se calculan las metricas

### Endpoint de metricas

```
GET /api/v1/dashboard/metricas?sede_id=xxx
```

El backend ejecuta una consulta SQL con agregaciones:

```sql
SELECT
    COUNT(*)                                                    AS total,
    COUNT(*) FILTER (WHERE estado = 'PENDIENTE')                AS pendientes,
    COUNT(*) FILTER (WHERE estado = 'EN_PROCESO')               AS en_proceso,
    COUNT(*) FILTER (WHERE estado = 'RESUELTO')                 AS resueltos,
    COUNT(*) FILTER (WHERE estado = 'CERRADO')                  AS cerrados,
    COUNT(*) FILTER (WHERE tipo_solicitud = 'RECLAMO')          AS total_reclamos,
    COUNT(*) FILTER (WHERE tipo_solicitud = 'QUEJA')            AS total_quejas,
    COUNT(*) FILTER (WHERE fecha_limite < NOW()
                     AND estado IN ('PENDIENTE','EN_PROCESO'))   AS vencidos,
    COUNT(*) FILTER (WHERE fecha_registro >= NOW() - '7 days')  AS ultimos_7_dias,
    COUNT(*) FILTER (WHERE fecha_registro >= DATE_TRUNC('month', NOW())) AS este_mes,
    AVG(dias_resolucion)                                        AS promedio_dias
FROM reclamos
WHERE tenant_id = :tenantID
```

### Endpoint de uso

```
GET /api/v1/dashboard/uso
```

Lee la vista `v_uso_tenant` que compara limites del plan vs uso actual (ver documentacion de Suscripciones y Planes).

---

## Endpoints de la API

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/dashboard/metricas` | Estadisticas de reclamos (con filtro sede opcional) |
| GET | `/api/v1/dashboard/uso` | Uso de recursos y funcionalidades del plan |

---

## En el frontend

### Componente `PaginaDashboard.tsx`

```
┌───────────────────────────────────────────────────────┐
│  Dashboard                        [Filtro: Sede ▼]    │
├───────┬───────┬───────┬───────────────────────────────┤
│ 45    │  12   │  3    │  4.2 dias                     │
│ Este  │Pendi- │Venci- │ Resolucion                    │
│ Mes   │entes  │ dos   │ promedio                      │
├───────┴───────┴───────┴───────────────────────────────┤
│                                                       │
│  Distribucion por Estado                              │
│  ██████████ ██████ ████████████████ ████              │
│  PEND(25%) PROC(15%)  RESUELTO(45%)  CERR(15%)       │
│                                                       │
├───────────────────────┬───────────────────────────────┤
│  Tipo de Solicitud    │  Actividad Reciente           │
│                       │                               │
│     ┌───────┐         │  Ultimos 7 dias: 18           │
│     │ 70%   │         │  Total: 156                   │
│     │Reclamo│         │  Resueltos: 89                │
│     │ 30%   │         │                               │
│     │ Queja │         │                               │
│     └───────┘         │                               │
├───────────────────────┴───────────────────────────────┤
│  Recursos del Plan (PYME)                             │
│  Sedes:     ████░░░░░░ 3/15                           │
│  Usuarios:  ██████████ 5/5  ← LLENO                  │
│  Chatbots:  ████░░░░░░ 1/2                            │
│                                                       │
│  Funcionalidades: [✓]Email [✓]PDF [✗]API ...          │
└───────────────────────────────────────────────────────┘
```
