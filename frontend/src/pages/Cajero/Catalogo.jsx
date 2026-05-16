import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { listarCategorias } from "../../services/categoriasService";
import { listarProductos } from "../../services/productosService";

/* =============== Hook modo oscuro sincronizado =============== */
function useSystemTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return "light";
}

/* =============== Catálogo principal =============== */
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

const Catalogo = ({ onClose }) => {
  const theme = useSystemTheme();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar categorías y productos
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [categoriesData, productsData] = await Promise.all([
          listarCategorias(),
          listarProductos(),
        ]);

        const categoryMap = new Map();
        (categoriesData || []).forEach((cat) => {
          const nombre = normalizeCategoryName(cat.nombre);
          const key = nombre
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();
          if (nombre && key && !categoryMap.has(key)) {
            categoryMap.set(key, {
              id: cat.id_categoria,
              nombre,
              label: getCategoryLabel(nombre),
            });
          }
        });
        const formattedCategories = Array.from(categoryMap.values());
        setCategories(formattedCategories);

        // Aquí, cambiamos para guardar la categoría como el nombre de la categoría, en vez de solo el id_categoria
        setProducts(
          (productsData || []).map((p) => ({
            id: p.id_producto,
            nombre: p.nombre,
            precio: p.precio_venta,
            categoriaNombre: normalizeCategoryName(p.nombre_categoria),
            stock: p.stock_actual,
            image: "🛍️",
          }))
        );

        if (
          formattedCategories.length > 0 &&
          !activeCategory // solo establecer si no hay selección aún
        ) {
          // Seleccionar automáticamente la primera categoría al cargar datos
          setActiveCategory(formattedCategories[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // Nota: NO incluir activeCategory en dependencia, sería lupo infinito. Solo cargar una vez.
    // eslint-disable-next-line
  }, []);

  // Esta lógica hace que si el usuario borra las categorías y luego se recargan, la active se mantenga válida
  useEffect(() => {
    if (
      categories.length > 0 &&
      (!activeCategory ||
        !categories.some((cat) => cat.id === activeCategory.id))
    ) {
      // Si la categoría activa ya no existe, selecciona la primera
      setActiveCategory(categories[0]);
    }
  }, [categories]);

  // Filtrar productos SOLO si hay categoría activa y productos cargados
  // Cambiar a filtrar por nombre de categoría
  const filteredProducts =
    products && activeCategory
      ? products.filter(
          (p) =>
            typeof p.categoriaNombre !== "undefined" &&
            String(p.categoriaNombre) === String(activeCategory.nombre)
        )
      : [];

  /* =================== UI =================== */
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={`cashier-modal-light relative flex h-[88vh] max-h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-sm border shadow-2xl transition-colors duration-300 md:flex-row
          ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-white border-[#c7d2fe] text-slate-800"
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel lateral de categorías */}
        <aside
          className={`max-h-[210px] w-full shrink-0 overflow-y-auto border-b transition-colors duration-300 md:max-h-none md:w-[240px] md:border-b-0 md:border-r
            ${
              theme === "dark"
                ? "bg-slate-950 border-slate-800"
                : "bg-[#eef2ff] border-[#c7d2fe]"
            }
          `}
        >
          <div className="bg-[linear-gradient(135deg,#3157d5,#4f46e5)] px-4 py-3 text-white">
            <h2 className="text-sm font-bold uppercase tracking-wide">
              Categorías
            </h2>
            <p className="mt-1 text-xs text-slate-100/90">Catálogo de venta</p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:flex md:flex-col md:p-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-sm border p-2 text-left text-sm font-semibold transition-all md:p-3
                  ${
                    activeCategory?.id === cat.id
                      ? theme === "dark"
                        ? "bg-slate-800 text-white shadow-md"
                        : "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-white shadow-md"
                      : theme === "dark"
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                      : "bg-white hover:bg-[#eef2ff] border-[#c7d2fe] text-slate-800"
                  }`}
              >
                {cat.label || cat.nombre}
              </button>
            ))}
          </div>
        </aside>

        {/* Sección de productos */}
        <main
          className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-colors duration-300
            ${
              theme === "dark"
                ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
                : "bg-[#f4f6ff]"
            }`}
        >
          <div className="border-b border-[#c7d2fe] bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:py-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[#233876] dark:text-slate-300">
              Productos disponibles
            </div>
            <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {activeCategory?.label || activeCategory?.nombre || "Catálogo"}
            </h3>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
          {loading && (
            <div className="col-span-full text-center py-10 text-slate-600 dark:text-slate-300">
              <div className="text-lg animate-pulse">Cargando productos...</div>
            </div>
          )}

          {error && (
            <div className="col-span-full text-center py-10 text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-600 dark:text-slate-300">
              No hay productos disponibles en esta categoría.
            </div>
          )}

          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className={`overflow-hidden rounded-sm shadow-sm flex flex-col text-center cursor-pointer transition-all duration-200 border
                ${
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "bg-white border-[#c7d2fe] hover:border-[#3157d5] hover:shadow-lg hover:shadow-[#3157d5]/10"
                }`}
            >
              <div className="bg-[linear-gradient(135deg,#3157d5,#4f46e5)] px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-white">
                P{prod.id}
              </div>
              <div className="flex flex-1 flex-col items-center p-4">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-3
                  ${
                    theme === "dark"
                      ? "bg-slate-700"
                      : "bg-slate-100"
                  }`}
              >
                {prod.image}
              </div>
              <h3 className="w-full truncate text-sm font-black text-slate-950 dark:text-white">{prod.nombre}</h3>
              <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-300">
                Stock: {prod.stock ?? 0}
              </p>
              <span
                className={`mt-3 px-3 py-1 rounded-md text-sm font-black ${
                  theme === "dark"
                    ? "bg-white text-slate-950"
                    : "bg-slate-950 text-white"
                }`}
              >
                ${prod.precio?.toLocaleString?.() ?? prod.precio}
              </span>
              </div>
            </div>
          ))}
          </div>
        </main>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-sm transition
            ${
              theme === "dark"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-red-500 hover:bg-red-600 text-white shadow-md"
            }`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default Catalogo;
