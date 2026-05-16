// src/pages/CalibrarProductos.jsx - Centrada, fetch real, editar/eliminar con papelera
import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Wrench, Edit3, Trash2, Search, Package } from "lucide-react";
import ModalEditarProducto from "../Admin/EditarProducto";
import useCategorias from "../../hooks/useCategorias";
import useProductos from "../../hooks/useProductos";
import { actualizarProducto, eliminarProducto } from "../../services/productosService";
import { ensureOk } from "../../services/responseUtils";
import { formatStock } from "../../utils/stock";

export default function CalibrarProductos() {
  const { productos, setProductos, loading: loadingProductos, refetchProductos } = useProductos();
  const { categorias, loading: loadingCategorias } = useCategorias();
  const [buscar, setBuscar] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [modalEditar, setModalEditar] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [productoEliminar, setProductoEliminar] = useState(null);
  const [notice, setNotice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const loading = loadingProductos || loadingCategorias;

  // Filtros
  const productosFiltrados = useMemo(() => {
    const searchTerm = buscar.toLowerCase().trim();
    return productos.filter((p) => {
      const matchCategoria = filterCategoria === "Todas" || p.nombre_categoria === filterCategoria;
      const matchBusqueda = !searchTerm ||
        (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(searchTerm)) ||
        (p.codigo_interno && p.codigo_interno.toLowerCase().includes(searchTerm)) ||
        (p.codigo && p.codigo.toLowerCase().includes(searchTerm)) ||
        (p.id_producto && p.id_producto.toString().includes(searchTerm));

      return matchCategoria && matchBusqueda;
    });
  }, [buscar, filterCategoria, productos]);

  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProductos = productosFiltrados.slice(startIndex, startIndex + itemsPerPage);
  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const confirmarEliminar = async () => {
    if (!productoEliminar?.id_producto) return;
    try {
      await eliminarProducto(productoEliminar.id_producto);
      setProductos(productos.filter((p) => p.id_producto !== productoEliminar.id_producto));
      await refetchProductos();
      setProductoEliminar(null);
      setNotice({
        type: "success",
        title: "Producto enviado a papelera",
        message: "El producto se movió a la papelera correctamente.",
      });
    } catch (err) {
      console.error("Error eliminando producto:", err);
      setNotice({
        type: "error",
        title: "No se pudo eliminar el producto",
        message: err.message || "Intenta nuevamente o revisa las dependencias del producto.",
      });
    }
  };

  const handleEditar = (producto) => {
    setProductoSeleccionado(producto);
    setModalEditar(true);
  };

  const handleGuardar = async (productoEditado) => {
    try {
      const response = await actualizarProducto(productoEditado.id_producto, productoEditado);
      await ensureOk(response, "No se pudo actualizar el producto");
      setProductos((prev) =>
        prev.map((p) =>
          p.id_producto === productoEditado.id_producto
            ? { ...p, ...productoEditado }
            : p
        )
      );
      refetchProductos();
      setModalEditar(false);
      setNotice({
        type: "success",
        title: "Producto actualizado",
        message: "Los cambios del producto se guardaron correctamente.",
      });
    } catch (err) {
      console.error("Error actualizando producto:", err);
      setNotice({
        type: "error",
        title: "No se pudo actualizar el producto",
        message: err.message || "Revisa la información e intenta nuevamente.",
      });
    }
  };

  const handlePageChange = (page) => setCurrentPage(page);

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <div className="text-center">
          <Package size={32} className="animate-spin text-cyan-600 mx-auto mb-2" />
          <p className="text-slate-500">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {/* Encabezado centrado */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-gradient-to-r from-cyan-600 to-lime-600 p-2.5 rounded-sm shadow-sm text-white">
            <Wrench size={22} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Calibrar Productos</h1>
        </div>
        <p className="text-sm text-slate-500 mb-4 font-medium">Ajuste y edición de precios – MARKETSYS</p>
      </div>

      {/* Filtros - Centrado */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2 border-b pb-2">
            <Search size={18} /> Buscar y filtrar productos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Categoría</label>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
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
                  className="w-full pl-9 pr-4 py-2 border rounded-sm text-sm focus:ring-2 focus:ring-cyan-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabla - Responsive, centrada, sin scroll-x */}
        <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-700 flex justify-between items-center">
            Productos calibrables ({productosFiltrados.length})
          </h2>

          <div className="overflow-hidden">
            <table className="w-full table-fixed text-xs border border-slate-200 rounded-sm overflow-hidden">
              <thead className="bg-gradient-to-r from-cyan-600 to-lime-600 text-white">
                <tr>
                  <th className="w-[120px] px-2 py-2 text-left uppercase tracking-wide">Código</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wide">Producto</th>
                  <th className="w-[115px] px-2 py-2 text-right uppercase tracking-wide">Compra</th>
                  <th className="w-[115px] px-2 py-2 text-right uppercase tracking-wide">Venta</th>
                  <th className="w-[90px] px-2 py-2 text-right uppercase tracking-wide">Stock</th>
                  <th className="w-[74px] px-2 py-2 text-center uppercase tracking-wide">Activo</th>
                  <th className="w-[88px] px-2 py-2 text-center uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {currentProductos.length > 0 ? (
                  currentProductos.map((p) => (
                    <tr key={p.id_producto} className="h-12 hover:bg-cyan-50 transition">
                      <td className="px-2 py-2 font-mono text-[11px] font-semibold text-slate-700">
                        {p.codigo_interno || `P${p.id_producto}`}
                      </td>
                      <td className="min-w-0 px-2 py-2">
                        <div className="truncate font-semibold text-slate-800" title={p.nombre}>{p.nombre}</div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] font-medium text-slate-500">
                          <span className="truncate" title={p.nombre_categoria}>{p.nombre_categoria || "Sin categoría"}</span>
                          <span className="shrink-0 text-slate-300">|</span>
                          <span className="shrink-0">{p.unidad_abrev || p.nombre_unidad || "-"}</span>
                          {p.codigo_barras && (
                            <>
                              <span className="shrink-0 text-slate-300">|</span>
                              <span className="truncate font-mono" title={p.codigo_barras}>{p.codigo_barras}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">${parseFloat(p.precio_compra || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</td>
                      <td className="px-2 py-2 text-right font-semibold text-emerald-600">${parseFloat(p.precio_venta || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</td>
                      <td className="px-2 py-2 text-right">{formatStock(p.stock_actual)}</td>
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
                            onClick={() => setProductoEliminar(p)}
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
                    <td colSpan="7" className="h-[480px] text-center py-8 text-slate-400">
                      No hay productos que coincidan con los filtros...
                    </td>
                  </tr>
                )}
                {currentProductos.length > 0 &&
                  currentProductos.length < itemsPerPage &&
                  Array.from({ length: itemsPerPage - currentProductos.length }, (_, index) => (
                    <tr key={`empty-row-${index}`} className="h-12">
                      <td colSpan="7" className="px-2 py-2">&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
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

      {productoEliminar && (
        <ProductConfirmDialog
          producto={productoEliminar}
          onCancel={() => setProductoEliminar(null)}
          onConfirm={confirmarEliminar}
        />
      )}

      {notice && (
        <ProductNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function ProductConfirmDialog({ producto, onCancel, onConfirm }) {
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
            <h3 className="text-lg font-black leading-tight">Enviar producto a papelera</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">
              El producto dejará de estar disponible y podrá restaurarse desde Papelera.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Producto</span>
            <span className="max-w-[230px] truncate text-right font-black text-[#111827]">{producto.nombre}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Código</span>
            <span className="font-black text-[#111827]">{producto.codigo_interno || `P${producto.id_producto}`}</span>
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
            Enviar a papelera
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductNotice({ type = "success", title, message, onClose }) {
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
