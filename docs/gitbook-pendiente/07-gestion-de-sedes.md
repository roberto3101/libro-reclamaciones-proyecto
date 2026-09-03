# Gestion de Sedes (Locales)

## Que es y para que sirve

Por ley peruana (D.S. 011-2011-PCM), cada local comercial donde se atiende publico debe tener su propio **Libro de Reclamaciones**. Las sedes representan estos locales dentro del sistema.

Cada sede tiene su propio slug (URL amigable), direccion, horario, responsable y puede recibir reclamos de forma independiente. Los reclamos se asocian a la sede donde ocurrio el problema.

---

## Datos de una sede

| Campo | Que es | Ejemplo |
|-------|--------|---------|
| **nombre** | Nombre del local | "Sede Miraflores" |
| **slug** | URL amigable (unico por empresa) | "sede-miraflores" |
| **direccion** | Direccion fisica | "Av. Larco 123" |
| **departamento** | Departamento | "Lima" |
| **provincia** | Provincia | "Lima" |
| **distrito** | Distrito | "Miraflores" |
| **telefono** | Telefono de contacto | "01-555-1234" |
| **email** | Email del local | "miraflores@empresa.com" |
| **responsable_nombre** | Nombre del responsable | "Maria Garcia" |
| **responsable_cargo** | Cargo | "Administradora" |
| **horario_atencion** | Horarios por dia (JSON) | [{dia:"Lunes", inicio:"09:00", fin:"18:00"}] |
| **latitud/longitud** | Coordenadas GPS | -12.1196, -77.0314 |
| **es_principal** | Es la sede principal? | true/false |
| **activo** | Esta activa? | true/false |

---

## Sede Principal

Cada empresa tiene exactamente **una sede principal** que:
- Se crea automaticamente durante el onboarding
- **No se puede desactivar** (proteccion del sistema)
- Aparece siempre primera en la lista

---

## Generacion automatica del slug

Cuando creas una sede y no escribes el slug manualmente, el sistema lo genera automaticamente a partir del nombre:

```
"Polleria El Rey S.A.C." → "polleria-el-rey-sac"
"Tienda N 5 - Centro"    → "tienda-n-5-centro"
"Sede Ni os Felices"     → "sede-ninos-felices"
```

El proceso:
1. Quita acentos (normaliza Unicode)
2. Convierte a minusculas
3. Reemplaza caracteres especiales con guiones
4. Quita guiones al inicio y final

---

## Validaciones

- **Limite del plan**: Antes de crear una sede, se verifica que el plan lo permita (ej: plan EMPRENDEDOR permite max 3 sedes)
- **Slug unico**: No puede haber dos sedes con el mismo slug en la misma empresa
- **Sede principal protegida**: No se puede desactivar la sede principal
- **Suscripcion activa**: Se necesita una suscripcion activa o trial para crear sedes

---

## Endpoints de la API

| Metodo | Endpoint | Que hace |
|--------|----------|----------|
| GET | `/api/v1/sedes` | Listar sedes activas |
| GET | `/api/v1/sedes/:id` | Ver detalle de una sede |
| POST | `/api/v1/sedes` | Crear nueva sede |
| PUT | `/api/v1/sedes/:id` | Actualizar datos |
| DELETE | `/api/v1/sedes/:id` | Desactivar sede |

---

## En el frontend

### Pagina de sedes (`PaginaSedes.tsx`)

- Tabla: nombre, slug, direccion, responsable, acciones (editar/eliminar)
- Boton "Nueva Sede" que abre el formulario

### Formulario (`FormSede.tsx`)

- Generacion automatica de slug mientras escribes el nombre
- Formulario de direccion completa (departamento, provincia, distrito)
- Datos de contacto del responsable
- **Editor de horarios**: Puedes agregar/editar/eliminar horarios por dia de la semana
- **Mapa de ubicacion**: Componente que se carga bajo demanda (lazy-loaded) para seleccionar coordenadas GPS
- Validacion de coordenadas (-90 a 90 latitud, -180 a 180 longitud)
