const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat, TableOfContents } = require('docx');
const fs = require('fs');

// ============================================================
// CONFIGURACION
// ============================================================
const COLORS = {
  primary: "1A56DB",
  headerBg: "1A56DB",
  headerText: "FFFFFF",
  altRowBg: "F3F6FC",
  lightBg: "EBF0FA",
  border: "D1D5DB",
  sectionBg: "F0F4FF",
  accent: "2563EB",
  text: "1F2937",
  muted: "6B7280",
};

const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const PAGE_WIDTH = 15840; // Landscape Letter
const PAGE_HEIGHT = 12240;
const MARGIN = 1080; // 0.75 inch
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 13680

// ============================================================
// HELPERS
// ============================================================
function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
      new TextRun({ text, bold: true, font: "Arial", size: 18, color: COLORS.headerText })
    ]})]
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shaded ? { fill: COLORS.altRowBg, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
      new TextRun({ text: text || "", font: "Arial", size: 17, color: COLORS.text, ...(opts.bold ? { bold: true } : {}), ...(opts.italics ? { italics: true } : {}) })
    ]})]
  });
}

function makeTableRow(cells, shaded) {
  return new TableRow({ children: cells.map((c, i) => dataCell(c.text, c.width, { shaded, bold: c.bold, italics: c.italics })) });
}

function columnTable(columns) {
  // columns: [{name, type, required, description}]
  const colWidths = [2800, 2000, 1200, 7680]; // name, type, req, desc = 13680
  const rows = [
    new TableRow({ children: [
      headerCell("Columna", colWidths[0]),
      headerCell("Tipo", colWidths[1]),
      headerCell("Requerido", colWidths[2]),
      headerCell("Descripcion", colWidths[3]),
    ]})
  ];
  columns.forEach((col, i) => {
    rows.push(makeTableRow([
      { text: col.name, width: colWidths[0], bold: true },
      { text: col.type, width: colWidths[1] },
      { text: col.required, width: colWidths[2] },
      { text: col.description, width: colWidths[3] },
    ], i % 2 === 1));
  });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

function sectionTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: COLORS.primary })]
  });
}

function tableTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: COLORS.accent })]
  });
}

function desc(text) {
  return new Paragraph({
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 19, color: COLORS.text })]
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 40, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 17, italics: true, color: COLORS.muted })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 100, after: 100 }, children: [] });
}

