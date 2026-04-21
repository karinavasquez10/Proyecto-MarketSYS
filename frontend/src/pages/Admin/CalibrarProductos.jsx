// src/pages/CalibrarProductos.jsx - Centrada, fetch real, editar/eliminar con papelera
import React, { useState, useEffect } from "react";
import { Wrench, Edit3, Trash2, Search, Package } from "lucide-react";
import ModalEditarProducto from "../Admin/EditarProducto";

// Variable de entorno con endpoint base
const RAW_API_URL = import.meta.env.VITE_API_URL || "";
const API = (() => {
  try {
    let u = RAW_API_URL || "http://localhost:5000";
    u = u.replace(/\/+$/, "");
    if (!u.endsWith("/api")) u = u + "/api";
    return u;
  } catch {
    return "http://localhost:5000/api";
  }
})();

export default function CalibrarProductos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [modalEditar, setModalEditar] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prodRes, catRes] = await Promise.all([
          fetch(`${API}/products/productos`),
          fetch(`${API}/categorias`),
        ]);
        if (prodRes.ok) setProductos(await prodRes.json());
        if (catRes.ok) setCategorias(await catRes.json());
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtros
  const productosFiltrados = productos.filter((p) => {
    // Filtro de categoría
    const matchCategoria = filterCategoria === "Todas" || p.nombre_categoria === filterCategoria;
    
    // Filtro de búsqueda - buscar en nombre, código o ID
    const searchTerm = buscar.toLowerCase().trim();
    const matchBusqueda = !searchTerm || 
      (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) ||
      (p.codigo && p.codigo.toLowerCase().includes(searchTerm)) ||
      (p.id_producto && p.id_producto.toString().includes(searchTerm));
    
    return matchCategoria && matchBusqueda;
  });

  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProductos = productosFiltrados.slice(startIndex, startIndex + itemsPerPage);

  const handleEliminar = async (id) => {
    if (!confirm("¿Deseas eliminar este producto? Se moverá a la papelera.")) return;
    try {
      await fetch(`${API}/products/productos/${id}`, { method: "DELETE" });
      setProductos(productos.filter((p) => p.id_producto !== id));
      alert("Producto movido a la papelera exitosamente");
    } catch (err) {
      console.error("Error eliminando producto:", err);
      alert("Error al eliminar producto");
    }
  };

  const handleEditar = (producto) => {
    setProductoSeleccionado(producto);
    setModalEditar(true);
  };

  const handleGuardar = async (productoEditado) => {
    try {
      await fetch(`${API}/products/productos/${productoEditado.id_producto}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productoEditado),
      });
      setProductos((prev) =>
        prev.map((p) => (p.id_producto === productoEditado.id_producto ? productoEditado : p))
      );
      setModalEditar(false);
      alert("Producto actualizado exitosamente");
    } catch (err) {
      console.error("Error actualizando producto:", err);
      alert("Error al actualizar producto");
    }
  };

  const handlePageChange = (page) => setCurrentPage(page);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 px-6 sm:px-8 py-10 flex justify-center items-center">
        <div className="text-center">
          <Package size={32} className="animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-slate-500">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 px-6 sm:px-8 py-10">
      {/* Encabezado centrado */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-2.5 rounded-lg shadow-md text-white">
            <Wrench size={22} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Calibrar Productos</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6 font-medium">Ajuste y edición de precios – InventNet</p>
      </div>

      {/* Filtros - Centrado */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-4 sm:p-6 mb-6">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2 border-b pb-2">
            <Search size={18} /> Buscar y filtrar productos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Categoría</label>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200"
              >
                <option>Todas</option>
                {categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Buscar producto</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Nombre, código o ID del producto..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabla - Responsive, centrada, sin scroll-x */}
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-700 flex justify-between items-center">
            Productos calibrables ({productosFiltrados.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-gradient-to-r from-orange-400/80 to-yellow-400/80 text-white">
                <tr>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-16">Código</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-40">Nombre</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-24">Categoría</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-24">Unidad</th>
                  <th className="px-2 py-2 text-right uppercase tracking-wide w-20">Precio Compra</th>
                  <th className="px-2 py-2 text-right uppercase tracking-wide w-20">Precio Venta</th>
                  <th className="px-2 py-2 text-right uppercase tracking-wide w-16">Stock Actual</th>
                  <th className="px-2 py-2 text-center uppercase tracking-wide w-12">Activo</th>
                  <th className="px-2 py-2 text-center uppercase tracking-wide w-16">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProductos.length > 0 ? (
                  currentProductos.map((p) => (
                    <tr key={p.id_producto} className="hover:bg-orange-50 transition">
                      <td className="px-2 py-2 font-medium">P{p.id_producto}</td>
                      <td className="px-2 py-2 truncate">{p.nombre}</td>
                      <td className="px-2 py-2 truncate">{p.nombre_categoria}</td>
                      <td className="px-2 py-2 truncate">{p.unidad_abrev || p.nombre_unidad || '-'}</td>
                      <td className="px-2 py-2 text-right">${parseFloat(p.precio_compra).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-emerald-600">${parseFloat(p.precio_venta).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right">{parseFloat(p.stock_actual).toFixed(2)}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                          {p.estado ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleEditar(p)}
                            className="bg-sky-500 hover:bg-sky-600 text-white p-1.5 rounded-md text-xs shadow"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleEliminar(p.id_producto)}
                            className="bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-md text-xs shadow"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-400">
                      No hay productos que coincidan con los filtros...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4 text-xs">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded disabled:opacity-50 hover:bg-orange-100 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 rounded ${currentPage === page ? 'bg-orange-500 text-white' : 'hover:bg-orange-100'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded disabled:opacity-50 hover:bg-orange-100 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
              <span className="px-2 text-slate-600">
                {startIndex + 1}-{Math.min(startIndex + itemsPerPage, productosFiltrados.length)} de {productosFiltrados.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalEditar && (
        <ModalEditarProducto
          producto={productoSeleccionado}
          onClose={() => setModalEditar(false)}
          onSave={handleGuardar}
          categorias={categorias}
        />
      )}
    </div>
  );
}