/**
 * Pantalla que se muestra cuando el usuario no tiene permisos para ver un módulo.
 * Reutilizable en cualquier página protegida.
 */
interface Props {
  modulo?: string;
}

export function PantallaSinPermisos({ modulo }: Props) {
  return (
    <div className="h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Icono de candado */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-red-400 dark:text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Acceso restringido
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          No tienes permisos para acceder
          {modulo ? ` al módulo de ${modulo}` : ' a esta sección'}.
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Solicita al administrador que te asigne los permisos necesarios desde el módulo de <strong className="text-gray-600 dark:text-gray-300">Roles</strong>.
        </p>

        <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <span>Administración → Roles → Editar permisos del rol</span>
        </div>
      </div>
    </div>
  );
}
