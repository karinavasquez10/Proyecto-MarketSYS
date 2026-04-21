import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

/* =============== Hook modo oscuro sincronizado =============== */
function useSystemTheme() {
  const [theme, setTheme] = useState(
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/* =============== Catálogo principal =============== */
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

        const [categoryResponse, productResponse] = await Promise.all([
          fetch("http://localhost:5000/api/categorias"),
          fetch("http://localhost:5000/api/products/productos"),
        ]);

        if (!categoryResponse.ok || !productResponse.ok) {
          throw new Error("Error al obtener datos");
        }

        const categoriesData = await categoryResponse.json();
        const productsData = await productResponse.json();

        // Si no hay categoría activa, seleccionamos la primera automáticamente
        if (categoriesData && categoriesData.length > 0) {
          setCategories(
            categoriesData.map((cat) => ({
              id: cat.id_categoria,
              nombre: cat.nombre,
            }))
          );
        } else {
          setCategories([]);
        }

        // Aquí, cambiamos para guardar la categoría como el nombre de la categoría, en vez de solo el id_categoria
        setProducts(
          (productsData || []).map((p) => ({
            id: p.id_producto,
            nombre: p.nombre,
            precio: p.precio_venta,
            categoriaNombre: p.nombre_categoria, // Usar nombre_categoria en vez de id_categoria
            stock: p.stock_actual,
            image: "🛍️",
          }))
        );

        if (
          categoriesData &&
          categoriesData.length > 0 &&
          !activeCategory // solo establecer si no hay selección aún
        ) {
          // Seleccionar automáticamente la primera categoría al cargar datos
          setActiveCategory({
            id: categoriesData[0].id_categoria,
            nombre: categoriesData[0].nombre,
          });
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
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={`relative w-[95vw] max-w-6xl h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex border transition-colors duration-300
          ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-800"
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel lateral de categorías */}
        <aside
          className={`w-1/5 p-4 overflow-y-auto transition-colors duration-300 border-r
            ${
              theme === "dark"
                ? "bg-slate-950 border-slate-800"
                : "bg-orange-50 border-slate-200"
            }
          `}
        >
          <h2
            className={`text-sm font-semibold mb-3 ${
              theme === "dark" ? "text-slate-300" : "text-slate-800"
            }`}
          >
            Categorías
          </h2>
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat)}
                className={`p-3 rounded-lg font-medium text-sm text-left transition-all
                  ${
                    activeCategory?.id === cat.id
                      ? theme === "dark"
                        ? "bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white shadow-md"
                        : "bg-gradient-to-r from-orange-400 to-pink-400 text-white shadow-md"
                      : theme === "dark"
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      : "bg-white hover:bg-orange-100 border border-slate-200"
                  }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </aside>

        {/* Sección de productos */}
        <main
          className={`flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 transition-colors duration-300
            ${
              theme === "dark"
                ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
                : "bg-gradient-to-br from-orange-50 via-white to-rose-50"
            }`}
        >
          {loading && (
            <div className="col-span-full text-center py-10 text-slate-400">
              <div className="text-lg animate-pulse">Cargando productos...</div>
            </div>
          )}

          {error && (
            <div className="col-span-full text-center py-10 text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-400">
              No hay productos disponibles en esta categoría.
            </div>
          )}

          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className={`p-4 rounded-xl shadow-sm flex flex-col items-center text-center cursor-pointer transition-all duration-200 border
                ${
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "bg-white border-slate-200 hover:bg-orange-50 hover:shadow-md"
                }`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-3
                  ${
                    theme === "dark"
                      ? "bg-slate-700"
                      : "bg-gradient-to-r from-orange-100 to-pink-100"
                  }`}
              >
                {prod.image}
              </div>
              <h3 className="font-semibold truncate">{prod.nombre}</h3>
              <span
                className={`mt-2 px-2 py-1 rounded text-sm font-bold ${
                  theme === "dark"
                    ? "bg-orange-600 text-white"
                    : "bg-gradient-to-r from-orange-400 to-fuchsia-400 text-white"
                }`}
              >
                ${prod.precio?.toLocaleString?.() ?? prod.precio}
              </span>
            </div>
          ))}
        </main>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition
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
