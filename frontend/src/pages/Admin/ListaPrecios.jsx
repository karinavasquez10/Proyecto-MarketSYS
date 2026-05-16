// src/pages/ListaPrecios.jsx
import React, { useMemo, useState } from "react";
import { AlertTriangle, Tag, FileSpreadsheet, Search } from "lucide-react";
import * as XLSX from 'xlsx';
import useProductos from "../../hooks/useProductos";

// Componente de carga animada (efecto de carga)
function Loader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
      <div className="relative mb-4">
        <div className="w-14 h-14 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Tag size={28} className="text-emerald-400 opacity-60" />
        </div>
      </div>
      <p className="text-emerald-500 font-semibold text-base animate-pulse">
        Cargando la lista de precios...
      </p>
      <p className="text-slate-400 text-xs mt-2">Por favor espera un momento</p>
    </div>
  );
}

export default function ListaPrecios() {
  const [categoria, setCategoria] = useState("Todas");
  const [buscar, setBuscar] = useState("");
  const { productos, loading } = useProductos();

  // Estados para filtros y paginación
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc', 'desc'
  const [filterStock, setFilterStock] = useState("all"); // 'all', 'con', 'sin'
  const [currentPage, setCurrentPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const itemsPerPage = 10;

  const productosEnriquecidos = useMemo(() => {
    return productos.map(p => ({
      ...p,
      codigo: p.codigo_interno || "-",
      id_sistema: "P" + p.id_producto.toString().padStart(4, '0'),
      tipo: (p.nombre_categoria === "Verduras" || p.nombre_categoria === "Frutas") ? "Báscula" : "Compra y Venta",
      margen: p.precio_compra > 0 ? ((p.precio_venta - p.precio_compra) / p.precio_compra * 100).toFixed(0) + "%" : "0%",
    }));
  }, [productos]);

  const categoriasUnicas = useMemo(() => {
    return ["Todas", ...new Set(productosEnriquecidos.map(p => p.nombre_categoria).filter(Boolean))];
  }, [productosEnriquecidos]);

  // Función para filtrar, ordenar y paginar productos
  const filteredAndSortedProductos = useMemo(() => {
    return productosEnriquecidos
      .filter(
          (p) =>
          (categoria === "Todas" || p.nombre_categoria === categoria) &&
          (
            p.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
            String(p.codigo || "").toLowerCase().includes(buscar.toLowerCase()) ||
            String(p.id_sistema || "").toLowerCase().includes(buscar.toLowerCase())
          )
      )
      .filter(p => {
        const stock = parseFloat(p.stock_actual || 0);
        return filterStock === "all" ||
          (filterStock === "con" && stock > 0) ||
          (filterStock === "sin" && stock === 0);
      })
      .sort((a, b) => {
        const nameA = a.nombre.toLowerCase();
        const nameB = b.nombre.toLowerCase();
        return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
  }, [buscar, categoria, filterStock, productosEnriquecidos, sortOrder]);

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedProductos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProductos = filteredAndSortedProductos.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const productosFiltrados = currentProductos; // Usar paginados para la tabla

  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(pages)
      .filter(page => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  // Exportar a Excel (agrupado por categoría, usando todos los filtrados y ordenados, no solo la página actual)
  const exportarExcel = () => {
    if (filteredAndSortedProductos.length === 0) {
      setNotice({
        title: "No hay datos para exportar",
        message: "Ajusta los filtros o la búsqueda para generar una lista de precios con productos.",
      });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Agrupar por categoría (solo categorías presentes en filtrados)
    const grouped = {};
    filteredAndSortedProductos.forEach(p => {
      if (!grouped[p.nombre_categoria]) grouped[p.nombre_categoria] = [];
      grouped[p.nombre_categoria].push(p);
    });

    // Crear hoja por categoría
    Object.entries(grouped).forEach(([cat, items]) => {
      const wsData = [
        ["Código Interno", "ID Sistema", "Producto", "Categoría", "Tipo", "Precio Compra", "Precio Venta", "Margen"],
        ...items.map(p => [
          p.codigo,
          p.id_sistema,
          p.nombre,
          p.nombre_categoria,
          p.tipo,
          p.precio_compra,
          p.precio_venta,
          p.margen,
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Auto-ajustar columnas
      const colWidths = wsData[0].map((_, i) => ({ wch: Math.max(...wsData.map(row => row[i]?.toString().length || 10)) }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, cat);
    });

    // Descargar con fecha actual
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Lista_Precios_${today}.xlsx`);
  };

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {/* ===== Encabezado ===== */}
      <div className="admin-module-header">
        <div className="admin-module-heading">
        <div className="admin-module-icon">
          <Tag size={20} />
        </div>
        <div>
          <h1 className="admin-module-title">Lista de Precios</h1>
          <p className="admin-module-subtitle">MARKETSYS</p>
        </div>
        </div>
        <button
          onClick={exportarExcel}
          className="admin-module-button admin-module-button-primary"
          disabled={filteredAndSortedProductos.length === 0}
        >
          <FileSpreadsheet size={16} />
          Exportar Excel
        </button>
      </div>
      <p className="hidden text-sm text-slate-500 mb-4 font-medium">
        MARKETSYS
      </p>

      {/* ===== Controles de filtro ===== */}
      <div className="admin-module-card">
        <div className="admin-module-card-header">
        <h2 className="admin-module-card-title flex items-center gap-2">
          <Search size={18} className="text-emerald-500" />
          Filtros de búsqueda
        </h2>
        </div>

        <div className="admin-module-grid mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300 max-h-40 overflow-y-auto"
            >
              {categoriasUnicas.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Buscar producto
            </label>
            <input
              type="text"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Escribe el nombre o código..."
              className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Ordenar por nombre
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
            >
              <option value="asc">A-Z</option>
              <option value="desc">Z-A</option>
            </select>
          </div>
        </div>

        {/* Filtros adicionales (stock) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Filtro de stock
            </label>
            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value)}
              className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
            >
              <option value="all">Todos los stocks</option>
              <option value="con">Con stock</option>
              <option value="sin">Sin stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== Tabla de precios ===== */}
      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <h2 className="admin-module-card-title">
            Productos disponibles ({filteredAndSortedProductos.length})
          </h2>

          <button
            onClick={exportarExcel}
            className="hidden items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={filteredAndSortedProductos.length === 0}
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="w-[110px] px-3 py-2 text-left">Código</th>
                <th className="w-[260px] px-3 py-2 text-left">Producto</th>
                <th className="w-[160px] px-3 py-2 text-left">Categoría</th>
                <th className="w-[150px] px-3 py-2 text-left">Tipo</th>
                <th className="w-[150px] px-3 py-2 text-right">Precio Compra</th>
                <th className="w-[150px] px-3 py-2 text-right">Precio Venta</th>
                <th className="w-[110px] px-3 py-2 text-center">Margen</th>
              </tr>
            </thead>

            <tbody className="divide-y align-top">
              {productosFiltrados.length > 0 ? (
                productosFiltrados.map((p, i) => (
                  <tr
                    key={p.id_producto || i}
                    className="h-12 hover:bg-slate-50 transition duration-150"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-700">{p.codigo}</td>
                    <td className="truncate px-3 py-2 font-medium text-slate-700" title={p.nombre}>
                      {p.nombre}
                    </td>
                    <td className="truncate px-3 py-2" title={p.nombre_categoria}>{p.nombre_categoria}</td>
                    <td className="truncate px-3 py-2">{p.tipo}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {parseFloat(p.precio_compra || 0).toLocaleString("es-CO", {
                        style: "currency",
                        currency: "COP",
                        minimumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                      {parseFloat(p.precio_venta || 0).toLocaleString("es-CO", {
                        style: "currency",
                        currency: "COP",
                        minimumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-semibold">
                        {p.margen}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="h-[480px] text-center text-slate-400 py-6 text-sm"
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              )}
              {productosFiltrados.length > 0 &&
                productosFiltrados.length < itemsPerPage &&
                Array.from({ length: itemsPerPage - productosFiltrados.length }, (_, index) => (
                  <tr key={`empty-row-${index}`} className="h-12">
                    <td colSpan="7" className="px-3 py-2">&nbsp;</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Paginación ===== */}
      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-slate-600 max-w-full">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            Anterior
          </button>
          {visiblePages.map((page, index) => {
            const previous = visiblePages[index - 1];
            const showGap = previous && page - previous > 1;
            return (
              <React.Fragment key={page}>
                {showGap && <span className="px-1 font-semibold text-slate-400">...</span>}
                <button
                  onClick={() => handlePageChange(page)}
                  className={`min-w-8 rounded px-3 py-1 ${currentPage === page ? 'bg-emerald-500 text-white' : 'hover:bg-slate-100'}`}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            Siguiente
          </button>
          <span className="px-2">
            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedProductos.length)} de {filteredAndSortedProductos.length}
          </span>
        </div>
      )}

      {notice && (
        <AdminNotice
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function AdminNotice({ title, message, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-100 text-amber-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-sm bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
