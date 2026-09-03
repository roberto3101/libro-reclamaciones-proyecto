import { useState, useEffect, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { superadminApi } from '@/api/superadmin';
import { ModalBase, BotonModal } from '@/componentes/ui/ModalBase';
import type { SuperAdminStaff, CrearStaffRequest } from '@/tipos';

const emptyForm: CrearStaffRequest = {
  email: '',
  password: '',
  nombre: '',
};

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '\u2014';
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SAStaff() {
  const [staff, setStaff] = useState<SuperAdminStaff[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CrearStaffRequest>(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await superadminApi.listarStaff();
      setStaff(data);
    } catch {
      toast.error('Error al cargar el staff');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const handleCrear = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.nombre) {
      toast.error('Todos los campos son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      await superadminApi.crearStaff(form);
      toast.success('SuperAdmin creado correctamente');
      setModalOpen(false);
      setForm(emptyForm);
      cargar();
    } catch {
      toast.error('Error al crear el SuperAdmin');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff SuperAdmin</h1>
        <button
          onClick={() => {
            setForm(emptyForm);
            setModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
        >
          + Nuevo SuperAdmin
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Activo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Ultimo Acceso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">Fecha Creacion</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                </tr>
              ))
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600 dark:text-gray-400">
                  No hay miembros del staff
                </td>
              </tr>
            ) : (
              staff.map((miembro) => (
                <tr
                  key={miembro.id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{miembro.nombre}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{miembro.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        miembro.activo
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full text-xs font-medium'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full text-xs font-medium'
                      }
                    >
                      {miembro.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    {formatearFecha(miembro.ultimo_acceso)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {formatearFecha(miembro.fecha_creacion)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear staff */}
      <ModalBase
        abierto={modalOpen}
        alCerrar={() => setModalOpen(false)}
        titulo="Nuevo SuperAdmin"
        maxAncho="sm"
        bloqueado={guardando}
        cerrarAlClickFuera={false}
        pie={
          <>
            <BotonModal
              texto={guardando ? 'Creando...' : 'Crear SuperAdmin'}
              variante="primario"
              onClick={() => {
                const fakeEvent = { preventDefault: () => {} } as FormEvent;
                handleCrear(fakeEvent);
              }}
              cargando={guardando}
            />
            <BotonModal
              texto="Cancelar"
              variante="secundario"
              onClick={() => setModalOpen(false)}
              deshabilitado={guardando}
            />
          </>
        }
      >
        <form id="form-crear-staff" onSubmit={handleCrear} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contrasena *</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition"
            />
          </div>
        </form>
      </ModalBase>
    </div>
  );
}
