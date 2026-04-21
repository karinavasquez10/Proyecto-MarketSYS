import React, { useState, useEffect } from "react";
import { PackageSearch, Filter, AlertTriangle, Database, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// Asumiendo backend en puerto 5000; ajusta si es diferente
const API_BASE_URL = 'http://localhost:5000';

// Spinner de carga mejorado
function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col justify-center items-center py-12">
      <svg className="animate-spin h-12 w-12 text-orange-500 mb-4" viewBox="0 0 45 45">
        <circle className="opacity-20" cx="22.5" cy="22.5" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
        <path d="M42.5,22.5a20,20 0 1,1-40,0" stroke="currentColor" strokeWidth="5" fill="none" className="opacity-70" />
      </svg>
      <span className="text-orange-600 text-base font-medium tracking-wide">{label}</span>
    </div>
  );
}

export default function ConsultaInventarioProductos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState("Todas las categorías");
  const [busqueda, setBusqueda] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  // Función helper para fetch
  const fetchWithErrorHandling = async (endpoint) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: Verifica el backend.`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`Error al cargar desde ${url}:`, err);
      setError(err.message);
      return [];
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const prods = await fetchWithErrorHandling('/api/products/productos');
      const cats = await fetchWithErrorHandling('/api/categorias');
      setProductos(prods);
      setCategorias([{ id_categoria: 0, nombre: "Todas las categorías" }, ...cats]);
      setLoading(false);
    };
    loadData();
  }, []);

  // "Nuevos" como creados en últimos 30 días
  const getNuevos = (productos) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return productos.filter(p => new Date(p.fecha_creacion) > thirtyDaysAgo).length;
  };

  // Tipo basado en unidad (simplificado; ajusta según lógica real)
  const getTipo = (unidad_abrev) => {
    return unidad_abrev === "kg" ? "Báscula" : "Compra y Venta";
  };

  // Filtros aplicados
  const filteredProductos = productos.filter((p) => {
    const matchesSearch = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          p.id_producto.toString().includes(busqueda);
    const matchesCategoria = categoria === "Todas las categorías" || p.nombre_categoria === categoria;
    let matchesFilter = true;

    switch (activeFilter) {
      case "porCalibrar":
        matchesFilter = p.stock_minimo === 0 || !p.precio_venta || p.precio_venta === 0;
        break;
      case "inactivos":
        matchesFilter = p.estado === 0;
        break;
      case "nuevo": {
        // Asumir "nuevo" como creados en últimos 30 días
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesFilter = new Date(p.fecha_creacion) > thirtyDaysAgo;
        break;
      }
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesCategoria && matchesFilter;
  });

  // Paginación
  const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
  const paginatedProductos = filteredProductos.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Indicadores computados
  const totalProductos = productos.length;
  const stockNegativo = productos.filter(p => p.stock_actual < 0).length;
  const calibrados = productos.filter(p => p.stock_minimo > 0 && p.precio_venta > 0).length; // Asumir "calibrados" como con stock_min y precio
  const nuevos = getNuevos(productos);

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-1 w-full max-w-[calc(150%-16rem)] mt-2">
        <Spinner label="Cargando inventario..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-1 w-full max-w-[calc(150%-16rem)] mt-2">
      {/* ===== ENCABEZADO ===== */}
      <div className="flex items-center gap-3 mb-2 -mt-2">
        <div className="bg-gradient-to-r from-emerald-500 to-sky-500 p-2.5 rounded-lg text-white shadow-md">
          <PackageSearch size={20} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          Consulta de Inventario
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-5 font-medium">
        MERKA FRUVER FLORENCIA
      </p>

      {/* Error */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">Error: {error}</p>
        </div>
      )}

      {/* ===== INDICADORES ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-700 font-semibold">
              Productos calibrados
            </p>
            <p className="text-lg font-bold text-amber-600">{((calibrados / totalProductos) * 100).toFixed(0)}%</p>
          </div>
          <AlertTriangle size={28} className="text-amber-500" />
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-700 font-semibold">
              Productos totales
            </p>
            <p className="text-lg font-bold text-emerald-600">{totalProductos}</p>
          </div>
          <Database size={26} className="text-emerald-500" />
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-rose-700 font-semibold">
              Stock negativo
            </p>
            <p className="text-lg font-bold text-rose-600">{stockNegativo}</p>
          </div>
          <AlertTriangle size={26} className="text-rose-500" />
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 font-semibold">Productos nuevos</p>
            <p className="text-lg font-bold text-blue-600">{nuevos}</p>
          </div>
          <Calendar size={26} className="text-blue-500" />
        </div>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            className="border rounded px-3 py-2 text-sm shadow-sm"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {categorias.map((cat) => (
              <option key={cat.id_categoria} value={cat.nombre}>
                {cat.nombre}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-64 shadow-sm"
          />

          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => setActiveFilter("todos")}
              className={`px-3 py-2 rounded text-sm shadow transition ${
                activeFilter === "todos"
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveFilter("porCalibrar")}
              className={`px-3 py-2 rounded text-sm shadow transition ${
                activeFilter === "porCalibrar"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              Por Calibrar
            </button>
            <button
              onClick={() => setActiveFilter("inactivos")}
              className={`px-3 py-2 rounded text-sm shadow transition ${
                activeFilter === "inactivos"
                  ? "bg-pink-600 hover:bg-pink-700 text-white"
                  : "bg-pink-500 hover:bg-pink-600 text-white"
              }`}
            >
              Inactivos
            </button>
          </div>
        </div>
      </div>

      {/* ===== TABLA DE INVENTARIO ===== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center mb-3 px-4 py-2 border-b border-slate-200">
          <p className="text-sm text-slate-600">
            Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, filteredProductos.length)} de {filteredProductos.length} productos
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm border-collapse w-max">
            <thead className="bg-gradient-to-r from-orange-400/90 to-fuchsia-400/90 text-white sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left w-16">Código</th>
                <th className="px-2 py-2 text-left w-48">Nombre</th>
                <th className="px-2 py-2 text-right w-24">Precio compra</th>
                <th className="px-2 py-2 text-right w-24">Precio venta</th>
                <th className="px-2 py-2 text-right w-20">Stock</th>
                <th className="px-2 py-2 text-center w-20">Tipo</th>
                <th className="px-2 py-2 text-center w-32">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProductos.length > 0 ? (
                paginatedProductos.map((p) => {
                  const tipo = getTipo(p.unidad_abrev);
                  return (
                    <tr
                      key={p.id_producto}
                      className="hover:bg-orange-50 transition border-b border-slate-100"
                    >
                      <td className="px-2 py-2 font-mono text-center">{p.id_producto}</td>
                      <td className="px-2 py-2 max-w-xs truncate">{p.nombre}</td>
                      <td className="px-2 py-2 text-right">
                        ${parseFloat(p.precio_compra).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-2 text-right">
                        ${parseFloat(p.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-medium ${
                          p.stock_actual < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {parseFloat(p.stock_actual).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600">
                        {tipo}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600 truncate">
                        {p.nombre_categoria}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center text-slate-400 py-8 italic">
                    No se encontraron productos con los filtros aplicados...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-4 gap-2 px-4 py-3 border-t border-slate-200">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600">
              Página {currentPage + 1} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}