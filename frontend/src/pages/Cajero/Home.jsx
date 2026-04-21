import React, { useState, useEffect } from "react";

// import { useNavigate } from "react-router-dom";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Users,
  Box,
  Archive,
  Moon,
  Sun,
  LogOut,
  X,
  Search,
  Edit2
} from "lucide-react";
import Cobrar from "./Cobrar";
import Catalogo from "./Catalogo";
import CerrarCaja from "./CerrarCaja";
import ConsultaFacturas from "./ConsultaFacturas";
import ConsultaProductos from "./ConsultaProductos";
import AbrirCaja from "./AbrirCaja";
import Clientes from "./Clientes";
import PerfilCajera from "./PerfilCajera";


const weighedCategories = ["Frutas", "Verduras", "Carnes"];

// Nueva versión de useProfilePhoto siguiendo HomeAdmin.jsx
function useProfilePhoto(userId) {
  const [profilePhoto, setProfilePhoto] = useState("");
  const cloudName =
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
    import.meta.env.CLOUDINARY_CLOUD_NAME ||
    "";
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!userId) {
      setProfilePhoto("");
      return;
    }

    if (!cloudName) {
      setProfilePhoto("");
      return;
    }

    // Cargar desde localStorage el ultimo profilePhoto, como fallback rápido
    if (storedUser?.foto_url) {
      setProfilePhoto(storedUser.foto_url);
    } else if (storedUser?.foto_perfil) {
      setProfilePhoto(
        storedUser.foto_perfil.startsWith("http")
          ? storedUser.foto_perfil
          : `https://res.cloudinary.com/${cloudName}/image/upload/${storedUser.foto_perfil}.jpg`
      );
    }

    // Fetch actualizado desde backend
    const fetchPhoto = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/perfil/${userId}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Siempre usar foto_url del backend (dinámica con versión)
        if (data?.foto_url) {
          setProfilePhoto(data.foto_url);
        } else if (data?.foto_perfil) {
          setProfilePhoto(
            `https://res.cloudinary.com/${cloudName}/image/upload/${data.foto_perfil}.jpg`
          );
        } else {
          setProfilePhoto("");
        }
        // Actualizar localStorage (solo los campos relevantes)
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,
            foto_url: data.foto_url,
            foto_perfil: data.foto_perfil
          })
        );
      } catch (err) {{err}
        // Si falla fetch, usar fallback local
        if (storedUser?.foto_url) setProfilePhoto(storedUser.foto_url);
        else setProfilePhoto("");
      }
    };

    fetchPhoto();

    // Escuchar evento de foto de perfil actualizada (por ejemplo, desde el modal de edición)
    const handlePhotoUpdate = () => fetchPhoto();
    window.addEventListener("profilePhotoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("profilePhotoUpdated", handlePhotoUpdate);
    // cloudName en deps garantiza que si cambia (por .env), se actualiza bien
    // storedUser no lo ponemos para evitar bucles
    // eslint-disable-next-line
  }, [userId, cloudName]);

  // Permite disparar refresh manual (por ejemplo, al cerrar modal de editar perfil)
  const refreshPhoto = () => {
    if (!userId) {
      setProfilePhoto("");
      return;
    }
    fetch(`http://localhost:5000/api/perfil/${userId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Fail");
        return r.json();
      })
      .then((data) => {
        if (data?.foto_url) {
          setProfilePhoto(data.foto_url);
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              foto_url: data.foto_url,
              foto_perfil: data.foto_perfil
            })
          );
        } else if (data?.foto_perfil) {
          setProfilePhoto(
            `https://res.cloudinary.com/${cloudName}/image/upload/${data.foto_perfil}.jpg`
          );
        }
      })
      .catch(() => {
        if (storedUser?.foto_url) setProfilePhoto(storedUser.foto_url);
        else setProfilePhoto("");
      });
  };

  return [profilePhoto, refreshPhoto];
}

