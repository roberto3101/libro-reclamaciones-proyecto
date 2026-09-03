# Documentacion Pendiente para GitBook

## Que es esto?

Estos son los **11 documentos de funcionalidades** que faltan en el GitBook y que SI existen en el proyecto. Todo esta basado en el codigo fuente real, nada inventado.

Cada documento esta escrito en lenguaje simple para que cualquiera pueda entenderlo, con diagramas de flujo, fragmentos de codigo y tablas de referencia.

---

## Documentos generados

| # | Documento | Paginas aprox | Tema |
|---|-----------|-------------|------|
| 01 | [Sistema de Suscripciones y Planes](01-sistema-suscripciones-y-planes.md) | 5 | Planes, precios, limites, validaciones, overrides |
| 02 | [Exportacion PDF y Excel](02-exportacion-pdf-y-excel.md) | 4 | Reportes masivos + PDF de resolucion individual |
| 03 | [Sistema de Email y Plantillas](03-sistema-email-y-plantillas.md) | 4 | 5 tipos de email, plantillas editables, SMTP |
| 04 | [Atencion en Vivo](04-atencion-en-vivo.md) | 5 | Live chat asesor-cliente via WhatsApp, WebSocket |
| 05 | [Dashboard y Metricas](05-dashboard-y-metricas.md) | 2 | KPIs, graficos, barras de uso, filtros |
| 06 | [Roles y Permisos](06-roles-y-permisos.md) | 2 | ADMIN vs SOPORTE, JWT, middlewares |
| 07 | [Gestion de Sedes](07-gestion-de-sedes.md) | 2 | Locales comerciales, slug, horarios, mapa |
| 08 | [Onboarding](08-onboarding-registro-empresa.md) | 2 | Registro de empresa nueva, trial automatico |
| 09 | [Seguimiento Publico](09-seguimiento-publico.md) | 4 | Formulario, tracking, WebSocket publico, QR |
| 10 | [Chatbots, API y Widget](10-chatbots-api-externa-widget.md) | 5 | Bots, API keys, permisos, widget embebido |
| 11 | [Deteccion de Intenciones IA](11-deteccion-intenciones-ia.md) | 4 | Pipeline de clasificacion, contexto, acciones |

---

## Donde ponerlos en GitBook

Recomiendo agregarlos al espacio **"Documentacion General"** (el que tiene la documentacion del asistente IA en espanol), como nuevas paginas al mismo nivel que las existentes.

**Estructura sugerida en GitBook**:

```
Documentacion General/
├── 00-Indice (existente)
├── 01-Inicio Rapido (existente)
├── 02-Autenticacion (existente)
├── ...
├── 10-Limites del Sistema (existente)
│
├── ── NUEVOS ──
├── 11-Sistema de Suscripciones y Planes
├── 12-Exportacion PDF y Excel
├── 13-Sistema de Email y Plantillas
├── 14-Atencion en Vivo
├── 15-Dashboard y Metricas
├── 16-Roles y Permisos
├── 17-Gestion de Sedes
├── 18-Onboarding
├── 19-Seguimiento Publico
├── 20-Chatbots API y Widget
└── 21-Deteccion de Intenciones IA
```

## Que YA esta documentado en GitBook (no se toca)

- Asistente IA (chat, configuracion, proveedores, conexion externa, consultas contexto)
- JWT y Autenticacion
- WebSockets (arquitectura general)
- WhatsApp Business (guia usuario + guia desarrollador)
- Seguridad general
- Validador de documentos (PSE Peru)
- Cloudflare Turnstile
- Base de datos (esquema completo)
- Despliegue
- Flujo de informacion general
- Resumen del proyecto
- Mantenimiento
