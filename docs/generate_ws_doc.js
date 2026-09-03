const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const C = {
  primary: "1A56DB", accent: "2563EB", text: "1F2937", muted: "6B7280",
  headerBg: "1A56DB", headerText: "FFFFFF", altRow: "F3F6FC", border: "D1D5DB",
  greenBg: "ECFDF5", greenText: "065F46", orangeBg: "FFF7ED", orangeText: "9A3412",
  blueBg: "EFF6FF", blueText: "1E40AF", purpleBg: "F5F3FF", purpleText: "5B21B6",
};

const PAGE_WIDTH = 15840;
const MARGIN = 1080;
const W = PAGE_WIDTH - 2 * MARGIN;

const border = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const borders = { top: border, bottom: border, left: border, right: border };
const pad = { top: 60, bottom: 60, left: 120, right: 120 };

// Helpers
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 },
  children: [new TextRun({ text: t, font: "Arial", size: 28, bold: true, color: C.primary })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 },
  children: [new TextRun({ text: t, font: "Arial", size: 24, bold: true, color: C.accent })] });
const h3 = (t) => new Paragraph({ spacing: { before: 200, after: 80 },
  children: [new TextRun({ text: t, font: "Arial", size: 22, bold: true, color: C.text })] });
const p = (t) => new Paragraph({ spacing: { before: 60, after: 80 },
  children: [new TextRun({ text: t, font: "Arial", size: 19, color: C.text })] });
const pBold = (label, t) => new Paragraph({ spacing: { before: 60, after: 80 },
  children: [new TextRun({ text: label, font: "Arial", size: 19, bold: true, color: C.text }), new TextRun({ text: t, font: "Arial", size: 19, color: C.text })] });
const note = (t) => new Paragraph({ spacing: { before: 40, after: 80 },
  children: [new TextRun({ text: t, font: "Arial", size: 17, italics: true, color: C.muted })] });
const sp = () => new Paragraph({ spacing: { before: 80, after: 80 }, children: [] });
const pb = () => new Paragraph({ children: [new PageBreak()] });

function infoBox(bgColor, textColor, icon, text) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      borders, width: { size: W, type: WidthType.DXA },
      shading: { fill: bgColor, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
      children: [new Paragraph({ children: [new TextRun({ text: `${icon} ${text}`, font: "Arial", size: 19, color: textColor })] })]
    })]})]
  });
}

function codeBlock(lines) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      borders, width: { size: W, type: WidthType.DXA },
      shading: { fill: "F8FAFC", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: lines.map(l => new Paragraph({ spacing: { before: 20, after: 20 },
        children: [new TextRun({ text: l, font: "Consolas", size: 16, color: "334155" })] }))
    })]})]
  });
}

function headerCell(text, width) {
  return new TableCell({ borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: C.headerBg, type: ShadingType.CLEAR }, margins: pad,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: "Arial", size: 18, color: C.headerText })] })] });
}
function dataCell(text, width, shaded, bold) {
  return new TableCell({ borders, width: { size: width, type: WidthType.DXA },
    shading: shaded ? { fill: C.altRow, type: ShadingType.CLEAR } : undefined, margins: pad,
    children: [new Paragraph({ children: [new TextRun({ text: text||"", font: "Arial", size: 17, color: C.text, bold })] })] });
}

// ============================================================
// DOCUMENT CONTENT
// ============================================================
const children = [];

