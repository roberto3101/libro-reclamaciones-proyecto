import { usarTema } from '@/ui';

/**
 * Toggle global de tema claro/oscuro.
 * Usa el contexto de UiProveedorTema, que ya persiste en localStorage
 * y sincroniza la clase .dark en <html>.
 *
 * Props opcionales para personalizar tamaño y posición.
 */
interface ToggleTemaProps {
  /** Clases CSS adicionales para el contenedor */
  className?: string;
}

export function ToggleTema({ className = '' }: ToggleTemaProps) {
  const { tema, alternarTema } = usarTema();
  const esOscuro = tema === 'dark';

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={esOscuro ? 'Modo claro' : 'Modo oscuro'}
      className={`lr-boton-cabecera ${className}`}
    >
      {/* Sol (modo claro) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute transition-opacity duration-200 ${
          esOscuro ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>

      {/* Luna (modo oscuro) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute transition-opacity duration-200 ${
          esOscuro ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
