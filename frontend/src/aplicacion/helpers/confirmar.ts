import Swal from 'sweetalert2';

interface OpcionesConfirmacion {
  titulo?: string;
  texto?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  icono?: 'warning' | 'error' | 'info' | 'question';
}

export async function confirmar(opciones: OpcionesConfirmacion = {}): Promise<boolean> {
  const resultado = await Swal.fire({
    title: opciones.titulo ?? '¿Estás seguro?',
    text: opciones.texto ?? 'Esta acción no se puede deshacer.',
    icon: opciones.icono ?? 'warning',
    showCancelButton: true,
    confirmButtonColor: '#b85528',
    cancelButtonColor: '#857e70',
    confirmButtonText: opciones.textoConfirmar ?? 'Sí, continuar',
    cancelButtonText: opciones.textoCancelar ?? 'Cancelar',
  });
  return resultado.isConfirmed;
}

export async function confirmarEliminacion(entidad: string): Promise<boolean> {
  return confirmar({
    titulo: `¿Eliminar ${entidad}?`,
    texto: `El ${entidad} será desactivado permanentemente.`,
    textoConfirmar: 'Sí, eliminar',
    icono: 'warning',
  });
}
