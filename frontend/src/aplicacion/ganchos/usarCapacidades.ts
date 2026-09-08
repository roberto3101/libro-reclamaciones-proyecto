import { useEffect, useState } from 'react';
import { http } from '@/api/http';

/**
 * Qué módulos opcionales tiene encendidos este servidor.
 *
 * Varios —asistente, chatbots, WhatsApp, correo, adjuntos, cobros— solo se
 * montan si hay credenciales configuradas. El menú, en cambio, se arma con
 * los permisos del rol y del plan, que dicen lo que el usuario PODRÍA usar.
 *
 * Sin esta comprobación, el plan promete asistente, el menú lo muestra, y
 * al entrar salta un 404: el usuario cree que el sistema está roto cuando
 * en realidad está sin configurar.
 */
export interface Capacidades {
  asistente: boolean;
  chatbots: boolean;
  whatsapp: boolean;
  correo: boolean;
  adjuntos: boolean;
  cobros: boolean;
}

/* Mientras no llega la respuesta se asume que todo está disponible.

   Es a propósito: si se asumiera lo contrario, el menú aparecería recortado
   durante un instante en cada carga y luego daría un salto al completarse.
   Un parpadeo de más molesta más que un módulo que tarda medio segundo en
   esconderse. */
const TODO_DISPONIBLE: Capacidades = {
  asistente: true, chatbots: true, whatsapp: true,
  correo: true, adjuntos: true, cobros: true,
};

export function usarCapacidades(): Capacidades {
  const [caps, setCaps] = useState<Capacidades>(TODO_DISPONIBLE);

  useEffect(() => {
    let vivo = true;
    http.get('/capacidades')
      .then((r) => { if (vivo && r.data?.data) setCaps(r.data.data as Capacidades); })
      // Si la consulta falla —servidor antiguo, red caída— se deja todo
      // visible. Ocultar medio panel por un fallo de red sería peor.
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  return caps;
}
