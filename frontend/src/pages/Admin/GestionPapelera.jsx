// GestionPapelera.jsx (versión actualizada - confirmación mejorada en UI para eliminación definitiva)
import React, { useState, useEffect } from "react";
import { Trash2, RotateCcw, XCircle, Search } from "lucide-react";

export default function GestionPapelera() {
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch inicial de papelera
  useEffect(() => {
    const fetchPapelera = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("http://localhost:5000/api/papelera");
        if (!res.ok) {
          throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
        }
        const data = await res.json();
        setItems(data.map(item => ({
          id: item.id_papelera,
          tipo: item.tipo,
          nombre: item.nombre,
          eliminadoPor: item.eliminadoPor || "Usuario desconocido",
          fecha: new Date(item.fecha).toISOString().split('T')[0], // Formato YYYY-MM-DD
        })));
      } catch (err) {
        console.error("Error al fetch papelera:", err);
        setError(err.message || "Error de conexión al servidor");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPapelera();
  }, []);

  // Refetch helper
  const refetchPapelera = async () => {
    try {
      setError(null);
      const res = await fetch("http://localhost:5000/api/papelera");
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
      }
      const data = await res.json();
      setItems(data.map(item => ({
        id: item.id_papelera,
        tipo: item.tipo,
        nombre: item.nombre,
        eliminadoPor: item.eliminadoPor || "Usuario desconocido",
        fecha: new Date(item.fecha).toISOString().split('T')[0],
      })));
    } catch (err) {
      console.error("Error al refetch:", err);
      setError(err.message || "Error al recargar datos");
    }
  };

  const handleRestaurar = async (id) => {
    try {
      setError(null);
      const res = await fetch(`http://localhost:5000/api/papelera/restore/${id}`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Error al restaurar");
      }
      await refetchPapelera();
    } catch (err) {
      console.error("Error al restaurar:", err);
      setError(err.message);
    }
  };

  const handleEliminarDefinitivo = async (id) => {
    const item = items.find(i => i.id === id);
    if (window.confirm(`¿Eliminar definitivamente "${item.nombre}" (${item.tipo})? Esta acción no se puede deshacer y borrará el registro permanentemente de la base de datos.`)) {
      try {
        setError(null);
        const res = await fetch(`http://localhost:5000/api/papelera/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Error al eliminar definitivamente");
        }
        await refetchPapelera();
      } catch (err) {
        console.error("Error al eliminar definitivamente:", err);
        setError(err.message);
      }
    }
  };

  const filtrados = items.filter(
    (i) =>
      i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.tipo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-6 sm:px-18 py-10 rounded-xl">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gradient-to-r from-orange-500 to-fuchsia-500 p-2.5 rounded-lg shadow-md text-white">
          <Trash2 size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Gestión de la Papelera
        </h1>
      </div>

      {/* ===== Cuadro de búsqueda ===== */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <Search size={18} className="text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-700">
            Buscar elementos eliminados
          </h2>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o tipo..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* ===== Tabla de elementos eliminados ===== */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6">
        <h2 className="text-lg font-semibold mb-5 text-slate-700">
          Elementos eliminados ({items.length})
        </h2>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Cargando elementos...</div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-rose-600 mb-2">Error al cargar datos</div>
            <div className="text-slate-500 text-sm">{error}</div>
            <button
              onClick={refetchPapelera}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-gradient-to-r from-orange-400/80 to-fuchsia-400/80 text-white">
                <tr>
                  {["#", "Tipo", "Nombre", "Eliminado por", "Fecha", "Acciones"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2 text-left text-xs uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length > 0 ? (
                  filtrados.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="border-b border-orange-100 hover:bg-orange-50 transition"
                    >
                      <td className="px-4 py-2 text-slate-600">{idx + 1}</td>
                      <td className="px-4 py-2 text-slate-800 font-medium max-w-[100px] truncate">
                        {item.tipo}
                      </td>
                      <td className="px-4 py-2 text-slate-700 max-w-[200px] truncate">
                        {item.nombre}
                      </td>
                      <td className="px-4 py-2 text-slate-600 max-w-[150px] truncate">
                        {item.eliminadoPor}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{item.fecha}</td>
                      <td className="px-4 py-2 flex gap-2">
                        <button
                          onClick={() => handleRestaurar(item.id)}
                          className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <RotateCcw size={14} /> Restaurar
                        </button>
                        <button
                          onClick={() => handleEliminarDefinitivo(item.id)}
                          className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <XCircle size={14} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-6 text-slate-400 text-sm"
                    >
                      🗑️ No hay elementos eliminados o no coinciden con la búsqueda.
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