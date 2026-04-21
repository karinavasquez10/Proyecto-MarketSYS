// src/pages/GestionCategorias.jsx
import React, { useState, useEffect } from "react";
import { FolderTree, PlusCircle, Edit, Trash2, Search, Filter } from "lucide-react";
import ModalAgregarCategoria from "../Admin/AgregarCategoria";
import ModalEditarCategoria from "../Admin/EditarCategoria";

// Loader sencillo animado, igual estilo que en ListaPrecios.jsx
function Loader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
      <div className="relative mb-4">
        <div className="w-14 h-14 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <FolderTree className="text-orange-400 opacity-50" size={32} />
        </div>
      </div>
      <span className="text-slate-400 select-none">Cargando categorías...</span>
    </div>
  );
}

// Variable de entorno con endpoint base - normalizamos y garantizamos el sufijo /api
const RAW_API_URL = import.meta.env.VITE_API_URL || "";
const API = (() => {
  try {
    let u = RAW_API_URL || "http://localhost:5000";
    u = u.replace(/\/+$/, ""); // quitar slash final
    if (!u.endsWith("/api")) u = u + "/api";
    return u;
  } catch {
    return "http://localhost:5000/api";
  }
})();

export default function GestionCategorias() {
  const [mostrarModalAgregar, setMostrarModalAgregar] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para filtros y paginación
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc', 'desc'
  const [filterImpuesto, setFilterImpuesto] = useState("all"); // 'all', 'con', 'sin'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch categorías activas
  const fetchCategorias = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API}/categorias`);
      if (!response.ok) {
        throw new Error(`Error al obtener categorías: ${response.status}`);
      }
      const data = await response.json();
      // Filtrar solo las no eliminadas (por si el backend no lo hace)
      const activas = data.filter(cat => !cat.is_deleted);
      setCategorias(activas);
    } catch (err) {
      console.error("Error fetching categorías:", err);
      setError(err.message);
      setCategorias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  // Función para filtrar y ordenar categorías
  const filteredAndSortedCategorias = categorias
    .filter(cat => {
      const matchesSearch = cat.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesImpuesto = filterImpuesto === "all" ||
        (filterImpuesto === "con" && parseFloat(cat.impuesto) > 0) ||
        (filterImpuesto === "sin" && parseFloat(cat.impuesto) === 0);
      return matchesSearch && matchesImpuesto;
    })
    .sort((a, b) => {
      const nameA = a.nombre.toLowerCase();
      const nameB = b.nombre.toLowerCase();
      return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedCategorias.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCategorias = filteredAndSortedCategorias.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Crear categoría
  const handleCrearCategoria = async (nuevaCategoria) => {
    try {
      const response = await fetch(`${API}/categorias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaCategoria),
      });
      if (!response.ok) {
        throw new Error(`Error al crear categoría: ${response.status}`);
      }
      fetchCategorias(); // Refetch
      setMostrarModalAgregar(false);
    } catch (err) {
      console.error("Error creando categoría:", err);
      alert("Error al crear categoría: " + err.message);
    }
  };

  // Actualizar categoría
  const handleActualizarCategoria = async (categoriaActualizada) => {
    if (!categoriaSeleccionada) return;
    try {
      const response = await fetch(`${API}/categorias/${categoriaSeleccionada.id_categoria}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoriaActualizada),
      });
      if (!response.ok) {
        throw new Error(`Error al actualizar categoría: ${response.status}`);
      }
      fetchCategorias(); // Refetch
      setMostrarModalEditar(false);
      setCategoriaSeleccionada(null);
    } catch (err) {
      console.error("Error actualizando categoría:", err);
      alert("Error al actualizar categoría: " + err.message);
    }
  };

  // Eliminar categoría (envía a papelera e inhabilita productos)
  const handleEliminarCategoria = async (id) => {
    if (!confirm("¿Estás seguro de eliminar esta categoría? Se enviará a la papelera y se inhabilitarán los productos asociados.")) return;
    try {
      const response = await fetch(`${API}/categorias/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Error al eliminar categoría: ${response.status}`);
      }
      fetchCategorias(); // Refetch
      alert("Categoría eliminada y productos inhabilitados exitosamente.");
    } catch (err) {
      console.error("Error eliminando categoría:", err);
      alert("Error al eliminar categoría: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-1 w-full max-w-[calc(150%-16rem)] flex justify-center items-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-1 w-full max-w-[calc(150%-16rem)] flex justify-center items-center min-h-[400px]">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-1 w-full max-w-[calc(150%-16rem)]">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-r from-orange-500 to-fuchsia-500 p-2.5 rounded-lg text-white shadow-md">
          <FolderTree size={20} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          Gestión de Categorías
        </h1>
      </div>

      {/* ===== Barra de acciones ===== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <p className="text-sm text-slate-600">
          Las categorías son compartidas en todas las sedes del sistema.
        </p>

        <button
          onClick={() => setMostrarModalAgregar(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:brightness-110 text-white px-4 py-2 rounded-md shadow-md text-sm font-medium transition active:scale-95"
        >
          <PlusCircle size={16} /> Nueva Categoría
        </button>
      </div>

      {/* ===== Filtros y Búsqueda ===== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre de categoría..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>

          {/* Filtros de Impuesto */}
          <select
            value={filterImpuesto}
            onChange={(e) => setFilterImpuesto(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-300 outline-none"
          >
            <option value="all">Todos los impuestos</option>
            <option value="con">Con impuesto</option>
            <option value="sin">Sin impuesto</option>
          </select>

          {/* Ordenamiento */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-300 outline-none"
          >
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </select>
        </div>
      </div>

      {/* ===== Tabla ===== */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-slate-200 transition hover:shadow-lg mb-6">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gradient-to-r from-orange-400/80 to-fuchsia-400/80 text-white">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Nombre</th>
              <th className="px-4 py-2 text-left hidden lg:table-cell font-medium">Descripción</th>
              <th className="px-4 py-2 text-right font-medium">Impuesto (%)</th>
              <th className="px-4 py-2 text-center font-medium">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {currentCategorias.map((cat) => (
              <tr
                key={cat.id_categoria}
                className="hover:bg-orange-50/70 transition-all duration-150"
              >
                <td className="px-4 py-3 font-medium text-slate-700">
                  {cat.nombre}
                </td>
                <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                  {cat.descripcion || "Sin descripción"}
                </td>
                <td className="px-4 py-3 text-right">
                  {parseFloat(cat.impuesto || 0).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-center flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setCategoriaSeleccionada(cat);
                      setMostrarModalEditar(true);
                    }}
                    className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1 rounded text-xs shadow-sm transition flex items-center gap-1"
                    title="Editar"
                  >
                    <Edit size={12} /> Editar
                  </button>
                  <button 
                    onClick={() => handleEliminarCategoria(cat.id_categoria)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs shadow-sm transition flex items-center gap-1"
                    title="Eliminar"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {currentCategorias.length === 0 && (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                  No hay categorías que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Paginación ===== */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 text-sm text-slate-600">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1 rounded ${currentPage === page ? 'bg-orange-500 text-white' : 'hover:bg-slate-100'}`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
          <span className="px-2">
            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedCategorias.length)} de {filteredAndSortedCategorias.length}
          </span>
        </div>
      )}

      {/* ===== Modal Agregar ===== */}
      <ModalAgregarCategoria
        visible={mostrarModalAgregar}
        onClose={() => setMostrarModalAgregar(false)}
        onSave={handleCrearCategoria}
      />

      {/* ===== Modal Editar ===== */}
      <ModalEditarCategoria
        visible={mostrarModalEditar}
        onClose={() => {
          setMostrarModalEditar(false);
          setCategoriaSeleccionada(null);
        }}
        categoria={categoriaSeleccionada}
        onSave={handleActualizarCategoria}
      />
    </div>
  );
}