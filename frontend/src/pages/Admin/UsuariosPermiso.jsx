// src/pages/Admin/UsuariosPermisos.jsx
import React, { useState, useEffect } from "react";
import { Users, Shield, Save, X, Check, AlertTriangle, CheckCircle2 } from "lucide-react";
import { listarPerfiles } from "../../services/perfilesService";
import {
  guardarPermisosUsuario,
  inicializarPermisosUsuario,
  listarModulosPermisos,
  listarPermisosUsuario,
} from "../../services/permisosService";

export default function UsuariosPermiso() {
  const [usuarios, setUsuarios] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermisos, setUserPermisos] = useState({});
  const [notice, setNotice] = useState(null);
  const [confirmInit, setConfirmInit] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    fetchUsuarios();
    fetchModulos();
  }, []);

  // Obtener usuarios
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const data = await listarPerfiles();
      setUsuarios(data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      setNotice({
        type: "error",
        title: "No se pudieron cargar usuarios",
        message: error.message || "Intenta actualizar la página o revisar la conexión con el servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Obtener módulos disponibles
  const fetchModulos = async () => {
    try {
      const data = await listarModulosPermisos();
      setModulos(data);
    } catch (error) {
      console.error("Error al cargar módulos:", error);
    }
  };

  // Abrir modal de permisos
  const handleOpenPermisos = async (usuario) => {
    setSelectedUser(usuario);
    try {
      setLoading(true);
      const data = await listarPermisosUsuario(usuario.id_usuario);

      // Inicializar permisos con los valores de la BD
      const permisosIniciales = {};
      Object.keys(data).forEach(moduloId => {
        permisosIniciales[moduloId] = data[moduloId] === true;
      });

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
    setConfirmInit(true);
  };

  const confirmarInicializarPermisos = async () => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      const response = await inicializarPermisosUsuario(selectedUser.id_usuario);

      // Recargar permisos
      const permisosResponse = await listarPermisosUsuario(selectedUser.id_usuario);
      const permisosActualizados = {};
      Object.keys(permisosResponse).forEach(moduloId => {
        permisosActualizados[moduloId] = permisosResponse[moduloId] === true;
      });

      setUserPermisos(permisosActualizados);
      setConfirmInit(false);
      setNotice({
        type: "success",
        title: "Permisos inicializados",
        message: `${response.permisos_creados} módulos quedaron habilitados según el rol del usuario.`,
      });
    } catch (error) {
      console.error("Error al inicializar permisos:", error);
      setNotice({
        type: "error",
        title: "No se pudieron inicializar",
        message: error.message || "Ocurrió un error al inicializar los permisos.",
      });
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

    try {
      setLoading(true);
      await guardarPermisosUsuario(selectedUser.id_usuario, userPermisos);
      setNotice({
        type: "success",
        title: "Permisos guardados",
        message: "Los permisos del usuario fueron actualizados correctamente.",
      });
      setShowPermisosModal(false);
    } catch (error) {
      console.error("Error al guardar permisos:", error);
      setNotice({
        type: "error",
        title: "No se pudieron guardar",
        message: error.message || "Ocurrió un error al guardar los permisos.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar módulos según el rol del usuario seleccionado
  const modulosAdmin = modulos.filter(m => m.categoria === 'admin');
  const modulosCajero = modulos.filter(m => m.categoria === 'cajero');

  return (
    <div className="admin-module-page">
      {/* ===== Encabezado ===== */}
      <div className="admin-module-header">
        <div className="admin-module-heading">
        <div className="admin-module-icon">
          <Users size={20} />
        </div>
        <div>
          <h1 className="admin-module-title">Permisos usuarios</h1>
          <p className="admin-module-subtitle">Gestiona únicamente los módulos y accesos disponibles para cada usuario.</p>
        </div>
        </div>
      </div>

      {/* ===== Lista de usuarios ===== */}
      <div className="bg-white/90 border border-indigo-100 rounded-sm shadow-sm p-6 mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <Shield size={18} className="text-indigo-500" />
            Usuarios con gestión de permisos ({usuarios.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-slate-600">Cargando usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-slate-200 rounded-sm overflow-hidden">
              <thead className="bg-gradient-to-r from-indigo-400/80 to-sky-400/80 text-white">
                <tr>
                  {["Nombre", "Correo", "Rol", "Sucursal", "Estado", "Permisos"].map((col) => (
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
                      <div className="flex">
                        <button
                          onClick={() => handleOpenPermisos(u)}
                          className="inline-flex items-center gap-2 rounded-sm border border-[#9eb8ff] bg-white px-3 py-2 text-xs font-black text-[#111827] shadow-sm transition hover:bg-[#eef4ff] [&_svg]:stroke-[2.8]"
                          title="Gestionar permisos"
                        >
                          <Shield size={16} className="text-[#3157d5]" />
                          Gestionar
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

      {/* ===== Modal Permisos ===== */}
      {showPermisosModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
              <div className="mb-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-3">
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
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-sm">
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>Este usuario no tiene permisos configurados.</strong>
                      <br />
                      Puedes inicializar los permisos predeterminados según su rol o configurarlos manualmente.
                    </p>
                    <button
                      onClick={handleInicializarPermisos}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:brightness-110 text-white px-4 py-2.5 rounded-sm text-sm font-medium shadow-sm transition"
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
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      Módulos de Administrador ({modulosAdmin.length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => habilitarTodos('admin')}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-sm hover:bg-green-200 transition font-medium"
                      >
                        <Check size={14} className="inline mr-1" />
                        Habilitar todos
                      </button>
                      <button
                        onClick={() => deshabilitarTodos('admin')}
                        className="rounded-sm border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-[#111827] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                      >
                        <X size={14} className="inline mr-1 text-rose-700" />
                        Deshabilitar todos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modulosAdmin.map((modulo) => (
                      <label
                        key={modulo.id}
                        className={`flex items-center gap-3 p-3 rounded-sm border-2 cursor-pointer transition ${
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
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-sm hover:bg-green-200 transition font-medium"
                      >
                        <Check size={14} className="inline mr-1" />
                        Habilitar todos
                      </button>
                      <button
                        onClick={() => deshabilitarTodos('cajero')}
                        className="rounded-sm border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-[#111827] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                      >
                        <X size={14} className="inline mr-1 text-rose-700" />
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
                          className={`flex items-center gap-3 p-3 rounded-sm border-2 cursor-pointer transition ${
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
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-sm text-sm font-medium transition"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePermisos}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-lime-600 hover:brightness-110 text-white px-4 py-2.5 rounded-sm text-sm font-medium shadow-sm transition"
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
      {confirmInit && selectedUser && (
        <PermissionConfirmDialog
          title="Inicializar permisos"
          message={`Se habilitarán los módulos predeterminados para el rol "${selectedUser.rol}".`}
          detail={selectedUser.nombre}
          confirmText="Inicializar permisos"
          onCancel={() => setConfirmInit(false)}
          onConfirm={confirmarInicializarPermisos}
        />
      )}
      {notice && (
        <PermissionNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function PermissionConfirmDialog({ title, message, detail, confirmText, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-amber-100 text-amber-700">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{message}</p>
            {detail && (
              <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700">
                Usuario: {detail}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-cyan-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionNotice({ type = "info", title, message, onClose }) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const iconClass = isSuccess
    ? "bg-emerald-100 text-emerald-700"
    : isError
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${iconClass}`}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-cyan-600 px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
