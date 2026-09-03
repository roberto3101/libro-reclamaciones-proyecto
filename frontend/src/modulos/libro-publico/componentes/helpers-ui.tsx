/**
 * Helpers de UI compartidos para el módulo Libro Público.
 * Todos soportan dark mode vía Tailwind.
 */

/**
 * Muestra un mensaje de error de validación debajo de un input.
 * SIEMPRE reserva espacio (min-height) para evitar "layout shift"
 * cuando el mensaje aparece o desaparece.
 */
export function ErrorTexto({ mensaje }: { mensaje?: string }) {
  return (
    <span
      className="error-texto-slot mt-0.5 text-xs text-red-600 dark:text-red-400"
      style={{
        opacity: mensaje ? 1 : 0,
        transition: 'opacity 0.15s ease',
        pointerEvents: mensaje ? 'auto' : 'none',
      }}
      aria-live="polite"
    >
      {mensaje || '\u00A0'}
    </span>
  );
}

export function Contador({ actual, max }: { actual: number; max: number }) {
  const porcentaje = max > 0 ? actual / max : 0;
  const esAlto = porcentaje >= 0.9;
  return (
    <span
      className={`block text-right text-[0.7rem] mt-1 ${
        esAlto
          ? 'text-amber-600 dark:text-amber-400 font-medium'
          : 'text-gray-600 dark:text-gray-400'
      }`}
    >
      {actual}/{max}
    </span>
  );
}
