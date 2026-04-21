import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* =============== Hook de sincronización con modo global =============== */
function useSystemTheme() {
  const [theme, setTheme] = React.useState(
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/* =============== Modal principal =============== */
/* =============== Modal principal =============== */
function ConsultaProductos({ open, onClose }) {
  const theme = useSystemTheme();
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-[95vw] max-w-[1200px] h-[88vh] rounded-2xl shadow-2xl overflow-hidden grid grid-rows-[auto,1fr]
        border transition-colors duration-300 ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`h-14 px-5 flex items-center justify-between transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-b border-slate-700 text-white"
              : "bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-500 text-white"
          }`}
        >
          <h2 className="text-base font-semibold">Consulta de Productos</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/20 transition"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div
          className={`overflow-y-auto transition-colors duration-300 ${
            theme === "dark"
              ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
              : "bg-gradient-to-br from-orange-50 via-white to-rose-50"
          }`}
        >
          <ConsultaProductosBody theme={theme} />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =============== URL de la API =============== */
const API_URL = "http://localhost:5000/api";

/* =============== Contenido del cuerpo =============== */
const money = (n) =>
  (Number(n) || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function ConsultaProductosBody({ theme }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [categoria, setCategoria] = useState("Todas");
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("TODOS");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("nombre");
  const [sortDir, setSortDir] = useState("asc");
  const perPage = 10;

  // Fetch productos y categorías al montar
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch categorías
        const resCat = await fetch(`${API_URL}/categorias`);
        console.log("Fetching categorías URL:", `${API_URL}/categorias`);
        if (!resCat.ok) {
          console.error("Categorías status:", resCat.status);
          throw new Error("Error cargando categorías");
        }
        const cats = await resCat.json();
        console.log("Categorías data:", cats);
        setCategorias(cats);

        // Fetch productos
        const resProd = await fetch(`${API_URL}/products/productos`);
        console.log("Fetching productos URL:", `${API_URL}/products/productos`);
        console.log("Productos status:", resProd.status);
        if (!resProd.ok) {
          const errorText = await resProd.text();
          console.error("Productos error:", errorText);
          throw new Error(`Error ${resProd.status}: No se pudieron cargar productos.`);
        }
        const prods = await resProd.json();
        console.log("Productos data:", prods);
        setProductos(prods);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtros y ordenamiento
  const filtered = productos.filter((p) => {
    const matchQ = !q || (p.nombre && p.nombre.toLowerCase().includes(q.toLowerCase()));
    const matchCat = categoria === "Todas" || p.nombre_categoria === categoria;
    const matchChip = chip === "TODOS" ||
      (chip === "BAJO STOCK" && Number(p.stock_actual) < Number(p.stock_minimo)) ||
      (chip === "SIN STOCK" && Number(p.stock_actual) <= 0);
    return matchQ && matchCat && matchChip;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortBy === "id_producto" || sortBy === "code") {
      cmp = (Number(a.id_producto) || 0) - (Number(b.id_producto) || 0);
    } else if (sortBy === "nombre") {
      cmp = a.nombre.localeCompare(b.nombre);
    } else if (sortBy === "stock") {
      cmp = Number(b.stock_actual) - Number(a.stock_actual);
    } else if (sortBy === "precio") {
      cmp = Number(a.precio_venta) - Number(b.precio_venta);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  const go = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  // Handler para dropdown de ordenamiento
  const handleSortChange = (option) => {
    const [field, ...rest] = option.split(" ");
    const direction = rest.join(" ");
    setSortBy(field === "Código" ? "code" : field.toLowerCase());
    setSortDir(
      direction === "(Ascendente)" ||
        direction === "(A-Z)" ||
        direction === "(Bajo-Alto)"
        ? "asc"
        : "desc"
    );
  };

  // Formateo para stock (decimal a entero para display)
  const formatStock = (n) =>
    Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });

  const getStockColor = (p) => {
    const actual = Number(p.stock_actual);
    const min = Number(p.stock_minimo);
    return actual < min ? "text-red-600" : "text-green-600";
  };

  const getStockTooltip = (p) => {
    const actual = Number(p.stock_actual);
    const min = Number(p.stock_minimo);
    return actual < min ? "Stock bajo: Reabastecer pronto" : "Stock óptimo";
  };

  // Mapping simple para emoji en img (basado en categoría)
  const getEmoji = (cat) => {
    const emojis = {
      "ABARROTES": "🛒",
      "VERDURAS": "🥦",
      "FRUTAS": "🍎",
      "CARNES": "🥩",
      "default": "📦"
    };
    return emojis[cat] || emojis.default;
  };

  if (loading) {
    // Cambiado: el contenedor ocupa todo el alto disponible, incluido el padding lateral, y el interior ocupa el alto restante del modal
    return (
      <div className="w-full h-[calc(88vh-3.5rem)] flex items-center justify-center">
        <div className="flex-1 flex items-center justify-center min-h-0 min-w-0">
          <p className="text-center text-lg">Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="text-center p-8 rounded-2xl bg-white dark:bg-slate-900">
          <h3 className="text-red-600 mb-2 text-lg">Error al cargar</h3>
          <p className="mb-4 text-slate-600 dark:text-slate-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Definir sort_dir solo para el select de la vista
  // Para lógica usar sortDir
  const sort_dir = sortDir;

  return (
    <div className="p-5 space-y-6">
      {/* Filtros */}
      <div
        className={`p-5 rounded-xl border shadow-md transition ${
          theme === "dark"
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span className="inline-block px-2 py-1 rounded text-white text-xs bg-gradient-to-r from-orange-400 to-fuchsia-500">
            Filtros
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Buscar</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre del producto..."
              className={`w-full px-3 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 text-white focus:ring-fuchsia-400"
                  : "bg-white border-slate-300 text-slate-800 focus:ring-orange-300"
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 text-white focus:ring-fuchsia-400"
                  : "bg-white border-slate-300 text-slate-800 focus:ring-orange-300"
              }`}
            >
              {["Todas", ...categorias.map((c) => c.nombre)].map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Filtro Stock</label>
            <select
              value={chip}
              onChange={(e) => setChip(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 text-white focus:ring-fuchsia-400"
                  : "bg-white border-slate-300 text-slate-800 focus:ring-orange-300"
              }`}
            >
              <option value="TODOS">TODOS</option>
              <option value="BAJO STOCK">BAJO STOCK</option>
              <option value="SIN STOCK">SIN STOCK</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ordenar por:</label>
            <select
              value={`${sortBy} ${sort_dir === "asc" ? "(Ascendente)" : "(Descendente)"}`}
              onChange={(e) => handleSortChange(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 text-white focus:ring-fuchsia-400"
                  : "bg-white border-slate-300 text-slate-800 focus:ring-orange-300"
              }`}
            >
              <option value="nombre (A-Z)">Nombre (A-Z)</option>
              <option value="nombre (Z-A)">Nombre (Z-A)</option>
              <option value="code (Ascendente)">Código (Ascendente)</option>
              <option value="code (Descendente)">Código (Descendente)</option>
              <option value="precio (Bajo-Alto)">Precio (Bajo-Alto)</option>
              <option value="precio (Alto-Bajo)">Precio (Alto-Bajo)</option>
              <option value="stock (Alto-Bajo)">Stock (Alto-Bajo)</option>
              <option value="stock (Bajo-Alto)">Stock (Bajo-Alto)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div
        className={`p-5 rounded-xl border shadow-md transition ${
          theme === "dark"
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead
              className={`text-left ${
                theme === "dark"
                  ? "bg-slate-700 text-slate-200"
                  : "bg-slate-50 text-slate-700"
              }`}
            >
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Imagen</th>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="text-right px-3 py-2 font-medium">Precio</th>
                <th className="text-right px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="text-center px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                theme === "dark" ? "divide-slate-700" : "divide-slate-200"
              }`}
            >
              {pageData.map((p, i) => (
                <tr
                  key={p.id_producto}
                  className={`transition ${
                    theme === "dark"
                      ? "hover:bg-slate-800/60"
                      : "hover:bg-orange-50"
                  }`}
                >
                  <td className="px-3 py-2">{(page - 1) * perPage + i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-400 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold">
                      {getEmoji(p.nombre_categoria)}
                    </div>
                  </td>
                  <td className="px-3 py-2">P{p.id_producto}</td>
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="text-right px-3 py-2">{money(p.precio_venta)}</td>
                  <td
                    className={`text-right px-3 py-2 ${getStockColor(p)}`}
                    title={getStockTooltip(p)}
                  >
                    {formatStock(p.stock_actual)}
                  </td>
                  <td className="px-3 py-2">COMPRA Y VENTA</td>
                  <td className="px-3 py-2">{p.nombre_categoria}</td>
                  <td className="text-center px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <SmallBtn
                        variant="outline"
                        onClick={() => alert(`Editar producto ${p.nombre}`)}
                      >
                        ✏️
                      </SmallBtn>
                      <SmallBtn
                        onClick={() => alert(`Exportar producto ${p.nombre}`)}
                      >
                        ⤴️
                      </SmallBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageData.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-slate-500 dark:text-slate-400"
                  >
                    No hay resultados para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div>
              Página {page} de {totalPages} ({filtered.length} total)
            </div>
            <div className="flex items-center gap-1">
              <PagerBtn onClick={() => go(1)}>{"<<"}</PagerBtn>
              <PagerBtn onClick={() => go(page - 1)} disabled={page === 1}>
                {"<"}
              </PagerBtn>
              {Array.from({ length: Math.min(5, totalPages) })
                .slice(Math.max(0, page - 3))
                .map((_, i) => {
                  const n = page - 3 + i + 1;
                  if (n > totalPages || n < 1) return null;
                  return (
                    <PagerBtn key={n} active={n === page} onClick={() => go(n)}>
                      {n}
                    </PagerBtn>
                  );
                })}
              {totalPages > 5 && page < totalPages - 2 && <span>...</span>}
              <PagerBtn
                onClick={() => go(page + 1)}
                disabled={page === totalPages}
              >
                {">"}
              </PagerBtn>
              <PagerBtn
                onClick={() => go(totalPages)}
                disabled={page === totalPages}
              >
                {">>"}
              </PagerBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== UI Helpers ===== */
function SmallBtn({ children, variant = "solid", onClick }) {
  const base = "px-2.5 py-1.5 rounded-md text-xs font-medium transition";
  const style =
    variant === "solid"
      ? "bg-gradient-to-r from-orange-400 to-fuchsia-500 text-white hover:brightness-110"
      : "border border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700";
  return (
    <button onClick={onClick} className={`${base} ${style}`} type="button">
      {children}
    </button>
  );
}
function PagerBtn({ children, onClick, active = false, disabled = false }) {
  if (disabled)
    return <span className="px-2 py-1 text-slate-400">{children}</span>;
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded border transition ${
        active
          ? "bg-gradient-to-r from-orange-400 to-fuchsia-500 text-white border-none"
          : "border-slate-300 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

export default ConsultaProductos;