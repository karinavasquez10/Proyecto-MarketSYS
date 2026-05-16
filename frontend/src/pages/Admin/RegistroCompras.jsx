// src/pages/RegistroCompras.jsx - Ingreso de compras, tabla responsive con unidades.
import React, { useMemo, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, DollarSign, Package, PlusCircle, RefreshCw, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useCategorias from "../../hooks/useCategorias";
import useCompras from "../../hooks/useCompras";
import useProductos from "../../hooks/useProductos";
import useProveedores from "../../hooks/useProveedores";
import {
  agregarDetalleCompra,
  crearCompra,
  eliminarDetalleCompra,
} from "../../services/comprasService";
import { ensureOk } from "../../services/responseUtils";

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
          Cargando ingresos de compras...
        </p>
        <p className="text-slate-400 text-xs mt-1">Por favor espera un momento</p>
      </div>
    </div>
  );
}

function ShortcutButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
    >
      {children}
    </button>
  );
}

export default function RegistroCompras() {
  const navigate = useNavigate();
  const { proveedores, loading: loadingProveedores, refetchProveedores } = useProveedores();
  const { productos, loading: loadingProductos, refetchProductos } = useProductos();
  const { categorias, loading: loadingCategorias, refetchCategorias } = useCategorias();
  const {
    comprasDetalle,
    loading: loadingCompras,
    refetchCompras,
  } = useCompras();
  const [cart, setCart] = useState([]);

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
    numero_documento: "",
    metodo_pago: "efectivo",
    fecha_vencimiento: "",
    categoria: "",
    producto: "",
    cantidad: "",
    costo: "",
    unidad: "",
  });
  const loading = loadingProveedores || loadingProductos || loadingCategorias || loadingCompras;
  const [refreshingLists, setRefreshingLists] = useState(false);
  const [notice, setNotice] = useState(null);
  const [detalleEliminar, setDetalleEliminar] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState("");
  const proveedoresActivos = useMemo(
    () => proveedores.filter((p) => (p.estado || "activo") === "activo"),
    [proveedores]
  );

  const productosFiltrados = useMemo(() => {
    if (!form.categoria) return productos;
    return productos.filter(p => p.nombre_categoria === form.categoria);
  }, [form.categoria, productos]);

  // Filtrar productos por categoría seleccionada
  useEffect(() => {
    if (form.categoria) {
      if (!productosFiltrados.find(p => p.id_producto == form.producto)) {
        setForm(prev => ({ ...prev, producto: "", costo: "", unidad: "" }));
      }
    }
  }, [form.categoria, form.producto, productosFiltrados]);

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

  const handleChange = (key, value) => setForm({ ...form, [key]: value });

  const addToCart = () => {
    if (!form.categoria || !form.producto || !form.cantidad || !form.costo) {
      setNotice({
        type: "warning",
        title: "Campos obligatorios",
        message: "Selecciona categoría, producto, cantidad y costo antes de agregar el ítem.",
      });
      return;
    }
    if (Number(form.cantidad) <= 0 || Number(form.costo) < 0) {
      setNotice({
        type: "warning",
        title: "Cantidad o costo inválido",
        message: "La cantidad debe ser mayor que cero y el costo no puede ser negativo.",
      });
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
      setNotice({
        type: "warning",
        title: "Carrito vacío",
        message: "Agrega al menos un ítem antes de finalizar la compra.",
      });
      return;
    }
    if (!form.proveedor) {
      setProveedorError("Selecciona un proveedor válido");
      return;
    }
    if (form.metodo_pago === "credito" && !form.fecha_vencimiento) {
      setNotice({
        type: "warning",
        title: "Fecha de vencimiento requerida",
        message: "Para compras a crédito debes indicar la fecha de vencimiento.",
      });
      return;
    }
    setProveedorError("");
    try {
      // 1. Registrar la compra (cabecera) - ahora sin ítem
      const compraRes = await crearCompra({
        id_proveedor: form.proveedor,
        fecha: form.fecha,
        numero_documento: form.numero_documento,
        metodo_pago: form.metodo_pago,
        fecha_vencimiento: form.metodo_pago === "credito" ? form.fecha_vencimiento : null,
        observaciones: form.metodo_pago === "credito" ? "Compra registrada a crédito" : null,
      });
      await ensureOk(compraRes, "Error al crear la compra");
      const compra = await compraRes.json();
      const id_compra = compra.id_compra;

      // 2. Registrar cada detalle
      for (const item of cart) {
        const detalleRes = await agregarDetalleCompra({
          id_compra,
          id_producto: item.producto,
          cantidad: item.cantidad,
          costo_unitario: item.costo,
        });
        await ensureOk(detalleRes, "Error al agregar detalle de compra");
      }
      setCart([]);
      await refetchCompras(); // Refresh
      setNotice({
        type: "success",
        title: "Compra finalizada",
        message: "La compra se registró correctamente y el inventario fue actualizado.",
      });
    } catch (err) {
      console.error("Error finalizando compra:", err);
      setNotice({
        type: "error",
        title: "No se pudo finalizar",
        message: err.message || "Ocurrió un error al registrar la compra.",
      });
    }
  };

  const handleDeleteDetalle = (detalle) => {
    setDetalleEliminar(detalle);
  };

  const confirmarEliminarDetalle = async () => {
    const id_detalle = detalleEliminar?.id_detalle_compra || detalleEliminar?.id_detalle;
    if (!id_detalle) return;
    try {
      const response = await eliminarDetalleCompra(id_detalle);
      await ensureOk(response, "Error al eliminar item");
      await refetchCompras(); // Refresh tabla
      setDetalleEliminar(null);
      setNotice({
        type: "success",
        title: "Ítem eliminado",
        message: "Se eliminó el ítem y se revirtió el stock correspondiente.",
      });
    } catch (err) {
      console.error("Error eliminando detalle compra:", err);
      setNotice({
        type: "error",
        title: "No se pudo eliminar",
        message: err.message || "Ocurrió un error al eliminar el ítem de compra.",
      });
    }
  };

  // Filtros y paginado sobre comprasDetalle
  const filteredComprasDetalle = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return comprasDetalle
      .filter(d =>
        (d.proveedor && d.proveedor.toLowerCase().includes(search)) ||
        (d.producto && d.producto.toLowerCase().includes(search))
      )
      .filter(d => filterProveedor === "Todos" || d.proveedor === filterProveedor);
  }, [comprasDetalle, filterProveedor, searchTerm]);

  const totalPages = Math.ceil(filteredComprasDetalle.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentDetalles = filteredComprasDetalle.slice(startIndex, startIndex + itemsPerPage);
  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  // Proveedores únicos para filtro
  const proveedoresUnicos = useMemo(() => {
    return ["Todos", ...Array.from(new Set(comprasDetalle.map(d => d.proveedor).filter(Boolean)))];
  }, [comprasDetalle]);

  const handlePageChange = (page) => setCurrentPage(page);

  const navigateWithCartWarning = (path) => {
    if (cart.length > 0) {
      setPendingNavigation(path);
      return;
    }
    navigate(path);
  };

  const confirmarSalida = () => {
    const path = pendingNavigation;
    setPendingNavigation("");
    if (path) navigate(path);
  };

  const refreshCatalogs = async () => {
    setRefreshingLists(true);
    try {
      await Promise.all([
        refetchProveedores(),
        refetchCategorias(),
        refetchProductos(),
      ]);
    } finally {
      setRefreshingLists(false);
    }
  };

  return (
    <div className="admin-module-page">
      {/* El loader ahora está contenido solo dentro de este div principal */}
      {loading && <PageLoader />}
      {/* ===== Encabezado (centrado) ===== */}
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="bg-gradient-to-r from-cyan-600 to-lime-600 p-2.5 rounded-sm shadow-sm text-white">
            <ShoppingBag size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              Ingreso de Compras
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Registra entradas de mercancía y actualiza inventario sin mezclarlo con la gestión de productos.
            </p>
          </div>
        </div>
      </div>

      {/* ===== Formulario (agregar a carrito) - Centrado ===== */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-6 sm:p-8 mb-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Registrar compra</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Usa los atajos si falta un proveedor, categoría o producto.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShortcutButton onClick={() => navigateWithCartWarning("/HomeAdmin/GestionProveedores")}>
                <PlusCircle size={14} /> Proveedor
              </ShortcutButton>
              <ShortcutButton onClick={() => navigateWithCartWarning("/HomeAdmin/GestionCategorias")}>
                <PlusCircle size={14} /> Categoría
              </ShortcutButton>
              <ShortcutButton onClick={() => navigateWithCartWarning("/HomeAdmin/RegistroProductos")}>
                <PlusCircle size={14} /> Producto
              </ShortcutButton>
              <button
                type="button"
                onClick={refreshCatalogs}
                disabled={refreshingLists}
                className="inline-flex items-center gap-1.5 rounded-sm border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={14} className={refreshingLists ? "animate-spin" : ""} />
                Actualizar listas
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => handleChange("fecha", e.target.value)}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Proveedor</label>
              <select
                value={form.proveedor}
                onChange={(e) => handleChange("proveedor", e.target.value)}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              >
                <option value="">Seleccione...</option>
                {proveedoresActivos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {proveedorError && <p className="text-xs text-red-500 mt-1">{proveedorError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Documento</label>
              <input
                type="text"
                value={form.numero_documento}
                onChange={(e) => handleChange("numero_documento", e.target.value)}
                placeholder="Factura proveedor"
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Forma de pago</label>
              <select
                value={form.metodo_pago}
                onChange={(e) => handleChange("metodo_pago", e.target.value)}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="mixto">Mixto</option>
                <option value="credito">Crédito</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento crédito</label>
              <input
                type="date"
                value={form.fecha_vencimiento}
                onChange={(e) => handleChange("fecha_vencimiento", e.target.value)}
                disabled={form.metodo_pago !== "credito"}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => handleChange("categoria", e.target.value)}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              >
                <option value="">Seleccione...</option>
                {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Producto</label>
              <select
                value={form.producto}
                onChange={(e) => handleChange("producto", e.target.value)}
                disabled={!form.categoria}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="flex-1 border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
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
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
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
                className="bg-cyan-500 hover:bg-cyan-700 text-white px-6 py-2.5 rounded-md text-sm font-medium shadow-sm transition flex items-center gap-2"
              >
                <DollarSign size={16} /> Finalizar ({cart.length})
              </button>
            )}
          </div>
          {/* Carrito local - Mejor distribución */}
          {cart.length > 0 && (
            <div className="mt-4 p-3 sm:p-4 bg-yellow-50 rounded-sm">
              <h3 className="font-medium mb-2 text-sm">Carrito ({cart.length} items)</h3>
              <ul className="space-y-1 text-xs">
                {cart.map(item => (
                  <li key={item.id} className="flex justify-between items-center">
                    <span className="truncate">
                      {item.nombreProducto} x {item.cantidad} {item.unidad} @ ${parseFloat(item.costo || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="font-medium">${Number(item.total || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-2"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right font-semibold text-cyan-700 text-sm">
                Total: ${cart.reduce((sum, item) => sum + parseFloat(item.total || 0), 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===== Filtros para tabla - Mejor grid responsivo ===== */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-4 sm:p-6 mb-4">
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
                className="w-full pl-9 pr-4 py-2 border rounded-sm focus:ring-2 focus:ring-cyan-200 text-sm"
              />
            </div>
            <select
              value={filterProveedor}
              onChange={(e) => setFilterProveedor(e.target.value)}
              className="border rounded-sm px-3 py-2 focus:ring-2 focus:ring-cyan-200 text-sm"
            >
              {proveedoresUnicos.map(prov => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
            <div className="md:col-span-1 md:justify-self-end" /> {/* Spacer para alineación */}
          </div>
        </div>

        {/* ===== Tabla de ingresos de compras ===== */}
        <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-700 flex justify-between items-center">
            Ingresos registrados ({filteredComprasDetalle.length})
          </h2>

          <div className="overflow-hidden">
            <table className="w-full table-fixed text-xs border border-slate-200 rounded-sm overflow-hidden">
              <thead className="bg-gradient-to-r from-cyan-600 to-lime-600 text-white">
                <tr>
                  <th className="w-[105px] px-2 py-2 text-left uppercase tracking-wide">Fecha</th>
                  <th className="w-[230px] px-2 py-2 text-left uppercase tracking-wide">Documento / Proveedor</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide">Producto</th>
                  <th className="w-[90px] px-2 py-2 text-right uppercase tracking-wide">Cant.</th>
                  <th className="w-[105px] px-2 py-2 text-right uppercase tracking-wide">Costo Unit.</th>
                  <th className="w-[105px] px-2 py-2 text-right uppercase tracking-wide">Total</th>
                  <th className="w-[64px] px-2 py-2 text-center uppercase tracking-wide">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {currentDetalles.length > 0 ? (
                  currentDetalles.map((d, i) => (
                    <tr key={d.id_detalle_compra || `${d.id_compra}_${d.id_producto}` || i} className="h-12 hover:bg-cyan-50 transition">
                      <td className="px-2 py-2">{d.fecha ? new Date(d.fecha).toLocaleDateString() : ""}</td>
                      <td className="min-w-0 px-2 py-2">
                        <div className="truncate font-mono text-[11px] font-semibold text-slate-700" title={d.numero_documento || `COMP-${String(d.id_compra).padStart(6, "0")}`}>
                          {d.numero_documento || `COMP-${String(d.id_compra).padStart(6, "0")}`}
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2">
                          <span className="truncate text-[10px] font-medium text-slate-500" title={d.proveedor || "-"}>{d.proveedor || "-"}</span>
                          <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            d.estado === "credito" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {d.estado || d.metodo_pago || "registrada"}
                          </span>
                        </div>
                      </td>
                      <td className="min-w-0 px-2 py-2">
                        <div className="truncate font-semibold text-slate-800" title={d.producto || "-"}>{d.producto || "-"}</div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] font-medium text-slate-500">
                          <span className="truncate" title={d.categoria || ""}>{d.categoria || "Sin categoría"}</span>
                          <span className="shrink-0 text-slate-300">|</span>
                          <span className="shrink-0">{d.unidad_abrev || d.unidad || "-"}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{d.cantidad}</td>
                      <td className="px-2 py-2 text-right">${parseFloat(d.costo_unitario || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</td>
                      <td className="px-2 py-2 text-right font-semibold text-cyan-700">
                        ${(parseFloat(d.cantidad || 0) * parseFloat(d.costo_unitario || 0)).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleDeleteDetalle(d)}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-md text-xs shadow w-full"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="h-[480px] text-center py-8 text-slate-400">
                      No hay compras registradas aún...
                    </td>
                  </tr>
                )}
                {currentDetalles.length > 0 &&
                  currentDetalles.length < itemsPerPage &&
                  Array.from({ length: itemsPerPage - currentDetalles.length }, (_, index) => (
                    <tr key={`empty-row-${index}`} className="h-12">
                      <td colSpan="7" className="px-2 py-2">&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Paginación - Centrada */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-2 mt-4 text-xs max-w-full">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded disabled:opacity-50 hover:bg-cyan-100 disabled:cursor-not-allowed"
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
                      className={`min-w-8 rounded px-3 py-1 ${currentPage === page ? 'bg-cyan-500 text-white' : 'hover:bg-cyan-100'}`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded disabled:opacity-50 hover:bg-cyan-100 disabled:cursor-not-allowed"
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
      {notice && (
        <PurchaseNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
      {detalleEliminar && (
        <PurchaseConfirmDialog
          variant="danger"
          title="Eliminar ítem de compra"
          message="Se revertirá el stock de este producto. Si es el último ítem, la compra se moverá a la papelera."
          detail={`${detalleEliminar.producto || "Producto"} - ${detalleEliminar.cantidad || 0} ${detalleEliminar.unidad_abrev || detalleEliminar.unidad || ""}`}
          confirmText="Eliminar ítem"
          onCancel={() => setDetalleEliminar(null)}
          onConfirm={confirmarEliminarDetalle}
        />
      )}
      {pendingNavigation && (
        <PurchaseConfirmDialog
          title="Salir con carrito pendiente"
          message="Tienes ítems pendientes en esta compra. Si continúas, el carrito actual se perderá."
          detail={`${cart.length} ítem${cart.length === 1 ? "" : "s"} sin finalizar`}
          confirmText="Salir de todas formas"
          onCancel={() => setPendingNavigation("")}
          onConfirm={confirmarSalida}
        />
      )}
    </div>
  );
}

function PurchaseNotice({ type = "info", title, message, onClose }) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const iconClass = isSuccess
    ? "bg-emerald-100 text-emerald-700"
    : isError
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${iconClass}`}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-cyan-600 px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseConfirmDialog({ variant = "warning", title, message, detail, confirmText, onCancel, onConfirm }) {
  const danger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${danger ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{message}</p>
            {detail && (
              <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700">
                {detail}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-sm px-4 py-2 text-sm font-black text-white shadow-sm transition ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-cyan-600 hover:bg-cyan-700"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
