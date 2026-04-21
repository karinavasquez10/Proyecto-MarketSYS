import React, { useState, useEffect } from "react";
import {
  PackagePlus,
  Tag,
  CheckCircle2,
  ArchiveX,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Asumiendo backend en puerto 5000; ajusta si es diferente (ej: 3001)
const API_BASE_URL = 'http://localhost:5000';

export default function RegistroProductos() {
  const [activo, setActivo] = useState(true);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio_compra: "",
    precio_venta: "",
    id_categoria: "",
    id_unidad: "",
    stock_actual: "",
    stock_minimo: "",
    stock_maximo: "",
    cambia_estado: 0,
    cambia_apariencia: 0,
    tiempo_cambio: "",
  });

  // Función helper para fetch con URLs absolutas y mejor manejo de errores
  const fetchWithErrorHandling = async (endpoint, setter) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en ${url}: Status ${response.status}`, errorText.substring(0, 200));
        throw new Error(`Error ${response.status}: Verifica que el backend esté corriendo en puerto 5000 y las rutas montadas correctamente.`);
      }
      const data = await response.json();
      setter(data);
    } catch (err) {
      console.error(`Error al cargar desde ${url}:`, err);
      setError(err.message);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    setLoading(true);
    setError(null); // Reset error
    fetchWithErrorHandling('/api/products/productos', setProductos);
    fetchWithErrorHandling('/api/categorias', setCategorias);
    fetchWithErrorHandling('/api/unidadesMedida', setUnidades); // Corregido: ruta como /api/unidadesMedida según tu index.js
    setLoading(false);
  }, []);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validaciones frontend reforzadas para todos los campos obligatorios
    if (!formData.nombre.trim()) {
      alert("El nombre del producto es obligatorio.");
      return;
    }
    if (!formData.id_categoria) {
      alert("Selecciona una categoría.");
      return;
    }
    if (!formData.id_unidad) {
      alert("Selecciona una unidad de medida.");
      return;
    }
    if (
      formData.precio_compra === "" ||
      isNaN(formData.precio_compra) ||
      parseFloat(formData.precio_compra) < 0
    ) {
      alert("El precio de compra debe ser un número positivo.");
      return;
    }
    if (
      formData.precio_venta === "" ||
      isNaN(formData.precio_venta) ||
      parseFloat(formData.precio_venta) < 0
    ) {
      alert("El precio de venta debe ser un número positivo.");
      return;
    }
    if (
      formData.stock_actual === "" ||
      isNaN(formData.stock_actual) ||
      parseFloat(formData.stock_actual) < 0
    ) {
      alert("El stock actual es obligatorio y debe ser un número positivo.");
      return;
    }
    if (
      formData.stock_minimo === "" ||
      isNaN(formData.stock_minimo) ||
      parseFloat(formData.stock_minimo) < 0
    ) {
      alert("El stock mínimo es obligatorio y debe ser un número positivo.");
      return;
    }
    if (
      formData.stock_maximo === "" ||
      isNaN(formData.stock_maximo) ||
      parseFloat(formData.stock_maximo) < 0
    ) {
      alert("El stock máximo es obligatorio y debe ser un número positivo.");
      return;
    }

    // Validación de campos de cambio automático
    if (
      (parseInt(formData.cambia_estado) === 1 || parseInt(formData.cambia_apariencia) === 1) &&
      (!formData.tiempo_cambio || parseInt(formData.tiempo_cambio) <= 0)
    ) {
      alert("Si el producto cambia de estado o apariencia, debes especificar el tiempo de cambio en días (mayor a 0).");
      return;
    }

    try {
      const nuevoProducto = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        id_categoria: parseInt(formData.id_categoria),
        id_unidad: parseInt(formData.id_unidad),
        precio_compra: parseFloat(formData.precio_compra),
        precio_venta: parseFloat(formData.precio_venta),
        stock_actual: parseFloat(formData.stock_actual),
        stock_minimo: parseFloat(formData.stock_minimo),
        stock_maximo: parseFloat(formData.stock_maximo),
        estado: activo ? 1 : 0,
        cambia_estado: parseInt(formData.cambia_estado),
        cambia_apariencia: parseInt(formData.cambia_apariencia),
        tiempo_cambio: formData.tiempo_cambio ? parseInt(formData.tiempo_cambio) : null,
      };

      const response = await fetch(`${API_BASE_URL}/api/products/productos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nuevoProducto),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      // Reset form
      setFormData({
        nombre: "",
        descripcion: "",
        precio_compra: "",
        precio_venta: "",
        id_categoria: "",
        id_unidad: "",
        stock_actual: "",
        stock_minimo: "",
        stock_maximo: "",
        cambia_estado: 0,
        cambia_apariencia: 0,
        tiempo_cambio: "",
      });
      setActivo(true);
      // Recargar productos
      fetchWithErrorHandling('/api/products/productos', setProductos);
      alert('Producto registrado exitosamente.');
    } catch (error) {
      console.error('Error en el envío:', error);
      alert(`Error al registrar el producto: ${error.message}`);
    }
  };

  // Filtrado y ordenamiento
  const filteredProducts = productos.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const nameA = a.nombre.toLowerCase();
    const nameB = b.nombre.toLowerCase();
    return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 sm:px-12 py-10 rounded-xl flex items-center justify-center">
        <p className="text-slate-600">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center">
      {/* Contenedor centrado completamente */}
      <div className="w-full max-w-6xl mx-auto px-2 sm:px-6 py-6 flex flex-col items-center">
        {/* Error global si hay */}
        {error && (
          <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4 w-full max-w-3xl mx-auto text-center">
            <p className="text-sm">Error al cargar datos: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-rose-600 hover:underline text-sm mt-1"
            >
              Recargar página
            </button>
          </div>
        )}

        {/* ===== Encabezado ===== */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-gradient-to-r from-emerald-500 to-sky-500 p-2.5 rounded-lg shadow-md text-white">
            <PackagePlus size={22} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight text-center">
            Registro de Productos
          </h1>
        </div>

        {/* ===== Formulario ===== */}
        <div className="bg-white/90 border border-emerald-100 rounded-2xl shadow-md p-8 mb-10 w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Datos del producto */}
          <div className="space-y-5 w-full">
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 border-b pb-2 border-slate-200">
              <Tag size={18} className="text-emerald-500" />
              Datos del producto
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleChange("nombre", e.target.value)}
                  placeholder="Ej: Cebolla blanca pelada"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </div>
            </div>
          </div>

          {/* === Clasificación y precios === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 w-full">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Precio de compra *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.precio_compra}
                onChange={(e) => handleChange("precio_compra", e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Precio de venta *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.precio_venta}
                onChange={(e) => handleChange("precio_venta", e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Categoría *
              </label>
              <select
                value={formData.id_categoria}
                onChange={(e) => handleChange("id_categoria", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">Seleccione...</option>
                {categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Unidad de medida *
              </label>
              <select
                value={formData.id_unidad}
                onChange={(e) => handleChange("id_unidad", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">Seleccione...</option>
                {unidades.map((uni) => (
                  <option key={uni.id_unidad} value={uni.id_unidad}>
                    {uni.nombre} ({uni.abreviatura})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6 w-full">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Stock actual *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_actual}
                onChange={(e) => handleChange("stock_actual", e.target.value)}
                placeholder="0.00"
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Stock mínimo *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_minimo}
                onChange={(e) => handleChange("stock_minimo", e.target.value)}
                required
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Stock máximo *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_maximo}
                onChange={(e) => handleChange("stock_maximo", e.target.value)}
                required
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          {/* === Configuración de Cambio Automático === */}
          <div className="space-y-5 w-full mb-6">
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 border-b pb-2 border-slate-200">
              <Tag size={18} className="text-sky-500" />
              Configuración de Cambio Automático
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  ¿Cambia de estado? (Vencimiento)
                </label>
                <select
                  value={formData.cambia_estado}
                  onChange={(e) => handleChange("cambia_estado", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                >
                  <option value={0}>No</option>
                  <option value={1}>Sí</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Productos que se vencen o pudren (ej: carne, frutas)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  ¿Cambia de apariencia? (Transformación)
                </label>
                <select
                  value={formData.cambia_apariencia}
                  onChange={(e) => handleChange("cambia_apariencia", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                >
                  <option value={0}>No</option>
                  <option value={1}>Sí</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Productos que se transforman (ej: plátano verde → maduro)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Tiempo de cambio (días)
                  {(formData.cambia_estado === 1 || formData.cambia_estado === "1" || 
                    formData.cambia_apariencia === 1 || formData.cambia_apariencia === "1") && 
                    <span className="text-rose-500 ml-1">*</span>}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.tiempo_cambio}
                  onChange={(e) => handleChange("tiempo_cambio", e.target.value)}
                  placeholder="Ej: 5"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Días después de creado para activar el cambio
                </p>
              </div>
            </div>

            {(formData.cambia_estado === 1 || formData.cambia_estado === "1" || 
              formData.cambia_apariencia === 1 || formData.cambia_apariencia === "1") && 
              !formData.tiempo_cambio && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  ⚠️ Si el producto cambia de estado o apariencia, debes especificar el tiempo de cambio en días.
                </p>
              </div>
            )}
          </div>

          {/* === Estado y Descripción === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 w-full">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="activo"
                checked={activo}
                onChange={() => setActivo(!activo)}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-400"
              />
              <label htmlFor="activo" className="text-sm text-slate-700">
                Producto activo en inventario
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Descripción del producto
              </label>
              <textarea
                rows="3"
                value={formData.descripcion}
                onChange={(e) => handleChange("descripcion", e.target.value)}
                placeholder="Descripción detallada del producto..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          {/* === Botones === */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 w-full">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  nombre: "",
                  descripcion: "",
                  precio_compra: "",
                  precio_venta: "",
                  id_categoria: "",
                  id_unidad: "",
                  stock_actual: "",
                  stock_minimo: "",
                  stock_maximo: "",
                  cambia_estado: 0,
                  cambia_apariencia: 0,
                  tiempo_cambio: "",
                });
                setActivo(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-md text-sm font-medium shadow-sm transition"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-md text-sm font-medium shadow-sm transition flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              Registrar Producto
            </button>
          </div>
        </div>

        {/* ===== Filtros y Búsqueda ===== */}
        <div className="bg-white/90 border border-emerald-100 rounded-2xl shadow-md p-6 mb-6 w-full max-w-4xl flex flex-col items-center">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
            <div className="flex items-center gap-3 flex-1 max-w-md mx-auto">
              <Search size={20} className="text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Buscar por nombre de producto..."
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Ordenar por nombre:</label>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(0);
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              >
                <option value="asc">A-Z</option>
                <option value="desc">Z-A</option>
              </select>
            </div>
          </div>
        </div>

        {/* ===== Tabla de productos ===== */}
        <div className="bg-white/90 border border-emerald-100 rounded-2xl shadow-md p-6 w-full max-w-6xl flex flex-col items-center">
          <h2 className="text-lg font-semibold mb-5 text-slate-700 text-center">
            Productos Registrados ({sortedProducts.length})
          </h2>

          {productos.length === 0 && !error ? (
            <div className="text-center py-8 text-slate-400">
              <ArchiveX size={32} className="mx-auto mb-2 text-slate-300" />
              <p>No hay productos registrados aún. ¡Registra el primero!</p>
            </div>
          ) : (
            <>
              {/* La tabla nunca debe hacer scroll-x ni cambiar su ancho */}
              <div className="w-full flex justify-center">
                <table className="table-fixed w-full max-w-5xl text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-gradient-to-r from-emerald-400/80 to-sky-400/80 text-white">
                    <tr>
                      {[
                        { key: "ID Producto", class: "w-[7%] text-center" },
                        { key: "Nombre", class: "w-[21%] text-center" },
                        { key: "Categoría", class: "w-[14%] text-center" },
                        { key: "Unidad", class: "w-[14%] text-center" },
                        { key: "Stock Actual", class: "w-[11%] text-center" },
                        { key: "Compra", class: "w-[11%] text-center" },
                        { key: "Venta", class: "w-[11%] text-center" },
                        { key: "Estado", class: "w-[11%] text-center" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`px-2 py-2 text-xs uppercase tracking-wide ${col.class} whitespace-nowrap`}
                        >
                          {col.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.length > 0 ? (
                      paginatedProducts.map((p) => (
                        <tr
                          key={p.id_producto}
                          className="border-b border-slate-100 hover:bg-emerald-50 transition text-center"
                        >
                          <td className="px-2 py-2 font-mono text-xs">{p.id_producto}</td>
                          <td className="px-2 py-2 font-medium text-slate-800 truncate max-w-[180px] mx-auto">
                            {p.nombre}
                          </td>
                          <td className="px-2 py-2">{p.nombre_categoria || 'N/A'}</td>
                          <td className="px-2 py-2">
                            {p.nombre_unidad ? `${p.nombre_unidad} (${p.unidad_abrev || ''})` : 'N/A'}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700">
                            {parseFloat(p.stock_actual || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700">
                            ${parseFloat(p.precio_compra || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-emerald-600">
                            ${parseFloat(p.precio_venta || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                p.estado === 1
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-600"
                              }`}
                            >
                              {p.estado === 1 ? "Sí" : "No"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="8"
                          className="text-center py-8 text-slate-400 text-sm"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <ArchiveX size={32} className="text-slate-300" />
                            <p>No hay productos que coincidan con la búsqueda...</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-center mt-6 gap-4">
                  <div className="text-sm text-slate-600 text-center">
                    Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, sortedProducts.length)} de {sortedProducts.length} productos
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0}
                      className="px-3 py-2 border border-slate-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-slate-600 px-3 py-2">
                      Página {currentPage + 1} de {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages - 1}
                      className="px-3 py-2 border border-slate-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}