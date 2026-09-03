import { Chip, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { PlantillaEmail } from '@/tipos';
import { UiIcono } from '@/ui';

// Iconos por tipo de evento
const ICONOS_EVENTO: Record<string, string> = {
  confirmacion_reclamo: 'mark_email_read',
  nuevo_reclamo_empresa: 'notifications_active',
  resolucion: 'task_alt',
  cambio_estado: 'sync_alt',
  nuevo_mensaje: 'forum',
};

// Tooltips tutorial por tipo de evento
const TUTORIAL_EVENTO: Record<string, string> = {
  confirmacion_reclamo:
    'Se envia automaticamente al cliente cuando registra un reclamo o queja. ' +
    'Incluye el codigo de seguimiento y fecha de registro. ' +
    'Controlado por el toggle "Notificar por email" en Configuracion.',
  nuevo_reclamo_empresa:
    'Se envia al email de contacto de la empresa cuando un cliente registra un nuevo reclamo. ' +
    'Incluye datos del consumidor y tipo de solicitud para accion inmediata. ' +
    'Controlado por el toggle "Notificar por email" en Configuracion.',
  cambio_estado:
    'Se envia al cliente cuando un administrador cambia el estado de su reclamo ' +
    '(ej: de "Pendiente" a "En Proceso"). Muestra el nuevo estado de forma visual. ' +
    'Controlado por el toggle "Notificar cambio de estado" en Configuracion.',
  resolucion:
    'Se envia al cliente cuando se emite la respuesta/resolucion oficial del reclamo. ' +
    'Incluye un resumen de la respuesta. Se adjunta el PDF de la hoja de resolucion. ' +
    'Controlado por el toggle "Notificar resolucion" en Configuracion.',
  nuevo_mensaje:
    'Se envia al cliente cuando un administrador le envia un mensaje interno. ' +
    'Incluye una vista previa del mensaje y un boton para ver el detalle. ' +
    'Solo se envia cuando la empresa escribe, NO cuando el cliente escribe. ' +
    'Controlado por el toggle "Notificar mensajes" en Configuracion.',
};

interface Props {
  plantillas: PlantillaEmail[];
  alEditar: (plantilla: PlantillaEmail) => void;
}

export function TablaPlantillasEmail({ plantillas, alEditar }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'center', width: '80px' }}>Acciones</th>
            <th style={thStyle}>Plantilla</th>
            <th style={thStyle}>Asunto</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '90px' }}>Estado</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '120px' }}>Variables</th>
          </tr>
        </thead>
        <tbody>
          {plantillas.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--ui-info-borde)' }}>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <Tooltip title="Editar plantilla" arrow>
                  <button
                    onClick={() => alEditar(p)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px', borderRadius: '4px', display: 'inline-flex',
                    }}
                  >
                    <EditIcon fontSize="small" sx={{ color: '#9a4a24' }} />
                  </button>
                </Tooltip>
              </td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UiIcono
                    nombre={ICONOS_EVENTO[p.tipo_evento] || 'mail'}
                    tamano={18}
                    sx={{ flex: 'none', color: 'var(--ui-texto-3)' }}
                  />
                  <span>{p.nombre_visual}</span>
                  <Tooltip
                    title={TUTORIAL_EVENTO[p.tipo_evento] || ''}
                    arrow
                    placement="right"
                    slotProps={{
                      tooltip: {
                        sx: {
                          maxWidth: 340,
                          fontSize: '0.8rem',
                          lineHeight: 1.5,
                          padding: '10px 14px',
                          backgroundColor: 'var(--ui-texto)',
                          color: 'var(--ui-superficie)',
                        },
                      },
                    }}
                  >
                    <InfoOutlinedIcon
                      sx={{
                        fontSize: '1rem',
                        color: '#aca596',
                        cursor: 'help',
                        flexShrink: 0,
                        '&:hover': { color: '#9a4a24' },
                      }}
                    />
                  </Tooltip>
                </div>
              </td>
              <td style={{ ...tdStyle, color: 'var(--ui-texto-2)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.asunto}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <Tooltip
                  title={
                    p.activa
                      ? 'Esta plantilla esta activa. Los correos usaran el texto personalizado que configuraste.'
                      : 'Esta plantilla esta inactiva. Los correos usaran el texto por defecto del sistema. Activa la plantilla desde el editor para usar tu texto personalizado.'
                  }
                  arrow
                  slotProps={{
                    tooltip: {
                      sx: { maxWidth: 280, fontSize: '0.78rem', lineHeight: 1.4, padding: '8px 12px', backgroundColor: 'var(--ui-texto)', color: 'var(--ui-superficie)' },
                    },
                  }}
                >
                  <Chip
                    label={p.activa ? 'Activa' : 'Inactiva'}
                    size="small"
                    sx={{
                      backgroundColor: p.activa ? 'var(--ui-exito-suave)' : 'var(--ui-superficie-hundida)',
                      color: p.activa ? 'var(--ui-exito-texto)' : 'var(--ui-texto-2)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'help',
                    }}
                  />
                </Tooltip>
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <Tooltip title={p.variables_permitidas.map(v => `{{${v}}}`).join(', ')} arrow>
                  <Chip
                    label={`${p.variables_permitidas.length} vars`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Nota informativa al pie */}
      <div style={{
        marginTop: '16px',
        padding: '12px 16px',
        backgroundColor: 'var(--ui-info-suave)',
        border: '1px solid var(--ui-info-borde)',
        borderRadius: 'var(--ui-r-lg)',
        fontSize: '0.8rem',
        color: 'var(--ui-info-texto)',
        lineHeight: 1.6,
      }}>
        <strong>¿Como funciona?</strong> Cada plantilla controla el texto de un tipo de correo especifico.
        Si una plantilla esta <strong>inactiva</strong>, el sistema usara un texto por defecto.
        Los correos solo se envian si los toggles correspondientes estan activados en{' '}
        <strong>Configuracion → Notificaciones por email</strong>.
        Pasa el cursor sobre el icono <InfoOutlinedIcon sx={{ fontSize: '0.85rem', verticalAlign: 'middle', color: '#244d50' }} /> de cada plantilla para ver cuando se envia.
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px',
  borderBottom: '2px solid var(--ui-info-borde)',
  fontWeight: 700, fontSize: '0.8rem',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
};
