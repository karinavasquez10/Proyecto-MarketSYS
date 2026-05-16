import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  PackagePlus,
  Tag,
  CheckCircle2,
  ArchiveX,
  Search,
  ChevronLeft,
  ChevronRight,
  Barcode,
} from "lucide-react";
import useCategorias from "../../hooks/useCategorias";
import useProductos from "../../hooks/useProductos";
import useUnidadesMedida from "../../hooks/useUnidadesMedida";
import { crearProducto } from "../../services/productosService";
import { ensureOk } from "../../services/responseUtils";
import { formatStock, stockSubmitValue } from "../../utils/stock";

export default function RegistroProductos() {
  const [activo, setActivo] = useState(true);
  const {
    productos,
    loading: loadingProductos,
    error: productosError,
    refetchProductos,
  } = useProductos();
  const {
    categorias,
    loading: loadingCategorias,
    error: categoriasError,
    refetchCategorias,
  } = useCategorias();
  const {
    unidades,
    loading: loadingUnidades,
    error: unidadesError,
    refetchUnidades,
  } = useUnidadesMedida();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(0);
  const [notice, setNotice] = useState(null);
  const [stockIlimitado, setStockIlimitado] = useState({
    stock_actual: false,
    stock_minimo: false,
    stock_maximo: false,
  });
  const itemsPerPage = 10;
  const loading = loadingProductos || loadingCategorias || loadingUnidades;
  const error = productosError || categoriasError || unidadesError;

  const [formData, setFormData] = useState({
    codigo_barras: "",
    codigo_interno: "",
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

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setNotice(null);
  };

  const handleBarcodeKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = formData.codigo_barras.trim();
    if (!code) return;
    const existing = productos.find((product) => String(product.codigo_barras || "").trim() === code);
    if (existing) {
      setNotice({
        type: "warning",
        title: "Código ya registrado",
        message: `Este código ya está registrado en: ${existing.nombre}.`,
      });
      return;
    }
    document.querySelector("#registro-producto-nombre")?.focus();
  };

  const handleSubmit = async () => {
    // Validaciones frontend reforzadas para todos los campos obligatorios
    if (!formData.nombre.trim()) {
      setNotice({ type: "warning", title: "Nombre requerido", message: "El nombre del producto es obligatorio." });
      return;
    }
    if (!formData.id_categoria) {
      setNotice({ type: "warning", title: "Categoría requerida", message: "Selecciona una categoría." });
      return;
    }
    if (!formData.id_unidad) {
      setNotice({ type: "warning", title: "Unidad requerida", message: "Selecciona una unidad de medida." });
      return;
    }
    if (
      formData.precio_compra === "" ||
      isNaN(formData.precio_compra) ||
      parseFloat(formData.precio_compra) < 0
    ) {
      setNotice({ type: "warning", title: "Precio de compra inválido", message: "El precio de compra debe ser un número positivo." });
      return;
    }
    if (
      formData.precio_venta === "" ||
      isNaN(formData.precio_venta) ||
      parseFloat(formData.precio_venta) < 0
    ) {
      setNotice({ type: "warning", title: "Precio de venta inválido", message: "El precio de venta debe ser un número positivo." });
      return;
    }
    if (!stockIlimitado.stock_actual && (
      formData.stock_actual === "" ||
      isNaN(formData.stock_actual) ||
      parseFloat(formData.stock_actual) < 0
    )) {
      setNotice({ type: "warning", title: "Stock actual inválido", message: "El stock actual es obligatorio y debe ser un número positivo." });
      return;
    }
    if (!stockIlimitado.stock_minimo && (
      formData.stock_minimo === "" ||
      isNaN(formData.stock_minimo) ||
      parseFloat(formData.stock_minimo) < 0
    )) {
      setNotice({ type: "warning", title: "Stock mínimo inválido", message: "El stock mínimo es obligatorio y debe ser un número positivo." });
      return;
    }
    if (!stockIlimitado.stock_maximo && (
      formData.stock_maximo === "" ||
      isNaN(formData.stock_maximo) ||
      parseFloat(formData.stock_maximo) < 0
    )) {
      setNotice({ type: "warning", title: "Stock máximo inválido", message: "El stock máximo es obligatorio y debe ser un número positivo." });
      return;
    }

    // Validación de campos de cambio automático
    if (
      (parseInt(formData.cambia_estado) === 1 || parseInt(formData.cambia_apariencia) === 1) &&
      (!formData.tiempo_cambio || parseInt(formData.tiempo_cambio) <= 0)
    ) {
      setNotice({
        type: "warning",
        title: "Tiempo de cambio requerido",
        message: "Si el producto cambia de estado o apariencia, debes especificar el tiempo de cambio en días mayor a 0.",
      });
      return;
    }

    try {
      const nuevoProducto = {
        codigo_barras: formData.codigo_barras.trim() || null,
        codigo_interno: formData.codigo_interno.trim() || null,
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        id_categoria: parseInt(formData.id_categoria),
        id_unidad: parseInt(formData.id_unidad),
        precio_compra: parseFloat(formData.precio_compra),
        precio_venta: parseFloat(formData.precio_venta),
        stock_actual: stockSubmitValue(formData.stock_actual, stockIlimitado.stock_actual),
        stock_minimo: stockSubmitValue(formData.stock_minimo, stockIlimitado.stock_minimo),
        stock_maximo: stockSubmitValue(formData.stock_maximo, stockIlimitado.stock_maximo),
        estado: activo ? 1 : 0,
        cambia_estado: parseInt(formData.cambia_estado),
        cambia_apariencia: parseInt(formData.cambia_apariencia),
        tiempo_cambio: formData.tiempo_cambio ? parseInt(formData.tiempo_cambio) : null,
      };

      const response = await crearProducto(nuevoProducto);
      await ensureOk(response, "Error al registrar el producto");

      // Reset form
      setFormData({
        codigo_barras: "",
        codigo_interno: "",
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
      setStockIlimitado({ stock_actual: false, stock_minimo: false, stock_maximo: false });
      // Recargar productos
      await refetchProductos();
      setNotice({
        type: "success",
        title: "Producto registrado",
        message: "El producto se registró correctamente.",
      });
    } catch (error) {
      console.error('Error en el envío:', error);
      setNotice({
        type: "error",
        title: "No se pudo registrar el producto",
        message: error.message || "Ocurrió un error inesperado al registrar el producto.",
      });
    }
  };

  // Filtrado y ordenamiento
  const sortedProducts = useMemo(() => {
    const filteredProducts = productos.filter((p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.codigo_barras || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.codigo_interno || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.id_producto || "").includes(searchTerm)
    );

    return [...filteredProducts].sort((a, b) => {
      const nameA = a.nombre.toLowerCase();
      const nameB = b.nombre.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }, [productos, searchTerm, sortOrder]);

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

  const recargarCatalogos = () => {
    refetchProductos();
    refetchCategorias();
    refetchUnidades();
  };

  const handleStockIlimitado = (key, checked) => {
    setStockIlimitado((prev) => ({ ...prev, [key]: checked }));
    if (checked) handleChange(key, "");
  };

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <p className="text-slate-600">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
        {/* Error global si hay */}
        {error && (
          <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4 w-full max-w-3xl mx-auto text-center">
            <p className="text-sm">Error al cargar datos: {error}</p>
            <button
              onClick={recargarCatalogos}
              className="text-rose-600 hover:underline text-sm mt-1"
            >
              Recargar datos
            </button>
          </div>
        )}

        {/* ===== Encabezado ===== */}
        <div className="admin-module-header">
          <div className="admin-module-heading">
          <div className="admin-module-icon">
            <PackagePlus size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Registro de Productos</h1>
            <p className="admin-module-subtitle">Crea productos y administra su información comercial.</p>
          </div>
          </div>
        </div>

        {/* ===== Formulario ===== */}
        <div className="admin-module-card">
          {notice && (
            <ProductNotice
              type={notice.type}
              title={notice.title}
              message={notice.message}
              onClose={() => setNotice(null)}
            />
          )}

          {/* Datos del producto */}
          <div className="space-y-5 w-full">
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 border-b pb-2 border-slate-200">
              <Tag size={18} className="text-emerald-500" />
              Datos del producto
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Código de barras
                </label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={17} />
                  <input
                    type="text"
                    value={formData.codigo_barras}
                    onChange={(e) => handleChange("codigo_barras", e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Escanea o escribe el código"
                    className="w-full border border-slate-200 rounded-sm py-2 pl-10 pr-3 text-sm focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Código interno
                </label>
                <input
                  type="text"
                  value={formData.codigo_interno}
                  onChange={(e) => handleChange("codigo_interno", e.target.value)}
                  placeholder="Ej: VER-001"
                  className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Nombre del producto *
                </label>
                <input
                  id="registro-producto-nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleChange("nombre", e.target.value)}
                  placeholder="Ej: Cebolla blanca pelada"
                  className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </div>
            </div>
          </div>

          {/* === Clasificación y precios === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4 w-full">
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
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4 w-full">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-600">Stock actual *</label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-[#152b73]">
                  <input
                    type="checkbox"
                    checked={stockIlimitado.stock_actual}
                    onChange={(e) => handleStockIlimitado("stock_actual", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Ilimitado
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_actual}
                onChange={(e) => handleChange("stock_actual", e.target.value)}
                placeholder={stockIlimitado.stock_actual ? "Ilimitado" : "0.00"}
                required={!stockIlimitado.stock_actual}
                disabled={stockIlimitado.stock_actual}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 disabled:bg-[#eef2ff] disabled:font-black disabled:text-[#111827]"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-600">Stock mínimo *</label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-[#152b73]">
                  <input
                    type="checkbox"
                    checked={stockIlimitado.stock_minimo}
                    onChange={(e) => handleStockIlimitado("stock_minimo", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Ilimitado
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_minimo}
                onChange={(e) => handleChange("stock_minimo", e.target.value)}
                required={!stockIlimitado.stock_minimo}
                placeholder={stockIlimitado.stock_minimo ? "Ilimitado" : "0.00"}
                disabled={stockIlimitado.stock_minimo}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 disabled:bg-[#eef2ff] disabled:font-black disabled:text-[#111827]"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-600">Stock máximo *</label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-[#152b73]">
                  <input
                    type="checkbox"
                    checked={stockIlimitado.stock_maximo}
                    onChange={(e) => handleStockIlimitado("stock_maximo", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Ilimitado
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_maximo}
                onChange={(e) => handleChange("stock_maximo", e.target.value)}
                required={!stockIlimitado.stock_maximo}
                placeholder={stockIlimitado.stock_maximo ? "Ilimitado" : "0.00"}
                disabled={stockIlimitado.stock_maximo}
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 disabled:bg-[#eef2ff] disabled:font-black disabled:text-[#111827]"
              />
            </div>
          </div>

          {/* === Configuración de Cambio Automático === */}
          <div className="space-y-5 w-full mb-4">
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
                  className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
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
                  className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                >
                  <option value={0}>No</option>
                  <option value={1}>Sí</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Productos que se transforman, por ejemplo: plátano verde a maduro.
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
                  className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Días después de creado para activar el cambio
                </p>
              </div>
            </div>

            {(formData.cambia_estado === 1 || formData.cambia_estado === "1" ||
              formData.cambia_apariencia === 1 || formData.cambia_apariencia === "1") &&
              !formData.tiempo_cambio && (
              <div className="bg-amber-50 border border-amber-200 rounded-sm p-3">
                <p className="text-sm text-amber-700">
                  Si el producto cambia de estado o apariencia, debes especificar el tiempo de cambio en días.
                </p>
              </div>
            )}
          </div>

          {/* === Estado y Descripción === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 w-full">
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
                className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          {/* === Botones === */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 w-full">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  codigo_barras: "",
                  codigo_interno: "",
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
                setStockIlimitado({ stock_actual: false, stock_minimo: false, stock_maximo: false });
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
        <div className="admin-module-card">
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
                placeholder="Buscar por nombre, código de barras o interno..."
                className="flex-1 border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
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
                className="border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
              >
                <option value="asc">A-Z</option>
                <option value="desc">Z-A</option>
              </select>
            </div>
          </div>
        </div>

        {/* ===== Tabla de productos ===== */}
        <div className="admin-module-card">
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
                <table className="table-fixed w-full max-w-5xl text-sm border border-slate-200 rounded-sm overflow-hidden">
                  <thead className="bg-gradient-to-r from-emerald-400/80 to-sky-400/80 text-white">
                    <tr>
                      {[
                        { key: "ID Producto", class: "w-[7%] text-center" },
                        { key: "Código", class: "w-[12%] text-center" },
                        { key: "Nombre", class: "w-[18%] text-center" },
                        { key: "Categoría", class: "w-[14%] text-center" },
                        { key: "Unidad", class: "w-[14%] text-center" },
                        { key: "Stock Actual", class: "w-[11%] text-center" },
                        { key: "Compra", class: "w-[11%] text-center" },
                        { key: "Venta", class: "w-[11%] text-center" },
                        { key: "Estado", class: "w-[8%] text-center" },
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
                          <td className="px-2 py-2 font-mono text-xs text-slate-700 truncate">
                            {p.codigo_barras || p.codigo_interno || "-"}
                          </td>
                          <td className="px-2 py-2 font-medium text-slate-800 truncate max-w-[180px] mx-auto">
                            {p.nombre}
                          </td>
                          <td className="px-2 py-2">{p.nombre_categoria || 'N/A'}</td>
                          <td className="px-2 py-2">
                            {p.nombre_unidad ? `${p.nombre_unidad} (${p.unidad_abrev || ''})` : 'N/A'}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700">
                            {formatStock(p.stock_actual)}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700">
                            ${parseFloat(p.precio_compra || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-emerald-600">
                            ${parseFloat(p.precio_venta || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
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
                          colSpan="9"
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
  );
}

function ProductNotice({ type = "warning", title, message, onClose }) {
  const success = type === "success";
  const warning = type === "warning";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  const iconClass = success
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : warning
      ? "border-amber-200 bg-amber-100 text-amber-700"
      : "border-rose-200 bg-rose-100 text-rose-700";

  return (
    <div
      className={`mb-5 rounded-sm border px-4 py-3 ${
        success
          ? "border-emerald-200 bg-emerald-50"
          : warning
            ? "border-amber-200 bg-amber-50"
            : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${iconClass}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-[#111827]">{title}</h3>
          <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-xs font-black text-[#111827] transition hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
