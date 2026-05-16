import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Barcode,
  Boxes,
  CalendarRange,
  PackageSearch,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  Tags,
  X,
} from "lucide-react";
import { listarCategorias } from "../../services/categoriasService";
import { crearProducto, listarProductos } from "../../services/productosService";
import { ensureOk } from "../../services/responseUtils";
import { listarUnidadesMedida } from "../../services/unidadesMedidaService";

const money = (value) =>
  Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const tabs = [
  { id: "inventario", label: "Inventario", icon: Boxes },
  { id: "categorias", label: "Categorías", icon: Tags },
  { id: "validador", label: "Validador", icon: Barcode },
  { id: "nuevo", label: "Nuevo producto", icon: PackagePlus },
];

const normalizeCategoryName = (name = "") => {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (normalized === "MECATO" || normalized === "DULCERIA") return "DULCERIA";
  if (normalized === "BEBIDAS" || normalized === "GASEOSAS") return "GASEOSAS";
  return String(name || "").trim();
};

const getCategoryLabel = (name = "") => {
  const normalized = normalizeCategoryName(name);
  if (normalized === "DULCERIA") return "Dulcería";
  if (normalized === "GASEOSAS") return "Gaseosas";
  return normalized;
};

function ConsultaProductos({ open, onClose, initialTab = "inventario", onProductsChanged }) {
  if (!open) return null;

  return createPortal(
    <ModalShell onClose={onClose}>
      <ConsultaProductosBody onClose={onClose} initialTab={initialTab} onProductsChanged={onProductsChanged} />
    </ModalShell>,
    document.body
  );
}

