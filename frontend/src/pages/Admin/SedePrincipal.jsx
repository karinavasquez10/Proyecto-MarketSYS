import React, { useState, useEffect } from "react";
import { AlertTriangle, Building2, Plus, Edit2, Trash2, Users, MapPin, Phone, X, Check, CheckCircle2 } from "lucide-react";
import {
  actualizarSucursal,
  crearSucursal,
  eliminarSucursal,
  listarSucursales,
  listarUsuariosSucursal,
} from "../../services/sucursalesService";

export default function SedePrincipal() {
  const [sucursales, setSucursales] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    ciudad: "",
    estado: "activa"
  });
  const [usuariosPorSucursal, setUsuariosPorSucursal] = useState({});
  const [notice, setNotice] = useState(null);
  const [sucursalEliminar, setSucursalEliminar] = useState(null);

  // Cargar sucursales al montar el componente
  useEffect(() => {
    fetchSucursales();
  }, []);

  // Obtener todas las sucursales
  const fetchSucursales = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const data = await listarSucursales();
      setSucursales(data);

      // Cargar usuarios por cada sucursal
      const usuariosEntries = await Promise.all(
        data.map(async (sucursal) => {
          const users = await listarUsuariosSucursal(sucursal.id_sucursal);
          return [sucursal.id_sucursal, users.length];
        })
      );
      const usuariosData = Object.fromEntries(usuariosEntries);
      setUsuariosPorSucursal(usuariosData);
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
      setNotice({
        type: "error",
        title: "No se pudieron cargar las sucursales",
        message: error.message || "Revisa la conexión con el servidor e intenta de nuevo.",
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Abrir modal para crear
  const handleCreate = () => {
    setEditMode(false);
    setSelectedSucursal(null);
    setFormData({
      nombre: "",
      direccion: "",
      telefono: "",
      ciudad: "",
      estado: "activa"
    });
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleEdit = (sucursal) => {
    setEditMode(true);
    setSelectedSucursal(sucursal);
    setFormData({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || "",
      telefono: sucursal.telefono || "",
      ciudad: sucursal.ciudad,
      estado: sucursal.estado
    });
    setShowModal(true);
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Guardar sucursal (crear o editar)
  const handleSave = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.ciudad) {
      setNotice({
        type: "warning",
        title: "Datos obligatorios",
        message: "Nombre y ciudad son obligatorios para guardar la sucursal.",
      });
      return;
    }
    if (formData.telefono && !/^[0-9+\s()-]{7,20}$/.test(formData.telefono.trim())) {
      setNotice({
        type: "warning",
        title: "Teléfono inválido",
        message: "Usa números y signos habituales como +, espacios o guiones.",
      });
      return;
    }
    if (
      editMode &&
      selectedSucursal?.estado === "activa" &&
      formData.estado === "inactiva"
    ) {
      const activasRestantes = sucursales.filter(
        (sucursal) => sucursal.id_sucursal !== selectedSucursal.id_sucursal && sucursal.estado === "activa"
      ).length;

      if (activasRestantes === 0) {
        setNotice({
          type: "warning",
          title: "Debe existir otra sucursal activa",
          message: "Antes de inactivar esta sucursal, activa otra sede para que el sistema siga operando.",
        });
        return;
      }
    }

    try {
      setSaving(true);
      if (editMode && selectedSucursal) {
        // Actualizar
        await actualizarSucursal(selectedSucursal.id_sucursal, formData);
        setNotice({
          type: "success",
          title: "Sucursal actualizada",
          message: "Los datos de la sucursal fueron guardados correctamente.",
        });
      } else {
        // Crear
        await crearSucursal(formData);
        setNotice({
          type: "success",
          title: "Sucursal creada",
          message: "La nueva sucursal fue registrada correctamente.",
        });
      }

      await fetchSucursales({ showLoader: false });
      setShowModal(false);
      setSelectedSucursal(null);
    } catch (error) {
      console.error("Error al guardar sucursal:", error);
      setNotice({
        type: "error",
        title: "No se pudo guardar",
        message: error.message || "Error al guardar la sucursal.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Eliminar sucursal
  const handleDelete = async (sucursal) => {
    const usuariosCount = usuariosPorSucursal[sucursal.id_sucursal] || 0;

    if (usuariosCount > 0) {
      setNotice({
        type: "warning",
        title: "Sucursal con usuarios",
        message: `No se puede eliminar porque tiene ${usuariosCount} usuario(s) asociado(s).`,
      });
      return;
    }

    setSucursalEliminar(sucursal);
  };

  const confirmarEliminarSucursal = async () => {
    if (!sucursalEliminar) return;
    try {
      setDeleting(true);
      await eliminarSucursal(sucursalEliminar.id_sucursal);
      setSucursalEliminar(null);
      setNotice({
        type: "success",
        title: "Sucursal eliminada",
        message: "La sucursal fue eliminada correctamente.",
      });
      await fetchSucursales({ showLoader: false });
    } catch (error) {
      console.error("Error al eliminar sucursal:", error);
      setNotice({
        type: "error",
        title: "No se pudo eliminar",
        message: error.message || "Error al eliminar la sucursal.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-module-page notranslate" translate="no">
      {/* ====== Encabezado ====== */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-cyan-600 to-indigo-600 p-2.5 rounded-sm shadow-sm text-white">
            <Building2 size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Gestión de Sucursales
          </h1>
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-lime-600 hover:brightness-110 text-white px-4 py-2.5 rounded-sm text-sm shadow-sm transition"
        >
          <Plus size={18} />
          Nueva Sucursal
        </button>
      </div>

      {/* ====== Tarjeta de información general ====== */}
      <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              MARKETSYS
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Total de sucursales: <span className="font-medium text-slate-600">{sucursales.length}</span>
            </p>
          </div>
          <div className="mt-3 sm:mt-0 text-sm bg-gradient-to-r from-cyan-100 to-indigo-100 text-cyan-800 px-3 py-1.5 rounded-md shadow-sm">
            Sistema activo <span className="font-semibold text-cyan-700">✓</span>
          </div>
        </div>
      </div>

      {/* ====== Lista de Sucursales ====== */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-600"></div>
          <p className="mt-4 text-slate-600">Cargando sucursales...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sucursales.map((sucursal) => (
            <div
              key={sucursal.id_sucursal}
              className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-6 hover:shadow-sm transition-shadow"
            >
              {/* Header de la tarjeta */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    {sucursal.nombre}
                  </h3>
                  <span
                    className={`inline-block px-2 py-1 text-xs rounded-full ${
                      sucursal.estado === "activa"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {sucursal.estado === "activa" ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </div>

              {/* Información de la sucursal */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={16} className="text-cyan-600" />
                  <span>{sucursal.ciudad}</span>
                </div>

                {sucursal.direccion && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <MapPin size={16} className="text-cyan-600 mt-0.5" />
                    <span className="flex-1">{sucursal.direccion}</span>
                  </div>
                )}

                {sucursal.telefono && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={16} className="text-cyan-600" />
                    <span>{sucursal.telefono}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users size={16} className="text-cyan-600" />
                  <span>
                    {usuariosPorSucursal[sucursal.id_sucursal] || 0} usuario(s)
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(sucursal)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-sky-500 hover:brightness-110 text-white px-3 py-2 rounded-sm text-sm shadow-sm transition"
                >
                  <Edit2 size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(sucursal)}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 hover:brightness-110 text-white px-3 py-2 rounded-sm text-sm shadow-sm transition"
                  disabled={usuariosPorSucursal[sucursal.id_sucursal] > 0}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mensaje si no hay sucursales */}
      {!loading && sucursales.length === 0 && (
        <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-12 text-center">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            No hay sucursales registradas
          </h3>
          <p className="text-slate-500 mb-4">
            Comienza creando tu primera sucursal
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-lime-600 hover:brightness-110 text-white px-6 py-2.5 rounded-sm text-sm shadow-sm transition"
          >
            <Plus size={18} />
            Nueva Sucursal
          </button>
        </div>
      )}

      {/* ====== Modal para Crear/Editar ====== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">
                {editMode ? "Editar Sucursal" : "Nueva Sucursal"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre de la Sucursal *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    placeholder="Ej: Sucursal Centro"
                    className="w-full border border-slate-300 rounded-sm px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-200 focus:border-cyan-600 focus:outline-none"
                    required
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ciudad *
                  </label>
                  <input
                    type="text"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleInputChange}
                    placeholder="Ej: Bogotá"
                    className="w-full border border-slate-300 rounded-sm px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-200 focus:border-cyan-600 focus:outline-none"
                    required
                  />
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleInputChange}
                    placeholder="Ej: Calle 123 #45-67"
                    className="w-full border border-slate-300 rounded-sm px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-200 focus:border-cyan-600 focus:outline-none"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    placeholder="Ej: 3001234567"
                    className="w-full border border-slate-300 rounded-sm px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-200 focus:border-cyan-600 focus:outline-none"
                  />
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estado
                  </label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-sm px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-200 focus:border-cyan-600 focus:outline-none"
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                  </select>
                </div>
              </div>

              {/* Botones del formulario */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-sm text-sm font-medium transition"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-lime-600 hover:brightness-110 text-white px-4 py-2.5 rounded-sm text-sm font-medium shadow-sm transition"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {editMode ? "Actualizar" : "Crear"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {sucursalEliminar && (
        <SucursalConfirmDialog
          sucursal={sucursalEliminar}
          onCancel={() => setSucursalEliminar(null)}
          onConfirm={confirmarEliminarSucursal}
          loading={deleting}
        />
      )}
      {notice && (
        <SucursalNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function SucursalConfirmDialog({ sucursal, onCancel, onConfirm, loading = false }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-rose-100 text-rose-700">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">Eliminar sucursal</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">
              Esta acción eliminará la sucursal seleccionada del sistema.
            </p>
            <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700">
              {sucursal.nombre}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-sm bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Eliminando..." : "Eliminar sucursal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SucursalNotice({ type = "info", title, message, onClose }) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const iconClass = isSuccess
    ? "bg-emerald-100 text-emerald-700"
    : isError
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm ${iconClass}`}>
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
