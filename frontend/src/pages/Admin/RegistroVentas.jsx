import React, { useState, useEffect } from "react";
import { ShoppingCart, DollarSign, User, Trash2, FileText, Search, ChevronLeft, ChevronRight, ArchiveX, AlertCircle } from "lucide-react";

// Asumiendo backend en puerto 5000; ajusta si es diferente
const API_BASE_URL = 'http://localhost:5000';

export default function RegistroVentas() {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, ] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    id_cliente: "",
    id_producto: "",
    cantidad: "",
    precio_unitario: "",
    descuento: "",
    metodo_pago: "efectivo",
  });
  const [impuestoRate, setImpuestoRate] = useState(0); // tasa de impuesto del producto

  // Asumir id_usuario (puedes obtener de auth/context)
  const id_usuario = 1; // Placeholder: Reemplaza con real user ID
  const id_caja = null; // Fijo para modo manual (sin caja)

  // Función helper para fetch
  const fetchWithErrorHandling = async (endpoint, setter, isArray = true) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en ${url}: Status ${response.status}`, errorText.substring(0, 200));
        throw new Error(`Error ${response.status}: Verifica el backend.`);
      }
      const data = await response.json();
      if (isArray) {
        setter(data);
      } else {
        setter(data);
      }
    } catch (err) {
      console.error(`Error al cargar desde ${url}:`, err);
      setError(err.message);
    }
  };

  // Cargar datos iniciales (sin fetch de caja para evitar error)
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWithErrorHandling('/api/ventas', setVentas);
    fetchWithErrorHandling('/api/clientes', setClientes);
    fetchWithErrorHandling('/api/products/productos', setProductos);
    setLoading(false);
  }, []);

  // Cargar precio e impuesto al seleccionar producto
  useEffect(() => {
    if (form.id_producto) {
      fetchWithErrorHandling(`/api/products/productos/${form.id_producto}`, (data) => {
        // Fix: Forzar 2 decimales en precio para precisión
        const precioVenta = data.precio_venta ? Number(parseFloat(data.precio_venta).toFixed(2)) : 0;
        setForm((prev) => ({ ...prev, precio_unitario: precioVenta.toString() }));
        setImpuestoRate(data.impuesto || 0);
      }, false);
    } else {
      setForm((prev) => ({ ...prev, precio_unitario: "" }));
      setImpuestoRate(0);
    }
  }, [form.id_producto]);

  const handleChange = (key, value) => setForm({ ...form, [key]: value });

  const handleSubmit = async () => {
    if (!form.id_producto || !form.cantidad || !form.precio_unitario) {
      alert("Por favor completa los campos obligatorios: producto, cantidad, precio");
      return;
    }
    let cantidadNum = parseFloat(form.cantidad);
    let precioNum = parseFloat(form.precio_unitario);
    let descuentoNum = parseFloat(form.descuento || 0);

    // Fix: Forzar precisión a 2 decimales para evitar errores de flotantes
    cantidadNum = Number(cantidadNum.toFixed(2));
    precioNum = Number(precioNum.toFixed(2));
    descuentoNum = Number(descuentoNum.toFixed(2));

    if (cantidadNum <= 0 || precioNum <= 0) {
      alert("Cantidad y precio deben ser mayores a 0");
      return;
    }
    if (descuentoNum < 0 || descuentoNum > (cantidadNum * precioNum)) {
      alert("Descuento debe ser entre 0 y el subtotal");
      return;
    }

    // Modo manual: siempre sin caja, stock siempre se reduce
    try {
      // Fix: Calcular con precisión (toFixed(2) para decimales)
      const subtotal = Number((cantidadNum * precioNum).toFixed(2));
      const impuesto_amount = Number((subtotal * (impuestoRate / 100)).toFixed(2));
      const total = Number((subtotal + impuesto_amount - descuentoNum).toFixed(2));

      const items = [{
        id_producto: parseInt(form.id_producto),
        cantidad: cantidadNum, // Ya con 2 decimales
        precio_unitario: precioNum, // Ya con 2 decimales
        descuento: descuentoNum, // Ya con 2 decimales
      }];

      const body = {
        fecha: `${form.fecha} 00:00:00`,
        id_cliente: form.id_cliente ? parseInt(form.id_cliente) : null,
        id_usuario,
        id_caja: id_caja, // null para manual
        subtotal,
        impuesto: impuesto_amount,
        total,
        metodo_pago: form.metodo_pago,
        observaciones: `Venta manual: ${form.metodo_pago} el ${form.fecha} (sin caja)`,
        items,
      };

      console.log('Enviando body (con precisión):', body); // Debug en frontend

      const response = await fetch(`${API_BASE_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Respuesta error:', errorText); // Debug
        const errorData = JSON.parse(errorText).message || errorText;
        throw new Error(errorData || `Error ${response.status}`);
      }

      // Reset form
      setForm({
        fecha: new Date().toISOString().split("T")[0],
        id_cliente: "",
        id_producto: "",
        cantidad: "",
        precio_unitario: "",
        descuento: "",
        metodo_pago: "efectivo",
      });
      setImpuestoRate(0);

      // Recargar ventas
      fetchWithErrorHandling('/api/ventas', setVentas);
      alert('Venta registrada exitosamente (manual, sin caja). Stock actualizado.');
    } catch (error) {
      console.error('Error al registrar venta:', error);
      alert(`Error al registrar la venta: ${error.message}`);
    }
  };

  // Aplicar filtros y ordenamiento (sin cambios)
  const filteredVentas = ventas.filter((v) => {
    const matchesSearch = (v.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.nombre_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.id_venta.toString().includes(searchTerm));
    return matchesSearch;
  });

  const sortedVentas = [...filteredVentas].sort((a, b) => {
    const dateA = new Date(a.fecha).getTime();
    const dateB = new Date(b.fecha).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const totalPages = Math.ceil(sortedVentas.length / itemsPerPage);
  const paginatedVentas = sortedVentas.slice(
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-6 sm:px-22 py-10 rounded-xl flex items-center justify-center">
        <p className="text-slate-600">Cargando ventas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-6 sm:px-22 py-10 rounded-xl mx-auto max-w-7xl">
      {/* Error global */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4 text-center">
          <p className="text-sm">Error al cargar datos: {error}</p>
          <button onClick={() => window.location.reload()} className="text-rose-600 hover:underline text-sm mt-1">
            Recargar
          </button>
        </div>
      )}

      {/* Info de modo manual */}
      <div className="bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3 rounded mb-4 text-center">
        <p className="text-sm">Modo manual: Ventas sin caja, pero con actualización de stock.</p>
      </div>

      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-2.5 rounded-lg shadow-md text-white">
          <ShoppingCart size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Registro de Ventas
        </h1>
      </div>

      {/* ===== Formulario ===== (sin cambios en UI) */}
      <div className="bg-white/90 border border-emerald-100 rounded-2xl shadow-md p-8 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => handleChange("fecha", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Cliente
            </label>
            <select
              value={form.id_cliente}
              onChange={(e) => handleChange("id_cliente", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((cl) => (
                <option key={cl.id} value={cl.id_cliente}>
                  {cl.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Medio de Pago
            </label>
            <select
              value={form.metodo_pago}
              onChange={(e) => handleChange("metodo_pago", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Producto
            </label>
            <select
              value={form.id_producto}
              onChange={(e) => handleChange("id_producto", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Seleccionar producto</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cantidad}
              onChange={(e) => handleChange("cantidad", e.target.value)}
              placeholder="Ej: 2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Precio Unitario
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.precio_unitario}
              onChange={(e) => handleChange("precio_unitario", e.target.value)}
              placeholder="$0.00"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>

        {/* Fila para Descuento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2" /> {/* Espaciador */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Descuento (opcional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.descuento}
              onChange={(e) => handleChange("descuento", e.target.value)}
              placeholder="$0.00"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>

        {/* Badge informativo para impuesto si >0 */}
        {impuestoRate > 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-100 px-3 py-2 rounded-md mb-4">
            <AlertCircle size={16} />
            <span>Impuesto: {impuestoRate}% (calculado automáticamente)</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-md text-sm font-medium shadow-sm transition flex items-center gap-2"
          >
            <DollarSign size={16} /> Registrar Venta
          </button>
        </div>
      </div>

      {/* ===== Tabla de Ventas ===== (sin cambios) */}
      <div className="bg-white/90 border border-emerald-100 rounded-2xl shadow-md p-6 overflow-x-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-slate-700">
            Ventas Registradas ({sortedVentas.length})
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="text-slate-600">Ordenar por fecha:</label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(0);
              }}
              className="border border-slate-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="desc">Más reciente</option>
              <option value="asc">Más antiguo</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-gradient-to-r from-emerald-400/80 to-green-400/80 text-white">
              <tr>
                {[
                  "ID Venta",
                  "Fecha",
                  "Cliente",
                  "Usuario",
                  "Total",
                  "Método Pago",
                ].map((col) => (
                  <th key={col} className="px-4 py-2 text-left text-xs uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedVentas.length > 0 ? (
                paginatedVentas.map((v) => (
                  <tr key={v.id_venta} className="border-b border-slate-100 hover:bg-emerald-50 transition">
                    <td className="px-4 py-2 font-mono">{v.id_venta}</td>
                    <td className="px-4 py-2">{new Date(v.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{v.nombre_cliente || 'Cliente Genérico'}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{v.nombre_usuario || 'N/A'}</td>
                    <td className="px-4 py-2 font-semibold text-emerald-600 text-right">${parseFloat(v.total || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 capitalize">{v.metodo_pago || 'efectivo'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ArchiveX size={32} className="text-slate-300" />
                      <p>No hay ventas registradas aún...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-6 gap-4">
            <div className="text-sm text-slate-600">
              Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, sortedVentas.length)} de {sortedVentas.length} ventas
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
      </div>
    </div>
  );
}