// src/pages/GestionCategorias.jsx
import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderTree, PlusCircle, Edit, Trash2, Search, Filter } from "lucide-react";
import ModalAgregarCategoria from "../Admin/AgregarCategoria";
import ModalEditarCategoria from "../Admin/EditarCategoria";
import useCategorias from "../../hooks/useCategorias";
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
} from "../../services/categoriasService";
import { ensureOk } from "../../services/responseUtils";

// Loader sencillo animado, igual estilo que en ListaPrecios.jsx
function Loader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
      <div className="relative mb-4">
        <div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <FolderTree className="text-cyan-500 opacity-50" size={32} />
        </div>
      </div>
      <span className="text-slate-400 select-none">Cargando categorías...</span>
    </div>
  );
}

export default function GestionCategorias() {
  const [mostrarModalAgregar, setMostrarModalAgregar] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [categoriaEliminar, setCategoriaEliminar] = useState(null);
  const [notice, setNotice] = useState(null);
  const { categorias, loading, error, refetchCategorias } = useCategorias();

  // Estados para filtros y paginación
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc', 'desc'
  const [filterImpuesto, setFilterImpuesto] = useState("all"); // 'all', 'con', 'sin'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Función para filtrar y ordenar categorías
  const filteredAndSortedCategorias = useMemo(() => {
    return categorias
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
  }, [categorias, filterImpuesto, searchTerm, sortOrder]);

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
      const response = await crearCategoria(nuevaCategoria);
      await ensureOk(response, "Error al crear categoría");
      await refetchCategorias(); // Refetch
      setMostrarModalAgregar(false);
    } catch (err) {
      console.error("Error creando categoría:", err);
      setNotice({
        type: "error",
        title: "No se pudo crear la categoría",
        message: err.message || "Revisa la información e intenta nuevamente.",
      });
    }
  };

  // Actualizar categoría
  const handleActualizarCategoria = async (categoriaActualizada) => {
    if (!categoriaSeleccionada) return;
    try {
      const response = await actualizarCategoria(categoriaSeleccionada.id_categoria, categoriaActualizada);
      await ensureOk(response, "Error al actualizar categoría");
      await refetchCategorias(); // Refetch
      setMostrarModalEditar(false);
      setCategoriaSeleccionada(null);
    } catch (err) {
      console.error("Error actualizando categoría:", err);
      setNotice({
        type: "error",
        title: "No se pudo actualizar la categoría",
        message: err.message || "Revisa la información e intenta nuevamente.",
      });
    }
  };

  // Eliminar categoría (envía a papelera e inhabilita productos)
  const confirmarEliminarCategoria = async () => {
    if (!categoriaEliminar?.id_categoria) return;
    try {
      const response = await eliminarCategoria(categoriaEliminar.id_categoria);
      await ensureOk(response, "Error al eliminar categoría");
      await refetchCategorias(); // Refetch
      setCategoriaEliminar(null);
      setNotice({
        type: "success",
        title: "Categoría enviada a papelera",
        message: "Los productos asociados quedaron inhabilitados correctamente.",
      });
    } catch (err) {
      console.error("Error eliminando categoría:", err);
      setNotice({
        type: "error",
        title: "No se pudo eliminar la categoría",
        message: err.message || "Intenta nuevamente o revisa si la categoría tiene dependencias.",
      });
    }
  };

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {/* ===== Encabezado ===== */}
      <div className="admin-module-header">
        <div className="admin-module-heading">
        <div className="admin-module-icon">
          <FolderTree size={20} />
        </div>
        <div>
          <h1 className="admin-module-title">Gestión de Categorías</h1>
          <p className="admin-module-subtitle">Las categorías son compartidas en todas las sedes del sistema.</p>
        </div>
        </div>
        <button
          onClick={() => setMostrarModalAgregar(true)}
          className="admin-module-button admin-module-button-primary"
        >
          <PlusCircle size={16} /> Nueva Categoría
        </button>
      </div>

      {/* ===== Barra de acciones ===== */}
      <div className="hidden flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <p className="text-sm text-slate-600">
          Las categorías son compartidas en todas las sedes del sistema.
        </p>

        <button
          onClick={() => setMostrarModalAgregar(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium transition active:scale-95"
        >
          <PlusCircle size={16} /> Nueva Categoría
        </button>
      </div>

      {/* ===== Filtros y Búsqueda ===== */}
      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <h2 className="admin-module-card-title">Filtros y búsqueda</h2>
          <Filter size={18} className="text-[#3157d5]" />
        </div>
        <div className="admin-module-grid">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre de categoría..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-sm focus:ring-2 focus:ring-cyan-300 outline-none"
            />
          </div>

          {/* Filtros de Impuesto */}
          <select
            value={filterImpuesto}
            onChange={(e) => setFilterImpuesto(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-sm focus:ring-2 focus:ring-cyan-300 outline-none"
          >
            <option value="all">Todos los impuestos</option>
            <option value="con">Con impuesto</option>
            <option value="sin">Sin impuesto</option>
          </select>

          {/* Ordenamiento */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-sm focus:ring-2 focus:ring-cyan-300 outline-none"
          >
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </select>
        </div>
      </div>

      {/* ===== Tabla ===== */}
      <div className="admin-module-card overflow-x-auto">
        <div className="admin-module-card-header">
          <h2 className="admin-module-card-title">Listado de categorías ({filteredAndSortedCategorias.length})</h2>
        </div>
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gradient-to-r from-cyan-600 to-indigo-600 text-white">
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
                className="hover:bg-cyan-50/70 transition-all duration-150"
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
                    onClick={() => setCategoriaEliminar(cat)}
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
              className={`px-3 py-1 rounded ${currentPage === page ? 'bg-cyan-500 text-white' : 'hover:bg-slate-100'}`}
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

      {categoriaEliminar && (
        <CategoryConfirmDialog
          categoria={categoriaEliminar}
          onCancel={() => setCategoriaEliminar(null)}
          onConfirm={confirmarEliminarCategoria}
        />
      )}

      {notice && (
        <CategoryNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function CategoryConfirmDialog({ categoria, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[440px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-100 text-rose-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">Eliminar categoría</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">
              Se enviará a la papelera y se inhabilitarán los productos asociados.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Categoría</span>
            <span className="max-w-[240px] truncate text-right font-black text-[#111827]">{categoria.nombre}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-[#b91c1c] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryNotice({ type = "success", title, message, onClose }) {
  const success = type === "success";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  const iconClass = success
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : "border-rose-200 bg-rose-100 text-rose-700";
  const buttonClass = success
    ? "bg-[linear-gradient(135deg,#3157d5,#18a36b)]"
    : "bg-[#b91c1c]";

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${iconClass}`}>
            <Icon size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`mt-5 w-full rounded-sm px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 ${buttonClass}`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
