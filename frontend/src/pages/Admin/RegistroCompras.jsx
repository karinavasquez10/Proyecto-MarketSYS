// src/pages/RegistroCompras.jsx - Tabla responsive sin scroll-x, con unidades y centrado
import React, { useState, useEffect } from "react";
import { Package, ShoppingBag, Trash2, DollarSign, Search } from "lucide-react";

// Loader superpuesto solo sobre el contenedor principal de la vista
function PageLoader() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white min-h-full">
      <div className="flex flex-col items-center justify-center">
        <div className="relative mb-3">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingBag size={26} className="text-yellow-400 opacity-70" />
          </div>
        </div>
        <p className="text-yellow-500 font-semibold text-base animate-pulse">
          Cargando registros de compras...
        </p>
        <p className="text-slate-400 text-xs mt-1">Por favor espera un momento</p>
      </div>
    </div>
  );
}

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

export default function RegistroCompras() {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [cart, setCart] = useState([]);
  const [comprasDetalle, setComprasDetalle] = useState([]); // Ahora usa JOIN de /compras
  const [loading, setLoading] = useState(true);

  // Para error en proveedor
  const [proveedorError, setProveedorError] = useState("");

  // Filtros y paginación en tabla
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProveedor, setFilterProveedor] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    proveedor: "",
    categoria: "",
    producto: "",
    cantidad: "",
    costo: "",
    unidad: "",
  });

  // Fetch inicial (proveedores, productos, categorias, unidades y comprasDetalle)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [provRes, prodRes, catRes, unitRes] = await Promise.all([
          fetch(`${API}/proveedores`),
          fetch(`${API}/products/productos`),
          fetch(`${API}/categorias`),
          fetch(`${API}/unidades_medida`),
        ]);
        if (provRes.ok) setProveedores(await provRes.json());
        if (prodRes.ok) {
          const data = await prodRes.json();
          setProductos(data);
          setProductosFiltrados(data);
        }
        if (catRes.ok) setCategorias(await catRes.json());
        if (unitRes.ok) setUnidades(await unitRes.json());
        await fetchComprasDetalle(); // Ahora fetch de /compras (JOIN)
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtrar productos por categoría seleccionada
  useEffect(() => {
    if (form.categoria) {
      const filtered = productos.filter(p => p.nombre_categoria === form.categoria);
      setProductosFiltrados(filtered);
      if (!filtered.find(p => p.id_producto == form.producto)) {
        setForm(prev => ({ ...prev, producto: "", costo: "", unidad: "" }));
      }
    } else {
      setProductosFiltrados(productos);
    }
  }, [form.categoria, productos]);

  // Auto-load costo y unidad
  useEffect(() => {
    if (form.producto) {
      const selectedProduct = productosFiltrados.find(p => p.id_producto == form.producto);
      if (selectedProduct) {
        setForm(prev => ({
          ...prev,
          costo: selectedProduct.precio_compra || "",
          unidad: selectedProduct.unidad_abrev || selectedProduct.unidad || "",
        }));
      }
    }
  }, [form.producto, productosFiltrados]);

  // Fetch compras-detalle para tabla (ahora usa /compras con JOIN)
  const fetchComprasDetalle = async () => {
    try {
      const res = await fetch(`${API}/compras`);
      if (res.ok) setComprasDetalle(await res.json());
      else setComprasDetalle([]);
    } catch (err) {
      console.error("Error fetching compras detalle:", err);
      setComprasDetalle([]);
    }
  };

  const handleChange = (key, value) => setForm({ ...form, [key]: value });

  const addToCart = () => {
    if (!form.categoria || !form.producto || !form.cantidad || !form.costo) {
      alert("Completa los campos obligatorios");
      return;
    }
    const selectedProduct = productosFiltrados.find(p => p.id_producto == form.producto);
    if (!selectedProduct) return;
    const newItem = {
      ...form,
      id: Date.now(),
      nombreProducto: selectedProduct.nombre,
      categoria: selectedProduct.nombre_categoria || form.categoria,
      total: parseFloat(form.cantidad) * parseFloat(form.costo),
    };
    setCart([...cart, newItem]);
    setForm({
      ...form, producto: "", cantidad: "", costo: "", unidad: "",
    });
  };

  const removeFromCart = (id) => setCart(cart.filter((c) => c.id !== id));

  const finalizarCompra = async () => {
    if (cart.length === 0) {
      alert("No hay items en el carrito");
      return;
    }
    if (!form.proveedor) {
      setProveedorError("Selecciona un proveedor válido");
      return;
    }
    setProveedorError("");
    try {
      // 1. Registrar la compra (cabecera) - ahora sin ítem
      const compraRes = await fetch(`${API}/compras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_proveedor: form.proveedor,
          fecha: form.fecha,
        }),
      });
      if (!compraRes.ok) throw new Error("Error al crear la compra");
      const compra = await compraRes.json();
      const id_compra = compra.id_compra;

      // 2. Registrar cada detalle
      for (const item of cart) {
        await fetch(`${API}/compras/detalle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_compra,
            id_producto: item.producto,
            cantidad: item.cantidad,
            costo_unitario: item.costo,
          }),
        });
      }
      setCart([]);
      await fetchComprasDetalle(); // Refresh
      alert("Compra finalizada exitosamente");
    } catch (err) {
      console.error("Error finalizando compra:", err);
      alert("Error al finalizar compra");
    }
  };

  const handleDeleteDetalle = async (id_detalle) => {
    if (!confirm("¿Eliminar este item de compra? Se revertirá el stock. Si es el último, la compra se moverá a la papelera.")) return;
    try {
      await fetch(`${API}/compras/detalle/${id_detalle}`, { method: "DELETE" });
      await fetchComprasDetalle(); // Refresh tabla
      alert("Item eliminado exitosamente");
    } catch (err) {
      console.error("Error eliminando detalle compra:", err);
      alert("Error al eliminar item");
    }
  };

  // Filtros y paginado sobre comprasDetalle
  const filteredComprasDetalle = comprasDetalle
    .filter(d =>
      (d.proveedor && d.proveedor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.producto && d.producto.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(d => filterProveedor === "Todos" || d.proveedor === filterProveedor);

  const totalPages = Math.ceil(filteredComprasDetalle.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentDetalles = filteredComprasDetalle.slice(startIndex, startIndex + itemsPerPage);

  // Proveedores únicos para filtro
  const proveedoresUnicos = ["Todos", ...Array.from(new Set(comprasDetalle.map(d => d.proveedor).filter(Boolean)))];

  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 px-6 sm:px-8 py-10 relative">
      {/* El loader ahora está contenido solo dentro de este div principal */}
      {loading && <PageLoader />}
      {/* ===== Encabezado (centrado) ===== */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-2.5 rounded-lg shadow-md text-white">
            <ShoppingBag size={22} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Registro de Compras
          </h1>
        </div>
      </div>

      {/* ===== Formulario (agregar a carrito) - Centrado ===== */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6 sm:p-8 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => handleChange("fecha", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Proveedor</label>
              <select
                value={form.proveedor}
                onChange={(e) => handleChange("proveedor", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Seleccione...</option>
                {proveedores.map(p => (
                  <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre}</option>
                ))}
              </select>
              {proveedorError && <p className="text-xs text-red-500 mt-1">{proveedorError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => handleChange("categoria", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Seleccione...</option>
                {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Producto</label>
              <select
                value={form.producto}
                onChange={(e) => handleChange("producto", e.target.value)}
                disabled={!form.categoria}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Seleccione...</option>
                {productosFiltrados.map(p => (
                  <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>
                ))}
              </select>
              {!form.categoria && <p className="text-xs text-slate-500 mt-1">Selecciona una categoría primero</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Cantidad</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.cantidad}
                  onChange={(e) => handleChange("cantidad", e.target.value)}
                  placeholder="Ej: 10"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200"
                />
                {form.unidad && (
                  <span className="self-center text-sm font-medium text-slate-600 whitespace-nowrap">{form.unidad}</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Costo Unit.</label>
              <input
                type="number"
                step="0.01"
                value={form.costo}
                onChange={(e) => handleChange("costo", e.target.value)}
                placeholder="$0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200"
                readOnly
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={addToCart}
              disabled={!form.categoria || !form.producto || !form.cantidad || !form.costo}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2.5 rounded-md text-sm font-medium shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Package size={16} /> Agregar Item
            </button>
            {cart.length > 0 && (
              <button
                onClick={finalizarCompra}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-md text-sm font-medium shadow-sm transition flex items-center gap-2"
              >
                <DollarSign size={16} /> Finalizar ({cart.length})
              </button>
            )}
          </div>
          {/* Carrito local - Mejor distribución */}
          {cart.length > 0 && (
            <div className="mt-4 p-3 sm:p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-medium mb-2 text-sm">Carrito ({cart.length} items)</h3>
              <ul className="space-y-1 text-xs">
                {cart.map(item => (
                  <li key={item.id} className="flex justify-between items-center">
                    <span className="truncate">
                      {item.nombreProducto} x {item.cantidad} {item.unidad} @ ${parseFloat(item.costo).toFixed(2)}
                    </span>
                    <span className="font-medium">${item.total.toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-2"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right font-semibold text-orange-600 text-sm">
                Total: ${cart.reduce((sum, item) => sum + parseFloat(item.total), 0).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===== Filtros para tabla - Mejor grid responsivo ===== */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-4 sm:p-6 mb-6">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2 border-b pb-2">
            <Search size={18} /> Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-end">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar proveedor/producto..."
                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 text-sm"
              />
            </div>
            <select
              value={filterProveedor}
              onChange={(e) => setFilterProveedor(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-200 text-sm"
            >
              {proveedoresUnicos.map(prov => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
            <div className="md:col-span-1 md:justify-self-end" /> {/* Spacer para alineación */}
          </div>
        </div>

        {/* ===== Tabla de Compras - Responsive, centrada, sin scroll-x forzado ===== */}
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-700 flex justify-between items-center">
            Compras Realizadas ({filteredComprasDetalle.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-gradient-to-r from-orange-400/80 to-yellow-400/80 text-white">
                <tr>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-20">Fecha</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-24">Proveedor</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-32">Producto</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-16">Cant.</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-12">Unidad</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-20">Costo Unit.</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-20">Categoría</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide w-16">Total</th>
                  <th className="px-2 py-2 text-center uppercase tracking-wide w-12">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentDetalles.length > 0 ? (
                  currentDetalles.map((d, i) => (
                    <tr key={d.id_detalle_compra || `${d.id_compra}_${d.id_producto}` || i} className="hover:bg-orange-50 transition">
                      <td className="px-2 py-2">{d.fecha ? new Date(d.fecha).toLocaleDateString() : ""}</td>
                      <td className="px-2 py-2 truncate">{d.proveedor || "-"}</td>
                      <td className="px-2 py-2 truncate">{d.producto || "-"}</td>
                      <td className="px-2 py-2">{d.cantidad}</td>
                      <td className="px-2 py-2">{d.unidad_abrev || d.unidad || "-"}</td>
                      <td className="px-2 py-2">${parseFloat(d.costo_unitario || 0).toFixed(2)}</td>
                      <td className="px-2 py-2 truncate">{d.categoria || ""}</td>
                      <td className="px-2 py-2 font-semibold text-orange-600">
                        ${(parseFloat(d.cantidad || 0) * parseFloat(d.costo_unitario || 0)).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleDeleteDetalle(d.id_detalle_compra)}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-md text-xs shadow w-full"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-400">
                      No hay compras registradas aún...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación - Centrada */}
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
                {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredComprasDetalle.length)} de {filteredComprasDetalle.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}