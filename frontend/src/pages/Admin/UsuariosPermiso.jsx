// src/pages/Admin/UsuariosPermisos.jsx
import React, { useState, useEffect } from "react";
import { Users, Shield, Edit2, Trash2, Save, X, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";
import api from "../../api";

export default function UsuariosPermiso() {
  const [usuarios, setUsuarios] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermisos, setUserPermisos] = useState({});
  const [sucursales, setSucursales] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    rol: "cajero",
    estado: 1,
    id_sucursal: 1,
    telefono: "",
    cargo: "",
    password: ""
  });

  // Cargar datos al montar
  useEffect(() => {
    fetchUsuarios();
    fetchModulos();
    fetchSucursales();
  }, []);

  // Obtener usuarios
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.get("/perfil");
      setUsuarios(response.data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      alert("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  // Obtener módulos disponibles
  const fetchModulos = async () => {
    try {
      const response = await api.get("/permisos/modulos");
      setModulos(response.data);
    } catch (error) {
      console.error("Error al cargar módulos:", error);
    }
  };

  // Obtener sucursales
  const fetchSucursales = async () => {
    try {
      const response = await api.get("/sucursales");
      setSucursales(response.data);
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
    }
  };

  // Abrir modal para editar usuario
  const handleEdit = (usuario) => {
    setSelectedUser(usuario);
    setFormData({
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      id_sucursal: usuario.id_sucursal || 1,
      telefono: usuario.telefono || "",
      cargo: usuario.cargo || "",
      password: "" // Inicialmente vacío, se llena si el usuario quiere cambiarla
    });
    setShowPassword(false); // Resetear visibilidad
    setShowEditModal(true);
  };

  // Guardar cambios del usuario
  const handleSaveUser = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.correo) {
      alert("Nombre y correo son obligatorios");
      return;
    }

    // Validar contraseña si se ingresó
    if (formData.password && formData.password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setLoading(true);
      
      // Preparar datos: mapear password a contrasena y solo incluir si se ingresó
      const dataToSend = {
        nombre: formData.nombre,
        correo: formData.correo,
        rol: formData.rol,
        estado: formData.estado,
        id_sucursal: formData.id_sucursal,
        telefono: formData.telefono || null,
        cargo: formData.cargo || null
      };
      
      // Solo agregar contrasena si se proporcionó
      if (formData.password && formData.password.trim()) {
        dataToSend.contrasena = formData.password.trim();
      }

      console.log('[DEBUG] Datos a enviar para actualización:', dataToSend);
      
      await api.put(`/perfil/${selectedUser.id_usuario}`, dataToSend);
      alert("Usuario actualizado exitosamente");
      setShowEditModal(false);
      fetchUsuarios();
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      alert(error.response?.data?.error || "Error al actualizar usuario");
    } finally {
      setLoading(false);
    }
  };

  // Eliminar usuario
  const handleDelete = async (usuario) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${usuario.nombre}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/perfil/${usuario.id_usuario}`);
      alert("Usuario eliminado exitosamente");
      fetchUsuarios();
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert(error.response?.data?.error || "Error al eliminar usuario");
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de permisos
  const handleOpenPermisos = async (usuario) => {
    setSelectedUser(usuario);
    try {
      setLoading(true);
      const response = await api.get(`/permisos/${usuario.id_usuario}`);
      console.log('[DEBUG] Permisos recibidos del backend:', response.data);
      console.log('[DEBUG] Usuario rol:', usuario.rol);
      console.log('[DEBUG] Número de permisos recibidos:', Object.keys(response.data).length);
      
      // Inicializar permisos con los valores de la BD
      const permisosIniciales = {};
      Object.keys(response.data).forEach(moduloId => {
        permisosIniciales[moduloId] = response.data[moduloId] === true;
      });
      
      console.log('[DEBUG] Permisos inicializados:', permisosIniciales);
      console.log('[DEBUG] Número de permisos inicializados:', Object.keys(permisosIniciales).length);
      setUserPermisos(permisosIniciales);
      setShowPermisosModal(true);
    } catch (error) {
      console.error("Error al cargar permisos:", error);
      // Si hay error o no hay permisos, inicializar con objeto vacío
      setUserPermisos({});
      setShowPermisosModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Inicializar permisos automáticamente según el rol
  const handleInicializarPermisos = async () => {
    if (!selectedUser) return;

    if (!confirm(`¿Deseas inicializar los permisos predeterminados para el rol "${selectedUser.rol}"?\n\nEsto habilitará todos los módulos correspondientes al rol del usuario.`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/permisos/${selectedUser.id_usuario}/inicializar`);
      console.log('[DEBUG] Permisos inicializados:', response.data);
      
      // Recargar permisos
      const permisosResponse = await api.get(`/permisos/${selectedUser.id_usuario}`);
      const permisosActualizados = {};
      Object.keys(permisosResponse.data).forEach(moduloId => {
        permisosActualizados[moduloId] = permisosResponse.data[moduloId] === true;
      });
      
      setUserPermisos(permisosActualizados);
      alert(`Permisos inicializados: ${response.data.permisos_creados} módulos habilitados`);
    } catch (error) {
      console.error("Error al inicializar permisos:", error);
      alert("Error al inicializar permisos: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Toggle permiso individual
  const togglePermiso = (moduloId) => {
    setUserPermisos(prev => ({
      ...prev,
      [moduloId]: !prev[moduloId]
    }));
  };

  // Habilitar todos los permisos de una categoría
  const habilitarTodos = (categoria) => {
    const modulosCategoria = modulos.filter(m => m.categoria === categoria);
    const nuevosPermisos = { ...userPermisos };
    modulosCategoria.forEach(m => {
      nuevosPermisos[m.id] = true;
    });
    setUserPermisos(nuevosPermisos);
  };

  // Deshabilitar todos los permisos de una categoría
  const deshabilitarTodos = (categoria) => {
    const modulosCategoria = modulos.filter(m => m.categoria === categoria);
    const nuevosPermisos = { ...userPermisos };
    modulosCategoria.forEach(m => {
      nuevosPermisos[m.id] = false;
    });
    setUserPermisos(nuevosPermisos);
  };

  // Guardar permisos
  const handleSavePermisos = async () => {
    if (!selectedUser) return;

    console.log('[DEBUG] Guardando permisos para usuario:', selectedUser.id_usuario);
    console.log('[DEBUG] Permisos a guardar:', userPermisos);
    console.log('[DEBUG] Cantidad de permisos a guardar:', Object.keys(userPermisos).length);

    try {
      setLoading(true);
      const response = await api.post(`/permisos/${selectedUser.id_usuario}`, {
        permisos: userPermisos
      });
      console.log('[DEBUG] Respuesta del backend:', response.data);
      alert("Permisos actualizados exitosamente");
      setShowPermisosModal(false);
    } catch (error) {
      console.error("Error al guardar permisos:", error);
      console.error('[DEBUG] Error completo:', error.response?.data || error.message);
      alert("Error al guardar permisos: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Filtrar módulos según el rol del usuario seleccionado
  const modulosAdmin = modulos.filter(m => m.categoria === 'admin');
  const modulosCajero = modulos.filter(m => m.categoria === 'cajero');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-6 sm:px-20 py-10">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gradient-to-r from-indigo-500 to-sky-500 p-2.5 rounded-lg shadow-md text-white">
          <Users size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Gestión de Usuarios y Permisos
        </h1>
      </div>

      {/* ===== Lista de usuarios ===== */}
      <div className="bg-white/90 border border-indigo-100 rounded-2xl shadow-md p-6 mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            Usuarios registrados ({usuarios.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-slate-600">Cargando usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-gradient-to-r from-indigo-400/80 to-sky-400/80 text-white">
                <tr>
                  {["Nombre", "Correo", "Rol", "Sucursal", "Estado", "Acciones"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs uppercase tracking-wide font-semibold"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr
                    key={u.id_usuario}
                    className="border-b border-slate-100 hover:bg-indigo-50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {u.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.correo}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        u.rol === 'admin' ? 'bg-purple-100 text-purple-700' :
                        u.rol === 'cajero' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.sucursal_nombre || 'Sin asignar'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          u.estado === 1
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-600"
                        }`}
                      >
                        {u.estado === 1 ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(u)}
                          className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded hover:bg-indigo-50 transition"
                          title="Editar usuario"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenPermisos(u)}
                          className="text-sky-600 hover:text-sky-800 p-1.5 rounded hover:bg-sky-50 transition"
                          title="Gestionar permisos"
                        >
                          <Shield size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="text-rose-600 hover:text-rose-800 p-1.5 rounded hover:bg-rose-50 transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && usuarios.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No hay usuarios registrados
          </div>
        )}
      </div>

      {/* ===== Modal Editar Usuario ===== */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit2 size={20} />
                Editar Usuario
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveUser} className="p-6">
              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Correo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Correo electrónico *
                  </label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Rol y Estado */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Rol
                    </label>
                    <select
                      value={formData.rol}
                      onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="admin">Administrador</option>
                      <option value="cajero">Cajero</option>
                      <option value="bodeguero">Bodeguero</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Estado
                    </label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: parseInt(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>
                </div>

                {/* Sucursal */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sucursal
                  </label>
                  <select
                    value={formData.id_sucursal}
                    onChange={(e) => setFormData({ ...formData, id_sucursal: parseInt(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {sucursales.map(s => (
                      <option key={s.id_sucursal} value={s.id_sucursal}>
                        {s.nombre} - {s.ciudad}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teléfono y Cargo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                      placeholder="3001234567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Cargo
                    </label>
                    <input
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                      placeholder="Ej: Cajero principal"
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contraseña (dejar vacío para no cambiar)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pr-12 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none"
                      placeholder={showPassword ? "Nueva contraseña" : "••••••••"}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Solo ingresa una contraseña si deseas cambiarla. Mínimo 6 caracteres.
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-sky-500 hover:brightness-110 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-md transition"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal Permisos ===== */}
      {showPermisosModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-sky-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Shield size={20} />
                  Permisos de Módulos
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Usuario: <span className="font-semibold">{selectedUser.nombre}</span> ({selectedUser.rol})
                </p>
              </div>
              <button
                onClick={() => setShowPermisosModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              {/* Alerta informativa con botón de inicialización */}
              <div className="mb-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Importante:</p>
                      <p>Los módulos desmarcados no serán visibles para este usuario en su panel de control.</p>
                      <p className="mt-1">
                        <strong>Rol del usuario:</strong> {selectedUser.rol} - 
                        {selectedUser.rol.toLowerCase() === 'admin' || selectedUser.rol.toLowerCase() === 'administrador' 
                          ? ' Solo se muestran módulos de Administrador'
                          : selectedUser.rol.toLowerCase() === 'cajero'
                          ? ' Solo se muestran módulos de Cajero'
                          : ' Se muestran todos los módulos'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Botón de inicialización automática */}
                {Object.keys(userPermisos).length === 0 && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>🔔 Este usuario no tiene permisos configurados.</strong>
                      <br />
                      Puedes inicializar los permisos predeterminados según su rol o configurarlos manualmente.
                    </p>
                    <button
                      onClick={handleInicializarPermisos}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:brightness-110 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-md transition"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          Inicializando...
                        </>
                      ) : (
                        <>
                          <Shield size={18} />
                          Inicializar Permisos Automáticamente
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Módulos de Administrador - Solo si el rol es admin */}
              {(selectedUser.rol.toLowerCase() === 'admin' || selectedUser.rol.toLowerCase() === 'administrador' || selectedUser.rol.toLowerCase() === 'bodeguero') && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      Módulos de Administrador ({modulosAdmin.length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => habilitarTodos('admin')}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium"
                      >
                        <Check size={14} className="inline mr-1" />
                        Habilitar todos
                      </button>
                      <button
                        onClick={() => deshabilitarTodos('admin')}
                        className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                      >
                        <X size={14} className="inline mr-1" />
                        Deshabilitar todos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modulosAdmin.map((modulo) => (
                      <label
                        key={modulo.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                          userPermisos[modulo.id]
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={userPermisos[modulo.id] || false}
                          onChange={() => togglePermiso(modulo.id)}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700 flex-1">
                          {modulo.nombre}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Módulos de Cajero - Solo si el rol es cajero */}
              {(selectedUser.rol.toLowerCase() === 'cajero' || selectedUser.rol.toLowerCase() === 'bodeguero') && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      Módulos de Cajero ({modulosCajero.length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => habilitarTodos('cajero')}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium"
                      >
                        <Check size={14} className="inline mr-1" />
                        Habilitar todos
                      </button>
                      <button
                        onClick={() => deshabilitarTodos('cajero')}
                        className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                      >
                        <X size={14} className="inline mr-1" />
                        Deshabilitar todos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modulosCajero.map((modulo) => {
                      const isChecked = userPermisos[modulo.id] || false;
                      return (
                        <label
                          key={modulo.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                            isChecked
                              ? 'bg-sky-50 border-sky-300'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermiso(modulo.id)}
                            className="w-5 h-5 text-sky-600 rounded focus:ring-2 focus:ring-sky-500"
                          />
                          <span className="text-sm font-medium text-slate-700 flex-1">
                            {modulo.nombre}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer con botones */}
            <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowPermisosModal(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePermisos}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:brightness-110 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-md transition"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Guardar Permisos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
