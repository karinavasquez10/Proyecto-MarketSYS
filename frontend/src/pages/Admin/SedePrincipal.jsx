import React, { useState, useEffect } from "react";
import { Building2, Plus, Edit2, Trash2, Users, MapPin, Phone, X, Check } from "lucide-react";
import api from "../../api";

export default function SedePrincipal() {
  const [sucursales, setSucursales] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    ciudad: "",
    estado: "activa"
  });
  const [usuariosPorSucursal, setUsuariosPorSucursal] = useState({});

  // Cargar sucursales al montar el componente
  useEffect(() => {
    fetchSucursales();
  }, []);

  // Obtener todas las sucursales
  const fetchSucursales = async () => {
    try {
      setLoading(true);
      const response = await api.get("/sucursales");
      setSucursales(response.data);
      
      // Cargar usuarios por cada sucursal
      const usuariosData = {};
      for (const sucursal of response.data) {
        const usersResponse = await api.get(`/sucursales/${sucursal.id_sucursal}/usuarios`);
        usuariosData[sucursal.id_sucursal] = usersResponse.data.length;
      }
      setUsuariosPorSucursal(usuariosData);
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
      alert("Error al cargar las sucursales");
    } finally {
      setLoading(false);
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
      alert("Nombre y ciudad son obligatorios");
      return;
    }

    try {
      setLoading(true);
      if (editMode && selectedSucursal) {
        // Actualizar
        await api.put(`/sucursales/${selectedSucursal.id_sucursal}`, formData);
        alert("Sucursal actualizada exitosamente");
      } else {
        // Crear
        await api.post("/sucursales", formData);
        alert("Sucursal creada exitosamente");
      }
      
      setShowModal(false);
      fetchSucursales();
    } catch (error) {
      console.error("Error al guardar sucursal:", error);
      alert(error.response?.data?.error || "Error al guardar la sucursal");
    } finally {
      setLoading(false);
    }
  };

  // Eliminar sucursal
  const handleDelete = async (sucursal) => {
    const usuariosCount = usuariosPorSucursal[sucursal.id_sucursal] || 0;
    
    if (usuariosCount > 0) {
      alert(`No se puede eliminar la sucursal porque tiene ${usuariosCount} usuario(s) asociado(s)`);
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la sucursal "${sucursal.nombre}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/sucursales/${sucursal.id_sucursal}`);
      alert("Sucursal eliminada exitosamente");
      fetchSucursales();
    } catch (error) {
      console.error("Error al eliminar sucursal:", error);
      alert(error.response?.data?.error || "Error al eliminar la sucursal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-6 sm:px-35 py-5">
      {/* ====== Encabezado ====== */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-orange-500 to-fuchsia-500 p-2.5 rounded-lg shadow-md text-white">
            <Building2 size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Gestión de Sucursales
          </h1>
        </div>
        
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:brightness-110 text-white px-4 py-2.5 rounded-lg text-sm shadow-md transition"
        >
          <Plus size={18} />
          Nueva Sucursal
        </button>
      </div>

      {/* ====== Tarjeta de información general ====== */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              INVENTNET
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Total de sucursales: <span className="font-medium text-slate-600">{sucursales.length}</span>
            </p>
          </div>
          <div className="mt-3 sm:mt-0 text-sm bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 px-3 py-1.5 rounded-md shadow-sm">
            Sistema activo <span className="font-semibold text-orange-600">✓</span>
          </div>
        </div>
      </div>

      {/* ====== Lista de Sucursales ====== */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-slate-600">Cargando sucursales...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sucursales.map((sucursal) => (
            <div
              key={sucursal.id_sucursal}
              className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow"
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
                  <MapPin size={16} className="text-orange-500" />
                  <span>{sucursal.ciudad}</span>
                </div>
                
                {sucursal.direccion && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <MapPin size={16} className="text-orange-500 mt-0.5" />
                    <span className="flex-1">{sucursal.direccion}</span>
                  </div>
                )}
                
                {sucursal.telefono && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={16} className="text-orange-500" />
                    <span>{sucursal.telefono}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users size={16} className="text-orange-500" />
                  <span>
                    {usuariosPorSucursal[sucursal.id_sucursal] || 0} usuario(s)
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(sucursal)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-sky-500 hover:brightness-110 text-white px-3 py-2 rounded-lg text-sm shadow-sm transition"
                >
                  <Edit2 size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(sucursal)}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 hover:brightness-110 text-white px-3 py-2 rounded-lg text-sm shadow-sm transition"
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
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-12 text-center">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            No hay sucursales registradas
          </h3>
          <p className="text-slate-500 mb-6">
            Comienza creando tu primera sucursal
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:brightness-110 text-white px-6 py-2.5 rounded-lg text-sm shadow-md transition"
          >
            <Plus size={18} />
            Nueva Sucursal
          </button>
        </div>
      )}

      {/* ====== Modal para Crear/Editar ====== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 focus:outline-none"
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 focus:outline-none"
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 focus:outline-none"
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 focus:outline-none"
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 focus:outline-none"
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
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
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
    </div>
  );
}
