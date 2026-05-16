import React, { useMemo, useState } from "react";
import { PackageSearch, Filter, AlertTriangle, Database, ChevronLeft, ChevronRight, Calendar, Pencil, X, Ban, RotateCcw } from "lucide-react";
import useCategorias from "../../hooks/useCategorias";
import useProductos from "../../hooks/useProductos";
import useMovimientosInventario from "../../hooks/useMovimientosInventario";
import { ajustarInventarioProducto } from "../../services/movimientosInventarioService";
import { cambiarEstadoProducto } from "../../services/productosService";
import { ensureOk } from "../../services/responseUtils";
import { formatStock, isUnlimitedStock, stockInputValue, stockSubmitValue } from "../../utils/stock";

// Spinner de carga mejorado
function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col justify-center items-center py-12">
      <svg className="animate-spin h-12 w-12 text-cyan-600 mb-4" viewBox="0 0 45 45">
        <circle className="opacity-20" cx="22.5" cy="22.5" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
        <path d="M42.5,22.5a20,20 0 1,1-40,0" stroke="currentColor" strokeWidth="5" fill="none" className="opacity-70" />
      </svg>
      <span className="text-cyan-700 text-base font-medium tracking-wide">{label}</span>
    </div>
  );
}

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

export default function ConsultaInventarioProductos() {
  const { productos, loading: loadingProductos, error: productosError, refetchProductos } = useProductos({ include_inactive: 1 });
  const { categorias, loading: loadingCategorias, error: categoriasError } = useCategorias();
  const movimientosParams = useMemo(() => ({ limit: 8 }), []);
  const ajustesParams = useMemo(() => ({ tipo: "ajuste", limit: 80 }), []);
  const {
    movimientos,
    loading: loadingMovimientos,
    error: movimientosError,
    refetchMovimientos,
  } = useMovimientosInventario(movimientosParams);
  const {
    movimientos: ajustesInventario,
    loading: loadingAjustes,
    error: ajustesError,
    refetchMovimientos: refetchAjustes,
  } = useMovimientosInventario(ajustesParams);
  const [categoria, setCategoria] = useState("Todas las categorías");
  const [busqueda, setBusqueda] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [activeView, setActiveView] = useState("inventario");
  const [currentPage, setCurrentPage] = useState(0);
  const [productoAjuste, setProductoAjuste] = useState(null);
  const [ajusteForm, setAjusteForm] = useState({
    nombre: "",
    stock_actual: "",
    stock_ilimitado: false,
    precio_venta: "",
    descripcion: "",
    observacion: "",
  });
  const [savingAjuste, setSavingAjuste] = useState(false);
  const [savingEstadoId, setSavingEstadoId] = useState(null);
  const [ajusteError, setAjusteError] = useState("");
  const [estadoPendiente, setEstadoPendiente] = useState(null);
  const itemsPerPage = 20;
  const loading = loadingProductos || loadingCategorias;
  const error = productosError || categoriasError;
  const movimientosInventarioError = movimientosError;
  const categoriasConTodas = useMemo(() => {
    const categoryMap = new Map();
    categorias.forEach((cat) => {
      const value = normalizeCategoryName(cat.nombre);
      const key = value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

      if (value && key && !categoryMap.has(key)) {
        categoryMap.set(key, {
          id_categoria: cat.id_categoria,
          nombre: value,
          label: getCategoryLabel(value),
        });
      }
    });

    return [
      { id_categoria: 0, nombre: "Todas las categorías", label: "Todas las categorías" },
      ...Array.from(categoryMap.values()),
    ];
  }, [categorias]);

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
  const filteredProductos = useMemo(() => {
    return productos.filter((p) => {
      const search = busqueda.toLowerCase();
      const matchesSearch = p.nombre.toLowerCase().includes(search) ||
                            String(p.codigo_barras || "").toLowerCase().includes(search) ||
                            String(p.codigo_interno || "").toLowerCase().includes(search) ||
                            p.id_producto.toString().includes(busqueda);
      const matchesCategoria = categoria === "Todas las categorías" || normalizeCategoryName(p.nombre_categoria) === categoria;
      let matchesFilter = true;

      switch (activeFilter) {
        case "porCalibrar":
          matchesFilter = p.stock_minimo === 0 || !p.precio_venta || p.precio_venta === 0;
          break;
        case "inactivos":
          matchesFilter = p.estado === 0;
          break;
        case "nuevo": {
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
  }, [activeFilter, busqueda, categoria, productos]);

  // Paginación
  const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
  const paginatedProductos = filteredProductos.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Indicadores computados
  const totalProductos = productos.length;
  const stockNegativo = useMemo(() => productos.filter(p => p.stock_actual < 0).length, [productos]);
  const calibrados = useMemo(() => productos.filter(p => p.stock_minimo > 0 && p.precio_venta > 0).length, [productos]);
  const nuevos = useMemo(() => getNuevos(productos), [productos]);

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const openAjuste = (producto) => {
    setProductoAjuste(producto);
    setAjusteForm({
      nombre: producto.nombre || "",
      stock_actual: stockInputValue(producto.stock_actual),
      stock_ilimitado: isUnlimitedStock(producto.stock_actual),
      precio_venta: String(producto.precio_venta ?? 0),
      descripcion: producto.descripcion || "",
      observacion: "",
    });
    setAjusteError("");
  };

  const closeAjuste = () => {
    setProductoAjuste(null);
    setAjusteError("");
  };

  const handleAjusteChange = (field, value) => {
    setAjusteForm((prev) => ({ ...prev, [field]: value }));
    setAjusteError("");
  };

  const handleGuardarAjuste = async () => {
    if (!productoAjuste) return;

    const stock = stockSubmitValue(ajusteForm.stock_actual, ajusteForm.stock_ilimitado);
    const precioVenta = Number(ajusteForm.precio_venta);

    if (!ajusteForm.nombre.trim()) {
      setAjusteError("El nombre del producto es obligatorio.");
      return;
    }
    if (!ajusteForm.stock_ilimitado && !Number.isFinite(stock)) {
      setAjusteError("La cantidad debe ser un número válido.");
      return;
    }
    if (!Number.isFinite(precioVenta) || precioVenta < 0) {
      setAjusteError("El precio de venta debe ser un número válido.");
      return;
    }

    setSavingAjuste(true);
    try {
      const response = await ajustarInventarioProducto({
        id_producto: productoAjuste.id_producto,
        id_usuario: storedUser?.id_usuario || storedUser?.id || 1,
        nombre: ajusteForm.nombre.trim(),
        stock_actual: stock,
        precio_venta: precioVenta,
        descripcion: ajusteForm.descripcion,
        observacion: ajusteForm.observacion,
      });
      await ensureOk(response, "No se pudo guardar el ajuste de inventario.");
      await Promise.all([refetchProductos(), refetchMovimientos(), refetchAjustes()]);
      setProductoAjuste(null);
      setAjusteError("");
    } catch (err) {
      setAjusteError(err.message || "No se pudo guardar el ajuste de inventario.");
    } finally {
      setSavingAjuste(false);
    }
  };

  const handleCambiarEstado = async (producto, estado) => {
    const accion = estado ? "activar" : "inactivar";
    setSavingEstadoId(producto.id_producto);
    setAjusteError("");
    try {
      const response = await cambiarEstadoProducto(producto.id_producto, {
        estado,
        id_usuario: storedUser?.id_usuario || storedUser?.id || 1,
      });
      await ensureOk(response, `No se pudo ${accion} el producto.`);
      await refetchProductos();
      setCurrentPage(0);
      setEstadoPendiente(null);
    } catch (err) {
      setAjusteError(err.message || `No se pudo ${accion} el producto.`);
    } finally {
      setSavingEstadoId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-module-card">
        <Spinner label="Cargando inventario..." />
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {/* ===== ENCABEZADO ===== */}
      <div className="admin-module-header">
        <div className="admin-module-heading">
        <div className="admin-module-icon">
          <PackageSearch size={20} />
        </div>
        <div>
          <h1 className="admin-module-title">Consulta de Inventario</h1>
          <p className="admin-module-subtitle">MARKETSYS</p>
        </div>
        </div>
      </div>
      <p className="hidden text-sm text-slate-500 mb-5 font-medium">
        MARKETSYS
      </p>

      {/* Error */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">Error: {error}</p>
        </div>
      )}

      {movimientosInventarioError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">No se pudo cargar el historial de inventario: {movimientosInventarioError}</p>
        </div>
      )}

      {ajustesError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">No se pudo cargar el histórico de ajustes: {ajustesError}</p>
        </div>
      )}

      {ajusteError && !productoAjuste && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">{ajusteError}</p>
        </div>
      )}

      {/* ===== INDICADORES ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-700 font-semibold">
              Productos calibrados
            </p>
            <p className="text-lg font-bold text-amber-600">{((calibrados / totalProductos) * 100).toFixed(0)}%</p>
          </div>
          <AlertTriangle size={28} className="text-amber-500" />
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-700 font-semibold">
              Productos totales
            </p>
            <p className="text-lg font-bold text-emerald-600">{totalProductos}</p>
          </div>
          <Database size={26} className="text-emerald-500" />
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-rose-700 font-semibold">
              Stock negativo
            </p>
            <p className="text-lg font-bold text-rose-600">{stockNegativo}</p>
          </div>
          <AlertTriangle size={26} className="text-rose-500" />
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 font-semibold">Productos nuevos</p>
            <p className="text-lg font-bold text-blue-600">{nuevos}</p>
          </div>
          <Calendar size={26} className="text-blue-500" />
        </div>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <h2 className="admin-module-card-title">Filtros de inventario</h2>
          <Filter size={18} className="text-[#3157d5]" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="border rounded px-3 py-2 text-sm shadow-sm"
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setCurrentPage(0);
            }}
          >
            {categoriasConTodas.map((cat) => (
              <option key={cat.id_categoria} value={cat.nombre}>
                {cat.label || cat.nombre}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Buscar producto, código o ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-64 shadow-sm"
          />

          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => {
                setActiveFilter("todos");
                setCurrentPage(0);
              }}
              className={`px-3 py-2 rounded text-sm shadow transition ${
                activeFilter === "todos"
                  ? "bg-cyan-700 hover:bg-cyan-800 text-white"
                  : "bg-cyan-500 hover:bg-cyan-700 text-white"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setActiveFilter("inactivos");
                setCurrentPage(0);
              }}
              className={`px-3 py-2 rounded text-sm shadow transition ${
                activeFilter === "inactivos"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-indigo-500 hover:bg-indigo-600 text-white"
              }`}
            >
              Inactivos
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveView("inventario")}
          className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-black transition ${
            activeView === "inventario"
              ? "border-[#3157d5] bg-[#3157d5] text-white shadow-sm"
              : "border-[#c7d2fe] bg-white text-[#233876] hover:bg-[#eef2ff]"
          }`}
        >
          <Database size={16} />
          Inventario
        </button>
        <button
          type="button"
          onClick={() => setActiveView("ajustes")}
          className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-black transition ${
            activeView === "ajustes"
              ? "border-[#3157d5] bg-[#3157d5] text-white shadow-sm"
              : "border-[#c7d2fe] bg-white text-[#233876] hover:bg-[#eef2ff]"
          }`}
        >
          <Pencil size={16} />
          Histórico de ajustes
        </button>
        <button
          type="button"
          onClick={() => setActiveView("movimientos")}
          className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-black transition ${
            activeView === "movimientos"
              ? "border-[#3157d5] bg-[#3157d5] text-white shadow-sm"
              : "border-[#c7d2fe] bg-white text-[#233876] hover:bg-[#eef2ff]"
          }`}
        >
          <Calendar size={16} />
          Movimientos recientes
        </button>
      </div>

      {/* ===== HISTORIAL RECIENTE ===== */}
      {activeView === "movimientos" && (
      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <h2 className="admin-module-card-title">Historial reciente de inventario</h2>
          <Database size={18} className="text-[#3157d5]" />
        </div>
        {loadingMovimientos ? (
          <p className="text-sm text-slate-500">Cargando movimientos recientes...</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay movimientos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Antes</th>
                  <th className="px-3 py-2 text-right">Después</th>
                  <th className="px-3 py-2 text-left">Observación</th>
                  <th className="px-3 py-2 text-left">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.map((mov) => (
                  <tr key={mov.id_movimiento_inventario} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">
                      {mov.fecha ? new Date(mov.fecha).toLocaleString("es-CO") : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-sm bg-[#e0e7ff] px-2 py-1 text-xs font-bold uppercase text-[#233876]">
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {mov.nombre_producto}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${Number(mov.cantidad) < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {Number(mov.cantidad || 0).toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatStock(mov.stock_anterior, "", { decimals: 0 })}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-900 font-semibold">
                      {formatStock(mov.stock_nuevo, "", { decimals: 0 })}
                    </td>
                    <td className="px-3 py-2 text-slate-700 max-w-xs truncate" title={mov.observacion || ""}>
                      {mov.observacion || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {mov.referencia_tabla ? `${mov.referencia_tabla} #${mov.referencia_id || "-"}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ===== HISTÓRICO DE AJUSTES ===== */}
      {activeView === "ajustes" && (
      <div className="admin-module-card overflow-hidden">
        <div className="admin-module-card-header border-b border-[#dbe4ff] bg-[linear-gradient(135deg,#eef2ff,#ffffff)]">
          <div>
            <h2 className="admin-module-card-title">Histórico de ajustes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Consulta cambios manuales de inventario, usuario responsable y saldo antes/después.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-[#233876]">
            <Pencil size={18} className="text-[#3157d5]" />
            <span className="text-sm font-black">{ajustesInventario.length}</span>
          </div>
        </div>
        {loadingAjustes ? (
          <p className="px-4 py-5 text-sm text-slate-500">Cargando histórico de ajustes...</p>
        ) : ajustesInventario.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">Aún no hay ajustes manuales registrados.</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead className="bg-[#233876] text-white">
                <tr>
                  <th className="w-[15%] px-3 py-3 text-left">Fecha</th>
                  <th className="w-[13%] px-3 py-3 text-left">Usuario</th>
                  <th className="w-[18%] px-3 py-3 text-left">Producto</th>
                  <th className="w-[12%] px-3 py-3 text-left">Código</th>
                  <th className="w-[9%] px-3 py-3 text-right">Cambio</th>
                  <th className="w-[8%] px-3 py-3 text-right">Antes</th>
                  <th className="w-[9%] px-3 py-3 text-right">Después</th>
                  <th className="w-[16%] px-3 py-3 text-left">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edff] bg-white">
                {ajustesInventario.map((mov) => (
                  <tr key={mov.id_movimiento_inventario} className="transition hover:bg-[#f8f9ff]">
                    <td className="px-3 py-3 text-slate-700">
                      {mov.fecha ? (
                        <div className="leading-tight">
                          <div className="font-bold text-slate-800">
                            {new Date(mov.fecha).toLocaleDateString("es-CO")}
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            {new Date(mov.fecha).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="truncate px-3 py-3 font-semibold text-slate-800" title={mov.nombre_usuario || "Sin usuario"}>
                      {mov.nombre_usuario || "Sin usuario"}
                    </td>
                    <td className="truncate px-3 py-3 font-bold text-slate-900" title={mov.nombre_producto || "-"}>
                      {mov.nombre_producto || "-"}
                    </td>
                    <td className="truncate px-3 py-3 font-mono text-xs font-bold text-[#233876]" title={mov.codigo_barras || mov.codigo_interno || "-"}>
                      {mov.codigo_barras || mov.codigo_interno || "-"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex min-w-14 justify-end rounded-sm px-2 py-1 font-black ${
                        Number(mov.cantidad) < 0
                          ? "bg-rose-50 text-rose-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {Number(mov.cantidad || 0).toLocaleString("es-CO")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700">
                      {formatStock(mov.stock_anterior, "", { decimals: 0 })}
                    </td>
                    <td className="px-3 py-3 text-right font-black text-slate-900">
                      {formatStock(mov.stock_nuevo, "", { decimals: 0 })}
                    </td>
                    <td className="truncate px-3 py-3 text-slate-700" title={mov.observacion || ""}>
                      {mov.observacion || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ===== TABLA DE INVENTARIO ===== */}
      {activeView === "inventario" && (
      <div className="admin-module-card overflow-hidden">
        <div className="admin-module-card-header">
          <p className="text-sm text-slate-600">
            Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, filteredProductos.length)} de {filteredProductos.length} productos
          </p>
        </div>
        <div className="overflow-x-hidden">
          <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
            <thead className="bg-gradient-to-r from-cyan-600 to-indigo-600 text-white sticky top-0">
              <tr>
                <th className="w-[5%] px-2 py-2 text-center">Items</th>
                <th className="w-[11%] px-2 py-2 text-left">Código</th>
                <th className="w-[22%] px-2 py-2 text-left">Nombre</th>
                <th className="w-[10%] px-2 py-2 text-right">Compra</th>
                <th className="w-[10%] px-2 py-2 text-right">Venta</th>
                <th className="w-[8%] px-2 py-2 text-right">Stock</th>
                <th className="w-[10%] px-2 py-2 text-center">Tipo</th>
                <th className="w-[8%] px-2 py-2 text-center">Estado</th>
                <th className="w-[10%] px-2 py-2 text-center">Categoría</th>
                <th className="w-[16%] px-2 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProductos.length > 0 ? (
                paginatedProductos.map((p, index) => {
                  const tipo = getTipo(p.unidad_abrev);
                  return (
                    <tr
                      key={p.id_producto}
                      className={`transition border-b border-slate-100 ${p.estado === 0 ? "bg-slate-50 text-slate-500 hover:bg-slate-100" : "hover:bg-cyan-50"}`}
                    >
                      <td className="px-2 py-2 text-center font-mono">{currentPage * itemsPerPage + index + 1}</td>
                      <td className="truncate px-2 py-2 font-mono text-[11px] text-slate-700" title={p.codigo_barras || p.codigo_interno || ""}>{p.codigo_barras || p.codigo_interno || "-"}</td>
                      <td className="truncate px-2 py-2 font-bold text-slate-900" title={p.nombre}>{p.nombre}</td>
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
                        {formatStock(p.stock_actual, "", { decimals: 0 })}
                      </td>
                      <td className="truncate px-2 py-2 text-center text-slate-600" title={tipo}>
                        {tipo}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`rounded-sm px-2 py-1 text-[11px] font-black uppercase ${p.estado === 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {p.estado === 0 ? "Inactivo" : "Activo"}
                        </span>
                      </td>
                      <td className="truncate px-2 py-2 text-center text-slate-600" title={p.nombre_categoria}>
                        {p.nombre_categoria}
                      </td>
                      <td className="px-2 py-2">
                        <div className="grid grid-cols-1 gap-1 xl:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => openAjuste(p)}
                          disabled={p.estado === 0}
                          className="inline-flex items-center justify-center gap-1 rounded-sm border border-[#c7d2fe] bg-[#eef2ff] px-2 py-1.5 text-[11px] font-black text-[#233876] transition hover:border-[#3157d5] hover:bg-[#dbe4ff] disabled:opacity-50"
                        >
                          <Pencil size={13} />
                          Ajustar
                        </button>
                        {p.estado === 0 ? (
                          <button
                            type="button"
                            onClick={() => setEstadoPendiente({ producto: p, estado: 1 })}
                            disabled={savingEstadoId === p.id_producto}
                            className="inline-flex items-center justify-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                          >
                            <RotateCcw size={13} />
                            Activar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEstadoPendiente({ producto: p, estado: 0 })}
                            disabled={savingEstadoId === p.id_producto}
                            className="inline-flex min-w-[82px] items-center justify-center whitespace-nowrap rounded-sm border border-rose-300 bg-rose-100 px-2.5 py-1.5 text-[11px] font-black text-black transition hover:bg-rose-200 disabled:opacity-60"
                          >
                            Inactivar
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="text-center text-slate-400 py-8 italic">
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
      )}

      {productoAjuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-sm border border-[#c7d2fe] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#3157d5] to-[#05a6c8] px-5 py-4 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-wide">Inventario</p>
                <h2 className="text-lg font-black">Ajustar producto</h2>
              </div>
              <button
                type="button"
                onClick={closeAjuste}
                className="grid h-9 w-9 place-items-center rounded-sm border border-white/30 bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-5 text-slate-900">
              {ajusteError && (
                <div className="rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                  {ajusteError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Nombre</span>
                  <input
                    value={ajusteForm.nombre}
                    onChange={(e) => handleAjusteChange("nombre", e.target.value)}
                    className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe4ff]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-[#233876]">
                    <span>Cantidad actual</span>
                    <label className="inline-flex items-center gap-1 normal-case tracking-normal text-[#152b73]">
                      <input
                        type="checkbox"
                        checked={Boolean(ajusteForm.stock_ilimitado)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAjusteForm((prev) => ({
                            ...prev,
                            stock_ilimitado: checked,
                            stock_actual: checked ? "" : prev.stock_actual,
                          }));
                          setAjusteError("");
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      Ilimitado
                    </label>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={ajusteForm.stock_actual}
                    onChange={(e) => handleAjusteChange("stock_actual", e.target.value)}
                    placeholder={ajusteForm.stock_ilimitado ? "Ilimitado" : "0.00"}
                    disabled={ajusteForm.stock_ilimitado}
                    className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe4ff] disabled:bg-[#eef2ff]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Precio venta</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ajusteForm.precio_venta}
                    onChange={(e) => handleAjusteChange("precio_venta", e.target.value)}
                    className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe4ff]"
                  />
                </label>

                <div className="rounded-sm border border-[#e0e7ff] bg-[#f8f9ff] px-3 py-2">
                  <p className="text-xs font-black uppercase tracking-wide text-[#233876]">Código</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-800">
                    {productoAjuste.codigo_barras || productoAjuste.codigo_interno || `ID ${productoAjuste.id_producto}`}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Descripción</span>
                <textarea
                  rows={3}
                  value={ajusteForm.descripcion}
                  onChange={(e) => handleAjusteChange("descripcion", e.target.value)}
                  className="w-full resize-none rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe4ff]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Observación del cambio</span>
                <textarea
                  rows={2}
                  value={ajusteForm.observacion}
                  onChange={(e) => handleAjusteChange("observacion", e.target.value)}
                  placeholder="Ej: Ajuste por conteo físico, corrección de precio, actualización de descripción..."
                  className="w-full resize-none rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe4ff]"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#e0e7ff] bg-[#f8f9ff] px-5 py-4">
              <button
                type="button"
                onClick={closeAjuste}
                className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarAjuste}
                disabled={savingAjuste}
                className="rounded-sm border border-[#3157d5] bg-[#3157d5] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#2746b3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAjuste ? "Guardando..." : "Guardar ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {estadoPendiente && (
        <EstadoProductoDialog
          producto={estadoPendiente.producto}
          estado={estadoPendiente.estado}
          loading={savingEstadoId === estadoPendiente.producto.id_producto}
          onCancel={() => setEstadoPendiente(null)}
          onConfirm={() => handleCambiarEstado(estadoPendiente.producto, estadoPendiente.estado)}
        />
      )}
    </div>
  );
}

function EstadoProductoDialog({ producto, estado, loading = false, onCancel, onConfirm }) {
  const activar = Boolean(estado);
  const accion = activar ? "activar" : "inactivar";
  const iconClass = activar
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : "border-rose-200 bg-rose-100 text-rose-700";
  const buttonClass = activar
    ? "bg-[linear-gradient(135deg,#3157d5,#18a36b)]"
    : "bg-[#b91c1c]";

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-[440px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${iconClass}`}>
            {activar ? <RotateCcw size={22} /> : <Ban size={22} />}
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">
              {activar ? "Activar producto" : "Inactivar producto"}
            </h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">
              ¿Deseas {accion} este producto en el inventario?
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
            <span className="font-black text-[#111827]">
              {producto.codigo_barras || producto.codigo_interno || `ID ${producto.id_producto}`}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-sm px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 ${buttonClass}`}
          >
            {loading ? "Procesando..." : activar ? "Activar" : "Inactivar"}
          </button>
        </div>
      </div>
    </div>
  );
}