// ============================================================
// DATA: TABLAS POR MODULO
// ============================================================
const modules = [
  // ---- MODULE 1: PLANES Y SUSCRIPCIONES ----
  {
    title: "1. Planes y Suscripciones",
    description: "Este modulo controla los planes de servicio disponibles y la suscripcion activa de cada empresa (tenant). Define los limites de uso, precios y funcionalidades habilitadas para cada cliente.",
    tables: [
      {
        name: "planes",
        desc: "Catalogo global de planes de suscripcion. Es la UNICA tabla sin tenant_id porque los planes son iguales para todas las empresas. Se insertan una vez y rara vez cambian.",
        note: "Planes actuales: DEMO (gratis), EMPRENDEDOR (S/ 19.90/mes), PYME (S/ 44.90/mes), PRO (S/ 84.90/mes).",
        columns: [
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del plan (generado automaticamente)" },
          { name: "codigo", type: "STRING", required: "Si", description: "Codigo corto del plan: DEMO, EMPRENDEDOR, PYME, PRO. Unico a nivel global." },
          { name: "nombre", type: "STRING", required: "Si", description: "Nombre visible: 'Plan Demo', 'Plan PYME', etc." },
          { name: "descripcion", type: "STRING", required: "No", description: "Texto descriptivo del plan para la pagina de precios." },
          { name: "precio_mensual", type: "DECIMAL", required: "Si", description: "Precio mensual en soles (S/). Plan Demo = 0." },
          { name: "precio_anual", type: "DECIMAL", required: "No", description: "Precio anual con descuento. NULL = no ofrece pago anual." },
          { name: "precio_sede_extra", type: "DECIMAL", required: "Si", description: "Costo mensual por cada sede adicional sobre el limite." },
          { name: "precio_usuario_extra", type: "DECIMAL", required: "Si", description: "Costo mensual por cada usuario adicional sobre el limite." },
          { name: "max_sedes", type: "INT", required: "Si", description: "Maximo de sedes (locales) permitidos. Ej: Demo=1, PRO=50." },
          { name: "max_usuarios", type: "INT", required: "Si", description: "Maximo de usuarios admin permitidos. Ej: Demo=1, PRO=10." },
          { name: "max_reclamos_mes", type: "INT", required: "Si", description: "Limite de reclamos por mes. -1 = ilimitado." },
          { name: "max_chatbots", type: "INT", required: "Si", description: "Cantidad maxima de chatbots configurables." },
          { name: "max_canales_whatsapp", type: "INT", required: "Si", description: "Cantidad maxima de numeros WhatsApp. -1=ilimitado, 0=no disponible." },
          { name: "permite_chatbot", type: "BOOL", required: "Si", description: "Puede usar chatbots de IA para responder reclamos?" },
          { name: "permite_whatsapp", type: "BOOL", required: "Si", description: "Puede recibir reclamos por WhatsApp?" },
          { name: "permite_email", type: "BOOL", required: "Si", description: "Puede enviar notificaciones por email?" },
          { name: "permite_reportes_pdf", type: "BOOL", required: "Si", description: "Puede exportar reportes en PDF?" },
          { name: "permite_exportar_excel", type: "BOOL", required: "Si", description: "Puede exportar datos a Excel?" },
          { name: "permite_api", type: "BOOL", required: "Si", description: "Tiene acceso a la API programatica?" },
          { name: "permite_marca_blanca", type: "BOOL", required: "Si", description: "Puede quitar el branding de la plataforma?" },
          { name: "permite_multi_idioma", type: "BOOL", required: "Si", description: "Soporte para multiples idiomas?" },
          { name: "permite_asistente_ia", type: "BOOL", required: "Si", description: "Asistente IA interno en el panel de admin?" },
          { name: "permite_atencion_vivo", type: "BOOL", required: "Si", description: "Chat en vivo con asesores humanos?" },
          { name: "max_storage_mb", type: "INT", required: "Si", description: "Almacenamiento total para archivos adjuntos (MB)." },
          { name: "orden", type: "INT", required: "Si", description: "Orden en que aparece en la pagina de precios." },
          { name: "activo", type: "BOOL", required: "Si", description: "Si esta visible y disponible para contratar." },
          { name: "destacado", type: "BOOL", required: "Si", description: "Se resalta visualmente en la pagina de precios." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha en que se creo el plan." },
        ]
      },
      {
        name: "suscripciones",
        desc: "Vincula cada empresa (tenant) con su plan activo. Un tenant tiene UNA suscripcion activa a la vez. Se conserva el historial de cambios de plan (upgrades/downgrades).",
        note: "Estados posibles: ACTIVA, SUSPENDIDA, CANCELADA, TRIAL, VENCIDA. Ciclos: MENSUAL o ANUAL.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Identificador de la empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la suscripcion." },
          { name: "plan_id", type: "UUID (FK)", required: "Si", description: "Referencia al plan contratado (tabla planes)." },
          { name: "estado", type: "STRING", required: "Si", description: "Estado actual: ACTIVA, SUSPENDIDA, CANCELADA, TRIAL, VENCIDA." },
          { name: "ciclo", type: "STRING", required: "Si", description: "Periodo de facturacion: MENSUAL o ANUAL." },
          { name: "fecha_inicio", type: "TIMESTAMP", required: "Si", description: "Cuando se activo esta suscripcion." },
          { name: "fecha_fin", type: "TIMESTAMP", required: "No", description: "Fecha de terminacion. NULL = se renueva automaticamente." },
          { name: "fecha_proximo_cobro", type: "DATE", required: "No", description: "Proxima fecha de cobro programada." },
          { name: "es_trial", type: "BOOL", required: "Si", description: "Es una prueba gratuita?" },
          { name: "dias_trial", type: "INT", required: "No", description: "Duracion del periodo de prueba en dias." },
          { name: "fecha_fin_trial", type: "DATE", required: "No", description: "Cuando termina el periodo de prueba." },
          { name: "override_max_sedes", type: "INT", required: "No", description: "Sobreescribe el limite de sedes del plan (negociaciones especiales). NULL = usa limite del plan." },
          { name: "override_max_usuarios", type: "INT", required: "No", description: "Sobreescribe el limite de usuarios. NULL = usa limite del plan." },
          { name: "override_max_reclamos", type: "INT", required: "No", description: "Sobreescribe el limite de reclamos/mes. NULL = usa limite del plan." },
          { name: "override_max_chatbots", type: "INT", required: "No", description: "Sobreescribe el limite de chatbots. NULL = usa limite del plan." },
          { name: "override_max_canales_whatsapp", type: "INT", required: "No", description: "Sobreescribe el limite de canales WhatsApp." },
          { name: "override_max_storage_mb", type: "INT", required: "No", description: "Sobreescribe el limite de almacenamiento." },
          { name: "referencia_pago", type: "STRING", required: "No", description: "ID de transaccion del sistema de pagos externo." },
          { name: "metodo_pago", type: "STRING", required: "No", description: "Metodo de pago: TARJETA, TRANSFERENCIA, YAPE, PLIN." },
          { name: "activado_por", type: "STRING", required: "No", description: "Quien activo: ONBOARDING, UPGRADE, ADMIN_MANUAL, RENOVACION." },
          { name: "notas", type: "STRING", required: "No", description: "Notas internas sobre la suscripcion." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion del registro." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      }
    ]
  },

  // ---- MODULE 2: CONFIGURACION DEL TENANT ----
  {
    title: "2. Configuracion de la Empresa (Tenant)",
    description: "Datos legales y de configuracion de cada empresa que usa el sistema. Se crea al momento del registro (onboarding). Cada empresa tiene exactamente UNA fila en esta tabla.",
    tables: [
      {
        name: "configuracion_tenant",
        desc: "Contiene los datos legales, de branding y configuracion de notificaciones de la empresa. Es como la 'ficha de identidad' de cada cliente del SaaS.",
        note: "El campo 'slug' es la URL publica del libro: tuapp.com/libro/{slug}. Debe ser unico a nivel global.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Identificador unico de la empresa en todo el sistema." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador del registro de configuracion." },
          { name: "razon_social", type: "STRING", required: "Si", description: "Nombre legal de la empresa (requerido por ley)." },
          { name: "ruc", type: "STRING", required: "Si", description: "Numero de RUC de la empresa. Unico por tenant." },
          { name: "nombre_comercial", type: "STRING", required: "No", description: "Nombre comercial o de fantasia." },
          { name: "direccion_legal", type: "STRING", required: "No", description: "Direccion del domicilio legal." },
          { name: "departamento", type: "STRING", required: "No", description: "Departamento de la direccion legal." },
          { name: "provincia", type: "STRING", required: "No", description: "Provincia de la direccion legal." },
          { name: "distrito", type: "STRING", required: "No", description: "Distrito de la direccion legal." },
          { name: "telefono", type: "STRING", required: "No", description: "Telefono de contacto principal." },
          { name: "email_contacto", type: "STRING", required: "No", description: "Email de contacto de la empresa." },
          { name: "logo_url", type: "STRING", required: "No", description: "URL del logo de la empresa." },
          { name: "slug", type: "STRING", required: "Si", description: "Identificador de URL: tuapp.com/libro/{slug}. Unico global." },
          { name: "sitio_web", type: "STRING", required: "No", description: "URL del sitio web de la empresa." },
          { name: "color_primario", type: "STRING", required: "No", description: "Color principal de la marca (hexadecimal). Por defecto: #1a56db." },
          { name: "plazo_respuesta_dias", type: "INT", required: "Si", description: "Plazo legal para responder reclamos (dias). Por defecto: 15." },
          { name: "mensaje_confirmacion", type: "STRING", required: "No", description: "Mensaje personalizado al registrar un reclamo." },
          { name: "notificar_whatsapp", type: "BOOL", required: "Si", description: "Enviar notificaciones por WhatsApp?" },
          { name: "notificar_email", type: "BOOL", required: "Si", description: "Enviar notificaciones por email?" },
          { name: "notificar_email_estado", type: "BOOL", required: "Si", description: "Notificar al cliente por email cuando cambia el estado?" },
          { name: "notificar_email_mensaje", type: "BOOL", required: "Si", description: "Notificar al cliente por email cuando hay un nuevo mensaje?" },
          { name: "notificar_email_resolucion", type: "BOOL", required: "Si", description: "Notificar al cliente por email cuando se resuelve el reclamo?" },
          { name: "activo", type: "BOOL", required: "Si", description: "La empresa esta activa en la plataforma?" },
          { name: "version", type: "INT", required: "Si", description: "Control de concurrencia (optimistic locking). Evita ediciones simultaneas." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de registro de la empresa." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion de la configuracion." },
        ]
      }
    ]
  },

  // ---- MODULE 3: SEDES ----
  {
    title: "3. Sedes (Establecimientos Fisicos)",
    description: "Por ley peruana (D.S. 011-2011-PCM), cada establecimiento fisico debe tener su propio libro de reclamaciones. Si una empresa tiene 3 locales, necesita 3 formularios publicos distintos.",
    tables: [
      {
        name: "sedes",
        desc: "Cada fila representa un local o establecimiento fisico de la empresa. Cada sede tiene su propio formulario publico de reclamos.",
        note: "El limite de sedes esta controlado por el plan contratado (planes.max_sedes).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa propietaria de la sede." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la sede." },
          { name: "nombre", type: "STRING", required: "Si", description: "Nombre de la sede: 'Sucursal San Isidro', 'Local Miraflores'." },
          { name: "slug", type: "STRING", required: "Si", description: "Identificador de URL para el formulario de la sede. Unico por tenant." },
          { name: "codigo_sede", type: "STRING", required: "No", description: "Codigo interno de la sede (opcional)." },
          { name: "direccion", type: "STRING", required: "Si", description: "Direccion fisica del establecimiento (obligatorio por ley)." },
          { name: "departamento", type: "STRING", required: "No", description: "Departamento de ubicacion." },
          { name: "provincia", type: "STRING", required: "No", description: "Provincia de ubicacion." },
          { name: "distrito", type: "STRING", required: "No", description: "Distrito de ubicacion." },
          { name: "referencia", type: "STRING", required: "No", description: "Referencia de la ubicacion." },
          { name: "telefono", type: "STRING", required: "No", description: "Telefono de contacto de la sede." },
          { name: "email", type: "STRING", required: "No", description: "Email de contacto de la sede." },
          { name: "responsable_nombre", type: "STRING", required: "No", description: "Nombre del responsable del local." },
          { name: "responsable_cargo", type: "STRING", required: "No", description: "Cargo del responsable del local." },
          { name: "horario_atencion", type: "JSONB", required: "No", description: "Horario de atencion en formato JSON flexible." },
          { name: "latitud", type: "DECIMAL", required: "No", description: "Latitud GPS del local." },
          { name: "longitud", type: "DECIMAL", required: "No", description: "Longitud GPS del local." },
          { name: "activo", type: "BOOL", required: "Si", description: "La sede esta activa? Si se desactiva, no recibe reclamos." },
          { name: "es_principal", type: "BOOL", required: "Si", description: "Es la sede principal? Solo una sede por empresa puede ser principal." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      }
    ]
  },

  // ---- MODULE 4: USUARIOS Y ROLES ----
  {
    title: "4. Usuarios y Roles del Panel",
    description: "Gestiona los usuarios que acceden al panel administrativo y sus permisos. Cada tenant puede personalizar roles y definir que puede hacer cada tipo de usuario.",
    tables: [
      {
        name: "usuarios_admin",
        desc: "Usuarios del panel administrativo de cada empresa. Pueden ser administradores, agentes de soporte, supervisores, etc.",
        note: "El limite de usuarios esta controlado por el plan (planes.max_usuarios). El campo 'rol' almacena el slug del rol asignado.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa a la que pertenece el usuario." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del usuario." },
          { name: "email", type: "STRING", required: "Si", description: "Email del usuario (login). Unico por empresa." },
          { name: "nombre_completo", type: "STRING", required: "Si", description: "Nombre completo del usuario." },
          { name: "password_hash", type: "STRING", required: "Si", description: "Contrasena encriptada (hash). Nunca se almacena en texto plano." },
          { name: "rol", type: "STRING", required: "Si", description: "Slug del rol: ADMIN, SOPORTE, u otro personalizado." },
          { name: "activo", type: "BOOL", required: "Si", description: "El usuario puede acceder al sistema?" },
          { name: "debe_cambiar_password", type: "BOOL", required: "Si", description: "Se le obliga a cambiar la contrasena al siguiente login?" },
          { name: "ultimo_acceso", type: "TIMESTAMP", required: "No", description: "Fecha y hora del ultimo inicio de sesion." },
          { name: "sede_id", type: "UUID (FK)", required: "No", description: "Sede asignada. NULL = acceso a todas las sedes." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion de la cuenta." },
          { name: "creado_por", type: "UUID", required: "No", description: "ID del admin que creo este usuario." },
        ]
      },
      {
        name: "roles_tenant",
        desc: "Roles personalizables por empresa. Cada rol define que modulos y acciones puede realizar un usuario. Los roles ADMIN y SOPORTE se crean automaticamente y no se pueden eliminar.",
        note: "El campo 'permisos' es un JSON con la estructura: {\"reclamos\": {\"ver\": true, \"editar\": true}, \"usuarios\": {\"ver\": true}, ...}",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa propietaria del rol." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del rol." },
          { name: "slug", type: "STRING", required: "Si", description: "Identificador tecnico: ADMIN, SOPORTE, SUPERVISOR, etc. Unico por tenant." },
          { name: "nombre", type: "STRING", required: "Si", description: "Nombre visible: 'Administrador', 'Agente de Soporte', etc." },
          { name: "descripcion", type: "STRING", required: "Si", description: "Descripcion del rol." },
          { name: "color", type: "STRING", required: "Si", description: "Color del badge del rol en la interfaz (hexadecimal)." },
          { name: "permisos", type: "JSONB", required: "Si", description: "Matriz de permisos: modulo -> accion -> true/false." },
          { name: "es_base", type: "BOOL", required: "Si", description: "Rol creado por el sistema? Si es true, no se puede eliminar." },
          { name: "orden", type: "INT", required: "Si", description: "Orden de visualizacion en la interfaz." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion del rol." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      }
    ]
  },

  // ---- MODULE 5: RECLAMOS ----
  {
    title: "5. Reclamos y Quejas",
    description: "El corazon del sistema. Aqui se almacenan todos los reclamos y quejas que los consumidores registran a traves del formulario publico, WhatsApp o chatbot. Cumple con la normativa INDECOPI (D.S. 011-2011-PCM / Ley 29571).",
    tables: [
      {
        name: "reclamos",
        desc: "Tabla principal de reclamos y quejas. Cada fila es un reclamo registrado por un consumidor. Contiene datos del consumidor, del bien/servicio, el detalle del reclamo y la gestion interna.",
        note: "Usa soft delete (deleted_at) porque INDECOPI puede exigir datos historicos. Nunca se borra fisicamente un reclamo. El limite mensual esta controlado por el plan.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa que recibe el reclamo." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del reclamo." },
          { name: "codigo_reclamo", type: "STRING", required: "Si", description: "Codigo legible del reclamo (ej: REC-2026-00001). Unico por empresa." },
          { name: "tipo_solicitud", type: "STRING", required: "Si", description: "Tipo: RECLAMO (insatisfaccion con producto/servicio) o QUEJA (mala atencion)." },
          { name: "estado", type: "STRING", required: "Si", description: "Estado actual: PENDIENTE, EN_PROCESO, RESUELTO, CERRADO." },
          { name: "nombre_completo", type: "STRING", required: "Si", description: "Nombre completo del consumidor que reclama." },
          { name: "tipo_documento", type: "STRING", required: "Si", description: "Tipo de documento: DNI, CE, PASAPORTE, RUC." },
          { name: "numero_documento", type: "STRING", required: "Si", description: "Numero de documento de identidad." },
          { name: "telefono", type: "STRING", required: "Si", description: "Telefono del consumidor." },
          { name: "email", type: "STRING", required: "Si", description: "Email del consumidor." },
          { name: "domicilio", type: "STRING", required: "No", description: "Direccion del consumidor." },
          { name: "departamento", type: "STRING", required: "No", description: "Departamento del consumidor." },
          { name: "provincia", type: "STRING", required: "No", description: "Provincia del consumidor." },
          { name: "distrito", type: "STRING", required: "No", description: "Distrito del consumidor." },
          { name: "menor_de_edad", type: "BOOL", required: "No", description: "El reclamante es menor de edad?" },
          { name: "nombre_apoderado", type: "STRING", required: "No", description: "Nombre del apoderado si es menor de edad." },
          { name: "razon_social_proveedor", type: "STRING", required: "No", description: "Copia del nombre de la empresa al momento del reclamo (snapshot)." },
          { name: "ruc_proveedor", type: "STRING", required: "No", description: "Copia del RUC al momento del reclamo (snapshot)." },
          { name: "direccion_proveedor", type: "STRING", required: "No", description: "Copia de la direccion al momento del reclamo (snapshot)." },
          { name: "sede_id", type: "UUID (FK)", required: "No", description: "Sede donde se registra el reclamo (referencia a tabla sedes)." },
          { name: "sede_nombre", type: "STRING", required: "No", description: "Nombre de la sede al momento del reclamo (snapshot)." },
          { name: "sede_direccion", type: "STRING", required: "No", description: "Direccion de la sede al momento del reclamo (snapshot)." },
          { name: "tipo_bien", type: "STRING", required: "No", description: "Tipo de bien: PRODUCTO o SERVICIO." },
          { name: "monto_reclamado", type: "DECIMAL", required: "No", description: "Monto en soles que reclama el consumidor." },
          { name: "descripcion_bien", type: "STRING", required: "Si", description: "Descripcion del producto o servicio contratado." },
          { name: "numero_pedido", type: "STRING", required: "No", description: "Numero de pedido o comprobante (si aplica)." },
          { name: "area_queja", type: "STRING", required: "No", description: "Area especifica de la queja (solo para tipo QUEJA)." },
          { name: "descripcion_situacion", type: "STRING", required: "No", description: "Descripcion de la situacion (solo para tipo QUEJA)." },
          { name: "fecha_incidente", type: "DATE", required: "Si", description: "Fecha en que ocurrio el incidente." },
          { name: "detalle_reclamo", type: "STRING", required: "Si", description: "Descripcion detallada del reclamo." },
          { name: "pedido_consumidor", type: "STRING", required: "Si", description: "Lo que solicita el consumidor como resolucion." },
          { name: "firma_digital", type: "STRING", required: "No", description: "Firma digital del formulario (base64)." },
          { name: "ip_address", type: "STRING", required: "No", description: "IP desde donde se registro el reclamo." },
          { name: "user_agent", type: "STRING", required: "No", description: "Navegador/dispositivo del consumidor." },
          { name: "acepta_terminos", type: "BOOL", required: "Si", description: "El consumidor acepto los terminos y condiciones?" },
          { name: "acepta_copia", type: "BOOL", required: "Si", description: "El consumidor acepto recibir copia del reclamo?" },
          { name: "fecha_registro", type: "TIMESTAMP", required: "Si", description: "Fecha y hora de registro del reclamo." },
          { name: "fecha_limite_respuesta", type: "DATE", required: "No", description: "Fecha maxima para responder (calculada: registro + plazo dias)." },
          { name: "fecha_respuesta", type: "TIMESTAMP", required: "No", description: "Fecha en que la empresa respondio." },
          { name: "fecha_cierre", type: "TIMESTAMP", required: "No", description: "Fecha en que se cerro el reclamo." },
          { name: "atendido_por", type: "UUID (FK)", required: "No", description: "ID del usuario admin que atiende el reclamo." },
          { name: "canal_origen", type: "STRING", required: "No", description: "Canal de ingreso: WEB, APP, PRESENCIAL, QR, CHATBOT." },
          { name: "deleted_at", type: "TIMESTAMP", required: "No", description: "Fecha de eliminacion logica. Si tiene valor, el reclamo esta 'eliminado' pero no se borra fisicamente." },
        ]
      },
      {
        name: "respuestas",
        desc: "Respuestas oficiales de la empresa a cada reclamo. Un reclamo puede tener multiples respuestas a lo largo del tiempo.",
        note: "El campo 'origen' indica si la respuesta fue escrita desde el panel, por un chatbot o via API.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa que responde." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la respuesta." },
          { name: "reclamo_id", type: "UUID (FK)", required: "Si", description: "Reclamo al que se responde." },
          { name: "respuesta_empresa", type: "STRING", required: "Si", description: "Texto de la respuesta oficial." },
          { name: "accion_tomada", type: "STRING", required: "No", description: "Accion correctiva que se tomo." },
          { name: "compensacion_ofrecida", type: "STRING", required: "No", description: "Compensacion ofrecida al consumidor." },
          { name: "respondido_por", type: "UUID", required: "No", description: "ID del usuario que redacto la respuesta." },
          { name: "cargo_responsable", type: "STRING", required: "No", description: "Cargo del responsable que firma la respuesta." },
          { name: "archivos_adjuntos", type: "JSONB", required: "No", description: "Lista de archivos adjuntos (JSON con URLs)." },
          { name: "notificado_cliente", type: "BOOL", required: "Si", description: "Se notifico al cliente sobre esta respuesta?" },
          { name: "canal_notificacion", type: "STRING", required: "No", description: "Canal por el que se notifico: EMAIL, WHATSAPP." },
          { name: "fecha_notificacion", type: "TIMESTAMP", required: "No", description: "Fecha en que se envio la notificacion." },
          { name: "origen", type: "STRING", required: "Si", description: "Quien genero la respuesta: PANEL, CHATBOT, API." },
          { name: "chatbot_id", type: "UUID", required: "No", description: "Si fue generada por un chatbot, su ID." },
          { name: "fecha_respuesta", type: "TIMESTAMP", required: "Si", description: "Fecha y hora de la respuesta." },
        ]
      },
      {
        name: "historial_reclamos",
        desc: "Registro de trazabilidad de todos los cambios que sufre un reclamo. Es de solo insercion (nunca se edita ni borra). Permite reconstruir la historia completa de un reclamo.",
        note: "Tipos de accion: CREACION, CAMBIO_ESTADO, RESPUESTA, ASIGNACION, NOTIFICACION, REAPERTURA, CHATBOT_RESPUESTA.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del evento." },
          { name: "reclamo_id", type: "UUID (FK)", required: "Si", description: "Reclamo afectado." },
          { name: "estado_anterior", type: "STRING", required: "No", description: "Estado antes del cambio. NULL en la creacion." },
          { name: "estado_nuevo", type: "STRING", required: "Si", description: "Estado despues del cambio." },
          { name: "tipo_accion", type: "STRING", required: "Si", description: "Tipo de accion realizada." },
          { name: "comentario", type: "STRING", required: "No", description: "Comentario o nota sobre la accion." },
          { name: "usuario_accion", type: "UUID", required: "No", description: "ID del usuario que realizo la accion." },
          { name: "chatbot_id", type: "UUID", required: "No", description: "ID del chatbot si la accion fue automatica." },
          { name: "ip_address", type: "STRING", required: "No", description: "IP desde donde se realizo la accion." },
          { name: "fecha_accion", type: "TIMESTAMP", required: "Si", description: "Fecha y hora de la accion." },
        ]
      },
      {
        name: "mensajes_seguimiento",
        desc: "Chat de seguimiento entre el consumidor y la empresa sobre un reclamo en particular. Permite comunicacion bidireccional despues de registrar el reclamo.",
        note: "Tipos de mensaje: CLIENTE (del consumidor), EMPRESA (del admin), CHATBOT (automatico).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del mensaje." },
          { name: "reclamo_id", type: "UUID (FK)", required: "Si", description: "Reclamo al que pertenece el mensaje." },
          { name: "tipo_mensaje", type: "STRING", required: "Si", description: "Quien envio: CLIENTE, EMPRESA, CHATBOT." },
          { name: "mensaje", type: "STRING", required: "Si", description: "Contenido del mensaje." },
          { name: "archivo_url", type: "STRING", required: "No", description: "URL del archivo adjunto." },
          { name: "archivo_nombre", type: "STRING", required: "No", description: "Nombre original del archivo." },
          { name: "leido", type: "BOOL", required: "Si", description: "El destinatario ya leyo el mensaje?" },
          { name: "fecha_lectura", type: "TIMESTAMP", required: "No", description: "Fecha en que se leyo." },
          { name: "chatbot_id", type: "UUID", required: "No", description: "ID del chatbot si fue automatico." },
          { name: "fecha_mensaje", type: "TIMESTAMP", required: "Si", description: "Fecha y hora del mensaje." },
        ]
      }
    ]
  },

  // ---- MODULE 6: CHATBOTS E INTEGRACIONES ----
  {
    title: "6. Chatbots e Integraciones IA",
    description: "Este modulo permite a las empresas configurar chatbots de inteligencia artificial que pueden responder reclamos automaticamente, gestionar estados y enviar mensajes. Cada chatbot accede via API keys con permisos granulares.",
    tables: [
      {
        name: "chatbots",
        desc: "Configuracion de cada chatbot. Define el nombre, tipo, modelo de IA, permisos y restricciones operativas.",
        note: "Tipos de chatbot: ASISTENTE_IA, WHATSAPP_BOT, TELEGRAM_BOT, CUSTOM. El limite esta controlado por el plan.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa propietaria." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del chatbot." },
          { name: "nombre", type: "STRING", required: "Si", description: "Nombre del chatbot: 'Asistente IA de Reclamos'." },
          { name: "descripcion", type: "STRING", required: "No", description: "Descripcion del chatbot." },
          { name: "tipo", type: "STRING", required: "Si", description: "Tipo: ASISTENTE_IA, WHATSAPP_BOT, TELEGRAM_BOT, CUSTOM." },
          { name: "modelo_ia", type: "STRING", required: "No", description: "Modelo de IA: 'gpt-4o', 'claude-sonnet', etc." },
          { name: "prompt_sistema", type: "STRING", required: "No", description: "Instrucciones base para el comportamiento del chatbot." },
          { name: "temperatura", type: "DECIMAL", required: "No", description: "Creatividad de las respuestas (0.0=preciso, 1.0=creativo)." },
          { name: "max_tokens_respuesta", type: "INT", required: "No", description: "Largo maximo de cada respuesta (en tokens)." },
          { name: "puede_leer_reclamos", type: "BOOL", required: "Si", description: "Permiso para leer reclamos." },
          { name: "puede_responder", type: "BOOL", required: "Si", description: "Permiso para crear respuestas oficiales." },
          { name: "puede_cambiar_estado", type: "BOOL", required: "Si", description: "Permiso para cambiar estado de reclamos." },
          { name: "puede_enviar_mensajes", type: "BOOL", required: "Si", description: "Permiso para enviar mensajes de seguimiento." },
          { name: "puede_leer_metricas", type: "BOOL", required: "Si", description: "Permiso para ver dashboard y reportes." },
          { name: "requiere_aprobacion", type: "BOOL", required: "Si", description: "Las respuestas quedan como borrador hasta que un admin las apruebe?" },
          { name: "max_respuestas_dia", type: "INT", required: "No", description: "Limite diario de respuestas (rate limit)." },
          { name: "horario_activo", type: "JSONB", required: "No", description: "Horario en que el chatbot esta activo: {inicio: '08:00', fin: '20:00'}." },
          { name: "sedes_permitidas", type: "JSONB", required: "No", description: "Lista de IDs de sedes donde opera. NULL = todas las sedes." },
          { name: "activo", type: "BOOL", required: "Si", description: "El chatbot esta activo?" },
          { name: "creado_por", type: "UUID", required: "No", description: "ID del admin que creo el chatbot." },
          { name: "ultima_actividad", type: "TIMESTAMP", required: "No", description: "Ultima vez que el chatbot proceso algo." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      },
      {
        name: "chatbot_api_keys",
        desc: "Claves de acceso API para los chatbots. Cada chatbot puede tener multiples keys (rotacion de credenciales). La key se hashea con SHA256 y nunca se almacena en texto plano.",
        note: "Formato del token: crb_{entorno}_{random}. Ejemplo: crb_live_a1b2c3d4e5f6. El token solo se muestra UNA vez al crearse.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la key." },
          { name: "chatbot_id", type: "UUID (FK)", required: "Si", description: "Chatbot al que pertenece la key." },
          { name: "nombre", type: "STRING", required: "Si", description: "Nombre descriptivo: 'Key produccion v1'." },
          { name: "key_prefix", type: "STRING", required: "Si", description: "Primeros 12 caracteres del token (para identificar sin exponer el secreto)." },
          { name: "key_hash", type: "STRING", required: "Si", description: "SHA256 del token completo. Se usa para autenticar." },
          { name: "entorno", type: "STRING", required: "Si", description: "Entorno: LIVE (produccion) o TEST (pruebas)." },
          { name: "activa", type: "BOOL", required: "Si", description: "La key esta activa? Si es false, se rechaza toda solicitud." },
          { name: "fecha_expiracion", type: "TIMESTAMP", required: "No", description: "Fecha de expiracion. NULL = no expira." },
          { name: "ips_permitidas", type: "JSONB", required: "No", description: "Lista de IPs autorizadas. NULL = cualquier IP." },
          { name: "ultimo_uso", type: "TIMESTAMP", required: "No", description: "Ultima vez que se uso esta key." },
          { name: "requests_por_minuto", type: "INT", required: "Si", description: "Limite de solicitudes por minuto." },
          { name: "requests_por_dia", type: "INT", required: "Si", description: "Limite de solicitudes por dia." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion de la key." },
          { name: "creado_por", type: "UUID", required: "No", description: "ID del admin que genero la key." },
        ]
      },
      {
        name: "chatbot_logs",
        desc: "Registro de TODAS las llamadas API que hacen los chatbots. Sirve para auditoria, debugging, monitoreo de rate limits y potencial facturacion por uso.",
        note: "Los logs se eliminan automaticamente despues de 90 dias (TTL de CockroachDB).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del log." },
          { name: "chatbot_id", type: "UUID", required: "Si", description: "Chatbot que hizo la llamada." },
          { name: "api_key_id", type: "UUID", required: "Si", description: "Key usada para autenticar." },
          { name: "metodo", type: "STRING", required: "Si", description: "Metodo HTTP: GET, POST, PUT, PATCH." },
          { name: "endpoint", type: "STRING", required: "Si", description: "Ruta de la API: /api/v1/reclamos." },
          { name: "request_body", type: "JSONB", required: "No", description: "Body de la solicitud (sin datos sensibles)." },
          { name: "status_code", type: "INT", required: "Si", description: "Codigo de respuesta HTTP: 200, 400, 401, 403, 429, 500." },
          { name: "response_body", type: "JSONB", required: "No", description: "Respuesta resumida." },
          { name: "ip_address", type: "STRING", required: "No", description: "IP del chatbot." },
          { name: "duracion_ms", type: "INT", required: "No", description: "Tiempo de respuesta en milisegundos." },
          { name: "reclamo_id", type: "UUID", required: "No", description: "Si la accion fue sobre un reclamo, su ID." },
          { name: "accion", type: "STRING", required: "No", description: "Accion realizada: LEER_RECLAMO, RESPONDER, etc." },
          { name: "fue_rate_limited", type: "BOOL", required: "Si", description: "La solicitud fue rechazada por rate limit?" },
          { name: "fecha_expiracion", type: "TIMESTAMP", required: "Si", description: "Fecha de auto-eliminacion (90 dias desde creacion)." },
          { name: "fecha", type: "TIMESTAMP", required: "Si", description: "Fecha y hora del log." },
        ]
      }
    ]
  },

  // ---- MODULE 7: SESIONES Y AUDITORIA ----
  {
    title: "7. Sesiones y Auditoria",
    description: "Control de sesiones de los usuarios admin y registro inmutable de todas las acciones realizadas en el sistema. Es fundamental para la seguridad y trazabilidad.",
    tables: [
      {
        name: "sesiones_admin",
        desc: "Sesiones activas de los usuarios del panel. Cada login genera una sesion con un token hasheado. Las sesiones expiradas se eliminan automaticamente.",
        note: "Las sesiones se limpian automaticamente cada hora (TTL de CockroachDB).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa del usuario." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la sesion." },
          { name: "usuario_id", type: "UUID (FK)", required: "Si", description: "Usuario que inicio sesion." },
          { name: "token_hash", type: "STRING", required: "Si", description: "Hash del token JWT. No se almacena el token original." },
          { name: "ip_address", type: "STRING", required: "No", description: "IP desde donde se conecto." },
          { name: "user_agent", type: "STRING", required: "No", description: "Navegador/dispositivo." },
          { name: "activa", type: "BOOL", required: "Si", description: "La sesion sigue activa?" },
          { name: "fecha_inicio", type: "TIMESTAMP", required: "Si", description: "Cuando se inicio la sesion." },
          { name: "fecha_expiracion", type: "TIMESTAMP", required: "Si", description: "Cuando expira automaticamente." },
        ]
      },
      {
        name: "auditoria_admin",
        desc: "Log inmutable de TODAS las acciones administrativas. Cada vez que un usuario hace algo en el panel (login, responder reclamo, crear usuario, etc.), se registra aqui.",
        note: "Acciones registradas: LOGIN, LOGOUT, CREAR_RECLAMO, RESPONDER, CAMBIAR_ESTADO, ASIGNAR, EXPORTAR, CONFIGURAR, CREAR_USUARIO, CREAR_CHATBOT, CAMBIAR_PLAN, etc.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del evento." },
          { name: "usuario_id", type: "UUID (FK)", required: "Si", description: "Usuario que realizo la accion." },
          { name: "accion", type: "STRING", required: "Si", description: "Tipo de accion: LOGIN, RESPONDER, CREAR_USUARIO, etc." },
          { name: "entidad", type: "STRING", required: "Si", description: "Entidad afectada: RECLAMO, USUARIO, CONFIG, SEDE, CHATBOT, etc." },
          { name: "entidad_id", type: "STRING", required: "No", description: "ID de la entidad afectada." },
          { name: "detalles", type: "JSONB", required: "No", description: "Detalles adicionales en formato JSON." },
          { name: "ip_address", type: "STRING", required: "No", description: "IP desde donde se realizo la accion." },
          { name: "fecha", type: "TIMESTAMP", required: "Si", description: "Fecha y hora de la accion." },
        ]
      }
    ]
  },

  // ---- MODULE 8: ASISTENTE IA ----
  {
    title: "8. Asistente IA Interno",
    description: "Asistente de inteligencia artificial integrado en el panel de administracion. Los usuarios admin pueden chatear con el asistente para obtener ayuda, analizar datos y generar respuestas. Las conversaciones se eliminan automaticamente despues de 7 dias.",
    tables: [
      {
        name: "asistente_conversaciones",
        desc: "Cada fila es una sesion de chat entre un usuario admin y el asistente IA. Se auto-eliminan despues de 7 dias.",
        note: "Limites: maximo 10 conversaciones por usuario (se borra la mas vieja al crear la 11va) y 50 mensajes por conversacion.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la conversacion." },
          { name: "usuario_id", type: "UUID (FK)", required: "Si", description: "Usuario que inicio la conversacion." },
          { name: "titulo", type: "STRING", required: "Si", description: "Titulo de la conversacion (auto-generado del primer mensaje)." },
          { name: "activa", type: "BOOL", required: "Si", description: "La conversacion sigue activa?" },
          { name: "total_mensajes", type: "INT", required: "Si", description: "Cantidad total de mensajes en la conversacion." },
          { name: "total_tokens_prompt", type: "INT", required: "Si", description: "Total de tokens de entrada consumidos." },
          { name: "total_tokens_output", type: "INT", required: "Si", description: "Total de tokens de salida generados." },
          { name: "proveedor_ia", type: "STRING", required: "No", description: "Proveedor de IA usado: ollama/llama3.1, anthropic, etc." },
          { name: "fecha_expiracion", type: "TIMESTAMP", required: "Si", description: "Fecha de auto-eliminacion (7 dias desde creacion)." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima actividad en la conversacion." },
        ]
      },
      {
        name: "asistente_mensajes",
        desc: "Mensajes individuales de cada conversacion con el asistente IA. Se eliminan en cascada cuando se borra la conversacion padre.",
        note: "Roles: USER (mensaje del usuario admin) o ASSISTANT (respuesta de la IA).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del mensaje." },
          { name: "conversacion_id", type: "UUID (FK)", required: "Si", description: "Conversacion a la que pertenece." },
          { name: "rol", type: "STRING", required: "Si", description: "Quien envio el mensaje: USER o ASSISTANT." },
          { name: "contenido", type: "STRING", required: "Si", description: "Texto del mensaje." },
          { name: "tokens_prompt", type: "INT", required: "No", description: "Tokens de entrada (solo para ASSISTANT)." },
          { name: "tokens_output", type: "INT", required: "No", description: "Tokens de salida (solo para ASSISTANT)." },
          { name: "proveedor", type: "STRING", required: "No", description: "Proveedor de IA usado para esta respuesta." },
          { name: "duracion_ms", type: "INT", required: "No", description: "Tiempo de respuesta en milisegundos." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha y hora del mensaje." },
        ]
      }
    ]
  },

  // ---- MODULE 9: WHATSAPP ----
  {
    title: "9. WhatsApp (Canales)",
    description: "Permite a las empresas conectar sus numeros de WhatsApp Business con la plataforma. Cuando un cliente escribe por WhatsApp, el sistema identifica automaticamente a que empresa pertenece el numero y procesa el mensaje.",
    tables: [
      {
        name: "canales_whatsapp",
        desc: "Mapeo entre numeros de telefono de WhatsApp Business y tenants. Cuando Meta envia un mensaje al webhook, el backend busca aqui que empresa debe atenderlo.",
        note: "En produccion, el access_token debe encriptarse con AES-256. El chatbot_id vincula al chatbot que define el prompt y modelo de IA para las respuestas automaticas.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa propietaria del canal." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del canal." },
          { name: "phone_number_id", type: "STRING", required: "Si", description: "ID del numero en la API de Meta. Unico globalmente." },
          { name: "display_phone", type: "STRING", required: "Si", description: "Numero visible: +51 999 888 777." },
          { name: "access_token", type: "STRING", required: "Si", description: "Token de acceso de Meta para enviar mensajes." },
          { name: "verify_token", type: "STRING", required: "Si", description: "Token de verificacion para el webhook de Meta." },
          { name: "nombre_canal", type: "STRING", required: "Si", description: "Nombre descriptivo: 'WhatsApp Principal'." },
          { name: "chatbot_id", type: "UUID (FK)", required: "No", description: "Chatbot vinculado para respuestas automaticas. NULL = sin IA." },
          { name: "activo", type: "BOOL", required: "Si", description: "El canal esta activo?" },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      }
    ]
  },

  // ---- MODULE 10: ATENCION EN VIVO ----
  {
    title: "10. Atencion en Vivo (Chat Humano)",
    description: "Cuando un cliente solicita hablar con un asesor humano (por ejemplo, escribiendo 'asesor' en WhatsApp), se crea una solicitud que aparece en el panel. El asesor toma la solicitud y se comunica con el cliente en tiempo real a traves de WhatsApp.",
    tables: [
      {
        name: "solicitudes_asesor",
        desc: "Cada fila es una solicitud de atencion humana. El bot de WhatsApp la crea cuando detecta que el cliente quiere hablar con una persona. Los asesores las gestionan desde el panel.",
        note: "Flujo: PENDIENTE (llega la solicitud) -> EN_ATENCION (un asesor la toma) -> RESUELTO/CANCELADO (finaliza).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la solicitud." },
          { name: "nombre", type: "STRING", required: "Si", description: "Nombre del cliente que solicita atencion." },
          { name: "telefono", type: "STRING", required: "Si", description: "Telefono del cliente (numero de WhatsApp)." },
          { name: "motivo", type: "STRING", required: "Si", description: "Motivo por el que solicita hablar con un asesor." },
          { name: "canal_origen", type: "STRING", required: "Si", description: "Canal de origen: WHATSAPP, WEB, TELEFONO." },
          { name: "canal_whatsapp_id", type: "UUID (FK)", required: "No", description: "Canal de WhatsApp por el que llego la solicitud." },
          { name: "estado", type: "STRING", required: "Si", description: "Estado: PENDIENTE, EN_ATENCION, RESUELTO, CANCELADO." },
          { name: "prioridad", type: "STRING", required: "Si", description: "Prioridad: BAJA, NORMAL, ALTA, URGENTE." },
          { name: "asignado_a", type: "UUID (FK)", required: "No", description: "ID del asesor que tomo la solicitud." },
          { name: "fecha_asignacion", type: "TIMESTAMP", required: "No", description: "Cuando el asesor tomo la solicitud." },
          { name: "fecha_resolucion", type: "TIMESTAMP", required: "No", description: "Cuando se resolvio o cancelo." },
          { name: "nota_interna", type: "STRING", required: "Si", description: "Notas internas del asesor (no visibles para el cliente)." },
          { name: "resumen_conversacion", type: "STRING", required: "Si", description: "Resumen de la conversacion con el bot antes de escalar al asesor." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion de la solicitud." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      },
      {
        name: "mensajes_atencion",
        desc: "Mensajes del chat en vivo entre el asesor y el cliente durante una solicitud de atencion. Los mensajes del asesor se envian automaticamente por WhatsApp al cliente.",
        note: "Remitentes: CLIENTE (mensaje entrante por WhatsApp), ASESOR (mensaje saliente desde el panel), SISTEMA (mensajes automaticos como handoff o cierre).",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico del mensaje." },
          { name: "solicitud_id", type: "UUID (FK)", required: "Si", description: "Solicitud de atencion a la que pertenece." },
          { name: "remitente", type: "STRING", required: "Si", description: "Quien envio el mensaje: CLIENTE, ASESOR, SISTEMA." },
          { name: "contenido", type: "STRING", required: "Si", description: "Texto del mensaje." },
          { name: "asesor_id", type: "UUID (FK)", required: "No", description: "ID del asesor (solo para mensajes de tipo ASESOR)." },
          { name: "fecha_envio", type: "TIMESTAMP", required: "Si", description: "Fecha y hora del mensaje." },
        ]
      }
    ]
  },

  // ---- MODULE 11: NOTIFICACIONES ----
  {
    title: "11. Notificaciones",
    description: "Sistema de notificaciones en tiempo real para los usuarios del panel. Las notificaciones se envian via WebSocket y se almacenan para consulta posterior. Se eliminan automaticamente despues de 90 dias.",
    tables: [
      {
        name: "notificaciones",
        desc: "Cada fila es una notificacion enviada a un usuario del panel. Se muestran en la campana de notificaciones y se envian en tiempo real via WebSocket.",
        note: "Se eliminan automaticamente despues de 90 dias (TTL de CockroachDB). Soporte para paginacion cursor-based.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la notificacion." },
          { name: "usuario_destino_id", type: "UUID (FK)", required: "Si", description: "Usuario que recibe la notificacion." },
          { name: "tipo", type: "STRING", required: "Si", description: "Tipo de notificacion (para filtrar y agrupar)." },
          { name: "titulo", type: "STRING", required: "Si", description: "Titulo corto de la notificacion." },
          { name: "contenido", type: "STRING", required: "Si", description: "Detalle de la notificacion." },
          { name: "datos_extra", type: "JSONB", required: "No", description: "Datos adicionales en JSON (URLs, IDs, etc.)." },
          { name: "leida", type: "BOOL", required: "Si", description: "El usuario ya leyo esta notificacion?" },
          { name: "fecha_lectura", type: "TIMESTAMP", required: "No", description: "Cuando se marco como leida." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion." },
          { name: "fecha_expiracion", type: "TIMESTAMP", required: "Si", description: "Fecha de auto-eliminacion (90 dias)." },
        ]
      },
      {
        name: "configuracion_notificaciones_rol",
        desc: "Controla que tipos de notificacion recibe cada rol. Si no hay registro para un tipo, se considera habilitado por defecto.",
        note: "Se elimina en cascada al borrar el rol asociado.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico." },
          { name: "rol_id", type: "UUID (FK)", required: "Si", description: "Rol al que aplica la configuracion." },
          { name: "tipo_notificacion", type: "STRING", required: "Si", description: "Tipo de notificacion a configurar." },
          { name: "habilitado", type: "BOOL", required: "Si", description: "Este tipo de notificacion esta activo para este rol?" },
        ]
      }
    ]
  },

  // ---- MODULE 12: PLANTILLAS EMAIL ----
  {
    title: "12. Plantillas de Email",
    description: "Plantillas de correo electronico personalizables por empresa. Definen el asunto y cuerpo HTML de las notificaciones automaticas que se envian a clientes y a la empresa cuando ocurren eventos con los reclamos.",
    tables: [
      {
        name: "plantillas_email",
        desc: "Cada empresa tiene 5 plantillas predefinidas (una por tipo de evento). El admin puede editar el asunto, cuerpo HTML y activar/desactivar cada una.",
        note: "Tipos de evento: confirmacion_reclamo, nuevo_reclamo_empresa, cambio_estado, resolucion, nuevo_mensaje. Variables soportadas: {{nombre}}, {{codigo}}, {{tipo}}, {{estado}}, {{fecha}}, {{empresa}}, {{sede}}, {{mensaje}}.",
        columns: [
          { name: "tenant_id", type: "UUID", required: "Si", description: "Empresa." },
          { name: "id", type: "UUID", required: "Si", description: "Identificador unico de la plantilla." },
          { name: "tipo_evento", type: "STRING", required: "Si", description: "Tipo de evento: confirmacion_reclamo, nuevo_reclamo_empresa, cambio_estado, resolucion, nuevo_mensaje." },
          { name: "asunto", type: "STRING", required: "Si", description: "Asunto del email. Soporta variables como {{nombre}} y {{codigo}}." },
          { name: "cuerpo_html", type: "STRING", required: "Si", description: "Cuerpo del email en HTML. Soporta las mismas variables." },
          { name: "activa", type: "BOOL", required: "Si", description: "La plantilla esta activa? Si es false, el email no se envia." },
          { name: "fecha_creacion", type: "TIMESTAMP", required: "Si", description: "Fecha de creacion." },
          { name: "fecha_actualizacion", type: "TIMESTAMP", required: "Si", description: "Ultima modificacion." },
        ]
      }
    ]
  },
];

