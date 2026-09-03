import type { PasoGuia } from './GuiaModulo';

interface ContenidoGuia {
  titulo: string;
  descripcion: string;
  pasos: PasoGuia[];
  consejo?: string;
}

/* ── Guías por módulo ── */

export const guiaDashboard: ContenidoGuia = {
  titulo: 'Dashboard',
  descripcion:
    'Este es tu panel principal. Aquí ves de un vistazo cómo va tu negocio: cuántos reclamos tienes, en qué estado están y cuántos recursos usas de tu plan.',
  pasos: [
    {
      titulo: 'Revisa tus métricas',
      descripcion: 'Las tarjetas de arriba muestran el total de reclamos, pendientes, en proceso y resueltos.',
    },
    {
      titulo: 'Consulta el uso de tu plan',
      descripcion: 'Las barras te indican cuántas sedes, usuarios y chatbots estás usando vs tu límite.',
    },
    {
      titulo: 'Filtra por sede',
      descripcion: 'Si tienes varias sedes, usa el selector para ver las métricas de una sede específica.',
    },
  ],
  consejo: 'El dashboard se actualiza cada vez que entras. Si necesitas datos más recientes, simplemente recarga la página.',
};

export const guiaReclamos: ContenidoGuia = {
  titulo: 'Reclamos',
  descripcion:
    'Aquí gestionas todos los reclamos y quejas que tus clientes envían. Puedes filtrar, buscar, responder y cambiar el estado de cada uno.',
  pasos: [
    {
      titulo: 'Explora la lista',
      descripcion: 'Verás todos los reclamos ordenados por fecha. Usa los filtros de estado, sede o periodo para encontrar lo que buscas.',
    },
    {
      titulo: 'Abre un reclamo',
      descripcion: 'Haz clic en cualquier fila para ver el detalle completo: datos del cliente, descripción y el historial.',
    },
    {
      titulo: 'Responde al cliente',
      descripcion: 'Dentro del detalle puedes enviar una respuesta oficial o mensajes internos de seguimiento.',
    },
    {
      titulo: 'Cambia el estado',
      descripcion: 'Mueve el reclamo entre estados: Pendiente → En Proceso → Resuelto → Cerrado según avance la gestión.',
    },
  ],
  consejo: 'Los reclamos marcados en rojo están próximos a vencer. Atiéndelos primero para cumplir con los plazos legales.',
};

export const guiaUsuarios: ContenidoGuia = {
  titulo: 'Usuarios',
  descripcion:
    'Aquí administras las cuentas de las personas que usan el panel. Cada usuario tiene un rol que define qué puede hacer.',
  pasos: [
    {
      titulo: 'Crea un usuario',
      descripcion: 'Haz clic en "Nuevo Usuario", completa nombre, email, contraseña y selecciona su rol.',
    },
    {
      titulo: 'Asigna un rol',
      descripcion: 'El rol determina los permisos. Puedes crear roles personalizados en el módulo de Roles.',
    },
    {
      titulo: 'Asigna una sede',
      descripcion: 'Si el usuario solo debe ver reclamos de una sede, selecciónala. Si no, déjalo en "Todas las sedes".',
    },
    {
      titulo: 'Edita o desactiva',
      descripcion: 'Haz clic en el ícono de lápiz para editar o en la papelera para desactivar una cuenta.',
    },
  ],
  consejo: 'No puedes desactivar tu propia cuenta. Si necesitas cambiar tu rol, pide a otro administrador que lo haga.',
};

export const guiaRoles: ContenidoGuia = {
  titulo: 'Roles',
  descripcion:
    'Aquí defines los roles de tu equipo y los permisos que tiene cada uno. Es como decidir quién puede ver, crear, editar o eliminar en cada sección.',
  pasos: [
    {
      titulo: 'Revisa los roles existentes',
      descripcion: 'Verás los roles base (Administrador y Soporte) y los que hayas creado. Los base no se pueden eliminar.',
    },
    {
      titulo: 'Crea un nuevo rol',
      descripcion: 'Haz clic en "Nuevo Rol", ponle un nombre descriptivo (ej: "Supervisor") y configura sus permisos.',
    },
    {
      titulo: 'Configura la matriz de permisos',
      descripcion: 'Activa o desactiva cada acción por módulo. Por ejemplo: Reclamos → Ver ✓, Editar ✓, Eliminar ✗.',
    },
    {
      titulo: 'Asigna el rol a usuarios',
      descripcion: 'Ve al módulo de Usuarios y cambia el rol de quien necesites.',
    },
  ],
  consejo: 'El rol "Administrador" siempre tiene todos los permisos activados. No necesitas configurarlo.',
};

export const guiaSedes: ContenidoGuia = {
  titulo: 'Sedes',
  descripcion:
    'Aquí registras las sucursales o locales de tu empresa. Cada sede tiene su propio formulario público donde los clientes envían reclamos.',
  pasos: [
    {
      titulo: 'Agrega una sede',
      descripcion: 'Haz clic en "Nueva Sede" y completa: nombre, dirección, teléfono y horario de atención.',
    },
    {
      titulo: 'Copia el enlace público',
      descripcion: 'Cada sede genera un link único. Compártelo con tus clientes para que envíen sus reclamos.',
    },
    {
      titulo: 'Configura la ubicación',
      descripcion: 'Puedes agregar la dirección exacta para que aparezca en el formulario público.',
    },
  ],
  consejo: 'La cantidad de sedes que puedes crear depende de tu plan. Revisa tu suscripción si necesitas más.',
};