function ModalShell({ children, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose?.();
    const prev = document.body.style.overflow;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#c7d2fe] bg-[#f4f6ff] text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ConsultaProductosBody({ onClose, initialTab, onProductsChanged }) {
  const normalizeTab = (tab) => (tab === "catalogo" ? "inventario" : tab || "inventario");
  const [activeTab, setActiveTab] = useState(normalizeTab(initialTab));
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [stockFilter, setStockFilter] = useState("TODOS");
  const [orden, setOrden] = useState("nombre");
  const [page, setPage] = useState(1);
  const [validatorCode, setValidatorCode] = useState("");
  const [validatedProduct, setValidatedProduct] = useState(null);
  const [validatorMessage, setValidatorMessage] = useState("");
  const validatorRef = useRef(null);
  const perPage = 10;

  useEffect(() => {
    setActiveTab(normalizeTab(initialTab));
  }, [initialTab]);

  const fetchData = async () => {
    setRefreshing(true);
    setError("");
    try {
      const [cats, prods, units] = await Promise.all([listarCategorias(), listarProductos(), listarUnidadesMedida()]);
      const categoryMap = new Map();
      (Array.isArray(cats) ? cats : []).forEach((cat) => {
        const nombre = normalizeCategoryName(cat.nombre);
        const key = nombre
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toUpperCase();
        if (nombre && key && !categoryMap.has(key)) {
          categoryMap.set(key, { ...cat, nombre, label: getCategoryLabel(nombre) });
        }
      });
      setCategorias(Array.from(categoryMap.values()));
      setUnidades(Array.isArray(units) ? units : []);
      setProductos(
        (Array.isArray(prods) ? prods : []).map((prod) => ({
          ...prod,
          nombre_categoria: normalizeCategoryName(prod.nombre_categoria),
          categoria_label: getCategoryLabel(prod.nombre_categoria),
        }))
      );
    } catch (err) {
      setError(err.message || "No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, categoria, stockFilter, orden, activeTab]);

  useEffect(() => {
    if (activeTab === "validador") {
      setTimeout(() => validatorRef.current?.focus(), 80);
    }
  }, [activeTab]);

  const categoriasConResumen = useMemo(() => {
    return categorias.map((cat) => {
      const items = productos.filter((prod) => normalizeCategoryName(prod.nombre_categoria) === cat.nombre);
      const stock = items.reduce((sum, prod) => sum + Number(prod.stock_actual || 0), 0);
      const valor = items.reduce((sum, prod) => sum + Number(prod.stock_actual || 0) * Number(prod.precio_venta || 0), 0);
      return { ...cat, productos: items.length, stock, valor };
    });
  }, [categorias, productos]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const result = productos.filter((prod) => {
      const searchText = `${prod.nombre || ""} ${prod.codigo_barras || ""} ${prod.codigo_interno || ""} ${prod.id_producto || ""}`.toLowerCase();
      const matchQ = !text || searchText.includes(text);
      const matchCategory = categoria === "Todas" || normalizeCategoryName(prod.nombre_categoria) === categoria;
      const stock = Number(prod.stock_actual || 0);
      const min = Number(prod.stock_minimo || 0);
      const matchStock =
        stockFilter === "TODOS" ||
        (stockFilter === "BAJO_STOCK" && stock <= min) ||
        (stockFilter === "SIN_STOCK" && stock <= 0);
      return matchQ && matchCategory && matchStock;
    });

    return [...result].sort((a, b) => {
      if (orden === "precio_desc") return Number(b.precio_venta || 0) - Number(a.precio_venta || 0);
      if (orden === "precio_asc") return Number(a.precio_venta || 0) - Number(b.precio_venta || 0);
      if (orden === "stock_desc") return Number(b.stock_actual || 0) - Number(a.stock_actual || 0);
      if (orden === "stock_asc") return Number(a.stock_actual || 0) - Number(b.stock_actual || 0);
      if (orden === "codigo") return String(a.codigo_interno || a.id_producto).localeCompare(String(b.codigo_interno || b.id_producto));
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
  }, [categoria, orden, productos, q, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  const resumen = useMemo(() => {
    const bajoStock = productos.filter((prod) => Number(prod.stock_actual || 0) <= Number(prod.stock_minimo || 0)).length;
    const sinStock = productos.filter((prod) => Number(prod.stock_actual || 0) <= 0).length;
    const valorVenta = productos.reduce((sum, prod) => sum + Number(prod.stock_actual || 0) * Number(prod.precio_venta || 0), 0);
    return { productos: productos.length, categorias: categorias.length, bajoStock, sinStock, valorVenta };
  }, [categorias.length, productos]);

  const handleValidate = (event) => {
    event?.preventDefault();
    const code = validatorCode.trim().toLowerCase();
    if (!code) return;
    const found = productos.find((prod) =>
      [prod.codigo_barras, prod.codigo_interno, String(prod.id_producto)]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase() === code)
    );
    setValidatedProduct(found || null);
    setValidatorMessage(found ? "Producto encontrado." : "No se encontró un producto con ese código.");
  };

  if (loading) {
    return (
      <div className="grid min-h-[360px] place-items-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 animate-spin text-[#3157d5]" size={26} />
          <p className="text-sm font-black text-[#111827]">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#ffffff_58%,#f8f9ff)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Módulo del cajero</p>
            <h2 className="text-xl font-black leading-tight text-[#111827]">Inventario</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="grid h-9 w-9 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#3157d5] shadow-sm transition hover:bg-[#e0e7ff]"
              title="Actualizar"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-sm bg-[#3157d5] text-white shadow-sm transition hover:brightness-105"
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-sm border px-3 py-2 text-xs font-black transition ${
                  active
                    ? "border-[#3157d5] bg-[#3157d5] text-white shadow-sm"
                    : "border-[#c7d2fe] bg-white text-[#111827] hover:bg-[#eef2ff]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <div className="mb-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Productos" value={resumen.productos} helper={`${resumen.categorias} categorías`} icon={Boxes} />
          <MetricCard title="Bajo stock" value={resumen.bajoStock} helper={`${resumen.sinStock} sin stock`} icon={PackageSearch} />
          <MetricCard title="Valor venta" value={money(resumen.valorVenta)} helper="Inventario estimado" icon={CalendarRange} />
          <MetricCard title="Filtrados" value={filtered.length} helper="Según filtros actuales" icon={Search} />
        </section>

        {activeTab === "inventario" && (
          <InventoryFilters
            q={q}
            setQ={setQ}
            categoria={categoria}
            setCategoria={setCategoria}
            categorias={categorias}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            orden={orden}
            setOrden={setOrden}
          />
        )}

        {activeTab === "inventario" && (
          <InventoryTable pageData={pageData} page={page} perPage={perPage} totalPages={totalPages} setPage={setPage} filtered={filtered} />
        )}

        {activeTab === "categorias" && (
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categoriasConResumen.map((cat) => (
              <div key={cat.id_categoria} className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#111827]">{cat.label || cat.nombre}</p>
                    <p className="mt-1 text-xs font-bold text-[#4b5563]">{cat.productos} productos registrados</p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
                    <Tags size={17} />
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <InfoBox label="Stock" value={Number(cat.stock || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} />
                  <InfoBox label="Valor" value={money(cat.valor)} />
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === "validador" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#111827]">Validar precio por código</h3>
              <p className="mt-1 text-xs font-bold text-[#4b5563]">Escanea el código de barras o escribe el código interno del producto.</p>
              <form onSubmit={handleValidate} className="mt-4 flex overflow-hidden rounded-sm border border-[#3157d5] bg-white shadow-sm">
                <input
                  ref={validatorRef}
                  value={validatorCode}
                  onChange={(event) => setValidatorCode(event.target.value)}
                  placeholder="Código de barras, interno o ID..."
                  className="min-w-0 flex-1 bg-white px-3 py-3 text-base font-black text-[#111827] outline-none placeholder:text-[#6b7280]"
                />
                <button type="submit" className="bg-[#3157d5] px-4 text-sm font-black text-white transition hover:brightness-105">
                  Validar
                </button>
              </form>
              {validatorMessage && (
                <p className={`mt-3 text-sm font-black ${validatedProduct ? "text-emerald-700" : "text-red-700"}`}>{validatorMessage}</p>
              )}
            </div>

            {validatedProduct ? (
              <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">{validatedProduct.codigo_interno || `P${validatedProduct.id_producto}`}</p>
                    <h3 className="mt-1 text-xl font-black text-[#111827]">{validatedProduct.nombre}</h3>
                    <p className="mt-1 text-sm font-bold text-[#4b5563]">{validatedProduct.nombre_categoria || "Sin categoría"}</p>
                  </div>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
                    <Barcode size={22} />
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <InfoBox label="Precio venta" value={money(validatedProduct.precio_venta)} strong />
                  <InfoBox label="Stock" value={Number(validatedProduct.stock_actual || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} />
                  <InfoBox label="Barras" value={validatedProduct.codigo_barras || "-"} />
                </div>
              </div>
            ) : (
              <EmptyState text="Aún no hay un producto validado." />
            )}
          </section>
        )}

        {activeTab === "nuevo" && (
          <QuickProductForm
            categorias={categorias}
            unidades={unidades}
            onCreated={async () => {
              await fetchData();
              await onProductsChanged?.();
              setActiveTab("inventario");
            }}
          />
        )}
      </main>
    </>
  );
}

function QuickProductForm({ categorias, unidades, onCreated }) {
  const unidadPorDefecto = unidades.find((unidad) => String(unidad.abreviatura || "").toLowerCase() === "ud") || unidades[0];
  const categoriaPorDefecto = categorias[0];
  const [form, setForm] = useState({
    nombre: "",
    codigo_barras: "",
    codigo_interno: "",
    descripcion: "",
    id_categoria: categoriaPorDefecto?.id_categoria || "",
    id_unidad: unidadPorDefecto?.id_unidad || "",
    precio_venta: "",
    precio_compra: "0",
    stock_actual: "0",
    stock_minimo: "0",
    stock_maximo: "0",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      id_categoria: current.id_categoria || categoriaPorDefecto?.id_categoria || "",
      id_unidad: current.id_unidad || unidadPorDefecto?.id_unidad || "",
    }));
  }, [categoriaPorDefecto?.id_categoria, unidadPorDefecto?.id_unidad]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      nombre: "",
      codigo_barras: "",
      codigo_interno: "",
      descripcion: "",
      id_categoria: categoriaPorDefecto?.id_categoria || "",
      id_unidad: unidadPorDefecto?.id_unidad || "",
      precio_venta: "",
      precio_compra: "0",
      stock_actual: "0",
      stock_minimo: "0",
      stock_maximo: "0",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    const nombre = form.nombre.trim();
    const precioVenta = Number(form.precio_venta);
    const precioCompra = Number(form.precio_compra || 0);
    const stockActual = Number(form.stock_actual || 0);
    const stockMinimo = Number(form.stock_minimo || 0);
    const stockMaximo = Number(form.stock_maximo || 0);

    if (!nombre) {
      setMessage({ type: "error", text: "El nombre del producto es obligatorio." });
      return;
    }
    if (!form.id_categoria || !form.id_unidad) {
      setMessage({ type: "error", text: "Selecciona categoría y unidad de medida." });
      return;
    }
    if (!Number.isFinite(precioVenta) || precioVenta < 0) {
      setMessage({ type: "error", text: "El precio de venta debe ser un número válido." });
      return;
    }
    if ([precioCompra, stockActual, stockMinimo, stockMaximo].some((value) => !Number.isFinite(value) || value < 0)) {
      setMessage({ type: "error", text: "Los valores numéricos no pueden ser negativos." });
      return;
    }

    setSaving(true);
    try {
      const response = await crearProducto({
        nombre,
        codigo_barras: form.codigo_barras.trim() || null,
        codigo_interno: form.codigo_interno.trim() || null,
        descripcion: form.descripcion.trim() || null,
        id_categoria: Number(form.id_categoria),
        id_unidad: Number(form.id_unidad),
        precio_compra: precioCompra,
        precio_venta: precioVenta,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        stock_maximo: stockMaximo,
        estado: 1,
        cambia_estado: 0,
        cambia_apariencia: 0,
        tiempo_cambio: null,
      });
      await ensureOk(response, "No se pudo crear el producto");
      setMessage({ type: "success", text: "Producto creado y disponible para venta." });
      resetForm();
      await onCreated?.();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo crear el producto." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <form onSubmit={handleSubmit} className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Inventario cajero</p>
            <h3 className="text-lg font-black text-[#111827]">Agregar producto básico</h3>
            <p className="mt-1 text-xs font-bold text-[#4b5563]">
              Crea productos simples para venta. Los datos avanzados pueden ajustarse luego desde administrador.
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
            <PackagePlus size={20} />
          </span>
        </div>

        {message && (
          <div
            className={`mb-3 rounded-sm border px-3 py-2 text-sm font-black ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Nombre del producto" required>
            <Input value={form.nombre} onChange={(value) => update("nombre", value)} placeholder="Ej: MORA KG" autoFocus />
          </FormField>

          <FormField label="Precio venta" required>
            <Input type="number" value={form.precio_venta} onChange={(value) => update("precio_venta", value)} placeholder="0" min="0" />
          </FormField>

          <FormField label="Categoría" required>
            <Select
              value={form.id_categoria}
              onChange={(value) => update("id_categoria", value)}
              options={categorias.map((cat) => ({ value: cat.id_categoria, label: cat.label || cat.nombre }))}
            />
          </FormField>

          <FormField label="Unidad" required>
            <Select
              value={form.id_unidad}
              onChange={(value) => update("id_unidad", value)}
              options={unidades.map((unidad) => ({
                value: unidad.id_unidad,
                label: `${unidad.nombre} (${unidad.abreviatura})`,
              }))}
            />
          </FormField>

          <FormField label="Código de barras">
            <Input value={form.codigo_barras} onChange={(value) => update("codigo_barras", value)} placeholder="Escanea o escribe código" />
          </FormField>

          <FormField label="Código interno">
            <Input value={form.codigo_interno} onChange={(value) => update("codigo_interno", value)} placeholder="Opcional" />
          </FormField>

          <FormField label="Stock inicial">
            <Input type="number" value={form.stock_actual} onChange={(value) => update("stock_actual", value)} placeholder="0" min="0" step="0.001" />
          </FormField>

          <FormField label="Precio compra">
            <Input type="number" value={form.precio_compra} onChange={(value) => update("precio_compra", value)} placeholder="0" min="0" />
          </FormField>

          <FormField label="Stock mínimo">
            <Input type="number" value={form.stock_minimo} onChange={(value) => update("stock_minimo", value)} placeholder="0" min="0" step="0.001" />
          </FormField>

          <FormField label="Stock máximo">
            <Input type="number" value={form.stock_maximo} onChange={(value) => update("stock_maximo", value)} placeholder="0" min="0" step="0.001" />
          </FormField>

          <div className="md:col-span-2">
            <FormField label="Descripción">
              <textarea
                value={form.descripcion}
                onChange={(event) => update("descripcion", event.target.value)}
                placeholder="Detalle opcional del producto"
                rows={3}
                className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#6b7280] focus:border-[#3157d5]"
              />
            </FormField>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#eef2ff] pt-3">
          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2 text-sm font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:opacity-50"
          >
            Limpiar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-sm bg-[#3157d5] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </form>

      <aside className="rounded-sm border border-[#dbe4ff] bg-[#f8f9ff] p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wide text-[#111827]">Alcance para cajero</h3>
        <div className="mt-3 space-y-2 text-sm font-bold text-[#4b5563]">
          <p>El producto queda activo y disponible para facturación al guardar.</p>
          <p>Usa unidad <strong className="text-[#111827]">kg</strong> para productos por báscula y <strong className="text-[#111827]">ud</strong> para productos unitarios.</p>
          <p>Si no conoces el precio de compra real, puedes dejarlo en cero y el administrador lo ajusta después.</p>
        </div>
        <div className="mt-4 grid gap-2">
          <InfoBox label="Categorías disponibles" value={categorias.length} />
          <InfoBox label="Unidades disponibles" value={unidades.length} />
        </div>
      </aside>
    </section>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Input({ value, onChange, ...props }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#6b7280] focus:border-[#3157d5]"
      {...props}
    />
  );
}

function InventoryFilters({ q, setQ, categoria, setCategoria, categorias, stockFilter, setStockFilter, orden, setOrden }) {
  return (
    <section className="mt-4 rounded-sm border border-[#dbe4ff] bg-white p-3 shadow-sm">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr]">
        <FilterControl label="Filtro por nombre o codigo">
          <label className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2">
            <Search size={16} className="text-[#3157d5]" />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar nombre, código o ID..." className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#111827] outline-none placeholder:text-[#6b7280]" />
          </label>
        </FilterControl>
        <FilterControl label="Filtro por categoria">
          <Select
            value={categoria}
            onChange={setCategoria}
            options={[
              { value: "Todas", label: "Todas" },
              ...categorias.map((cat) => ({ value: cat.nombre, label: cat.label || cat.nombre })),
            ]}
          />
        </FilterControl>
        <FilterControl label="Filtro por nivel de stock">
        <Select
          value={stockFilter}
          onChange={setStockFilter}
          options={[
            { value: "TODOS", label: "Todo stock" },
            { value: "BAJO_STOCK", label: "Bajo stock" },
            { value: "SIN_STOCK", label: "Sin stock" },
          ]}
        />
        </FilterControl>
        <FilterControl label="Ordenar productos">
        <Select
          value={orden}
          onChange={setOrden}
          options={[
            { value: "nombre", label: "Nombre A-Z" },
            { value: "codigo", label: "Código" },
            { value: "precio_desc", label: "Mayor precio" },
            { value: "precio_asc", label: "Menor precio" },
            { value: "stock_desc", label: "Mayor stock" },
            { value: "stock_asc", label: "Menor stock" },
          ]}
        />
        </FilterControl>
      </div>
    </section>
  );
}

function FilterControl({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
        {label}
      </div>
      {children}
    </div>
  );
}

function InventoryTable({ pageData, page, perPage, totalPages, setPage, filtered }) {
  return (
    <section className="mt-4 overflow-hidden rounded-sm border border-[#dbe4ff] bg-white shadow-sm">
      <div className="grid grid-cols-[0.9fr_1.2fr_2fr_1fr_0.8fr_0.9fr] gap-3 border-b border-[#dbe4ff] bg-[#eef2ff] px-3 py-2 text-xs font-black uppercase text-[#233876] max-lg:hidden">
        <span>Código</span>
        <span>Barras</span>
        <span>Producto</span>
        <span>Categoría</span>
        <span className="text-right">Stock</span>
        <span className="text-right">Precio</span>
      </div>
      {pageData.length ? (
        pageData.map((prod) => <ProductRow key={prod.id_producto} product={prod} />)
      ) : (
        <EmptyState text="No hay productos con los filtros seleccionados." />
      )}
      <Pagination page={page} setPage={setPage} totalPages={totalPages} total={filtered.length} />
    </section>
  );
}

function ProductRow({ product }) {
  const lowStock = Number(product.stock_actual || 0) <= Number(product.stock_minimo || 0);
  return (
    <div className="grid gap-2 border-b border-[#eef2ff] px-3 py-3 text-sm font-bold text-[#111827] last:border-b-0 lg:grid-cols-[0.9fr_1.2fr_2fr_1fr_0.8fr_0.9fr] lg:items-center">
      <span className="font-black text-[#3157d5]">{product.codigo_interno || `P${product.id_producto}`}</span>
      <span className="font-mono text-xs text-[#4b5563]">{product.codigo_barras || "-"}</span>
      <span className="font-black">{product.nombre}</span>
      <span>{product.categoria_label || getCategoryLabel(product.nombre_categoria) || "Sin categoría"}</span>
      <span className={`font-black lg:text-right ${lowStock ? "text-red-700" : "text-emerald-700"}`}>
        {Number(product.stock_actual || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })}
      </span>
      <span className="font-black lg:text-right">{money(product.precio_venta)}</span>
    </div>
  );
}

function MetricCard({ title, value, helper, icon: Icon }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">{title}</p>
          <p className="mt-1 break-words text-xl font-black text-[#111827]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#4b5563]">{helper}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
          <Icon size={19} strokeWidth={2.7} />
        </span>
      </div>
    </div>
  );
}

function InfoBox({ label, value, strong = false }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-[#f8f9ff] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#3157d5]">{label}</p>
      <p className={`${strong ? "text-lg" : "text-sm"} mt-1 break-words font-black text-[#111827]`}>{value}</p>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-black text-[#111827] outline-none transition focus:border-[#3157d5]">
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
      })}
    </select>
  );
}

function Pagination({ page, setPage, totalPages, total }) {
  if (totalPages <= 1) return <div className="border-t border-[#eef2ff] px-3 py-3 text-xs font-black text-[#4b5563]">{total} registros</div>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef2ff] px-3 py-3">
      <p className="text-xs font-black text-[#4b5563]">{total} registros · Página {page} de {totalPages}</p>
      <div className="flex gap-2">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="m-3 rounded-sm border border-dashed border-[#c7d2fe] bg-[#f8f9ff] p-6 text-center">
      <p className="text-sm font-black text-[#111827]">{text}</p>
    </div>
  );
}

export default ConsultaProductos;
