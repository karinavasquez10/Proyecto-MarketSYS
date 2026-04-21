// src/pages/ListaPrecios.jsx
import React, { useState, useEffect } from "react";
import { Tag, FileSpreadsheet, Search } from "lucide-react";
import * as XLSX from 'xlsx';

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
  const [productos, setProductos] = useState([]);
  const [categoriasUnicas, setCategoriasUnicas] = useState(["Todas"]);
  const [loading, setLoading] = useState(true);

  // Estados para filtros y paginación
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc', 'desc'
  const [filterStock, setFilterStock] = useState("all"); // 'all', 'con', 'sin'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch productos
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API}/products/productos`);
        if (!response.ok) {
          throw new Error(`Error al obtener productos: ${response.status}`);
        }
        const data = await response.json();
        // Generar codigo y tipo, calcular margen usando precio_compra
        const productosEnriquecidos = data.map(p => ({
          ...p,
          codigo: "P" + p.id_producto.toString().padStart(4, '0'),
          tipo: (p.nombre_categoria === "Verduras" || p.nombre_categoria === "Frutas") ? "Báscula" : "Compra y Venta",
          margen: p.precio_compra > 0 ? ((p.precio_venta - p.precio_compra) / p.precio_compra * 100).toFixed(0) + "%" : "0%",
        }));
        setProductos(productosEnriquecidos);
        // Extraer categorías únicas
        const cats = ["Todas", ...new Set(productosEnriquecidos.map(p => p.nombre_categoria).filter(Boolean))];
        setCategoriasUnicas(cats);
      } catch (err) {
        console.error("Error fetching productos:", err);
        setProductos([]);
        setCategoriasUnicas(["Todos"]);
      } finally {
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

  // Función para filtrar, ordenar y paginar productos
  const filteredAndSortedProductos = productos
    .filter(
      (p) =>
        (categoria === "Todas" || p.nombre_categoria === categoria) &&
        (p.nombre.toLowerCase().includes(buscar.toLowerCase()) || p.codigo.toLowerCase().includes(buscar.toLowerCase()))
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

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedProductos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProductos = filteredAndSortedProductos.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const productosFiltrados = currentProductos; // Usar paginados para la tabla

  // Exportar a Excel (agrupado por categoría, usando todos los filtrados y ordenados, no solo la página actual)
  const exportarExcel = () => {
    if (filteredAndSortedProductos.length === 0) {
      alert("No hay datos para exportar.");
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
        ["Código", "Producto", "Categoría", "Tipo", "Precio Compra", "Precio Venta", "Margen"],
        ...items.map(p => [
          p.codigo,
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
      <div className="p-4 sm:p-15 w-full max-w-[calc(150%-16rem)] mt-0 flex justify-center items-center min-h-[400px] bg-white rounded-2xl shadow-md border border-slate-200">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-15 w-full max-w-[calc(150%-16rem)] mt-0">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gradient-to-r from-emerald-500 to-sky-500 p-2.5 rounded-lg text-white shadow-md">
          <Tag size={20} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          Lista de Precios
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-6 font-medium">
        MERKA FRUVER FLORENCIA
      </p>

      {/* ===== Controles de filtro ===== */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Search size={18} className="text-emerald-500" />
          Filtros de búsqueda
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 items-end mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300 max-h-40 overflow-y-auto"
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
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Ordenar por nombre
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
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
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
            >
              <option value="all">Todos los stocks</option>
              <option value="con">Con stock</option>
              <option value="sin">Sin stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== Tabla de precios ===== */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-slate-700">
            Productos disponibles ({filteredAndSortedProductos.length})
          </h2>

          <button 
            onClick={exportarExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={filteredAndSortedProductos.length === 0}
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Categoría</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-right">Precio Compra</th>
                <th className="px-3 py-2 text-right">Precio Venta</th>
                <th className="px-3 py-2 text-center">Margen</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {productosFiltrados.length > 0 ? (
                productosFiltrados.map((p, i) => (
                  <tr
                    key={p.id_producto || i}
                    className="hover:bg-slate-50 transition duration-150"
                  >
                    <td className="px-3 py-2">{p.codigo}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {p.nombre}
                    </td>
                    <td className="px-3 py-2">{p.nombre_categoria}</td>
                    <td className="px-3 py-2">{p.tipo}</td>
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
                    className="text-center text-slate-400 py-6 text-sm"
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Paginación ===== */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 text-sm text-slate-600">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1 rounded ${currentPage === page ? 'bg-emerald-500 text-white' : 'hover:bg-slate-100'}`}
            >
              {page}
            </button>
          ))}
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
    </div>
  );
}