export const guiaChatbots: ContenidoGuia = {
  titulo: 'Chatbots',
  descripcion:
    'Aquí configuras bots que responden automáticamente en tu formulario público. Puedes personalizar qué dicen y cómo interactúan con tus clientes.',
  pasos: [
    {
      titulo: 'Crea un chatbot',
      descripcion: 'Haz clic en "Nuevo Chatbot", ponle un nombre y configura el mensaje de bienvenida.',
    },
    {
      titulo: 'Personaliza las respuestas',
      descripcion: 'Define qué responde el bot cuando un cliente envía un reclamo o hace una consulta.',
    },
    {
      titulo: 'Verifica la conexión',
      descripcion: 'En el detalle del chatbot, revisa que la conexión esté activa y funcionando correctamente.',
    },
  ],
  consejo: 'Puedes crear varios chatbots para diferentes propósitos. Ponles nombres descriptivos para identificarlos fácilmente.',
};

export const guiaWhatsApp: ContenidoGuia = {
  titulo: 'WhatsApp',
  descripcion:
    'Aquí conectas tus canales de WhatsApp Business para que los clientes puedan crear reclamos directamente por WhatsApp.',
  pasos: [
    {
      titulo: 'Agrega un canal',
      descripcion: 'Haz clic en "Nuevo Canal" e ingresa el número de WhatsApp Business, el token de acceso y el verify token.',
    },
    {
      titulo: 'Asocia un chatbot',
      descripcion: 'Selecciona qué chatbot responderá los mensajes de este canal.',
    },
    {
      titulo: 'Configura el webhook',
      descripcion: 'Copia la URL del webhook y pégala en la configuración de tu cuenta de Meta Business.',
    },
  ],
  consejo: 'Necesitas una cuenta de Meta Business verificada para usar la API de WhatsApp.',
};

export const guiaAtencionVivo: ContenidoGuia = {
  titulo: 'Atención en Vivo',
  descripcion:
    'Aquí ves las solicitudes de clientes que quieren hablar con una persona real. Puedes asignar asesores y chatear en tiempo real.',
  pasos: [
    {
      titulo: 'Revisa las solicitudes',
      descripcion: 'Verás una lista de clientes esperando atención. Las más recientes aparecen primero.',
    },
    {
      titulo: 'Asigna un asesor',
      descripcion: 'Selecciona quién de tu equipo atenderá cada solicitud.',
    },
    {
      titulo: 'Chatea con el cliente',
      descripcion: 'Una vez asignado, abre la conversación para responder en tiempo real.',
    },
  ],
  consejo: 'Responde rápido: los clientes esperan atención inmediata cuando solicitan hablar con un asesor.',
};

export const guiaAsistente: ContenidoGuia = {
  titulo: 'Asistente IA',
  descripcion:
    'Aquí puedes hacerle preguntas a la inteligencia artificial sobre tus reclamos, métricas y datos. Es como tener un analista disponible 24/7.',
  pasos: [
    {
      titulo: 'Escribe tu pregunta',
      descripcion: 'Pregunta lo que necesites: "¿Cuántos reclamos tuve este mes?" o "¿Cuál es la sede con más quejas?".',
    },
    {
      titulo: 'Revisa la respuesta',
      descripcion: 'El asistente analiza tus datos y te da una respuesta clara y directa.',
    },
  ],
  consejo: 'Mientras más específica sea tu pregunta, mejor será la respuesta del asistente.',
};

export const guiaSuscripcion: ContenidoGuia = {
  titulo: 'Suscripción',
  descripcion:
    'Aquí ves tu plan actual, los límites de recursos y puedes cambiar a un plan superior si lo necesitas.',
  pasos: [
    {
      titulo: 'Revisa tu plan',
      descripcion: 'Verás el nombre de tu plan, si estás en periodo de prueba y cuándo vence.',
    },
    {
      titulo: 'Consulta tus límites',
      descripcion: 'Cada plan tiene un máximo de sedes, usuarios, chatbots y reclamos por mes.',
    },
    {
      titulo: 'Cambia de plan',
      descripcion: 'Si necesitas más recursos, selecciona un plan superior y confirma el cambio.',
    },
  ],
  consejo: 'Durante el periodo de prueba tienes acceso completo. Elige un plan antes de que termine para no perder funcionalidad.',
};

export const guiaConfiguracion: ContenidoGuia = {
  titulo: 'Configuración',
  descripcion:
    'Aquí personalizas los datos de tu empresa: razón social, RUC, logo, colores y datos de contacto que aparecen en los formularios públicos.',
  pasos: [
    {
      titulo: 'Completa los datos de tu empresa',
      descripcion: 'Ingresa razón social, RUC, dirección fiscal y datos de contacto.',
    },
    {
      titulo: 'Sube tu logo',
      descripcion: 'El logo aparecerá en el formulario público y en los correos que se envían a tus clientes.',
    },
    {
      titulo: 'Personaliza los colores',
      descripcion: 'Elige los colores de tu marca para que el formulario público refleje tu identidad.',
    },
  ],
  consejo: 'Mantén tus datos actualizados. Los clientes verán esta información cuando envíen un reclamo.',
};