// COVER
children.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "LIBRO DE RECLAMACIONES SaaS", font: "Arial", size: 40, bold: true, color: C.primary })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
  children: [new TextRun({ text: "Arquitectura WebSocket", font: "Arial", size: 34, color: C.accent })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
  children: [new TextRun({ text: "Documentacion Tecnica - Como funciona el tiempo real", font: "Arial", size: 22, color: C.muted })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
  children: [new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}`, font: "Arial", size: 20, color: C.muted })] }));
children.push(pb());

// ============================================================
// 1. QUE ES WEBSOCKET Y POR QUE LO USAMOS
// ============================================================
children.push(h1("1. Que es WebSocket y por que lo usamos"));
children.push(sp());
children.push(p("En una aplicacion web normal (HTTP), el navegador tiene que PREGUNTAR al servidor cada vez que quiere saber si hay algo nuevo. Esto se llama 'polling' y es como estar llamando por telefono cada 5 segundos para preguntar 'hay algo nuevo?'. Es ineficiente y lento."));
children.push(sp());
children.push(p("WebSocket resuelve esto: abre un CANAL PERMANENTE entre el navegador y el servidor. Una vez conectado, el servidor puede ENVIAR datos al navegador en el momento exacto en que ocurren, sin que el navegador tenga que preguntar."));
children.push(sp());
children.push(infoBox(C.blueBg, C.blueText, "EJEMPLO:", "Un asesor responde un reclamo desde el panel. En ese MISMO instante, el cliente que esta mirando su reclamo en la web ve el nuevo mensaje aparecer automaticamente. No tuvo que recargar la pagina."));
children.push(sp());
children.push(h3("Para que usamos WebSocket en nuestro sistema:"));
children.push(p("1. Notificaciones en tiempo real: cuando llega un reclamo nuevo, todos los asesores ven la campanita actualizada al instante."));
children.push(p("2. Chat en vivo (Atencion en Vivo): los mensajes entre asesor y cliente por WhatsApp aparecen en tiempo real en el panel."));
children.push(p("3. Mensajes de seguimiento: cuando la empresa responde un reclamo, el cliente lo ve al instante sin recargar."));
children.push(p("4. Seguimiento publico: el consumidor que consulta su reclamo por codigo recibe actualizaciones en vivo."));
children.push(pb());

// ============================================================
// 2. VISION GENERAL - COMO FUNCIONA
// ============================================================
children.push(h1("2. Vision general: como funciona todo junto"));
children.push(sp());
children.push(p("El sistema tiene 3 capas principales que trabajan juntas:"));
children.push(sp());

// Diagram as table
const diagramRows = [
  new TableRow({ children: [
    new TableCell({ borders, width: { size: 4560, type: WidthType.DXA }, shading: { fill: C.blueBg, type: ShadingType.CLEAR }, margins: pad,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "FRONTEND (React)", font: "Arial", size: 20, bold: true, color: C.blueText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Navegador del usuario", font: "Arial", size: 17, color: C.blueText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Se conecta por WebSocket", font: "Arial", size: 17, color: C.blueText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Escucha eventos y reacciona", font: "Arial", size: 17, color: C.blueText })] }),
      ] }),
    new TableCell({ borders, width: { size: 4560, type: WidthType.DXA }, shading: { fill: C.greenBg, type: ShadingType.CLEAR }, margins: pad,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CONCENTRADOR (Hub)", font: "Arial", size: 20, bold: true, color: C.greenText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Centro de control", font: "Arial", size: 17, color: C.greenText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Gestiona TODAS las conexiones", font: "Arial", size: 17, color: C.greenText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Enruta mensajes a quien corresponde", font: "Arial", size: 17, color: C.greenText })] }),
      ] }),
    new TableCell({ borders, width: { size: 4560, type: WidthType.DXA }, shading: { fill: C.orangeBg, type: ShadingType.CLEAR }, margins: pad,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SERVICIOS (Backend)", font: "Arial", size: 20, bold: true, color: C.orangeText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Logica de negocio", font: "Arial", size: 17, color: C.orangeText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "Cuando algo pasa (reclamo,", font: "Arial", size: 17, color: C.orangeText })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: "mensaje, etc.) avisa al Hub", font: "Arial", size: 17, color: C.orangeText })] }),
      ] }),
  ] })
];
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [4560, 4560, 4560], rows: diagramRows }));
children.push(sp());

children.push(h3("Flujo paso a paso (ejemplo: nuevo reclamo):"));
children.push(p("1. Un consumidor registra un reclamo desde el formulario publico (HTTP POST normal)."));
children.push(p("2. El ReclamoService guarda el reclamo en la base de datos."));
children.push(p("3. Inmediatamente despues, el ReclamoService le dice al NotificacionTiempoRealService: 'oye, hay un reclamo nuevo'."));
children.push(p("4. El NotificacionTiempoRealService guarda una notificacion en la DB para cada asesor y le pide al Concentrador que la envie."));
children.push(p("5. El Concentrador busca que asesores de esa empresa estan conectados por WebSocket y les envia el evento al instante."));
children.push(p("6. El frontend (React) del asesor recibe el evento y actualiza la campanita de notificaciones sin recargar la pagina."));
children.push(pb());

// ============================================================
// 3. MAPA DE ARCHIVOS
// ============================================================
children.push(h1("3. Mapa de archivos: donde esta cada cosa"));
children.push(sp());
children.push(p("Todos los archivos de WebSocket estan organizados en dos carpetas principales:"));
children.push(sp());

// Backend files table
children.push(h3("Backend (Go) - 5 archivos principales + 1 servicio"));
const beColW = [5500, 8180];
const beFiles = [
  ["backend/internal/websocket/\nconcentrador_conexiones.go", "EL CEREBRO. Gestiona TODAS las conexiones activas. Sabe que usuarios estan conectados, en que salas estan, y se encarga de enviar los mensajes al destinatario correcto. Es como una central telefonica: recibe llamadas y las enruta."],
  ["backend/internal/websocket/\nconexion_websocket.go", "Representa UNA conexion individual. Cada usuario que abre el panel tiene su propia ConexionWebSocket. Este archivo maneja el envio de mensajes (BombaEscritura), la deteccion de desconexiones (BombaLectura), y el ping/pong para mantener la conexion viva."],
  ["backend/internal/websocket/\nmensaje_evento_websocket.go", "Define los TIPOS de eventos que viajan por WebSocket. Cada evento tiene un nombre (ej: RECLAMO_NUEVO_REGISTRADO) y una estructura de datos especifica. Es como un catalogo de todos los mensajes posibles."],
  ["backend/internal/websocket/\nregistrador_rutas_websocket.go", "Registra los 5 endpoints WebSocket en el servidor. Cuando el frontend quiere conectarse, llega a una de estas rutas. Aqui se valida el JWT, se crea la conexion y se asigna a la sala correcta."],
  ["backend/internal/websocket/\nautenticador_conexion_websocket.go", "Seguridad. Valida que quien se conecta por WebSocket sea quien dice ser. Para admins: valida el token JWT y extrae tenant_id + usuario_id. Para publico: verifica que el codigo de reclamo exista en la base de datos."],
  ["backend/internal/service/\nnotificacion_tiempo_real_service.go", "EL PUENTE entre la logica de negocio y el WebSocket. Cuando cualquier servicio necesita enviar algo en tiempo real, usa este servicio. El se encarga de: crear la notificacion en la DB, buscar los destinatarios correctos, y pedir al Concentrador que la envie."],
];

const beRows = [new TableRow({ children: [headerCell("Archivo", beColW[0]), headerCell("Que hace (en simple)", beColW[1])] })];
beFiles.forEach((f, i) => {
  beRows.push(new TableRow({ children: [
    new TableCell({ borders, width: { size: beColW[0], type: WidthType.DXA }, margins: pad,
      shading: i%2===1 ? { fill: C.altRow, type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: f[0], font: "Consolas", size: 16, bold: true, color: C.accent })] })] }),
    dataCell(f[1], beColW[1], i%2===1)
  ] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: beColW, rows: beRows }));
children.push(sp());

// Frontend files table
children.push(h3("Frontend (React/TypeScript) - 3 archivos de infraestructura"));
const feFiles = [
  ["frontend/src/infraestructura/websocket/\nconcentrador-websocket.ts", "Cliente WebSocket inteligente. Se conecta al servidor, y si se desconecta (por internet inestable, pestana inactiva, etc.), se RECONECTA SOLO automaticamente con espera progresiva (1s, 2s, 4s, 8s... hasta 30s max). Tambien envia 'ping' cada 30 segundos para que el servidor sepa que sigue ahi."],
  ["frontend/src/infraestructura/websocket/\nusarConexionWebSocket.ts", "Hooks de React que los componentes usan para conectarse. Hay uno por cada tipo de conexion: notificaciones, atencion en vivo, mensajes de reclamo, y seguimiento publico. Cada hook maneja la conexion/desconexion automaticamente cuando el componente se monta/desmonta."],
  ["frontend/src/infraestructura/websocket/\ntipos-evento-websocket.ts", "Define los tipos de eventos en TypeScript (espejo del backend). Asegura que frontend y backend hablen el mismo idioma."],
];

const feRows = [new TableRow({ children: [headerCell("Archivo", beColW[0]), headerCell("Que hace (en simple)", beColW[1])] })];
feFiles.forEach((f, i) => {
  feRows.push(new TableRow({ children: [
    new TableCell({ borders, width: { size: beColW[0], type: WidthType.DXA }, margins: pad,
      shading: i%2===1 ? { fill: C.altRow, type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: f[0], font: "Consolas", size: 16, bold: true, color: C.accent })] })] }),
    dataCell(f[1], beColW[1], i%2===1)
  ] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: beColW, rows: feRows }));
children.push(sp());

children.push(h3("Componentes que USAN WebSocket"));
const compFiles = [
  ["CampanaNotificaciones.tsx", "La campanita de notificaciones del header. Se conecta al WS de notificaciones y actualiza el contador en tiempo real."],
  ["ChatAtencion.tsx", "El chat en vivo entre asesor y cliente. Usa el WS de atencion-vivo para recibir mensajes al instante."],
  ["PaginaDetalleReclamo.tsx", "Detalle de un reclamo. Usa WS para recibir nuevos mensajes de seguimiento sin recargar."],
  ["PaginaSeguimiento.tsx", "Pagina publica donde el consumidor consulta su reclamo. Usa WS publico para ver cambios de estado en vivo."],
];
const compRows = [new TableRow({ children: [headerCell("Componente React", 4000), headerCell("Para que usa WebSocket", 9680)] })];
compFiles.forEach((f, i) => {
  compRows.push(new TableRow({ children: [dataCell(f[0], 4000, i%2===1, true), dataCell(f[1], 9680, i%2===1)] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [4000, 9680], rows: compRows }));
children.push(pb());

// ============================================================
// 4. EL CONCENTRADOR - EXPLICACION DETALLADA
// ============================================================
children.push(h1("4. El Concentrador: el cerebro del sistema"));
children.push(sp());
children.push(p("El ConcentradorConexiones es el componente mas importante. Piensa en el como el SWITCH de una red: todos se conectan a el y el decide a quien enviar cada mensaje."));
children.push(sp());

children.push(h3("Como organiza las conexiones"));
children.push(p("El Concentrador mantiene dos 'mapas' (diccionarios) en memoria:"));
children.push(sp());
children.push(pBold("1. conexionesPorTenant: ", "Agrupa las conexiones por empresa. Si la empresa 'Polleria Rey' tiene 3 asesores conectados, hay 3 conexiones bajo el tenant_id de esa empresa. Esto permite enviar un mensaje a TODOS los asesores de una empresa."));
children.push(sp());
children.push(pBold("2. conexionesPorSala: ", "Agrupa las conexiones por 'sala' (room). Una sala es un grupo temporal. Ejemplo: cuando un asesor abre el chat de la solicitud #123, se une a la sala 'atencion-vivo:tenant:123'. Asi, los mensajes de esa solicitud solo llegan a quien esta mirando ese chat."));
children.push(sp());

children.push(h3("Tipos de envio (difusion)"));
children.push(sp());
const envioRows = [new TableRow({ children: [headerCell("Tipo", 3200), headerCell("A quien llega", 4500), headerCell("Ejemplo real", 5980)] })];
const envios = [
  ["DifundirATenant", "A TODOS los usuarios conectados de una empresa", "Llega un reclamo nuevo -> todos los asesores de esa empresa reciben la notificacion"],
  ["DifundirASala", "Solo a los usuarios que estan en una sala especifica", "Un cliente escribe en el chat de atencion -> solo el asesor que tiene abierto ese chat lo recibe"],
  ["DifundirAUsuario", "A UN usuario especifico de una empresa", "Una notificacion personal (ej: te asignaron un reclamo) -> solo llega a ese asesor"],
];
envios.forEach((e, i) => {
  envioRows.push(new TableRow({ children: [dataCell(e[0], 3200, i%2===1, true), dataCell(e[1], 4500, i%2===1), dataCell(e[2], 5980, i%2===1)] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [3200, 4500, 5980], rows: envioRows }));
children.push(sp());

children.push(h3("El loop principal (Ejecutar)"));
children.push(p("El Concentrador corre en un bucle infinito esperando ordenes por canales (channels de Go). Cada canal es como un buzon de correo dedicado:"));
children.push(sp());
children.push(codeBlock([
  "Registrar        -> Un usuario nuevo se conecto",
  "Desregistrar     -> Un usuario se desconecto",
  "UnirseASala      -> Un usuario abrio un chat especifico",
  "SalirDeSala      -> Un usuario cerro un chat",
  "DifundirATenant  -> Enviar mensaje a toda la empresa",
  "DifundirASala    -> Enviar mensaje a un chat especifico",
  "DifundirAUsuario -> Enviar mensaje a un usuario especifico",
]));
children.push(sp());
children.push(infoBox(C.greenBg, C.greenText, "POR QUE ES SEGURO:", "El Concentrador usa un RWMutex (candado de lectura/escritura). Esto significa que multiples goroutines pueden LEER las conexiones al mismo tiempo, pero solo UNA puede ESCRIBIR (agregar o quitar conexiones) a la vez. Asi no hay conflictos aunque haya 1000 usuarios conectados."));
children.push(pb());

// ============================================================
// 5. CONEXION INDIVIDUAL
// ============================================================
children.push(h1("5. Cada conexion individual"));
children.push(sp());
children.push(p("Cada usuario conectado por WebSocket tiene su propio objeto ConexionWebSocket con:"));
children.push(sp());
children.push(pBold("ID: ", "Un identificador unico (UUID) para esta conexion."));
children.push(pBold("TenantID: ", "A que empresa pertenece este usuario."));
children.push(pBold("UsuarioID: ", "Que usuario es (extraido del JWT al conectarse)."));
children.push(pBold("Salas: ", "Lista de salas a las que esta unido."));
children.push(pBold("Enviar: ", "Un buzon (channel) donde se ponen los mensajes que hay que enviarle."));
children.push(sp());

children.push(h3("Las dos 'bombas' (goroutines que mantienen viva la conexion)"));
children.push(sp());
children.push(pBold("BombaEscritura: ", "Es un bucle que esta ESPERANDO mensajes en el buzon 'Enviar'. Cuando llega un mensaje, lo envia al navegador del usuario. Tambien envia un 'ping' cada 54 segundos para verificar que la conexion sigue viva. Si no puede enviar, cierra la conexion."));
children.push(sp());
children.push(pBold("BombaLectura: ", "Es un bucle que esta ESPERANDO mensajes del navegador. En nuestro sistema, el navegador casi nunca envia datos (solo ping/pong). El proposito principal es DETECTAR cuando el usuario se desconecta (cerro la pestana, se le fue el internet, etc.) para limpiarlo del Concentrador."));
children.push(sp());
children.push(infoBox(C.orangeBg, C.orangeText, "IMPORTANTE:", "Cada conexion tiene 2 goroutines (BombaEscritura + BombaLectura). Si hay 100 usuarios conectados, hay 200 goroutines activas. En Go esto es muy eficiente porque cada goroutine solo usa unos 4KB de memoria (vs 1MB de un thread en Java)."));
children.push(pb());

// ============================================================
// 6. ENDPOINTS WEBSOCKET
// ============================================================
children.push(h1("6. Los 5 endpoints WebSocket"));
children.push(sp());
children.push(p("El sistema expone 5 URLs de WebSocket. Cada una sirve para un proposito diferente:"));
children.push(sp());

const endpointColW = [4000, 2000, 7680];
const epRows = [new TableRow({ children: [headerCell("Endpoint (URL)", endpointColW[0]), headerCell("Autenticacion", endpointColW[1]), headerCell("Para que sirve", endpointColW[2])] })];
const endpoints = [
  ["/ws/notificaciones", "JWT (token)", "Canal principal del panel admin. Recibe: nuevos reclamos, cambios de estado, asignaciones, notificaciones de la campanita. Se conecta al abrir el panel y permanece abierto todo el tiempo."],
  ["/ws/atencion-vivo/:solicitudId", "JWT (token)", "Chat en vivo de una solicitud de atencion. Se conecta cuando el asesor abre el chat de una solicitud. Recibe mensajes del cliente en tiempo real."],
  ["/ws/reclamos/:reclamoId/mensajes", "JWT (token)", "Mensajes de seguimiento de un reclamo. Se conecta cuando se abre el detalle de un reclamo. Recibe nuevos mensajes del cliente sin recargar."],
  ["/ws/publico/seguimiento/:slug/:codigo", "Sin JWT (publico)", "Seguimiento publico de reclamo. El consumidor puede ver actualizaciones de su reclamo en tiempo real. Tiene rate limit: max 5 conexiones por IP. Auto-desconexion a los 30 minutos."],
  ["/ws/metricas", "JWT (token)", "Endpoint HTTP (no WebSocket) que retorna estadisticas: total de conexiones, salas activas, memoria usada, goroutines. Para monitoreo interno."],
];
endpoints.forEach((e, i) => {
  epRows.push(new TableRow({ children: [
    new TableCell({ borders, width: { size: endpointColW[0], type: WidthType.DXA }, margins: pad,
      shading: i%2===1 ? { fill: C.altRow, type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: e[0], font: "Consolas", size: 16, bold: true, color: C.accent })] })] }),
    dataCell(e[1], endpointColW[1], i%2===1),
    dataCell(e[2], endpointColW[2], i%2===1),
  ] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: endpointColW, rows: epRows }));
children.push(sp());

children.push(h3("Como se conecta el frontend a cada endpoint"));
children.push(sp());
children.push(codeBlock([
  "// Admin: el token JWT se pasa como query parameter",
  "ws://servidor/ws/notificaciones?token=eyJhbGciOiJIUzI1...",
  "",
  "// Publico: no necesita token, solo slug + codigo del reclamo",
  "ws://servidor/ws/publico/seguimiento/polleria-rey/REC-2026-00001",
]));
children.push(pb());

// ============================================================
// 7. EVENTOS
// ============================================================
children.push(h1("7. Catalogo de eventos (que mensajes viajan por WebSocket)"));
children.push(sp());
children.push(p("Cada mensaje WebSocket tiene esta estructura:"));
children.push(sp());
children.push(codeBlock([
  '{',
  '  "tipo": "RECLAMO_NUEVO_REGISTRADO",',
  '  "datos": { "reclamo_id": "abc-123", "codigo": "REC-2026-00001", ... },',
  '  "fecha_evento": "2026-03-16T10:30:00Z"',
  '}',
]));
children.push(sp());

const evColW = [5500, 3000, 5180];
const evRows = [new TableRow({ children: [headerCell("Evento", evColW[0]), headerCell("Se envia a", evColW[1]), headerCell("Cuando se dispara", evColW[2])] })];
const eventos = [
  ["SOLICITUD_ATENCION_NUEVA", "Todo el tenant", "Un cliente pide hablar con asesor por WhatsApp"],
  ["SOLICITUD_ATENCION_SIN_ATENDER", "Todo el tenant", "Pasan X minutos y nadie toma la solicitud"],
  ["MENSAJE_ATENCION_CLIENTE_RECIBIDO", "Sala del chat", "El cliente escribe un mensaje por WhatsApp durante atencion en vivo"],
  ["MENSAJE_ATENCION_ASESOR_ENVIADO", "Sala del chat", "El asesor envia un mensaje desde el panel"],
  ["RECLAMO_NUEVO_REGISTRADO", "Todo el tenant", "Un consumidor registra un reclamo o queja"],
  ["RECLAMO_ESTADO_CAMBIADO", "Todo el tenant + sala seguimiento", "Un asesor cambia el estado del reclamo (ej: Pendiente -> En Proceso)"],
  ["RECLAMO_RESUELTO_CON_RESPUESTA", "Todo el tenant + sala seguimiento", "La empresa responde y resuelve el reclamo"],
  ["RECLAMO_MENSAJE_CLIENTE_RECIBIDO", "Sala del reclamo", "El cliente envia un mensaje de seguimiento"],
  ["RECLAMO_MENSAJE_EMPRESA_ENVIADO", "Sala del reclamo + seguimiento", "La empresa responde un mensaje de seguimiento"],
  ["RECLAMO_ATENDIDO_POR_USUARIO", "Todo el tenant", "Un asesor se asigna un reclamo"],
  ["NOTIFICACION_NUEVA", "Usuario especifico", "Se crea una notificacion personalizada para un asesor"],
  ["CONTADOR_NOTIFICACIONES_ACTUALIZADO", "Usuario especifico", "Se actualiza el numero de notificaciones no leidas"],
  ["SEGUIMIENTO_ESTADO_ACTUALIZADO", "Sala seguimiento publico", "Cambia el estado de un reclamo (visible para el consumidor)"],
  ["SEGUIMIENTO_MENSAJE_NUEVO", "Sala seguimiento publico", "La empresa envia un mensaje visible para el consumidor"],
];
eventos.forEach((e, i) => {
  evRows.push(new TableRow({ children: [
    new TableCell({ borders, width: { size: evColW[0], type: WidthType.DXA }, margins: pad,
      shading: i%2===1 ? { fill: C.altRow, type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: e[0], font: "Consolas", size: 15, bold: true, color: C.text })] })] }),
    dataCell(e[1], evColW[1], i%2===1),
    dataCell(e[2], evColW[2], i%2===1),
  ] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: evColW, rows: evRows }));
children.push(pb());

// ============================================================
// 8. SEGURIDAD
// ============================================================
children.push(h1("8. Seguridad"));
children.push(sp());
children.push(p("El sistema WebSocket tiene multiples capas de seguridad:"));
children.push(sp());

children.push(pBold("1. Autenticacion JWT: ", "Los endpoints admin requieren un token JWT valido como query parameter. El autenticador extrae el tenant_id y usuario_id del token y los asocia a la conexion. Sin token valido, la conexion se rechaza con 401."));
children.push(sp());
children.push(pBold("2. Aislamiento por tenant: ", "Cada conexion pertenece a UN tenant. Un usuario de la empresa A NUNCA puede recibir datos de la empresa B. El Concentrador filtra por tenant_id al enviar mensajes."));
children.push(sp());
children.push(pBold("3. Rate limiting publico: ", "Las conexiones publicas (seguimiento de reclamo sin login) estan limitadas a maximo 5 conexiones simultaneas por IP. Esto previene abuso."));
children.push(sp());
children.push(pBold("4. Auto-desconexion: ", "Las conexiones publicas se desconectan automaticamente despues de 30 minutos para no desperdiciar recursos."));
children.push(sp());
children.push(pBold("5. Validacion de existencia: ", "Para el seguimiento publico, el sistema verifica en la base de datos que el codigo de reclamo exista antes de permitir la conexion WebSocket."));
children.push(sp());
children.push(pBold("6. Throttling de notificaciones: ", "El NotificacionTiempoRealService tiene un cooldown de 30 segundos por tipo+contexto. Si llegan 10 mensajes de seguimiento en 5 segundos, solo se envia 1 notificacion (no 10). Esto evita spam."));
children.push(pb());

// ============================================================
// 9. RECONEXION AUTOMATICA
// ============================================================
children.push(h1("9. Reconexion automatica (Frontend)"));
children.push(sp());
children.push(p("Internet no es perfecto. Las conexiones se caen. Nuestro cliente WebSocket en el frontend tiene un sistema inteligente de reconexion:"));
children.push(sp());

children.push(h3("Exponential Backoff con Jitter"));
children.push(p("Si se pierde la conexion, NO intenta reconectar inmediatamente (eso sobrecargaria el servidor). En cambio:"));
children.push(sp());
children.push(codeBlock([
  "Intento 1: espera ~1 segundo",
  "Intento 2: espera ~2 segundos",
  "Intento 3: espera ~4 segundos",
  "Intento 4: espera ~8 segundos",
  "Intento 5: espera ~16 segundos",
  "Intento 6+: espera 30 segundos (maximo)",
  "",
  "Total: maximo 15 intentos antes de rendirse",
  "",
  "El 'jitter' agrega un poco de aleatoriedad para que",
  "si 100 usuarios se desconectan al mismo tiempo, no",
  "intenten todos reconectar en el mismo milisegundo.",
]));
children.push(sp());

children.push(h3("Reconexion por visibilidad"));
children.push(p("Si el usuario cambia de pestana y vuelve, el sistema detecta que la pagina volvio a ser visible y reconecta inmediatamente. Esto es muy comun en el dia a dia: el asesor abre otra pestana, vuelve al panel, y la conexion se restablece sin que se de cuenta."));
children.push(sp());

children.push(h3("Ping/Pong (latido)"));
children.push(p("Cada 30 segundos, el frontend envia un 'ping' al servidor. El servidor responde con un 'pong'. Si el servidor no recibe pong en 60 segundos, cierra la conexion. Si el frontend no puede enviar el ping, sabe que perdio conexion e inicia la reconexion."));
children.push(pb());

// ============================================================
// 10. POR QUE ES ESCALABLE
// ============================================================
children.push(h1("10. Por que es escalable"));
children.push(sp());
children.push(p("La arquitectura WebSocket esta disenada para crecer sin problemas. Estas son las razones tecnicas:"));
children.push(sp());

children.push(h3("1. Goroutines de Go (no threads)"));
children.push(p("Cada conexion usa 2 goroutines (~8KB de memoria total). En Java, cada thread usa ~1MB. Esto significa que con 1GB de RAM podemos mantener ~125,000 conexiones simultaneas solo en goroutines, vs ~1,000 en Java."));
children.push(sp());

children.push(h3("2. Channels con buffer"));
children.push(p("Los canales del Concentrador tienen buffer (capacidad de 64-256 mensajes). Esto significa que si hay un pico de actividad, los mensajes se encolan en el buffer en vez de bloquear el sistema. Es como tener una fila de espera en un restaurante."));
children.push(sp());

children.push(h3("3. RWMutex (candado inteligente)"));
children.push(p("El Concentrador usa un candado de lectura/escritura. Multiples goroutines pueden LEER al mismo tiempo (enviar mensajes), pero solo UNA puede ESCRIBIR (agregar/quitar conexiones). Como la mayoria de operaciones son lecturas (enviar mensajes), el sistema casi nunca se bloquea."));
children.push(sp());

children.push(h3("4. Snapshot antes de difundir"));
children.push(p("Cuando el Concentrador necesita enviar un mensaje a una sala, primero toma un 'snapshot' (copia rapida) de las conexiones con el candado de lectura, lo suelta, y LUEGO envia los mensajes sin candado. Esto reduce el tiempo que el candado esta ocupado al minimo."));
children.push(sp());

children.push(h3("5. Envio no bloqueante"));
children.push(p("Al enviar un mensaje, si el buzon del usuario esta lleno (red lenta), el Concentrador NO se bloquea esperando. Simplemente desconecta a ese usuario lento para no afectar a los demas. Usa select/default de Go para esto."));
children.push(sp());

children.push(h3("6. Aislamiento por tenant"));
children.push(p("Los datos estan organizados por empresa (tenant). Si la empresa A tiene un pico de actividad, NO afecta a la empresa B. El Concentrador solo busca entre las conexiones de ese tenant, no entre TODAS las conexiones del sistema."));
children.push(sp());

children.push(h3("7. Limpieza automatica"));
children.push(p("Conexiones publicas se auto-desconectan a los 30 min. El cache de throttle se limpia cada 5 min. Las salas vacias se eliminan del mapa. No hay 'fugas de memoria' porque todo tiene un mecanismo de limpieza."));
children.push(sp());

children.push(infoBox(C.greenBg, C.greenText, "EN NUMEROS:", "Con un servidor modesto (2 vCPU, 4GB RAM), el sistema puede manejar facilmente 5,000+ conexiones simultaneas. Cada empresa promedio tiene 2-5 asesores conectados, lo que significa ~1,000 a 2,500 empresas atendidas con un solo servidor."));
children.push(pb());

// ============================================================
// 11. RESUMEN
// ============================================================
children.push(h1("11. Resumen ejecutivo"));
children.push(sp());

const resRows = [new TableRow({ children: [headerCell("Aspecto", 3500), headerCell("Detalle", 10180)] })];
const resumen = [
  ["Tecnologia", "WebSocket (protocolo estandar RFC 6455) sobre Go con gorilla/websocket + React"],
  ["Patron", "Hub centralizado (ConcentradorConexiones) con salas y canales de Go"],
  ["Endpoints", "5 rutas: notificaciones, atencion en vivo, mensajes reclamo, seguimiento publico, metricas"],
  ["Eventos", "14 tipos de eventos diferentes (reclamos, mensajes, notificaciones, seguimiento)"],
  ["Seguridad", "JWT para admin, validacion DB para publico, rate limiting por IP, aislamiento por tenant"],
  ["Reconexion", "Exponential backoff (1s-30s), deteccion de visibilidad, ping/pong cada 30/60s"],
  ["Escalabilidad", "Goroutines (~8KB c/u), RWMutex, snapshot, envio no-bloqueante, limpieza automatica"],
  ["Archivos backend", "5 en backend/internal/websocket/ + 1 servicio puente"],
  ["Archivos frontend", "3 en frontend/src/infraestructura/websocket/ + 4 componentes que lo usan"],
];
resumen.forEach((r, i) => {
  resRows.push(new TableRow({ children: [dataCell(r[0], 3500, i%2===1, true), dataCell(r[1], 10180, i%2===1)] }));
});
children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [3500, 10180], rows: resRows }));

// ============================================================
// BUILD DOC
// ============================================================
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C.primary },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.accent },
        paragraph: { spacing: { before: 300, after: 100 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840, orientation: "landscape" },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Libro de Reclamaciones SaaS - Arquitectura WebSocket", font: "Arial", size: 16, color: C.muted })] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Pagina ", font: "Arial", size: 16, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.muted })] })] })
    },
    children,
  }]
});

const out = "docs/Documentacion_WebSocket_LibroReclamaciones.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(out, buf);
  console.log(`Documento generado: ${out} (${(buf.length/1024).toFixed(1)} KB)`);
});
