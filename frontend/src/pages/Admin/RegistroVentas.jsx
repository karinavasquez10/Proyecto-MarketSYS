import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShoppingCart, DollarSign, ChevronLeft, ChevronRight, ArchiveX, AlertCircle } from "lucide-react";
import { listarClientes } from "../../services/clientesService";
import { obtenerProducto, listarProductos } from "../../services/productosService";
import { crearVenta, listarVentas } from "../../services/ventasService";
import { ensureOk } from "../../services/responseUtils";

export default function RegistroVentas() {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, ] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(0);
  const [notice, setNotice] = useState(null);
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

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  }, []);
  const id_usuario = storedUser?.id_usuario || storedUser?.id || 1;
  const id_caja = null; // Fijo para modo manual (sin caja)

  const cargarDatosIniciales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ventasData, clientesData, productosData] = await Promise.all([
        listarVentas(),
        listarClientes(),
        listarProductos(),
      ]);
      setVentas(ventasData);
      setClientes(clientesData);
      setProductos(productosData);
    } catch (err) {
      console.error("Error al cargar datos de ventas:", err);
      setError(err.message || "Error de conexión al servidor");
      setVentas([]);
      setClientes([]);
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos iniciales (sin fetch de caja para evitar error)
  useEffect(() => {
    cargarDatosIniciales();
  }, [cargarDatosIniciales]);

  // Cargar precio e impuesto al seleccionar producto
  useEffect(() => {
    if (form.id_producto) {
      obtenerProducto(form.id_producto)
        .then((data) => {
          // Fix: Forzar 2 decimales en precio para precisión
          const precioVenta = data.precio_venta ? Number(parseFloat(data.precio_venta).toFixed(2)) : 0;
          setForm((prev) => ({ ...prev, precio_unitario: precioVenta.toString() }));
          setImpuestoRate(data.impuesto || 0);
        })
        .catch((err) => {
          console.error("Error al cargar producto:", err);
          setError(err.message || "Error al cargar producto");
        });
    } else {
      setForm((prev) => ({ ...prev, precio_unitario: "" }));
      setImpuestoRate(0);
    }
  }, [form.id_producto]);

  const handleChange = (key, value) => setForm({ ...form, [key]: value });

  const handleSubmit = async () => {
    if (!form.id_producto || !form.cantidad || !form.precio_unitario) {
      setNotice({
        type: "warning",
        title: "Campos obligatorios",
        message: "Completa producto, cantidad y precio antes de registrar la venta.",
      });
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
      setNotice({
        type: "warning",
        title: "Valores inválidos",
        message: "Cantidad y precio deben ser mayores a cero.",
      });
      return;
    }
    if (descuentoNum < 0 || descuentoNum > (cantidadNum * precioNum)) {
      setNotice({
        type: "warning",
        title: "Descuento inválido",
        message: "El descuento debe estar entre cero y el subtotal de la venta.",
      });
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

      const response = await crearVenta(body);
      await ensureOk(response, "Error al registrar la venta");

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
      const ventasActualizadas = await listarVentas();
      setVentas(ventasActualizadas);
      setNotice({
        type: "success",
        title: "Venta manual registrada",
        message: "La factura, el inventario y el ingreso financiero fueron actualizados correctamente.",
      });
    } catch (error) {
      console.error('Error al registrar venta:', error);
      setNotice({
        type: "error",
        title: "No se pudo registrar la venta",
        message: error.message || "Ocurrió un error inesperado al registrar la venta manual.",
      });
    }
  };

  // Aplicar filtros y ordenamiento (sin cambios)
  const filteredVentas = useMemo(() => ventas.filter((v) => {
    const matchesSearch = (v.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.nombre_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.id_venta.toString().includes(searchTerm));
    return matchesSearch;
  }), [searchTerm, ventas]);

  const sortedVentas = useMemo(() => [...filteredVentas].sort((a, b) => {
    const dateA = new Date(a.fecha).getTime();
    const dateB = new Date(b.fecha).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  }), [filteredVentas, sortOrder]);

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
      <div className="admin-module-page">
        <p className="text-slate-600">Cargando ventas...</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {/* Error global */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4 text-center">
          <p className="text-sm">Error al cargar datos: {error}</p>
          <button onClick={cargarDatosIniciales} className="text-rose-600 hover:underline text-sm mt-1">
            Recargar
          </button>
        </div>
      )}

      {/* Info de modo manual */}
      <div className="bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3 rounded mb-4 text-center">
        <p className="text-sm">Venta manual sin caja: crea factura y actualiza inventario, pero no suma al cierre de caja.</p>
      </div>

      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-2.5 rounded-sm shadow-sm text-white">
          <ShoppingCart size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Venta manual sin caja
        </h1>
      </div>

      {/* ===== Formulario ===== (sin cambios en UI) */}
      <div className="bg-white/90 border border-emerald-100 rounded-sm shadow-sm p-8 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => handleChange("fecha", e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Cliente
            </label>
            <select
              value={form.id_cliente}
              onChange={(e) => handleChange("id_cliente", e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((cl) => (
                <option key={cl.id} value={cl.id}>
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
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Producto
            </label>
            <select
              value={form.id_producto}
              onChange={(e) => handleChange("id_producto", e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>

        {/* Fila para Descuento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
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
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
      <div className="bg-white/90 border border-emerald-100 rounded-sm shadow-sm p-6 overflow-x-hidden">
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
              className="border border-slate-200 rounded-sm px-3 py-1 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="desc">Más reciente</option>
              <option value="asc">Más antiguo</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-sm border border-slate-200 rounded-sm overflow-hidden">
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

      {notice && (
        <SaleNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function SaleNotice({ type = "warning", title, message, onClose }) {
  const success = type === "success";
  const warning = type === "warning";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  const iconClass = success
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : warning
      ? "border-amber-200 bg-amber-100 text-amber-700"
      : "border-rose-200 bg-rose-100 text-rose-700";
  const buttonClass = success
    ? "bg-[linear-gradient(135deg,#3157d5,#18a36b)]"
    : warning
      ? "bg-[#111827]"
      : "bg-[#b91c1c]";

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