// ============================================================
// BUILD DOCUMENT
// ============================================================
const children = [];

// Cover / Title
children.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "LIBRO DE RECLAMACIONES SaaS", font: "Arial", size: 40, bold: true, color: COLORS.primary })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "Documentacion de Base de Datos", font: "Arial", size: 32, color: COLORS.accent })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 400 },
  children: [new TextRun({ text: "Guia completa de tablas organizadas por modulos funcionales", font: "Arial", size: 22, color: COLORS.muted })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "Motor de base de datos: CockroachDB", font: "Arial", size: 20, color: COLORS.text })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "Arquitectura: Multi-tenant con aislamiento logico (tenant_id)", font: "Arial", size: 20, color: COLORS.text })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "Normativa: D.S. 011-2011-PCM / Ley N 29571 (INDECOPI)", font: "Arial", size: 20, color: COLORS.text })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}`, font: "Arial", size: 20, color: COLORS.muted })]
}));

// Page break
children.push(new Paragraph({ children: [new PageBreak()] }));

// TOC
children.push(new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 200, after: 300 },
  children: [new TextRun({ text: "Tabla de Contenidos", font: "Arial", size: 28, bold: true, color: COLORS.primary })]
}));
children.push(new TableOfContents("Tabla de Contenidos", { hyperlink: true, headingStyleRange: "1-2" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// Intro section
children.push(sectionTitle("Introduccion"));
children.push(desc("Este documento describe todas las tablas de la base de datos del sistema Libro de Reclamaciones SaaS. Esta organizado por modulos funcionales para facilitar su comprension."));
children.push(spacer());
children.push(desc("Conceptos clave:"));
children.push(desc("- Tenant: Cada empresa cliente que usa la plataforma. Todos los datos estan aislados por tenant_id."));
children.push(desc("- UUID: Identificador unico universal. Se genera automaticamente y nunca se repite."));
children.push(desc("- FK (Foreign Key): Referencia a otra tabla. Garantiza que los datos estan relacionados correctamente."));
children.push(desc("- JSONB: Dato flexible en formato JSON (como un mini-documento dentro de una columna)."));
children.push(desc("- TTL: Tiempo de vida. Las filas se eliminan automaticamente despues de cierto tiempo."));
children.push(desc("- Soft Delete: En vez de borrar fisicamente, se marca con una fecha de eliminacion (deleted_at)."));
children.push(spacer());
children.push(desc("La base de datos tiene 23 tablas + 4 vistas, organizadas en 12 modulos funcionales. Todas las tablas (excepto 'planes') usan clave primaria compuesta (tenant_id, id) para garantizar el aislamiento de datos entre empresas."));
children.push(new Paragraph({ children: [new PageBreak()] }));

// Modules
modules.forEach(mod => {
  children.push(sectionTitle(mod.title));
  children.push(desc(mod.description));
  children.push(spacer());

  mod.tables.forEach(table => {
    children.push(tableTitle(`Tabla: ${table.name}`));
    children.push(desc(table.desc));
    if (table.note) {
      children.push(note(table.note));
    }
    children.push(spacer());
    children.push(columnTable(table.columns));
    children.push(spacer());
    children.push(spacer());
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));
});

// Views section
children.push(sectionTitle("13. Vistas (Views)"));
children.push(desc("Las vistas son consultas predefinidas que combinan datos de varias tablas para facilitar el trabajo del backend. No almacenan datos propios, solo son 'atajos' para consultas frecuentes."));
children.push(spacer());

children.push(tableTitle("Vista: v_dashboard_reclamos"));
children.push(desc("Metricas resumidas de reclamos por empresa y sede. Se usa para alimentar el dashboard del panel con datos como: total de reclamos, pendientes, resueltos, vencidos, promedio de dias de resolucion, reclamos de los ultimos 7 dias y del mes actual."));
children.push(spacer());

children.push(tableTitle("Vista: v_reclamos_pendientes"));
children.push(desc("Lista de reclamos pendientes con su prioridad calculada. Clasifica automaticamente cada reclamo como VENCIDO (paso la fecha limite), URGENTE (quedan 3 dias o menos) o NORMAL."));
children.push(spacer());

children.push(tableTitle("Vista: v_detalle_reclamo"));
children.push(desc("Detalle completo de un reclamo con toda su informacion: datos del consumidor, proveedor, sede, detalle, respuestas, admin asignado y prioridad calculada. Une datos de reclamos, usuarios_admin y respuestas."));
children.push(spacer());

children.push(tableTitle("Vista: v_uso_tenant"));
children.push(desc("Uso actual del tenant vs limites del plan. El backend la consulta ANTES de crear sedes, usuarios, chatbots o reclamos para verificar que no se excedan los limites del plan contratado. Muestra los limites efectivos (considerando overrides) y el uso actual."));
children.push(spacer());

// Final page
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(sectionTitle("Resumen"));

const summaryData = [
  ["Modulo", "Tablas", "Descripcion"],
  ["Planes y Suscripciones", "planes, suscripciones", "Catalogo de planes y suscripcion activa por empresa"],
  ["Configuracion Tenant", "configuracion_tenant", "Datos legales, branding y configuracion de cada empresa"],
  ["Sedes", "sedes", "Establecimientos fisicos (obligatorio por ley)"],
  ["Usuarios y Roles", "usuarios_admin, roles_tenant", "Usuarios del panel y permisos personalizables"],
  ["Reclamos y Quejas", "reclamos, respuestas, historial_reclamos, mensajes_seguimiento", "Reclamos, respuestas, trazabilidad y chat de seguimiento"],
  ["Chatbots e IA", "chatbots, chatbot_api_keys, chatbot_logs", "Configuracion de chatbots, API keys y logs"],
  ["Sesiones y Auditoria", "sesiones_admin, auditoria_admin", "Control de sesiones y log inmutable de acciones"],
  ["Asistente IA", "asistente_conversaciones, asistente_mensajes", "Chat con IA interno del panel (TTL 7 dias)"],
  ["WhatsApp", "canales_whatsapp", "Canales de WhatsApp Business multi-tenant"],
  ["Atencion en Vivo", "solicitudes_asesor, mensajes_atencion", "Chat humano asesor-cliente via WhatsApp"],
  ["Notificaciones", "notificaciones, configuracion_notificaciones_rol", "Notificaciones en tiempo real (TTL 90 dias)"],
  ["Plantillas Email", "plantillas_email", "Emails personalizables por tipo de evento"],
];

const summaryColWidths = [3000, 4500, 6180];
const summaryRows = [];
summaryRows.push(new TableRow({ children: [
  headerCell("Modulo", summaryColWidths[0]),
  headerCell("Tablas", summaryColWidths[1]),
  headerCell("Descripcion", summaryColWidths[2]),
]}));
for (let i = 1; i < summaryData.length; i++) {
  summaryRows.push(makeTableRow([
    { text: summaryData[i][0], width: summaryColWidths[0], bold: true },
    { text: summaryData[i][1], width: summaryColWidths[1] },
    { text: summaryData[i][2], width: summaryColWidths[2] },
  ], i % 2 === 0));
}
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: summaryColWidths,
  rows: summaryRows,
}));

children.push(spacer());
children.push(desc("Total: 23 tablas + 4 vistas, organizadas en 12 modulos funcionales."));

// ============================================================
// CREATE DOC
// ============================================================
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: COLORS.primary },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: COLORS.accent },
        paragraph: { spacing: { before: 300, after: 100 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: {
          width: 12240,
          height: 15840,
          orientation: "landscape",
        },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Libro de Reclamaciones SaaS - Documentacion de Base de Datos", font: "Arial", size: 16, color: COLORS.muted })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Pagina ", font: "Arial", size: 16, color: COLORS.muted }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: COLORS.muted }),
          ]
        })]
      })
    },
    children,
  }]
});

// ============================================================
// SAVE
// ============================================================
const outputPath = process.argv[2] || "docs/Documentacion_Base_de_Datos_LibroReclamaciones.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Documento generado: ${outputPath}`);
  console.log(`Tamanio: ${(buffer.length / 1024).toFixed(1)} KB`);
});
