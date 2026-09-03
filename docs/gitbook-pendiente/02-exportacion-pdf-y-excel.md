# Exportacion PDF y Excel

## Que es y para que sirve

El sistema permite exportar la informacion de reclamos en dos formatos:

1. **PDF**: Un reporte visual con tabla de reclamos, ideal para imprimir o enviar por email.
2. **Excel (XLSX)**: Una hoja de calculo con 18 columnas detalladas, ideal para analisis y filtrado.

Ademas, cuando se resuelve un reclamo, se genera automaticamente un **PDF de resolucion** profesional que se envia al cliente por email.

---

## Exportacion masiva (listado de reclamos)

### Como funciona

El usuario va a la pagina de reclamos, aplica los filtros que quiera (por fecha, estado, sede, etc.) y hace clic en el boton PDF o Excel. El sistema genera el archivo al instante y lo descarga.

### Flujo paso a paso

```
1. Usuario aplica filtros en la tabla de reclamos
     ↓
2. Hace clic en "Exportar PDF" o "Exportar Excel"
     ↓
3. Frontend envia GET /api/v1/reclamos/exportar/pdf (o /excel)
   con los mismos filtros como parametros
     ↓
4. Backend consulta la base de datos (maximo 10,000 registros)
     ↓
5. Genera el archivo en memoria (no se guarda en disco)
     ↓
6. Retorna el archivo como descarga directa
     ↓
7. El navegador descarga: reclamos_20260328_143055.pdf
```

### Filtros disponibles

Todos los filtros son opcionales. Si no pones ninguno, exporta todo:

| Parametro | Que filtra | Ejemplo |
|-----------|-----------|---------|
| `sede_id` | Sede especifica | UUID de la sede |
| `estado` | Estado del reclamo | PENDIENTE, EN_PROCESO, RESUELTO |
| `periodo` | Periodo predefinido | hoy, semana, mes, anio |
| `fecha_desde` | Fecha inicio personalizada | 2026-01-01 |
| `fecha_hasta` | Fecha fin personalizada | 2026-03-28 |
| `busqueda` | Texto libre | nombre, email, codigo, documento |
| `proximos_a_vencer` | Solo los que estan por vencer | true |
| `es_cliente_plataforma` | Filtrar por cliente la plataforma | true / false |

### Que contiene el PDF

Un reporte en formato **apaisado (horizontal) A4** con:

- **Encabezado**: Titulo "Reporte de Reclamos y Quejas" + nombre de la empresa + RUC
- **Tabla de 10 columnas**: Codigo, Consumidor, Documento, Tipo, Estado, Sede, Atendido por, Fecha, Monto, Cliente
- **Pie de pagina**: Fecha de generacion + numero de pagina
- **Resumen**: Total de registros exportados

### Que contiene el Excel

Una hoja llamada "Reclamos" con **18 columnas** mucho mas detalladas:

```
Codigo | Tipo Solicitud | Estado | Consumidor | Tipo Doc | Nro Documento |
Telefono | Email | Sede | Atendido por | Bien/Servicio | Descripcion |
Monto Reclamado | Fecha Incidente | Fecha Registro | Fecha Limite | Canal | Es Cliente
```

Caracteristicas del Excel:
- Encabezados en azul con texto blanco
- Filtros automaticos en todas las columnas
- Primera fila congelada (siempre visible al hacer scroll)
- Columna de montos con formato numerico `#,##0.00`

---

## PDF de Resolucion (documento individual)

### Que es

Cuando un asesor emite la resolucion final de un reclamo, el sistema genera automaticamente un **PDF profesional** con el formato legal requerido. Este PDF se envia por email al cliente.

### Cuando se genera

```
1. Asesor escribe la respuesta de resolucion
     ↓
2. Hace clic en "Emitir Resolucion Final"
     ↓
3. El sistema confirma: "Se cerrara el caso y se generara el PDF"
     ↓
4. Backend guarda la respuesta + cierra el reclamo
     ↓
5. En segundo plano (asincrono, no bloquea):
     a. Genera el PDF con los datos del reclamo
     b. Aplica el branding de la empresa (color, logo)
     c. Inserta la firma digital del representante
     d. Envia email con el PDF adjunto al cliente
     e. Si falla el email, reintenta hasta 3 veces
```

