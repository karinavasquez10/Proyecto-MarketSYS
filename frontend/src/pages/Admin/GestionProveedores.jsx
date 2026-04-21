// GestionProveedores.jsx (versión corregida - mejoras en posicionamiento para texto largo en tabla, sin cambios en diseño general)
import React, { useState, useEffect } from "react";
import { PlusCircle, Edit2, Trash2, Search } from "lucide-react";

export default function GestionProveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [formData, setFormData] = useState({
    id: null,
    nombre: "",
    identificacion: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [modoEdicion, setModoEdicion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch inicial de proveedores
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("http://localhost:5000/api/proveedores");
        if (!res.ok) {
          throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
        }
        const data = await res.json();
        setProveedores(
          data.map((p) => ({
            id: p.id_proveedor,
            nombre: p.nombre,
            identificacion: p.identificacion || "",
            telefono: p.telefono || "",
            email: p.correo || "",
            direccion: p.direccion || "",
          }))
        );
      } catch (err) {
        console.error("Error al fetch proveedores:", err);
        setError(err.message || "Error de conexión al servidor");
        setProveedores([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProveedores();
  }, []);

  // Refetch helper
  const refetchProveedores = async () => {
    try {
      setError(null);
      const res = await fetch("http://localhost:5000/api/proveedores");
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
      }
      const data = await res.json();
      setProveedores(
        data.map((p) => ({
          id: p.id_proveedor,
          nombre: p.nombre,
          identificacion: p.identificacion || "",
          telefono: p.telefono || "",
          email: p.correo || "",
          direccion: p.direccion || "",
        }))
      );
    } catch (err) {
      console.error("Error al refetch:", err);
      setError(err.message || "Error al recargar datos");
    }
  };

  // 🔍 Filtrado
  const proveedoresFiltrados = proveedores.filter((prov) =>
    prov.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  // ✏️ Manejadores
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAgregar = async () => {
    if (!formData.nombre || !formData.telefono)
      return;
    try {
      setError(null);
      const res = await fetch("http://localhost:5000/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          identificacion: formData.identificacion,
          direccion: formData.direccion,
          telefono: formData.telefono,
          correo: formData.email,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Error al agregar proveedor");
      }
      resetForm();
      await refetchProveedores();
    } catch (err) {
      console.error("Error al agregar:", err);
      setError(err.message);
    }
  };

  const handleEditar = (prov) => {
    setModoEdicion(true);
    setFormData({
      ...prov,
      email: prov.email,
    });
    setError(null);
  };

  const handleGuardar = async () => {
    if (!formData.nombre || !formData.telefono)
      return;
    try {
      setError(null);
      const res = await fetch(`http://localhost:5000/api/proveedores/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          identificacion: formData.identificacion,
          direccion: formData.direccion,
          telefono: formData.telefono,
          correo: formData.email,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Error al actualizar proveedor");
      }
      resetForm();
      await refetchProveedores();
    } catch (err) {
      console.error("Error al guardar:", err);
      setError(err.message);
    }
  };

  const handleEliminar = async (id) => {
    if (window.confirm("¿Seguro deseas eliminar este proveedor?")) {
      try {
        setError(null);
        const res = await fetch(`http://localhost:5000/api/proveedores/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Error al eliminar proveedor");
        }
        await refetchProveedores();
      } catch (err) {
        console.error("Error al eliminar:", err);
        setError(err.message);
      }
    }
  };

  const resetForm = () => {
    setModoEdicion(false);
    setFormData({
      id: null,
      nombre: "",
      identificacion: "",
      telefono: "",
      email: "",
      direccion: "",
    });
    setError(null);
  };

  // ==================== UI ====================
  return (
    <div className="pt-4 pb-6 sm:pt-10 sm:pb-30 px-25 bg-gradient-to-br from-orange-50 via-white to-rose-50 min-h-screen rounded-xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">
        Gestión de Proveedores
      </h1>

      {/* Filtro */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-1/2">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar proveedor..."
            className="w-full border border-orange-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>

      {/* Formulario CRUD */}
      <div className="bg-white/90 backdrop-blur-md border border-orange-100 rounded-2xl shadow-lg p-6 mb-8 transition-all">
        <h2 className="text-lg font-semibold mb-4 text-slate-700">
          {modoEdicion ? "Editar Proveedor" : "Agregar Proveedor"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              name="nombre"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Proveedor S.A."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Identificación
            </label>
            <input
              type="text"
              name="identificacion"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              value={formData.identificacion}
              onChange={handleChange}
              placeholder="Ej: NIT o CC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Teléfono
            </label>
            <input
              type="text"
              name="telefono"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="Ej: 3001234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              value={formData.email}
              onChange={handleChange}
              placeholder="Ej: proveedor@gmail.com"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              name="direccion"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Ej: Calle 10 #45-23"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {modoEdicion ? (
            <>
              <button
                onClick={handleGuardar}
                className="bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:brightness-110 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                <Edit2 size={16} /> Guardar Cambios
              </button>
              <button
                onClick={resetForm}
                className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={handleAgregar}
              className="bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:brightness-110 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm"
            >
              <PlusCircle size={16} /> Agregar Proveedor
            </button>
          )}
        </div>
      </div>

      {/* Tabla de proveedores */}
      <div className="bg-white/90 backdrop-blur-md border border-orange-100 rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-slate-700">
          Lista de Proveedores
        </h2>

        {loading ? (
          <div className="text-center text-slate-400 py-8">
            Cargando proveedores...
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-rose-600 mb-2">Error al cargar datos</div>
            <div className="text-slate-500 text-sm">{error}</div>
            <button
              onClick={refetchProveedores}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full text-xs border border-orange-100 rounded-lg overflow-hidden border-collapse">
              <thead className="bg-gradient-to-r from-orange-400/80 to-fuchsia-400/80 text-white">
                <tr>
                  <th className="px-2 py-2 border border-orange-100 whitespace-nowrap w-[130px]">Nombre</th>
                  <th className="px-2 py-2 border border-orange-100 whitespace-nowrap w-[110px]">Identificación</th>
                  <th className="px-2 py-2 border border-orange-100 whitespace-nowrap w-[95px]">Teléfono</th>
                  <th className="px-2 py-2 border border-orange-100 whitespace-nowrap w-[150px]">Email</th>
                  <th className="px-2 py-2 border border-orange-100 whitespace-nowrap">Dirección</th>
                  <th className="px-2 py-2 border border-orange-100 whitespace-nowrap text-center w-[165px]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.length > 0 ? (
                  proveedoresFiltrados.map((prov) => (
                    <tr
                      key={prov.id}
                      className="hover:bg-orange-50 transition text-slate-700"
                    >
                      <td className="px-2 py-2 border border-orange-100 text-[11px] truncate" title={prov.nombre}>
                        {prov.nombre}
                      </td>
                      <td className="px-2 py-2 border border-orange-100 text-[11px] truncate" title={prov.identificacion}>
                        {prov.identificacion}
                      </td>
                      <td className="px-2 py-2 border border-orange-100 text-[11px] truncate" title={prov.telefono}>
                        {prov.telefono}
                      </td>
                      <td className="px-2 py-2 border border-orange-100 text-[11px] truncate" title={prov.email}>
                        {prov.email}
                      </td>
                      <td className="px-2 py-2 border border-orange-100 text-[11px] truncate" title={prov.direccion}>
                        {prov.direccion}
                      </td>
                      <td className="px-2 py-2 border border-orange-100 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleEditar(prov)}
                            className="bg-yellow-400 hover:bg-yellow-500 text-white px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 transition"
                          >
                            <Edit2 size={12} /> Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(prov.id)}
                            className="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 transition"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center text-slate-400 py-4 italic text-xs"
                    >
                      No se encontraron proveedores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}