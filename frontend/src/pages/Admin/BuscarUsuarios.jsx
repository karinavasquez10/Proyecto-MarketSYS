import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  actualizarPerfil,
  eliminarPerfil,
  listarPerfiles,
  restablecerContrasenaPerfil,
} from "../../services/perfilesService";
import {
  aprobarSolicitudRecuperacion,
  listarSolicitudesRecuperacion,
  rechazarSolicitudRecuperacion,
} from "../../services/authService";
import { listarSucursalesActivas } from "../../services/sucursalesService";

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "cajero", label: "Cajero" },
  { value: "bodeguero", label: "Bodeguero" },
];

const estadoLabel = {
  1: "Activo",
  0: "Inactivo",
};

export default function BuscarUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [solicitudesRecuperacion, setSolicitudesRecuperacion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");
  const [rolFiltro, setRolFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [rejectObservation, setRejectObservation] = useState("");
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    rol: "cajero",
    estado: 1,
    id_sucursal: 1,
    telefono: "",
    cargo: "",
    password: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [usuariosData, sucursalesData, solicitudesData] = await Promise.all([
        listarPerfiles(),
        listarSucursalesActivas(),
        listarSolicitudesRecuperacion({ estado: "pendiente" }),
      ]);
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
      setSolicitudesRecuperacion(Array.isArray(solicitudesData) ? solicitudesData : []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setError(err.message || "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  const resumen = useMemo(() => {
    const activos = usuarios.filter((u) => Number(u.estado) === 1).length;
    const admins = usuarios.filter((u) => String(u.rol).toLowerCase() === "admin").length;
    const cajeros = usuarios.filter((u) => String(u.rol).toLowerCase() === "cajero").length;

    return {
      total: usuarios.length,
      activos,
      inactivos: usuarios.length - activos,
      admins,
      cajeros,
      solicitudes: solicitudesRecuperacion.length,
    };
  }, [solicitudesRecuperacion.length, usuarios]);

  const getAdminId = () => {
    try {
      const raw = localStorage.getItem("authUser");
      const user = raw ? JSON.parse(raw) : null;
      return user?.id || user?.id_usuario || 1;
    } catch {
      return 1;
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const busqueda = filtro.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const coincideTexto = !busqueda || [
        usuario.nombre,
        usuario.correo,
        usuario.documento_identidad,
        usuario.telefono,
        usuario.cargo,
      ].some((valor) => String(valor || "").toLowerCase().includes(busqueda));
      const coincideRol = rolFiltro === "todos" || usuario.rol === rolFiltro;
      const coincideEstado = estadoFiltro === "todos" || Number(usuario.estado) === Number(estadoFiltro);

      return coincideTexto && coincideRol && coincideEstado;
    });
  }, [estadoFiltro, filtro, rolFiltro, usuarios]);

  const openEditModal = (usuario) => {
    setSelectedUser(usuario);
    setFormData({
      nombre: usuario.nombre || "",
      correo: usuario.correo || "",
      rol: usuario.rol || "cajero",
      estado: Number(usuario.estado) === 1 ? 1 : 0,
      id_sucursal: usuario.id_sucursal || sucursales[0]?.id_sucursal || 1,
      telefono: usuario.telefono || "",
      cargo: usuario.cargo || "",
      password: "",
    });
    setShowPassword(false);
    setShowEditModal(true);
  };

  const handleCopyTemporaryPassword = async () => {
    if (!tempPasswordModal?.password) return;

    try {
      await navigator.clipboard.writeText(tempPasswordModal.password);
      setNotice({
        type: "success",
        title: "Contraseña copiada",
        message: "La contraseña temporal quedó copiada al portapapeles.",
      });
    } catch (err) {
      console.error("No se pudo copiar la contraseña:", err);
      setNotice({
        type: "warning",
        title: "Copia manual requerida",
        message: "No se pudo copiar automáticamente. Puedes seleccionar la contraseña y copiarla manualmente.",
      });
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!formData.nombre.trim() || !formData.correo.trim()) {
      setNotice({
        type: "warning",
        title: "Datos obligatorios",
        message: "Nombre y correo son obligatorios para guardar el usuario.",
      });
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setNotice({
        type: "warning",
        title: "Contraseña muy corta",
        message: "La contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        nombre: formData.nombre.trim(),
        correo: formData.correo.trim(),
        rol: formData.rol,
        estado: Number(formData.estado),
        id_sucursal: Number(formData.id_sucursal),
        telefono: formData.telefono?.trim() || null,
        cargo: formData.cargo?.trim() || null,
      };

      if (formData.password.trim()) {
        payload.contrasena = formData.password.trim();
      }

      await actualizarPerfil(selectedUser.id_usuario, payload);
      setShowEditModal(false);
      await fetchData();
      setNotice({
        type: "success",
        title: "Usuario actualizado",
        message: "Los datos del usuario fueron guardados correctamente.",
      });
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      setNotice({
        type: "error",
        title: "No se pudo actualizar",
        message: err.message || "Error al actualizar usuario.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setConfirmAction({
      title: "Restablecer contraseña",
      message: "Se generará una contraseña temporal para entregarla al usuario.",
      detail: selectedUser.nombre,
      confirmText: "Generar contraseña",
      onConfirm: confirmarRestablecerPassword,
    });
  };

  const confirmarRestablecerPassword = async () => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      const response = await restablecerContrasenaPerfil(selectedUser.id_usuario);
      setConfirmAction(null);
      setTempPasswordModal({
        title: "Contraseña temporal generada",
        description: "Entrégala al usuario para que pueda iniciar sesión. Al entrar deberá crear una contraseña nueva.",
        userName: selectedUser.nombre,
        userEmail: selectedUser.correo,
        password: response.contrasena_temporal,
      });
    } catch (err) {
      console.error("Error al restablecer contraseña:", err);
      setNotice({
        type: "error",
        title: "No se pudo restablecer",
        message: err.message || "Error al restablecer contraseña.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRecoveryRequest = async (solicitud) => {
    setConfirmAction({
      title: "Aprobar recuperación",
      message: "Se generará una contraseña temporal y el usuario deberá cambiarla al iniciar sesión.",
      detail: solicitud.nombre || solicitud.correo,
      confirmText: "Aprobar solicitud",
      onConfirm: () => confirmarAprobarSolicitud(solicitud),
    });
  };

  const confirmarAprobarSolicitud = async (solicitud) => {
    try {
      setLoading(true);
      const response = await aprobarSolicitudRecuperacion(solicitud.id_solicitud, {
        id_admin: getAdminId(),
      });
      await fetchData();
      setConfirmAction(null);
      setTempPasswordModal({
        title: "Solicitud aprobada",
        description: "Se generó una contraseña temporal. Entrégala al usuario; el sistema le pedirá cambiarla al iniciar sesión.",
        userName: response.usuario?.nombre || solicitud.nombre,
        userEmail: response.usuario?.correo || solicitud.correo,
        password: response.contrasena_temporal,
      });
    } catch (err) {
      console.error("Error al aprobar solicitud:", err);
      setNotice({
        type: "error",
        title: "No se pudo aprobar",
        message: err.message || "No se pudo aprobar la solicitud.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRecoveryRequest = async (solicitud) => {
    setRejectObservation("");
    setRejectRequest(solicitud);
  };

  const confirmarRechazoSolicitud = async () => {
    if (!rejectRequest) return;
    try {
      setLoading(true);
      await rechazarSolicitudRecuperacion(rejectRequest.id_solicitud, {
        id_admin: getAdminId(),
        observacion: rejectObservation,
      });
      await fetchData();
      setRejectRequest(null);
      setRejectObservation("");
      setNotice({
        type: "success",
        title: "Solicitud rechazada",
        message: "La solicitud de recuperación fue rechazada correctamente.",
      });
    } catch (err) {
      console.error("Error al rechazar solicitud:", err);
      setNotice({
        type: "error",
        title: "No se pudo rechazar",
        message: err.message || "No se pudo rechazar la solicitud.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (usuario) => {
    setConfirmAction({
      variant: "danger",
      title: "Eliminar usuario",
      message: "Esta acción quitará el acceso del usuario al sistema.",
      detail: usuario.nombre,
      confirmText: "Eliminar usuario",
      onConfirm: () => confirmarEliminarUsuario(usuario),
    });
  };

  const confirmarEliminarUsuario = async (usuario) => {
    try {
      setLoading(true);
      await eliminarPerfil(usuario.id_usuario);
      await fetchData();
      setConfirmAction(null);
      setNotice({
        type: "success",
        title: "Usuario eliminado",
        message: "El usuario fue eliminado correctamente.",
      });
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      setNotice({
        type: "error",
        title: "No se pudo eliminar",
        message: err.message || "Error al eliminar usuario.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <UserCog size={20} />
          </div>
          <div>
            <h1 className="admin-module-title">Gestión usuarios</h1>
            <p className="admin-module-subtitle">
              Edita datos básicos, estado, sucursal, cargo, contraseña y eliminación de usuarios.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-sm border border-[#9eb8ff] bg-white px-4 py-2 text-sm font-black text-[#152b73] shadow-sm transition hover:bg-[#f0f5ff]"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        {[
          ["Usuarios", resumen.total],
          ["Activos", resumen.activos],
          ["Inactivos", resumen.inactivos],
          ["Admins", resumen.admins],
          ["Cajeros", resumen.cajeros],
          ["Solicitudes", resumen.solicitudes],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-[#c8d7ff] bg-white/95 p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-[#152b73]">{label}</p>
            <p className="mt-1 text-2xl font-black text-[#111827]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9e3ff] bg-[#f8fbf7] px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
              <KeyRound size={18} className="text-[#3157d5]" />
              Solicitudes de recuperación
            </h2>
            <p className="mt-1 text-xs font-bold text-[#47524e]">
              Aprueba solo si reconoces al usuario. Se genera una contraseña temporal y queda obligado a cambiarla.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-sm bg-[#eef4ff] px-3 py-1.5 text-xs font-black text-[#152b73]">
            <Clock size={14} />
            {solicitudesRecuperacion.length} pendiente(s)
          </span>
        </div>

        {solicitudesRecuperacion.length === 0 ? (
          <div className="px-4 py-6 text-sm font-bold text-[#47524e]">
            No hay solicitudes pendientes de cambio de contraseña.
          </div>
        ) : (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {solicitudesRecuperacion.map((solicitud) => (
              <article
                key={solicitud.id_solicitud}
                className="rounded-sm border border-[#d9e3ff] bg-[#fffdf8] p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#111827]">
                      {solicitud.nombre || "Usuario sin nombre"}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#152b73]">
                      <Mail size={13} />
                      {solicitud.correo}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase text-[#47524e]">
                      Rol: {solicitud.rol || "Sin rol"} - Solicitud #{solicitud.id_solicitud}
                    </p>
                  </div>
                  <span className="rounded-sm bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">
                    Pendiente
                  </span>
                </div>

                {solicitud.mensaje && (
                  <p className="mt-3 rounded-sm border border-[#e4e0cf] bg-white px-3 py-2 text-sm font-semibold text-[#303735]">
                    {solicitud.mensaje}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRejectRecoveryRequest(solicitud)}
                    disabled={loading}
                    className="rounded-sm border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black text-[#7f1d1d] transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveRecoveryRequest(solicitud)}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#18a36b] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} />
                    Aprobar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-sm border border-[#c8d7ff] bg-[#f8fbf7] p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px]">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Buscar usuario</span>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3157d5]" />
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Nombre, correo, documento, teléfono o cargo"
                className="h-11 w-full rounded-sm border border-[#b9caff] bg-white pl-10 pr-3 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Filtrar por rol</span>
            <select
              value={rolFiltro}
              onChange={(e) => setRolFiltro(e.target.value)}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              <option value="todos">Todos</option>
              {roles.map((rol) => (
                <option key={rol.value} value={rol.value}>{rol.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Filtrar por estado</span>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              <option value="todos">Todos</option>
              <option value="1">Activos</option>
              <option value="0">Inactivos</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-white px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
            <Users size={18} className="text-[#3157d5]" />
            Usuarios registrados
          </h2>
          <span className="rounded-sm bg-[#e9f2e9] px-3 py-1 text-xs font-black text-[#152b73]">
            {usuariosFiltrados.length} resultado(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-bold text-[#152b73]">Cargando usuarios...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] table-fixed text-sm">
              <thead className="bg-[#eef4ff] text-[#152b73]">
                <tr>
                  <th className="w-[24%] px-4 py-3 text-left text-xs font-black uppercase">Usuario</th>
                  <th className="w-[24%] px-4 py-3 text-left text-xs font-black uppercase">Contacto</th>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-black uppercase">Rol</th>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-black uppercase">Sucursal</th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-black uppercase">Estado</th>
                  <th className="w-[10%] px-4 py-3 text-center text-xs font-black uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id_usuario} className="transition hover:bg-[#f7fbf3]">
                    <td className="px-4 py-3">
                      <p className="truncate font-black text-[#111827]">{usuario.nombre}</p>
                      <p className="truncate text-xs font-bold text-[#47524e]">
                        Doc: {usuario.documento_identidad || "Sin documento"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex min-w-0 items-center gap-1 truncate font-bold text-[#111827]">
                        <Mail size={14} className="shrink-0 text-[#3157d5]" />
                        {usuario.correo}
                      </p>
                      <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]">
                        <Phone size={13} className="shrink-0 text-[#3157d5]" />
                        {usuario.telefono || "Sin teléfono"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-sm border border-[#b9caff] bg-[#f5f8ff] px-2 py-1 text-xs font-black uppercase text-[#152b73]">
                        {usuario.rol || "usuario"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate font-bold text-[#111827]">{usuario.sucursal_nombre || "Sin asignar"}</p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-[#47524e]">
                        <Briefcase size={13} className="shrink-0 text-[#3157d5]" />
                        {usuario.cargo || "Sin cargo"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-sm px-2 py-1 text-xs font-black ${
                          Number(usuario.estado) === 1
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {estadoLabel[Number(usuario.estado)] || "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(usuario)}
                          className="rounded-sm border border-[#b9caff] bg-white p-2 text-[#152b73] transition hover:bg-[#eef4ff]"
                          title="Editar usuario"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(usuario)}
                          className="rounded-sm border border-rose-300 bg-white p-2 text-[#7f1d1d] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                          title="Eliminar usuario"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {usuariosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-sm font-bold text-[#47524e]">
                      No se encontraron usuarios con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tempPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-md border border-white/70 bg-white shadow-2xl shadow-slate-950/25">
            <div className="relative bg-[linear-gradient(135deg,#233876,#3157d5_58%,#18a36b)] px-5 py-5 text-white">
              <button
                type="button"
                onClick={() => setTempPasswordModal(null)}
                className="absolute right-4 top-4 rounded-sm border border-white/30 bg-white/10 p-2 text-white transition hover:bg-white/20"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
              <div className="flex items-start gap-3 pr-12">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-white/30 bg-white/15">
                  <CheckCircle2 size={24} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white/80">Recuperación autorizada</p>
                  <h2 className="mt-1 text-xl font-black leading-tight">{tempPasswordModal.title}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/90">
                    {tempPasswordModal.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-sm border border-[#d9e3ff] bg-[#f8fbf7] p-4">
                <p className="text-xs font-black uppercase text-[#152b73]">Usuario</p>
                <p className="mt-1 text-base font-black text-[#111827]">{tempPasswordModal.userName || "Usuario"}</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#303735]">
                  <Mail size={14} className="text-[#3157d5]" />
                  {tempPasswordModal.userEmail || "Sin correo"}
                </p>
              </div>

              <div className="rounded-sm border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase text-amber-950">Contraseña temporal</p>
                  <span className="rounded-sm bg-white px-2 py-1 text-[11px] font-black text-amber-900">
                    Requiere cambio al ingresar
                  </span>
                </div>
                <div className="flex items-stretch overflow-hidden rounded-sm border border-amber-300 bg-white shadow-sm">
                  <div className="flex min-h-14 flex-1 items-center px-4">
                    <code className="break-all font-mono text-2xl font-black tracking-wide text-[#111827]">
                      {tempPasswordModal.password}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTemporaryPassword}
                    className="inline-flex items-center gap-2 border-l border-amber-200 bg-[#fff7e6] px-4 text-sm font-black text-amber-950 transition hover:bg-amber-100"
                  >
                    <Copy size={16} />
                    Copiar
                  </button>
                </div>
              </div>

              <div className="rounded-sm border border-[#d9e3ff] bg-[#eef4ff] px-4 py-3 text-sm font-bold leading-6 text-[#152b73]">
                Esta contraseña solo debe entregarse al usuario correcto. Después de usarla, el sistema le pedirá crear una nueva contraseña personal.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => setTempPasswordModal(null)}
                  className="rounded-sm border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-black text-[#111827] transition hover:bg-slate-200"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleCopyTemporaryPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#18a36b] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
                >
                  <Copy size={17} />
                  Copiar contraseña
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-sm bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-[#eef4ff] px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-[#111827]">
                  <Edit2 size={18} className="text-[#3157d5]" />
                  Editar usuario
                </h2>
                <p className="text-xs font-bold text-[#47524e]">{selectedUser.nombre}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-sm border border-[#b9caff] bg-white p-2 text-[#152b73] transition hover:bg-[#f5f8ff]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Nombre completo *</span>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Correo electrónico *</span>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Rol</span>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                  >
                    {roles.map((rol) => (
                      <option key={rol.value} value={rol.value}>{rol.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Estado</span>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: Number(e.target.value) })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                  >
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Sucursal activa</span>
                  <select
                    value={formData.id_sucursal}
                    onChange={(e) => setFormData({ ...formData, id_sucursal: Number(e.target.value) })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                  >
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {sucursal.nombre} - {sucursal.ciudad}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Teléfono</span>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                    placeholder="3001234567"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Cargo</span>
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="h-11 w-full rounded-sm border border-[#b9caff] px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                    placeholder="Ej: Cajera principal"
                  />
                </label>
              </div>

              <div className="rounded-sm border border-amber-200 bg-amber-50 p-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-amber-900">
                    Nueva contraseña opcional
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-11 w-full rounded-sm border border-amber-200 bg-white px-3 pr-10 text-sm font-bold text-[#111827] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      placeholder="Dejar vacío para conservar la actual"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-800"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="mt-3 rounded-sm border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  Restablecer contraseña temporal
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[#d9e3ff] pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-sm border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-black text-[#111827] transition hover:bg-slate-200"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  disabled={loading}
                >
                  <Save size={17} />
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmAction && (
        <UserConfirmDialog
          variant={confirmAction.variant}
          title={confirmAction.title}
          message={confirmAction.message}
          detail={confirmAction.detail}
          confirmText={confirmAction.confirmText}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmAction.onConfirm}
        />
      )}
      {rejectRequest && (
        <RejectRecoveryDialog
          solicitud={rejectRequest}
          observacion={rejectObservation}
          onChange={setRejectObservation}
          onCancel={() => {
            setRejectRequest(null);
            setRejectObservation("");
          }}
          onConfirm={confirmarRechazoSolicitud}
        />
      )}
      {notice && (
        <UserNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function UserConfirmDialog({ variant = "warning", title, message, detail, confirmText, onCancel, onConfirm }) {
  const danger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm ${danger ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-[#111827]">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#303735]">{message}</p>
            {detail && (
              <div className="mt-3 rounded-sm border border-[#d9e3ff] bg-[#f8fbf7] px-3 py-2 text-xs font-black uppercase text-[#152b73]">
                {detail}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[#111827] transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-sm px-4 py-2 text-sm font-black text-white shadow-sm transition ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#3157d5] hover:brightness-110"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectRecoveryDialog({ solicitud, observacion, onChange, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-rose-100 text-rose-700">
            <X size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-[#111827]">Rechazar solicitud</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#303735]">
              Puedes dejar una observación para la solicitud de {solicitud.nombre || solicitud.correo}.
            </p>
          </div>
        </div>
        <textarea
          value={observacion}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          placeholder="Motivo u observación opcional"
          className="mt-4 w-full resize-none rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
        />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[#111827] transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-rose-700"
          >
            Rechazar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

function UserNotice({ type = "info", title, message, onClose }) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const iconClass = isSuccess
    ? "bg-emerald-100 text-emerald-700"
    : isError
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm ${iconClass}`}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-[#111827]">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#303735]">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-[#3157d5] px-5 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-110"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