### Estructura del PDF de resolucion

```
┌──────────────────────────────────────────────┐
│ ████████████████████████████████████████████  │  ← Barra color primario
│                                              │
│  EMPRESA S.A.C.                              │
│  RUC: 20123456789                            │
│                                              │
│  Fecha: 28/03/2026     Exp: RCL-2026-001234  │
│                                              │
│              RESOLUCION                       │
│              ═══════════                      │
│                                              │
│  1. IDENTIFICACION DEL PROVEEDOR             │
│  ┌──────────────────────────────────────┐    │
│  │ Razon Social: Empresa S.A.C.         │    │
│  │ RUC: 20123456789                     │    │
│  │ Sede: Sede Principal                 │    │
│  │ Direccion: Av. Larco 123, Miraflores│    │
│  └──────────────────────────────────────┘    │
│                                              │
│  2. IDENTIFICACION DEL CONSUMIDOR            │
│  ┌──────────────────────────────────────┐    │
│  │ Nombre: Juan Perez Garcia            │    │
│  │ Documento: DNI 12345678              │    │
│  │ Domicilio: Calle Las Flores 456      │    │
│  │ Contacto: 999888777 / juan@mail.com  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  3. DETALLE DEL RECLAMO / QUEJA              │
│  ┌──────────────────────────────────────┐    │
│  │ Detalle: El producto llego danado... │    │
│  │ Pedido: Solicito devolucion total... │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  4. RESOLUCION DE LA EMPRESA                 │
│  ┌──────────────────────────────────────┐    │
│  │ Respuesta: Hemos procedido con...    │    │
│  │ Accion: Devolucion del 100%...       │    │
│  └──────────────────────────────────────┘    │
│                                              │
│                    Atte.                      │
│              [Firma Digital]                  │
│          ──────────────────────               │
│           Empresa S.A.C.                      │
│           RUC: 20123456789                    │
│                                              │
│  Ley N 29571 - Codigo de Proteccion          │
│  Documento emitido automaticamente            │
└──────────────────────────────────────────────┘
```

### Personalizacion por empresa

Cada empresa puede personalizar el PDF con:
- **Color primario**: Se usa en la barra superior, bordes de secciones, firma
- **Firma digital**: Imagen base64 del representante legal
- **Datos de la empresa**: Razon social, RUC, sede, direccion

El sistema calcula automaticamente variantes del color:
- **Color claro** (70% blanco): para los encabezados de seccion
- **Color muy claro** (92% blanco): para las filas alternas

### Permisos requeridos

Ambas exportaciones (PDF y Excel) requieren:
- Autenticacion JWT
- Pertenecer al tenant
- Permiso `ModuloReclamos.AccionExportar` en su rol

Los usuarios de SOPORTE solo ven reclamos de su sede asignada.

---

## Codigo clave del frontend

```typescript
// Cuando el usuario hace clic en "Exportar PDF"
const exportar = async (formato: 'pdf' | 'excel') => {
  // 1. Construye los parametros con los filtros activos
  const params = construirParams(sedeId, periodo, fechaDesde, ...);

  // 2. Llama al backend pidiendo un blob (archivo binario)
  const blob = await reclamosApi.exportarPDF(params);

  // 3. Crea un enlace temporal y fuerza la descarga
  const url = URL.createObjectURL(new Blob([blob]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `reclamos_${Date.now()}.pdf`;
  a.click();
};
```

---

## Archivos involucrados

| Capa | Archivo | Funcion |
|------|---------|---------|
| Rutas | `exportar_routes.go` | Registra los endpoints |
| Controlador | `exportar_controlador.go` | Maneja la peticion y filtros |
| Servicio PDF | `exportar_pdf_servicio.go` | Genera el PDF masivo |
| Servicio Excel | `exportar_excel_servicio.go` | Genera el Excel |
| Servicio Resolucion | `pdf_resolucion.go` | Genera el PDF individual |
| Frontend | `PaginaReclamos.tsx` | Botones y logica de descarga |