function QuantityModal({ product, currentQty, onSave, onClose, theme }) {
  const [qty, setQty] = useState(currentQty || "");

  useEffect(() => {
    setQty(currentQty || "");
  }, [currentQty]);

  const handleSave = () => {
    const numQty = parseFloat(qty);
    if (numQty > 0) {
      onSave(numQty.toString());
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`w-[400px] rounded-2xl shadow-2xl overflow-hidden ${theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-800"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold mb-3">{product.name}</h3>
          <p className="text-sm mb-2">Precio unitario: ${product.price.toLocaleString()} por {product.unit_abrev}</p>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`Ingresa cantidad en ${product.unit_abrev}`}
            className={`w-full px-3 py-2 rounded-lg border ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-800"}`}
          />
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white hover:brightness-110 transition"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([{ id: null, nombre: "Todas" }]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCobrar, setShowCobrar] = useState(false);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [showCerrarCaja, setShowCerrarCaja] = useState(false);
  const [showFacturas, setShowFacturas] = useState(false);
  const [showInventario, setShowInventario] = useState(false);
  const [showAbrirCaja, setShowAbrirCaja] = useState(false);
  const [showClientes, setShowClientes] = useState(false);
  const [showPerfilCajera, setShowPerfilCajera] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [showSelectorCliente, setShowSelectorCliente] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [editItemId, setEditItemId] = useState(null);
  
  // Permisos del usuario
  const [userPermisos, setUserPermisos] = useState({});
  const [permisosLoaded, setPermisosLoaded] = useState(false);
  
  // Estado de carga inicial
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Datos del usuario autenticado
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  })();
  const cajero = {
    nombre: storedUser?.nombre || storedUser?.email || "Usuario",
    rol: storedUser?.cargo || storedUser?.rol || "",
    correo: storedUser?.email || "",
    id: storedUser?.id,
  };

  // Foto de perfil (versión HomeAdmin)
  const [profilePhoto, refreshProfilePhoto] = useProfilePhoto(cajero.id);

  // Leer caja abierta
  const cajaAbierta = (() => {
    try {
      return JSON.parse(localStorage.getItem("caja_abierta") || "null");
    } catch {
      return null;
    }
  })();
  const idCajaAbierta = cajaAbierta?.id || cajaAbierta?.id_caja || null;
  
  // Tema
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Cargar permisos del usuario y datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      if (!cajero.id) {
        setLoadError({
          type: 'auth',
          message: 'No se encontró información de usuario. Por favor inicia sesión nuevamente.'
        });
        setInitialLoading(false);
        return;
      }
      
      try {
        // Cargar permisos y datos en paralelo
        const [permisosResponse, productResponse, categoryResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/permisos/${cajero.id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            }
          }),
          fetch("http://localhost:5000/api/products/productos"),
          fetch("http://localhost:5000/api/categorias"),
        ]);
        
        // Verificar si todas las respuestas fueron exitosas
        if (!permisosResponse.ok || !productResponse.ok || !categoryResponse.ok) {
          const errorMsg = !permisosResponse.ok 
            ? 'Error al cargar permisos de usuario'
            : !productResponse.ok
            ? 'Error al cargar productos'
            : 'Error al cargar categorías';
          
          setLoadError({
            type: 'server',
            message: `${errorMsg}. Código de error: ${permisosResponse.status || productResponse.status || categoryResponse.status}`
          });
          setInitialLoading(false);
          return;
        }
        
        // Procesar permisos
        const permisosData = await permisosResponse.json();
        setUserPermisos(permisosData);
        console.log('[Home Cajero] Permisos cargados:', permisosData);
        
        // Procesar productos y categorías
        const productsData = await productResponse.json();
        const categoriesData = await categoryResponse.json();

        const formattedProducts = productsData.map((p) => ({
          id: p.id_producto,
          name: p.nombre,
          price: parseFloat(p.precio_venta),
          category: p.nombre_categoria,
          stock: parseFloat(p.stock_actual),
          image: "🛒",
          unit: p.unidad || "Unidad",
          unit_abrev: p.unidad_abrev || "ud",
          tax_rate: parseFloat(p.impuesto) || 0,
          descripcion: p.descripcion,
        }));

        const formattedCategories = categoriesData.map((cat) => ({
          id: cat.id_categoria,
          nombre: cat.nombre,
        }));

        setProducts(formattedProducts);
        setCategories([{ id: null, nombre: "Todas" }, ...formattedCategories]);
        setLoadError(null); // Limpiar error si todo salió bien
      } catch (error) {
        console.error('[Home Cajero] Error al cargar datos iniciales:', error);
        
        // Determinar el tipo de error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          setLoadError({
            type: 'network',
            message: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.'
          });
        } else {
          setLoadError({
            type: 'unknown',
            message: 'Ocurrió un error inesperado al cargar los datos. Por favor intenta nuevamente.'
          });
        }
      } finally {
        setPermisosLoaded(true);
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, [cajero.id]);

  // Filtrar productos
  const filteredProducts = products.filter((p) => 
    (selectedCategory === "Todas" || p.category === selectedCategory) &&
    p.stock > 0 &&
    (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const searchResults = products.filter((p) => 
    p.stock > 0 && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  // Funciones carrito
  const openQuantityModal = (product, editId = null) => {
    setModalProduct(product);
    setEditItemId(editId);
    setShowQuantityModal(true);
  };

  const handleSaveQuantity = (qty) => {
    const product = modalProduct;
    const newQuantity = parseFloat(qty);
    if (newQuantity <= 0) return;

    const updatedItem = {
      ...product,
      quantity: newQuantity,
      is_weighed: true,
    };

    if (editItemId) {
      setCart((prev) =>
        prev.map((i) => (i.id === editItemId ? updatedItem : i))
      );
    } else {
      setCart((prev) => {
        const existingIndex = prev.findIndex((i) => i.id === product.id);
        if (existingIndex >= 0) {
          // Actualizar cantidad para productos ya en carrito
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + newQuantity,
          };
          return updated;
        } else {
          return [...prev, updatedItem];
        }
      });
    }

    setShowQuantityModal(false);
    setModalProduct(null);
    setEditItemId(null);
  };

  const addToCart = (p) => {
    if (weighedCategories.includes(p.category)) {
      openQuantityModal(p);
    } else {
      setCart((prev) => {
        const existing = prev.find((i) => i.id === p.id);
        if (existing) {
          return prev.map((i) =>
            i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { ...p, quantity: 1, is_weighed: false }];
      });
    }
  };

  const updateQuantity = (id, change) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id ? { ...i, quantity: Math.max(1, i.quantity + change) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const openEditModal = (item) => {
    openQuantityModal(item, item.id);
  };

  const removeFromCart = (id) => setCart((p) => p.filter((i) => i.id !== id));

  const lineTotal = (item) => {
    const subtotal = item.price * item.quantity;
    const tax = subtotal * item.tax_rate;
    return subtotal + tax;
  };

  const total = cart.reduce((sum, i) => sum + lineTotal(i), 0);

  const handleSearchSelect = (product) => {
    setSearchQuery("");
    addToCart(product);
  };

  const handleCobrarSuccess = () => {
    setCart([]);
  };

  // Mostrar pantalla de error si hay problemas de carga
  if (loadError) {
    const errorIcons = {
      network: '📡',
      server: '🔧',
      auth: '🔐',
      unknown: '⚠️'
    };

    const errorTitles = {
      network: 'Error de Conexión',
      server: 'Error del Servidor',
      auth: 'Sesión No Válida',
      unknown: 'Error Desconocido'
    };

    return (
      <div
        className={`flex h-screen w-screen items-center justify-center transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-zinc-900 via-gray-900 to-stone-900"
            : "bg-gradient-to-br from-orange-50 via-white to-rose-50"
        }`}
      >
        <div className={`max-w-md w-full mx-4 p-8 rounded-2xl shadow-2xl ${
          theme === "dark" 
            ? "bg-slate-900 border border-slate-700" 
            : "bg-white border border-slate-200"
        }`}>
          {/* Icono de error */}
          <div className="flex justify-center mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${
              loadError.type === 'network' 
                ? 'bg-red-100 dark:bg-red-900/30'
                : loadError.type === 'auth'
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-orange-100 dark:bg-orange-900/30'
            }`}>
              {errorIcons[loadError.type] || errorIcons.unknown}
            </div>
          </div>

          {/* Título y mensaje */}
          <div className="text-center mb-6">
            <h2 className={`text-2xl font-bold mb-3 ${
              theme === "dark" ? "text-white" : "text-slate-800"
            }`}>
              {errorTitles[loadError.type] || errorTitles.unknown}
            </h2>
            <p className={`text-sm leading-relaxed ${
              theme === "dark" ? "text-slate-300" : "text-slate-600"
            }`}>
              {loadError.message}
            </p>
          </div>

          {/* Recomendaciones según el tipo de error */}
          <div className={`p-4 rounded-lg mb-6 ${
            theme === "dark" ? "bg-slate-800" : "bg-slate-50"
          }`}>
            <p className={`text-xs font-semibold mb-2 ${
              theme === "dark" ? "text-slate-300" : "text-slate-700"
            }`}>
              Posibles soluciones:
            </p>
            <ul className={`text-xs space-y-1 ${
              theme === "dark" ? "text-slate-400" : "text-slate-600"
            }`}>
              {loadError.type === 'network' && (
                <>
                  <li>• Verifica tu conexión a internet</li>
                  <li>• Asegúrate de que el servidor esté activo</li>
                  <li>• Revisa la configuración de red</li>
                </>
              )}
              {loadError.type === 'server' && (
                <>
                  <li>• El servidor puede estar temporalmente inactivo</li>
                  <li>• Contacta al administrador del sistema</li>
                  <li>• Verifica la configuración de la base de datos</li>
                </>
              )}
              {loadError.type === 'auth' && (
                <>
                  <li>• Tu sesión puede haber expirado</li>
                  <li>• Inicia sesión nuevamente</li>
                  <li>• Contacta al administrador si el problema persiste</li>
                </>
              )}
              {loadError.type === 'unknown' && (
                <>
                  <li>• Intenta recargar la página</li>
                  <li>• Limpia la caché del navegador</li>
                  <li>• Contacta al soporte técnico</li>
                </>
              )}
            </ul>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-white bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:brightness-110 transition shadow-md"
            >
              Reintentar
            </button>
            {loadError.type === 'auth' && (
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/';
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                  theme === "dark"
                    ? "bg-slate-700 hover:bg-slate-600 text-white"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                }`}
              >
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mostrar spinner de carga inicial
  if (initialLoading) {
    return (
      <div
        className={`flex h-screen w-screen items-center justify-center transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-zinc-900 via-gray-900 to-stone-900"
            : "bg-gradient-to-br from-orange-50 via-white to-rose-50"
        }`}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Logo/Icono de la app */}
          <div className={`flex items-center gap-3 mb-4 ${
            theme === "dark" ? "text-slate-100" : "text-slate-800"
          }`}>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white font-bold text-2xl shadow-lg">
              IN
            </span>
            <div className="leading-tight">
              <div className="text-2xl font-bold">InventNet</div>
              <div className={`text-sm ${
                theme === "dark" ? "text-slate-400" : "text-slate-600"
              }`}>Sistema POS</div>
            </div>
          </div>

          {/* Spinner con gradiente */}
          <svg 
            className="animate-spin h-20 w-20" 
            viewBox="0 0 24 24"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              strokeWidth="3"
              fill="none"
              className={`opacity-20 ${theme === "dark" ? "stroke-slate-600" : "stroke-orange-200"}`}
            />
            <defs>
              <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
            <path
              className="opacity-90"
              fill="none"
              stroke="url(#spinnerGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              d="M12 2a10 10 0 0 1 10 10"
            />
          </svg>

          {/* Textos */}
          <div className="flex flex-col items-center gap-2">
            <div className={`text-xl font-bold bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-500 bg-clip-text text-transparent`}>
              Cargando datos del sistema...
            </div>
            <div className={`text-sm ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}>
              Configurando tu espacio de trabajo
            </div>
          </div>

          {/* Barra de progreso animada */}
          <div className={`w-64 h-1.5 rounded-full overflow-hidden ${
            theme === "dark" ? "bg-slate-800" : "bg-slate-200"
          }`}>
            <div className="h-full bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-500 animate-pulse rounded-full" 
                 style={{ width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen transition-colors duration-300 ${
        theme === "dark"
          ? "bg-gradient-to-br from-zinc-900 via-gray-900 to-stone-900 text-slate-100"
          : "bg-gradient-to-br from-orange-50 via-white to-rose-50 text-slate-700"
      }`}
    >
      {/* ===== Sidebar ===== */}
      <aside
        className={`w-56 flex flex-col border-r backdrop-blur-xl shadow-md ${
          theme === "dark"
            ? "bg-slate-950/80 border-slate-800"
            : "bg-white/80 border-orange-200"
        }`}
      >
        <div
          className={`p-4 text-lg font-bold border-b text-center ${
            theme === "dark"
              ? "border-slate-800 bg-gradient-to-r from-orange-600/30 to-fuchsia-500/30"
              : "border-orange-100 bg-gradient-to-r from-orange-400 via-rose-400 to-fuchsia-400 text-white rounded-br-2xl"
          }`}
        >
          Categorías
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {categories.map((cat) => (
            <button
              key={cat.nombre}
              onClick={() => setSelectedCategory(cat.nombre)}
              className={`w-full mb-2 px-4 py-2 text-left rounded-xl transition-all ${
                selectedCategory === cat.nombre
                  ? "bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-500 text-white font-semibold shadow-md"
                  : theme === "dark"
                  ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800"
                  : "bg-white hover:bg-orange-50 border border-orange-100 text-slate-700"
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </aside>

      {/* ===== Panel Central ===== */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header
          className={`px-3 py-2 flex flex-wrap gap-3 items-center justify-between border-b ${
            theme === "dark"
              ? "bg-slate-900/80 border-slate-800 text-slate-200"
              : "bg-white/80 border-orange-100 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setShowProfile(!showProfile)}
              title="Ir al perfil"
            >
              {profilePhoto ? (
                <img src={profilePhoto} alt="Perfil" className="w-10 h-10 rounded-full object-cover border" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
                  {cajero.nombre[0]}
                </div>
              )}
              <div className="leading-tight">
                <div className="text-sm font-semibold">{cajero.nombre}</div>
                <div className="text-xs opacity-70">{cajero.rol}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {[
              ["Clientes", () => setShowClientes(true), <Users key="users" size={16} />, "clientes_cajero"],
              ["Abrir Caja", () => setShowAbrirCaja(true), <Box key="box1" size={16} />, "abrir_caja"],
              ["Cerrar Caja", () => setShowCerrarCaja(true), <Box key="box2" size={16} />, "cerrar_caja"],
              ["Facturas", () => setShowFacturas(true), <Archive key="archive1" size={16} />, "consulta_facturas"],
              ["Catálogo", () => setShowCatalogo(true), <Archive key="archive2" size={16} />, "catalogo"],
              ["Inventario", () => setShowInventario(true), <Archive key="archive3" size={16} />, "consulta_productos"],
            ]
              .filter(([, , , moduloId]) => {
                // Si no hay moduloId, mostrar por defecto (para compatibilidad)
                if (!moduloId) return true;
                // Si no se han cargado los permisos aún, no mostrar nada
                if (!permisosLoaded) return false;
                // Mostrar solo si el usuario tiene permiso
                return userPermisos[moduloId] === true;
              })
              .map(([label, action, icon]) => (
                <button
                  key={label}
                  onClick={action}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition text-sm ${
                    theme === "dark"
                      ? "border-slate-700 bg-slate-800 hover:bg-slate-700"
                      : "border-orange-300 bg-white text-orange-700 hover:bg-orange-50"
                  }`}
                >
                  {icon}
                  {label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full ${
              theme === "dark"
                ? "bg-gray-800 text-yellow-300"
                : "bg-gray-100 text-gray-700"
            } hover:scale-105 transition`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Productos */}
        <section className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className={`rounded-2xl h-36 p-4 flex flex-col justify-between text-center cursor-pointer transition hover:scale-[1.02] ${
                  theme === "dark"
                    ? "bg-slate-900 border border-slate-700 hover:bg-gradient-to-r hover:from-orange-500 hover:to-fuchsia-500 hover:text-white"
                    : "bg-white border border-orange-100 hover:shadow-lg"
                }`}
              >
                <div className="text-2xl">{product.image}</div>
                <h3 className="text-sm font-semibold truncate">{product.name}</h3>
                <span
                  className={`font-bold text-sm ${
                    theme === "dark" ? "text-orange-400" : "text-orange-600"
                  }`}
                >
                  ${product.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ===== Factura ===== */}
      <aside
        className={`w-80 flex flex-col border-l shadow-lg transition ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-slate-200"
            : "bg-white border-orange-100 text-slate-700"
        }`}
      >
        <div
          className={`p-3 border-b ${
            theme === "dark"
              ? "border-slate-700 bg-gradient-to-r from-orange-600 to-fuchsia-600 text-white"
              : "border-orange-100 bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-500 text-white"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={20} />
            <h2 className="text-md font-semibold">Factura</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto por nombre..."
              className={`w-full pl-10 pr-4 py-2 rounded-full border-2 focus:border-orange-400 focus:outline-none transition-colors ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 text-white placeholder-slate-400"
                  : "bg-white border-slate-300 text-slate-800 placeholder-slate-500"
              }`}
            />
          </div>
        </div>

        {/* Dropdown de resultados sugeridos */}
        {searchQuery && searchResults.length > 0 && (
          <div className="max-h-96 overflow-y-auto border-t p-2 space-y-2">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSearchSelect(product)}
                className={`w-full p-3 rounded-lg text-left transition hover:bg-orange-50 dark:hover:bg-slate-700 ${
                  theme === "dark" ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <div className="font-semibold">{product.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">${product.price.toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && (
          <div className="p-4 text-center text-slate-500 dark:text-slate-400">
            No se encontraron resultados.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-500 mt-8">
              <ShoppingCart
                size={48}
                className={`mx-auto mb-4 opacity-50 ${
                  theme === "dark" ? "text-orange-400" : "text-orange-500"
                }`}
              />
              <p className="font-medium">Factura vacía</p>
              <p className="text-sm text-slate-400">
                Selecciona productos para agregar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => {
                const lineTotalAmount = lineTotal(item);
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-3 border ${
                      theme === "dark"
                        ? "bg-slate-800 border-slate-700"
                        : "bg-white border-orange-100"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-medium">{item.name}</h3>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {item.is_weighed ? (
                          <>
                            <span className="text-sm font-medium">
                              {item.quantity} {item.unit_abrev}
                            </span>
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-blue-500 hover:text-blue-600"
                              title="Editar cantidad"
                            >
                              <Edit2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center"
                            >
                              <Plus size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div
                        className={`font-bold ${
                          theme === "dark"
                            ? "text-orange-400"
                            : "text-orange-600"
                        }`}
                      >
                        ${lineTotalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={`border-t p-3 ${
            theme === "dark"
              ? "border-slate-700 bg-slate-950"
              : "border-orange-100 bg-white"
          }`}
        >
          {/* Selector de Cliente */}
          <div className="mb-3">
            {clienteSeleccionado ? (
              <div className={`p-2 rounded-lg flex items-center justify-between ${
                theme === "dark" ? "bg-slate-800 border border-slate-700" : "bg-orange-50 border border-orange-200"
              }`}>
                <div className="text-sm">
                  <div className="font-semibold">{clienteSeleccionado.nombre}</div>
                  <div className="text-xs opacity-70">{clienteSeleccionado.identificacion}</div>
                </div>
                <button
                  onClick={() => setClienteSeleccionado(null)}
                  className="text-rose-500 hover:text-rose-600"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSelectorCliente(true)}
                className={`w-full py-2 rounded-lg border text-sm font-medium transition ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
                    : "border-orange-200 bg-white hover:bg-orange-50 text-orange-700"
                }`}
              >
                + Seleccionar Cliente
              </button>
            )}
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold">Total:</span>
            <span
              className={`text-2xl font-extrabold ${
                theme === "dark" ? "text-orange-400" : "text-orange-600"
              }`}
            >
              ${total.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => setShowCobrar(true)}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-500 hover:brightness-110 transition"
          >
            Procesar Pago
          </button>
        </div>
      </aside>

      {/* ===== Menú de perfil del cajero ===== */}
      {showProfile && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`w-80 rounded-2xl p-6 shadow-xl border border-orange-100 ${theme === "dark" ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            <div className="flex flex-col items-center gap-2">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Perfil" className="w-16 h-16 rounded-full object-cover border-4 border-orange-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 flex items-center justify-center text-2xl text-white font-bold">
                  {cajero.nombre[0]}
                </div>
              )}
              <h3 className="text-lg font-semibold">{cajero.nombre}</h3>
              <p className="text-sm opacity-80">{cajero.rol}</p>
              <p className="text-sm text-slate-400">{cajero.correo}</p>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  setShowProfile(false);
                  setShowPerfilCajera(true);
                }}
                className="w-full py-2 bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white rounded-lg font-semibold hover:brightness-110 transition"
              >
                Ver perfil completo
              </button>

              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/";
                }}
                className="w-full py-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>

              <button
                onClick={() => setShowProfile(false)}
                className="w-full text-sm text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 mt-3"
              >
                Cerrar ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal cantidad ===== */}
      {showQuantityModal && modalProduct && (
        <QuantityModal
          product={modalProduct}
          currentQty={editItemId ? cart.find(i => i.id === editItemId)?.quantity.toString() : ""}
          onSave={handleSaveQuantity}
          onClose={() => {
            setShowQuantityModal(false);
            setModalProduct(null);
            setEditItemId(null);
          }}
          theme={theme}
        />
      )}

      {/* ===== Modal Perfil completo ===== */}
      {showPerfilCajera && (
        <PerfilCajera
          onClose={() => {
            setShowPerfilCajera(false);
            // Dispara una recarga del perfil (actualizar correctamente tras editar foto/campos)
            setTimeout(() => {
              refreshProfilePhoto();
            }, 50);
            // También emitir evento global (para otras vistas si se utilizan)
            setTimeout(() => {
              window.dispatchEvent(new Event("profilePhotoUpdated"));
            }, 100);
          }}
        />
      )}

      {/* ===== Modales ===== */}
      {showCobrar && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <Cobrar
            initialCliente={clienteSeleccionado}
            carrito={cart}
            usuario={storedUser}
            idCaja={idCajaAbierta}
            onClose={() => setShowCobrar(false)}
            onSuccess={handleCobrarSuccess}
          />
        </div>
      )}
      {showCatalogo && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <Catalogo onClose={() => setShowCatalogo(false)} />
        </div>
      )}
      {showCerrarCaja && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <CerrarCaja
            ventas={{ efectivo: 200000, tarjeta: 150000, nequi: 50000 }}
            onClose={() => setShowCerrarCaja(false)}
          />
        </div>
      )}
      <ConsultaFacturas open={showFacturas} onClose={() => setShowFacturas(false)} />
      <ConsultaProductos open={showInventario} onClose={() => setShowInventario(false)} />
      <Clientes open={showClientes} onClose={() => setShowClientes(false)} />
      <AbrirCaja 
        open={showAbrirCaja} 
        onClose={() => setShowAbrirCaja(false)}
        onConfirm={(data) => {
          fetch('http://localhost:5000/api/cajas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_usuario: data.id_usuario,
              id_sucursal: 1,
              fecha_apertura: data.abiertoEn,
              monto_inicial: Number(data.base),
              estado: 'abierta'
            })
          })
          .then(r => r.json())
          .then(caja => {
            const cajaConId = { ...data, id: caja.id, id_caja: caja.id };
            localStorage.setItem('caja_abierta', JSON.stringify(cajaConId));
            alert('Caja abierta exitosamente. ID: ' + caja.id);
            window.location.reload();
          })
          .catch(err => {
            console.error(err);
            alert('Error al abrir caja');
          });
        }}
        usuario={cajero}
      />

      {/* Modal Selector de Cliente */}
      {showSelectorCliente && (
        <SelectorCliente
          onClose={() => setShowSelectorCliente(false)}
          onSelect={(cliente) => {
            setClienteSeleccionado(cliente);
            setShowSelectorCliente(false);
          }}
        />
      )}
    </div>
  );
}

// Componente Selector de Cliente
function SelectorCliente({ onClose, onSelect }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";

  useEffect(() => {
    fetch('http://localhost:5000/api/clientes')
      .then(r => r.json())
      .then(data => {
        setClientes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.identificacion?.includes(busqueda)
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`w-[500px] max-h-[600px] rounded-2xl shadow-2xl overflow-hidden ${
          theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold mb-3">Seleccionar Cliente</h3>
          <input
            type="text"
            placeholder="Buscar por nombre o identificación..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${
              theme === "dark"
                ? "bg-slate-800 border-slate-700 text-white"
                : "bg-white border-slate-300 text-slate-800"
            }`}
          />
        </div>
        <div className="overflow-y-auto max-h-[400px] p-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No se encontraron clientes</div>
          ) : (
            clientesFiltrados.map(cliente => (
              <button
                key={cliente.id}
                onClick={() => onSelect(cliente)}
                className={`w-full p-3 rounded-lg text-left transition ${
                  theme === "dark"
                    ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                    : "bg-slate-50 hover:bg-orange-50 border border-slate-200"
                }`}
              >
                <div className="font-semibold">{cliente.nombre}</div>
                <div className="text-sm opacity-70">{cliente.identificacion}</div>
                {cliente.telefono && (
                  <div className="text-xs opacity-60">{cliente.telefono}</div>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;