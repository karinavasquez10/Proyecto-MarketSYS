// BuscarUsuarios.jsx (versión mejorada con modal de detalles y fotos actualizadas)
import React, { useState, useEffect } from "react";
import { UserSearch, RotateCw, X, User, Mail, Phone, MapPin, Calendar, Briefcase, IdCard } from "lucide-react";

const API = (() => {
  try {
    const RAW_API_URL = import.meta.env.VITE_API_URL || "";
    let u = RAW_API_URL || "http://localhost:5000";
    u = u.replace(/\/+$/, "");
    if (!u.endsWith("/api")) u += "/api";
    return u;
  } catch {
    return "http://localhost:5000/api";
  }
})();

// Spinner de carga
function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col justify-center items-center py-12">
      <svg className="animate-spin h-10 w-10 text-sky-500 mb-3" viewBox="0 0 45 45">
        <circle className="opacity-20" cx="22.5" cy="22.5" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
        <path d="M42.5,22.5a20,20 0 1,1-40,0" stroke="currentColor" strokeWidth="5" fill="none" />
      </svg>
      <span className="text-sky-600 text-sm font-medium">{label}</span>
    </div>
  );
}

export default function BuscarUsuario() {
  const [usuarios, setUsuarios] = useState([]);
  const [filtros, setFiltros] = useState({ documento: '', nombre: '', telefono: '', correo: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const itemsPerPage = 10;
  // const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";

  // Fetch inicial
  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API}/perfil`);
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        const data = await res.json();
        setUsuarios(data);
      } catch (err) {
        console.error('Error al fetch usuarios:', err);
        setError(err.message);
        setUsuarios([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsuarios();
  }, []);

  const handleFiltroChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
    setCurrentPage(1);
  };

  const handleActualizar = () => {
    window.location.reload();
  };

  const handleVerDetalle = async (idUsuario) => {
    try {
      setLoadingDetalle(true);
      setShowModal(true);
      const res = await fetch(`${API}/perfil/${idUsuario}`);
      if (!res.ok) throw new Error('Error al obtener detalle');
      const data = await res.json();
      setUsuarioSeleccionado(data);
    } catch (err) {
      console.error('Error al cargar detalle:', err);
      setError(err.message);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleCerrarModal = () => {
    setShowModal(false);
    setUsuarioSeleccionado(null);
  };

  const usuariosFiltrados = usuarios.filter(u =>
    (filtros.documento ? u.documento_identidad?.includes(filtros.documento) : true) &&
    (filtros.nombre ? u.nombre.toLowerCase().includes(filtros.nombre.toLowerCase()) : true) &&
    (filtros.telefono ? u.telefono?.includes(filtros.telefono) : true) &&
    (filtros.correo ? u.correo?.includes(filtros.correo) : true)
  );

  const totalPages = Math.ceil(usuariosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentUsuarios = usuariosFiltrados.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div className="p-6 w-full max-w-[calc(150%-16rem)]">
      {/* ======= ENCABEZADO ======= */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-sky-500 to-indigo-500 p-2.5 rounded-lg text-white shadow">
            <UserSearch size={20} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Gestión de Usuarios
          </h1>
        </div>
        <button onClick={handleActualizar} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md text-sm shadow transition">
          <RotateCw size={16} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* ======= CONTENEDOR TABLA ======= */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          {/* CABECERA */}
          <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Foto</th>
              <th className="px-4 py-3 text-left">Documento</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Correo</th>
              <th className="px-4 py-3 text-center">Activo</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>

          {/* FILTROS */}
          <thead className="bg-white border-b">
            <tr>
              <th className="px-4 py-2"></th>
              <th className="px-4 py-2">
                <input
                  type="text"
                  name="documento"
                  placeholder="Documento..."
                  value={filtros.documento}
                  onChange={handleFiltroChange}
                  className="w-full border rounded-md px-2 py-1 text-xs focus:ring focus:ring-sky-100"
                />
              </th>
              <th className="px-4 py-2">
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre..."
                  value={filtros.nombre}
                  onChange={handleFiltroChange}
                  className="w-full border rounded-md px-2 py-1 text-xs focus:ring focus:ring-sky-100"
                />
              </th>
              <th className="px-4 py-2">
                <input
                  type="text"
                  name="telefono"
                  placeholder="Teléfono..."
                  value={filtros.telefono}
                  onChange={handleFiltroChange}
                  className="w-full border rounded-md px-2 py-1 text-xs focus:ring focus:ring-sky-100"
                />
              </th>
              <th className="px-4 py-2">
                <input
                  type="text"
                  name="correo"
                  placeholder="Correo..."
                  value={filtros.correo}
                  onChange={handleFiltroChange}
                  className="w-full border rounded-md px-2 py-1 text-xs focus:ring focus:ring-sky-100"
                />
              </th>
              <th className="px-4 py-2"></th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>

          {/* CUERPO */}
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-8">
                  <Spinner label="Cargando usuarios..." />
                </td>
              </tr>
            ) : currentUsuarios.length > 0 ? (
              currentUsuarios.map((usuario) => (
                <tr
                  key={usuario.id_usuario}
                  className="hover:bg-slate-50 transition duration-150"
                >
                  <td className="px-4 py-3">
                    {usuario.foto_url ? (
                      <img
                        src={usuario.foto_url}
                        alt={usuario.nombre}
                        className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm border border-slate-200">
                        {usuario.nombre[0]}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {usuario.documento_identidad || 'N/A'}
                  </td>
                  <td className="px-4 py-3 max-w-[150px] truncate">{usuario.nombre}</td>
                  <td className="px-4 py-3">{usuario.telefono || 'N/A'}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate">{usuario.correo}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        usuario.estado === 1
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-600"
                      }`}
                    >
                      {usuario.estado === 1 ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => handleVerDetalle(usuario.id_usuario)}
                      className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-md text-xs shadow transition"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-slate-500">No se encontraron usuarios.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ======= PAGINACIÓN ======= */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2 text-xs text-slate-600">
          <button 
            onClick={() => handlePageChange(currentPage - 1)} 
            disabled={currentPage === 1}
            className="px-2.5 py-1 border rounded-md hover:bg-slate-100 disabled:opacity-50"
          >
            «
          </button>
          <button 
            onClick={() => handlePageChange(currentPage - 1)} 
            disabled={currentPage === 1}
            className="px-2.5 py-1 border rounded-md hover:bg-slate-100 disabled:opacity-50"
          >
            ‹
          </button>
          <span className="px-2 font-semibold text-slate-800">{currentPage}</span>
          <span className="px-2 text-slate-500">de {totalPages}</span>
          <button 
            onClick={() => handlePageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 border rounded-md hover:bg-slate-100 disabled:opacity-50"
          >
            ›
          </button>
          <button 
            onClick={() => handlePageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 border rounded-md hover:bg-slate-100 disabled:opacity-50"
          >
            »
          </button>
        </div>
      )}

      {/* ======= MODAL DE DETALLES ======= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User size={24} />
                <h2 className="text-xl font-bold">Detalle del Usuario</h2>
              </div>
              <button
                onClick={handleCerrarModal}
                className="hover:bg-white/20 p-2 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {loadingDetalle ? (
                <Spinner label="Cargando detalles..." />
              ) : usuarioSeleccionado ? (
                <div className="space-y-6">
                  {/* Foto y nombre */}
                  <div className="flex items-center gap-4 pb-4 border-b">
                    {usuarioSeleccionado.foto_url ? (
                      <img
                        src={usuarioSeleccionado.foto_url}
                        alt={usuarioSeleccionado.nombre}
                        className="w-20 h-20 rounded-full border-2 border-sky-200 object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl border-2 border-sky-200">
                        {usuarioSeleccionado.nombre[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{usuarioSeleccionado.nombre}</h3>
                      <p className="text-sm text-slate-500">{usuarioSeleccionado.rol || 'Usuario'}</p>
                    </div>
                  </div>

                  {/* Información detallada */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <IdCard size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Documento</p>
                        <p className="text-sm text-slate-800">{usuarioSeleccionado.documento_identidad || 'No registrado'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Mail size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Correo</p>
                        <p className="text-sm text-slate-800 break-all">{usuarioSeleccionado.correo}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Phone size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Teléfono</p>
                        <p className="text-sm text-slate-800">{usuarioSeleccionado.telefono || 'No registrado'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Briefcase size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Cargo</p>
                        <p className="text-sm text-slate-800">{usuarioSeleccionado.cargo || 'No especificado'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg md:col-span-2">
                      <MapPin size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Dirección</p>
                        <p className="text-sm text-slate-800">{usuarioSeleccionado.direccion || 'No registrada'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Calendar size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Fecha de Nacimiento</p>
                        <p className="text-sm text-slate-800">
                          {usuarioSeleccionado.fecha_nacimiento 
                            ? new Date(usuarioSeleccionado.fecha_nacimiento).toLocaleDateString('es-CO')
                            : 'No registrada'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <User size={18} className="text-sky-600 mt-1" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Género</p>
                        <p className="text-sm text-slate-800 capitalize">{usuarioSeleccionado.genero || 'No especificado'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-sky-50 rounded-lg border border-sky-100">
                    <span className="text-sm font-medium text-slate-700">Estado de la cuenta:</span>
                    <span
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                        usuarioSeleccionado.estado === 1
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-600"
                      }`}
                    >
                      {usuarioSeleccionado.estado === 1 ? "✓ Activo" : "✗ Inactivo"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">No se pudo cargar la información del usuario.</p>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t">
              <button
                onClick={handleCerrarModal}
                className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}