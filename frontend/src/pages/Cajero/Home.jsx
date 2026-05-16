import React, { useCallback, useState, useEffect, useRef } from "react";

// import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Users,
  Box,
  Archive,
  BarChart3,
  Boxes,
  ChevronDown,
  FileText,
  LogOut,
  X,
  Search,
  Menu,
  Settings,
  Wifi,
  WifiOff
} from "lucide-react";
import Cobrar from "./Cobrar";
import CerrarCaja from "./CerrarCaja";
import ConsultaFacturas from "./ConsultaFacturas";
import ConsultaProductos from "./ConsultaProductos";
import AbrirCaja from "./AbrirCaja";
import Clientes from "./Clientes";
import PerfilCajera from "./PerfilCajera";
import ReportesCajero from "./ReportesCajero";
import { obtenerCajaAbierta } from "../../services/cajasService";
import { listarCategorias } from "../../services/categoriasService";
import { listarClientes } from "../../services/clientesService";
import { obtenerPerfil, listarPerfiles } from "../../services/perfilesService";
import { listarPermisosUsuario } from "../../services/permisosService";
import { listarProductos } from "../../services/productosService";
import { obtenerConfiguracionSistema } from "../../services/configService";
import { leerPesoBascula } from "../../services/peripheralsService";
import { obtenerProximaFactura } from "../../services/ventasService";

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
        const data = await obtenerPerfil(userId);
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
      } catch (err) {
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
    obtenerPerfil(userId)
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

function QuantityModal({ product, currentQty, onSave, onClose, theme, scaleConfig, onReadScale }) {
  const [qty, setQty] = useState(currentQty || "");
  const [readingScale, setReadingScale] = useState(false);
  const [scaleMessage, setScaleMessage] = useState("");
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    setQty(currentQty || "");
    setScaleMessage("");
    setManualMode(false);
  }, [currentQty, product?.id]);

  const configuredUnit = scaleConfig?.["bascula.unidad"]?.valor;
  const unitLabel = product.unit_abrev || configuredUnit || product.unit || "kg";
  const mode = scaleConfig?.["bascula.modo"]?.valor || "manual";
  const precision = Number(scaleConfig?.["bascula.precision_decimales"]?.valor || 3);
  const canReadScale = ["mock", "rs232"].includes(mode) && typeof onReadScale === "function";
  const numericQty = Number.parseFloat(qty);
  const validQty = Number.isFinite(numericQty) && numericQty > 0;
  const subtotal = validQty ? product.price * numericQty : 0;
  const tax = subtotal * (Number(product.tax_rate) || 0);
  const total = subtotal + tax;

  const handleSave = () => {
    if (validQty) {
      onSave(numericQty.toString());
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && validQty) {
      handleSave();
    }
  };

  const handleReadScale = async () => {
    if (!canReadScale) return;
    setReadingScale(true);
    setManualMode(false);
    setScaleMessage("");
    try {
      const result = await onReadScale();
      if (!Number.isFinite(result.weight) || result.weight <= 0) {
        throw new Error("La lectura recibida no tiene un peso válido.");
      }
      setQty(result.weight.toFixed(precision));
      setScaleMessage(`Peso detectado: ${result.weight.toLocaleString("es-CO", { maximumFractionDigits: precision })} ${result.unit || unitLabel}`);
    } catch (error) {
      setScaleMessage(error.message || "No se pudo leer la báscula. Puedes ingresar el peso manualmente.");
    } finally {
      setReadingScale(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-3" onClick={onClose}>
      <div
        className={`w-full max-w-[380px] overflow-hidden rounded-lg border shadow-2xl ${
          theme === "dark"
            ? "border-slate-700 bg-slate-900 text-white"
            : "border-[#c7d2fe] bg-white text-slate-950"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#eef2ff,#ffffff)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Producto por peso</p>
              <h3 className="mt-0.5 line-clamp-2 text-base font-black leading-tight text-slate-950 dark:text-white">
                {product.name}
              </h3>
            </div>
            <span className="shrink-0 rounded-sm bg-[#3157d5] px-2 py-1 text-xs font-black uppercase text-white">
              {unitLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876] shadow-sm transition hover:bg-[#eef2ff]"
              title="Cerrar"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-sm border border-[#dbe4ff] bg-[#f8f9ff] px-3 py-2">
              <p className="text-[10px] font-black uppercase text-[#4b5551]">Precio</p>
              <p className="text-sm font-black text-slate-950">
                ${Number(product.price || 0).toLocaleString("es-CO")} / {unitLabel}
              </p>
            </div>
            <div className="rounded-sm border border-[#dbe4ff] bg-[#f8f9ff] px-3 py-2">
              <p className="text-[10px] font-black uppercase text-[#4b5551]">Lectura</p>
              <p className="text-sm font-black text-slate-950">
                {canReadScale ? "Por botón" : "Manual"}
              </p>
            </div>
          </div>

          {canReadScale && (
            <div className="rounded-sm border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-[#233876]">
                  {readingScale ? "Leyendo báscula..." : "Lectura de báscula"}
                </p>
                <span className={`h-2.5 w-2.5 rounded-full ${validQty ? "bg-emerald-500" : "bg-amber-500"}`} />
              </div>
              <p className={`mt-1 text-xs font-bold ${scaleMessage.startsWith("Peso detectado") ? "text-emerald-700" : "text-[#4b5563]"}`}>
                {scaleMessage || "Coloca el producto sobre la báscula y presiona Leer báscula."}
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-800">
              Peso en {unitLabel}
            </span>
            <div className="flex overflow-hidden rounded-sm border border-[#3157d5] bg-white shadow-sm">
              <input
                type="number"
                step={precision >= 3 ? "0.001" : "0.01"}
                min={precision >= 3 ? "0.001" : "0.01"}
                value={qty}
                onChange={(e) => {
                  setManualMode(true);
                  setQty(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder="0.000"
                autoFocus
                className="min-w-0 flex-1 bg-white px-3 py-2.5 text-lg font-black text-slate-950 outline-none placeholder:text-slate-400"
              />
              <span className="grid w-14 place-items-center bg-[#e0e7ff] text-sm font-black uppercase text-[#233876]">
                {unitLabel}
              </span>
            </div>
          </label>

          {manualMode && (
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-bold text-amber-800">
                Modo manual activo. Puedes ajustar el peso o reintentar la lectura.
              </p>
            </div>
          )}

          {canReadScale && (
            <button
              type="button"
              onClick={handleReadScale}
              disabled={readingScale}
              className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-black text-[#233876] transition hover:bg-[#eef2ff] disabled:cursor-wait disabled:opacity-60"
            >
              {readingScale ? "Leyendo..." : "Leer báscula"}
            </button>
          )}

          <div className="rounded-sm border border-[#c7d2fe] bg-[linear-gradient(135deg,#f8f9ff,#eef2ff)] p-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#4b5551]">
              <span>Subtotal</span>
              <span className="font-black text-slate-950">${subtotal.toLocaleString("es-CO")}</span>
            </div>
            {tax > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs font-bold text-[#4b5551]">
                <span>Impuesto</span>
                <span className="font-black text-slate-950">${tax.toLocaleString("es-CO")}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-[#c7d2fe] pt-2">
              <span className="text-xs font-black uppercase text-[#233876]">Total</span>
              <span className="text-xl font-black text-slate-950">${total.toLocaleString("es-CO")}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-[#c7d2fe] bg-white p-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-sm bg-slate-200 px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!validQty}
            className="flex-[1.35] rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptLikeIcon({ compact = false }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-sm border-2 border-[#3157d5] bg-[#e0e7ff] text-[#233876] leading-none ${compact ? "h-7 w-9 text-sm" : "h-9 w-12 text-base"}`}>
      ▬
    </span>
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

const formatProductsForSale = (productsData = []) =>
  (Array.isArray(productsData) ? productsData : []).map((p) => ({
    id: p.id_producto,
    barcode: p.codigo_barras || "",
    internalCode: p.codigo_interno || "",
    name: p.nombre,
    price: parseFloat(p.precio_venta),
    category: normalizeCategoryName(p.nombre_categoria),
    stock: parseFloat(p.stock_actual),
    image: "🛒",
    imageUrl: p.imagen_url || p.foto_url || p.imagen || p.url_imagen || "",
    unit: p.unidad || "Unidad",
    unit_abrev: p.unidad_abrev || "ud",
    tax_rate: parseFloat(p.impuesto) || 0,
    descripcion: p.descripcion,
  }));

function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([{ id: null, nombre: "Todas" }]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCobrar, setShowCobrar] = useState(false);
  const [showCerrarCaja, setShowCerrarCaja] = useState(false);
  const [showFacturas, setShowFacturas] = useState(false);
  const [showInventario, setShowInventario] = useState(false);
  const [showAbrirCaja, setShowAbrirCaja] = useState(false);
  const [showClientes, setShowClientes] = useState(false);
  const [showPerfilCajera, setShowPerfilCajera] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [showSelectorCliente, setShowSelectorCliente] = useState(false);
  const [responsableSeleccionado, setResponsableSeleccionado] = useState(null);
  const [showSelectorResponsable, setShowSelectorResponsable] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [documentDiscountPercent, setDocumentDiscountPercent] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showReportesCajero, setShowReportesCajero] = useState(false);
  const [reportesInitialTab, setReportesInitialTab] = useState("resumen");
  const [inventarioInitialTab, setInventarioInitialTab] = useState("inventario");
  const [clientesInitialTab, setClientesInitialTab] = useState("directorio");
  const [openCashierModules, setOpenCashierModules] = useState({});
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [editItemId, setEditItemId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scaleConfig, setScaleConfig] = useState({});
  const [barcodeConfig, setBarcodeConfig] = useState({});
  const [scanMessage, setScanMessage] = useState("");
  const [quickScanCode, setQuickScanCode] = useState("");
  const [businessLogo, setBusinessLogo] = useState("/ticket-logo.jpeg");
  const [nextInvoice, setNextInvoice] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [cajaActual, setCajaActual] = useState(null);
  const [cajaStatusLoading, setCajaStatusLoading] = useState(false);
  const searchInputRef = useRef(null);
  const quickScanInputRef = useRef(null);
  
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
    id: storedUser?.id || storedUser?.id_usuario,
    id_usuario: storedUser?.id_usuario || storedUser?.id,
  };

  useEffect(() => {
    if (!responsableSeleccionado && cajero.id) {
      setResponsableSeleccionado({
        id: cajero.id,
        nombre: cajero.nombre,
        rol: cajero.rol || "Cajero",
        correo: cajero.correo,
      });
    }
  }, [cajero.id, cajero.nombre, cajero.rol, cajero.correo, responsableSeleccionado]);

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
  const idCajaAbierta = cajaActual?.id_caja || cajaAbierta?.id || cajaAbierta?.id_caja || null;
  
  // El cajero queda fijo en modo claro para evitar textos blancos sobre fondos claros.
  const theme = "light";
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshCajaActual = async () => {
    if (!cajero.id) return;
    setCajaStatusLoading(true);
    try {
      const data = await obtenerCajaAbierta(cajero.id);
      setCajaActual(data);
      localStorage.setItem("caja_abierta", JSON.stringify({ ...data, estado: "abierta" }));
    } catch {
      setCajaActual(null);
      localStorage.removeItem("caja_abierta");
    } finally {
      setCajaStatusLoading(false);
    }
  };

  const handleCajaCerrada = () => {
    setCajaActual(null);
    localStorage.removeItem("caja_abierta");
    setShowCerrarCaja(false);
  };

  useEffect(() => {
    refreshCajaActual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajero.id]);

  const loadInitialData = useCallback(async () => {
    setInitialLoading(true);
    if (!cajero.id) {
      setLoadError({
        type: 'auth',
        message: 'No se encontró información de usuario. Por favor inicia sesión nuevamente.'
      });
      setInitialLoading(false);
      return;
    }

    try {
      const [permisosData, productsData, categoriesData, configData, nextInvoiceData] = await Promise.all([
        listarPermisosUsuario(cajero.id),
        listarProductos(),
        listarCategorias(),
        obtenerConfiguracionSistema(),
        obtenerProximaFactura(),
      ]);

      setUserPermisos(permisosData);

      const formattedProducts = formatProductsForSale(productsData);

      const categoryMap = new Map();
      categoriesData.forEach((cat) => {
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
          });
        }
      });
      const formattedCategories = Array.from(categoryMap.values());

      setProducts(formattedProducts);
      setCategories([{ id: null, nombre: "Todas" }, ...formattedCategories]);
      setScaleConfig(configData?.grupos?.bascula || {});
      setBarcodeConfig(configData?.grupos?.codigo_barras || {});
      setBusinessLogo(
        configData?.grupos?.empresa?.["empresa.logo_sidebar"]?.valor ||
        configData?.grupos?.impresion?.["impresion.logo_ticket"]?.valor ||
        "/ticket-logo.jpeg"
      );
      setNextInvoice(nextInvoiceData);
      setLoadError(null);
      await refreshCajaActual();
    } catch (error) {
      console.error('[Home Cajero] Error al cargar datos iniciales:', error);
      setLoadError({
        type: 'server',
        message: error.message || 'Ocurrió un error inesperado al cargar los datos. Por favor intenta nuevamente.'
      });
    } finally {
      setPermisosLoaded(true);
      setInitialLoading(false);
    }
  }, [cajero.id]);

  // Cargar permisos del usuario y datos iniciales
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const refreshProductsForSale = useCallback(async () => {
    const productsData = await listarProductos();
    setProducts(formatProductsForSale(productsData));
  }, []);

  const normalizeText = (value = "") =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  // Filtrar productos
  const normalizedSearch = normalizeText(searchQuery);
  const normalizedSelectedCategory = normalizeText(selectedCategory);
  const filteredProducts = products.filter((p) => 
    (normalizedSelectedCategory === "todas" || normalizeText(p.category) === normalizedSelectedCategory) &&
    (!normalizedSearch ||
      normalizeText(p.name).includes(normalizedSearch) ||
      normalizeText(p.barcode).includes(normalizedSearch) ||
      normalizeText(p.internalCode).includes(normalizedSearch) ||
      String(p.id || "").includes(normalizedSearch))
  );

  const searchResults = products.filter((p) => 
    normalizedSearch &&
    (normalizeText(p.name).includes(normalizedSearch) ||
      normalizeText(p.barcode).includes(normalizedSearch) ||
      normalizeText(p.internalCode).includes(normalizedSearch) ||
      String(p.id || "").includes(normalizedSearch))
  );

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

  const isWeighedProduct = (product) => {
    const unit = String(product.unit_abrev || product.unit || "").toLowerCase();
    return ["kg", "kilo", "kilogramo", "g", "gr", "gramo"].includes(unit);
  };

  const addToCart = (p) => {
    if (isWeighedProduct(p)) {
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

  const clearCart = () => {
    if (cart.length === 0 && !clienteSeleccionado) return;
    setCart([]);
    setClienteSeleccionado(null);
    setDocumentDiscountPercent(0);
  };

  const itemSubtotal = (item) => Number(item.price || 0) * Number(item.quantity || 0);
  const itemDiscount = (item) => Number(item.descuento || item.discountAmount || 0);
  const itemNetSubtotal = (item) => Math.max(0, itemSubtotal(item) - itemDiscount(item));
  const includedTax = (amount, rate) => {
    const numericAmount = Number(amount || 0);
    const numericRate = Number(rate || 0);
    if (numericAmount <= 0 || numericRate <= 0) return 0;
    return numericAmount - numericAmount / (1 + numericRate);
  };
  const itemTax = (item) => includedTax(itemNetSubtotal(item), item.tax_rate);
  const lineTotal = (item) => itemNetSubtotal(item);

  const applyProductDiscount = (productId, percent) => {
    setCart((prev) =>
      prev.map((item) => {
        if (String(item.id) !== String(productId)) return item;
        const subtotal = itemSubtotal(item);
        const discountAmount = percent > 0 ? (subtotal * percent) / 100 : 0;
        return {
          ...item,
          descuento: discountAmount,
          discountAmount,
          discountPercent: percent,
        };
      })
    );
  };

  const totalBruto = cart.reduce((sum, item) => sum + itemSubtotal(item), 0);
  const productDiscountTotal = cart.reduce((sum, item) => sum + itemDiscount(item), 0);
  const subtotalAfterProductDiscounts = Math.max(0, totalBruto - productDiscountTotal);
  const documentDiscountAmount = documentDiscountPercent > 0
    ? (subtotalAfterProductDiscounts * documentDiscountPercent) / 100
    : 0;
  const subtotalAfterDiscounts = Math.max(0, subtotalAfterProductDiscounts - documentDiscountAmount);
  const totalDiscount = productDiscountTotal + documentDiscountAmount;
  const totalImpuesto = subtotalAfterProductDiscounts > 0
    ? cart.reduce((sum, item) => {
        const itemNet = itemNetSubtotal(item);
        const proratedDocumentDiscount = documentDiscountAmount > 0
          ? (itemNet / subtotalAfterProductDiscounts) * documentDiscountAmount
          : 0;
        return sum + includedTax(Math.max(0, itemNet - proratedDocumentDiscount), item.tax_rate);
      }, 0)
    : 0;
  const total = subtotalAfterDiscounts;
  const totalUnits = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const today = new Date();
  const fechaHoy = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const handleSearchSelect = (product) => {
    setSearchQuery("");
    setScanMessage("");
    addToCart(product);
  };

  const barcodeConfigValue = (key, fallback = "") => barcodeConfig?.[key]?.valor ?? fallback;

  const findProductByScannedCode = (rawCode) => {
    const code = String(rawCode || "").trim();
    const mode = barcodeConfigValue("codigo_barras.modo_busqueda", "codigo_barras");

    return products.find((product) => {
      const barcode = String(product.barcode || "").trim();
      const internalCode = String(product.internalCode || "").trim();

      if (mode === "codigo_barras") return barcode && barcode === code;
      if (mode === "codigo_interno") return internalCode && internalCode === code;
      return (barcode && barcode === code) || (internalCode && internalCode === code);
    });
  };

  const handleSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;

    const code = searchQuery.trim();
    const enabled = barcodeConfigValue("codigo_barras.habilitado", true) !== false;
    const autoAdd = barcodeConfigValue("codigo_barras.agregar_automatico", true) !== false;
    const minLength = Number(barcodeConfigValue("codigo_barras.longitud_minima", 3)) || 3;

    if (!enabled || !autoAdd || code.length < minLength) return;

    const product = findProductByScannedCode(code);
    if (!product) {
      setScanMessage(`Código no encontrado: ${code}`);
      return;
    }

    event.preventDefault();
    addToCart(product);
    setSearchQuery("");
    setScanMessage(`${product.name} agregado por lector`);
  };

  const handleQuickScanKeyDown = (event) => {
    if (event.key !== "Enter") return;

    const code = quickScanCode.trim();
    const enabled = barcodeConfigValue("codigo_barras.habilitado", true) !== false;
    const minLength = Number(barcodeConfigValue("codigo_barras.longitud_minima", 3)) || 3;

    if (!enabled) {
      event.preventDefault();
      setScanMessage("La lectura de código de barras no está habilitada.");
      return;
    }

    if (code.length < minLength) return;

    const product = findProductByScannedCode(code);
    event.preventDefault();

    if (!product) {
      setScanMessage(`Código no encontrado: ${code}`);
      quickScanInputRef.current?.select();
      return;
    }

    addToCart(product);
    setQuickScanCode("");
    setScanMessage(`${product.name} agregado por lector`);
  };

  const handleCobrarSuccess = () => {
    setCart([]);
    refreshCajaActual();
    obtenerProximaFactura()
      .then(setNextInvoice)
      .catch(() => {});
  };

  const handleReadScale = async () => {
    const connectorUrl = scaleConfig?.["bascula.conector_url"]?.valor || "http://127.0.0.1:5123";
    return leerPesoBascula({ baseUrl: connectorUrl, scaleConfig });
  };

  const handleShowAllProducts = () => {
    setSelectedCategory("Todas");
    setSearchQuery("");
    setShowCategoryPanel(false);
  };

  const usuarioVenta = responsableSeleccionado
    ? { ...storedUser, ...responsableSeleccionado }
    : storedUser;

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (event.key === "F4") {
        event.preventDefault();
        quickScanInputRef.current?.focus();
        quickScanInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Mostrar pantalla de error si hay problemas de carga
  if (loadError) {
    const ErrorIcon = {
      network: WifiOff,
      server: Settings,
      auth: Users,
      unknown: AlertTriangle
    };

    const errorTitles = {
      network: 'Error de Conexión',
      server: 'Error del Servidor',
      auth: 'Sesión No Válida',
      unknown: 'Error Desconocido'
    };

    return (
      <div
        className={`flex h-screen w-full items-center justify-center transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            : "bg-[#edf3f1] text-slate-800"
        }`}
      >
        <div className={`max-w-md w-full mx-4 p-8 rounded-lg shadow-2xl ${
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
                : 'bg-slate-100 dark:bg-slate-950/30'
            }`}>
              {React.createElement(ErrorIcon[loadError.type] || ErrorIcon.unknown, {
                size: 38,
                className: loadError.type === 'network'
                  ? 'text-rose-700'
                  : loadError.type === 'auth'
                    ? 'text-amber-700'
                    : 'text-slate-700'
              })}
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
            <ul className={`list-disc space-y-1 pl-5 text-xs ${
              theme === "dark" ? "text-slate-400" : "text-slate-600"
            }`}>
              {loadError.type === 'network' && (
                <>
                  <li>Verifica tu conexión a internet</li>
                  <li>Asegúrate de que el servidor esté activo</li>
                  <li>Revisa la configuración de red</li>
                </>
              )}
              {loadError.type === 'server' && (
                <>
                  <li>El servidor puede estar temporalmente inactivo</li>
                  <li>Contacta al administrador del sistema</li>
                  <li>Verifica la configuración de la base de datos</li>
                </>
              )}
              {loadError.type === 'auth' && (
                <>
                  <li>Tu sesión puede haber expirado</li>
                  <li>Inicia sesión nuevamente</li>
                  <li>Contacta al administrador si el problema persiste</li>
                </>
              )}
              {loadError.type === 'unknown' && (
                <>
                  <li>Intenta recargar la página</li>
                  <li>Limpia la caché del navegador</li>
                  <li>Contacta al soporte técnico</li>
                </>
              )}
            </ul>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={loadInitialData}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900 transition shadow-md"
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
        className={`flex h-screen w-full items-center justify-center transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            : "bg-[radial-gradient(circle_at_18%_18%,rgba(122,143,106,0.20),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(49,87,213,0.14),transparent_32%),linear-gradient(135deg,#eef5ef,#fffdf8_54%,#edf3f1)] text-[#111827]"
        }`}
      >
        <div className={`flex flex-col items-center gap-6 rounded-lg border px-10 py-9 shadow-2xl backdrop-blur ${
          theme === "dark"
            ? "border-slate-700 bg-slate-900/78 shadow-black/30"
            : "border-white/80 bg-white/82 shadow-slate-900/12"
        }`}>
          {/* Logo/Icono de la app */}
          <div className={`flex items-center gap-3 mb-4 ${
            theme === "dark" ? "text-slate-100" : "text-[#111827]"
          }`}>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#233876,#3157d5_60%,#18a36b)] text-white font-black text-2xl shadow-lg shadow-[#3157d5]/25">
              MS
            </span>
            <div className="leading-tight">
              <div className="text-2xl font-black">MARKETSYS</div>
              <div className={`text-sm ${
                theme === "dark" ? "text-slate-300" : "text-[#233876]"
              } font-black uppercase tracking-wide`}>Sistema POS</div>
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
              className={`opacity-25 ${theme === "dark" ? "stroke-slate-600" : "stroke-[#c8d7ff]"}`}
            />
            <defs>
              <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#233876" />
                <stop offset="48%" stopColor="#3157d5" />
                <stop offset="100%" stopColor="#18a36b" />
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
            <div className="text-xl font-black text-[#000000]">
              Cargando datos del sistema...
            </div>
            <div className={`text-sm ${
              theme === "dark" ? "text-slate-300" : "text-[#47524e]"
            } font-bold`}>
              Configurando tu espacio de trabajo
            </div>
          </div>

          {/* Barra de progreso animada */}
          <div className={`w-64 h-1.5 rounded-full overflow-hidden ${
            theme === "dark" ? "bg-slate-800" : "bg-[#dbe6ff]"
          }`}>
            <div className="h-full animate-pulse rounded-full bg-[linear-gradient(90deg,#3157d5,#18a36b)]"
                 style={{ width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  const hasCashierPermission = (moduloId) => {
    if (!moduloId) return true;
    if (!permisosLoaded) return false;
    return userPermisos[moduloId] === true;
  };

  const openReportes = (tab = "resumen") => {
    setReportesInitialTab(tab);
    setShowReportesCajero(true);
  };

  const openInventario = (tab = "inventario") => {
    setInventarioInitialTab(tab);
    setShowInventario(true);
  };

  const openClientes = (tab = "directorio") => {
    setClientesInitialTab(tab);
    setShowClientes(true);
  };

  const toggleCashierModule = (title) => {
    setOpenCashierModules((current) => ({
      ...current,
      [title]: !current[title],
    }));
  };

  const cashierModules = [
    {
      title: "Facturación",
      icon: <FileText size={17} />,
      actions: [
        { label: "Histórico de facturas", action: () => setShowFacturas(true), moduloId: "consulta_facturas" },
        { label: "Facturas anuladas", action: () => setShowFacturas(true), moduloId: "consulta_facturas" },
        { label: "Responsables y filtros", action: () => setShowFacturas(true), moduloId: "consulta_facturas" },
      ],
    },
    {
      title: "Inventario",
      icon: <Boxes size={17} />,
      actions: [
        { label: "Inventario completo", action: () => openInventario("inventario"), moduloId: "consulta_productos" },
        { label: "Categorías", action: () => openInventario("categorias") },
        { label: "Validador de precios", action: () => openInventario("validador"), moduloId: "consulta_productos" },
      ],
    },
    {
      title: "Clientes",
      icon: <Users size={17} />,
      actions: [
        { label: "Gestión de clientes", action: () => openClientes("directorio"), moduloId: "clientes_cajero" },
        { label: "Crear cliente", action: () => openClientes("nuevo"), moduloId: "clientes_cajero" },
      ],
    },
    {
      title: "Reportes",
      icon: <BarChart3 size={17} />,
      actions: [
        { label: "Listado de cierres", action: () => openReportes("cierres") },
        { label: "Resumen diario", action: () => openReportes("resumen") },
        { label: "Ventas por categoría", action: () => openReportes("categorias") },
        { label: "Tickets productos/categorías", action: () => openReportes("tickets") },
      ],
    },
    {
      title: "Ajustes",
      icon: <Settings size={17} />,
      actions: [
        { label: "Perfil de cajero", action: () => setShowProfile(true) },
        { label: "Periféricos POS", disabled: true },
      ],
    },
  ].map((module) => ({
    ...module,
    actions: module.actions.filter((action) => hasCashierPermission(action.moduloId)),
  })).filter((module) => module.actions.length > 0);

  const cashierBoxActions = [
    {
      label: "Abrir caja",
      helper: "Inicio de turno",
      icon: <Box size={17} />,
      action: () => setShowAbrirCaja(true),
      moduloId: "abrir_caja",
      tone: "primary",
    },
    {
      label: "Cerrar caja",
      helper: "Fin de turno",
      icon: <Archive size={17} />,
      action: () => setShowCerrarCaja(true),
      moduloId: "cerrar_caja",
      tone: "danger",
    },
  ].filter((action) => hasCashierPermission(action.moduloId));

  return (
    <div
      className={`cashier-pos-screen flex h-screen w-full min-w-0 gap-0 overflow-hidden transition-colors duration-300 ${
        theme === "dark"
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
          : "bg-[linear-gradient(135deg,#f4f6ff,#eef2ff_48%,#f8f9ff)] text-[#3f4643]"
      }`}
    >
      {/* ===== Panel lateral estilo POS ===== */}
      {sidebarOpen && (
        <aside
          className={`flex w-[260px] shrink-0 flex-col overflow-hidden border-r shadow-sm ${
            theme === "dark"
              ? "bg-slate-950/90 border-slate-800"
              : "bg-[#f8f9ff] border-[#c7d2fe]"
          }`}
        >
        <div className="border-b border-[#c7d2fe] bg-[#eef2ff] p-3 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
          <div className="relative mb-3 flex h-20 items-center gap-3 overflow-hidden rounded-sm border border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#eef2ff_52%,#ffffff)] p-3 pr-12 shadow-sm">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-sm border border-white/80 bg-white shadow-sm">
              {businessLogo ? (
                <img
                  src={businessLogo}
                  alt="Logo del negocio"
                  className="h-full w-full object-contain p-1"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="text-sm font-black text-[#3157d5]">MS</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-black uppercase tracking-wide text-[#233876]">
                Panel cajero
              </div>
              <div className="truncate text-xs font-bold text-[#1f2926]">
                Sesión activa
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-2 top-2 grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876] shadow-sm transition hover:bg-[#e0e7ff]"
              title="Ocultar barra lateral"
            >
              <X size={17} />
            </button>
          </div>

          <button
            className="flex w-full items-center gap-2.5 rounded-sm border border-[#c7d2fe] bg-white p-3 text-left shadow-sm transition hover:border-[#3157d5] hover:bg-[#f4f6ff]"
            onClick={() => setShowProfile(!showProfile)}
            title="Ir al perfil"
          >
            {profilePhoto ? (
              <img src={profilePhoto} alt="Perfil" className="h-10 w-10 shrink-0 rounded-full border border-[#c7d2fe] object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-sm font-black text-white shadow-sm">
                MS
              </div>
            )}
            <div className="min-w-0">
              <div className="whitespace-normal text-[12px] font-black uppercase leading-tight text-[#111827]">
                MERKA FRUVER FLORENCIA
              </div>
              <div className="mt-1 truncate text-xs font-bold text-[#111827]">{cajero.nombre}</div>
              <div className="truncate text-xs font-semibold text-[#374151]">{cajero.rol || "Cajero"}</div>
            </div>
          </button>

          {cashierBoxActions.length > 0 && (
            <div className="mt-3 rounded-sm border border-[#c7d2fe] bg-white p-2 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-wide text-[#233876]">
                  Acciones de caja
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                    cajaActual
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {cajaStatusLoading ? "Verificando" : cajaActual ? `Abierta #${cajaActual.id_caja}` : "Cerrada"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cashierBoxActions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className={`min-w-0 rounded-sm border px-2 py-2 text-left shadow-sm transition ${
                      item.tone === "danger"
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "border-[#c7d2fe] bg-[#eef2ff] text-[#233876] hover:bg-[#e0e7ff]"
                    }`}
                  >
                    <span className={`flex items-center gap-1.5 text-xs font-black ${
                      item.tone === "danger" ? "text-[#7f1d1d]" : "text-[#233876]"
                    }`}>
                      <span className="[&_svg]:stroke-[2.7]">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className={`mt-1 block truncate text-[10px] font-bold ${
                      item.tone === "danger" ? "text-[#7f1d1d]" : "text-[#47524e]"
                    }`}>
                      {item.helper}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-[#233876] dark:text-slate-300">
            Módulos del cajero
          </div>
          <div className="space-y-3">
            {cashierModules.map((module) => (
              <section
                key={module.title}
                className={`overflow-hidden rounded-sm border shadow-sm ${
                  theme === "dark"
                    ? "border-slate-800 bg-slate-900"
                    : "border-[#dbe4ff] bg-white"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCashierModule(module.title)}
                  className="cashier-sidebar-module-button flex w-full items-center justify-between gap-2 border-b border-[#dbe4ff] bg-[linear-gradient(90deg,#eef2ff,#ffffff)] px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-[#111827] transition hover:bg-[#eef2ff]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-[#3157d5] [&_svg]:stroke-[2.7]">{module.icon}</span>
                    <span className="truncate text-[#233876]">{module.title}</span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[#3157d5] transition-transform ${
                      openCashierModules[module.title] ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openCashierModules[module.title] && (
                  <div className="space-y-1 p-1.5">
                    {module.actions.map((item) => (
                      <button
                        key={`${module.title}-${item.label}`}
                        onClick={() => {
                          if (item.disabled) return;
                          item.action?.();
                        }}
                        disabled={item.disabled}
                        className={`flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-xs font-black transition ${
                          item.disabled
                            ? "cursor-not-allowed bg-slate-50 text-slate-400"
                            : theme === "dark"
                            ? "text-slate-200 hover:bg-slate-800"
                            : "text-[#111827] hover:bg-[#eef2ff]"
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.disabled && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-400">
                            Próx.
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <div className={`border-t p-3 text-xs font-semibold ${theme === "dark" ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-600"}`}>
          Sesión activa
        </div>
        </aside>
      )}

      {/* ===== Panel Central ===== */}
      <main
        className={`flex min-w-[260px] flex-1 flex-col overflow-hidden border-r shadow-sm ${
          theme === "dark"
            ? "border-slate-800 bg-slate-950/80"
            : "border-[#c7d2fe] bg-white"
        }`}
      >
        <header
          className={`border-b ${
            theme === "dark"
              ? "border-slate-800 bg-slate-900/80"
              : "border-[#c7d2fe] bg-[linear-gradient(180deg,#ffffff,#f8f9ff)]"
          }`}
        >
          <div className="grid min-h-14 grid-cols-[minmax(112px,0.8fr)_minmax(150px,auto)_auto] items-center gap-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <button
                onClick={() => setSidebarOpen((open) => !open)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm border transition ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                    : "border-[#c7d2fe] bg-white text-[#3157d5] hover:bg-[#e0e7ff]"
                }`}
                title={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[10px] font-black uppercase tracking-wide text-[#000000] sm:text-[11px]">
                  MERKA FRUVER FLORENCIA
                </div>
                <h1 className="truncate text-xs font-black text-[#000000] sm:text-sm">
                  Facturación POS
                </h1>
              </div>
            </div>

            <button
              onClick={() => setShowCobrar(true)}
              disabled={cart.length === 0}
              className="cashier-submit-button flex w-full max-w-[230px] justify-self-center items-center justify-center gap-2 rounded-sm border border-[#c7d2fe] bg-[linear-gradient(180deg,#ffffff,#eef2ff)] px-2.5 py-2 text-base font-black uppercase tracking-wide text-[#111827] shadow-sm transition hover:border-[#3157d5] disabled:opacity-60 xl:max-w-[250px] xl:text-lg"
            >
              <ReceiptLikeIcon compact />
              <span>{cart.length > 0 ? `ENVIAR $ ${total.toLocaleString("es-CO")}` : "CONTINUAR 0,00"}</span>
            </button>

            <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-[#233876]">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${
                  isOnline
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
                title={isOnline ? "Con conexión a internet" : "Sin conexión a internet"}
              >
                {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                {isOnline ? "Online" : "Offline"}
              </span>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/";
                }}
                className="inline-flex items-center gap-1 rounded-sm border border-rose-200 bg-white px-2 py-1.5 text-rose-600 transition hover:bg-rose-50"
                title="Cerrar sesión"
              >
                <LogOut size={14} />
                Salir
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 border-y border-[#c7d2fe] bg-[linear-gradient(90deg,#233876,#3157d5_55%,#4f46e5)] px-3 py-1 text-xs font-black uppercase text-white shadow-sm">
            <button onClick={handleShowAllProducts} className="rounded-sm bg-white px-4 py-1 text-[#233876]">Todos</button>
            <button
              onClick={() => {
                setSearchQuery("");
                setShowCategoryPanel((open) => !open);
              }}
              className={`rounded-sm px-4 py-1 hover:bg-white/15 ${showCategoryPanel ? "bg-white/20" : ""}`}
            >
              Categorías
            </button>
            <button onClick={() => setShowFacturas(true)} className="rounded-sm border border-white/30 px-3 py-1 hover:bg-white/15">Ticket</button>
          </div>

          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="relative min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">
                Filtro por nombre o código
              </label>
              <Search className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 text-[#3157d5]" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar o escanear código"
                className={`w-full rounded-full border py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe] ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-950 text-white placeholder-slate-400"
                    : "border-[#c7d2fe] bg-white text-slate-800 placeholder-slate-400"
                }`}
              />
            </div>
            {scanMessage && (
              <div className={`rounded-sm border px-3 py-1.5 text-xs font-black ${
                scanMessage.includes("no encontrado")
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}>
                {scanMessage}
              </div>
            )}
          </div>
        </header>

        {/* Productos */}
        <section className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f5f1e8,#eef5ef_55%,#eef2ff)] p-2">
          {searchQuery && searchResults.length > 0 && (
            <div
              className="mb-2 rounded-sm border p-2 shadow-sm"
              style={{
                backgroundColor: "#fff8eb",
                borderColor: "#d7cbb5",
                color: "#111827",
              }}
            >
              <div className="mb-2 px-2 text-xs font-black uppercase tracking-wide text-[#3f4945]">
                Resultados rapidos
              </div>
              <div className="grid auto-rows-[64px] grid-cols-[repeat(auto-fill,minmax(260px,294px))] justify-start gap-2">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSearchSelect(product)}
                    className="grid h-16 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-sm border px-3 py-2 text-left text-sm transition hover:border-[#7a8f6a] hover:bg-[#f1f7eb] focus:border-[#7a8f6a] focus:bg-[#f1f7eb] focus:outline-none focus:ring-2 focus:ring-[#c9d9bb] active:bg-[#e8f4dc]"
                    style={{
                      backgroundColor: "#fffef8",
                      borderColor: "#d7cbb5",
                      color: "#111827",
                    }}
                  >
                    <span className="line-clamp-2 min-w-0 text-[13px] font-black leading-tight text-[#111827]">
                      {product.name}
                    </span>
                    <span className="w-[92px] shrink-0 text-right">
                      <span className="block truncate font-black text-[#111827]">${product.price.toLocaleString()}</span>
                      {(product.barcode || product.internalCode) && (
                        <span className="block truncate text-[10px] font-black text-[#4b5563]">{product.barcode || product.internalCode}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {normalizedSearch && searchResults.length === 0 && (
            <div className="rounded-sm border border-[#d7cbb5] bg-[#fff8eb] p-6 text-center shadow-sm">
              <Search size={32} className="mx-auto mb-2 text-[#3157d5]" />
              <p className="text-sm font-black text-[#111827]">No hay productos que coincidan</p>
              <p className="text-xs font-semibold text-[#47524e]">Revisa el nombre o el código ingresado.</p>
            </div>
          )}

          {showCategoryPanel && !normalizedSearch ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {categories.filter((cat) => normalizeText(cat.nombre) !== "todas").map((cat) => {
                const count = products.filter((product) => normalizeText(product.category) === normalizeText(cat.nombre)).length;
                return (
                  <button
                    key={cat.nombre}
                    onClick={() => {
                      setSelectedCategory(cat.nombre);
                      setShowCategoryPanel(false);
                    }}
                    className={`relative flex h-[154px] cursor-pointer flex-col overflow-hidden rounded-sm border text-center transition hover:-translate-y-0.5 ${
                      normalizeText(selectedCategory) === normalizeText(cat.nombre)
                        ? "border-[#3157d5] bg-[#eef2ff] shadow-md shadow-[#3157d5]/10"
                        : "border-[#b7c4ee] bg-[#fffdf8] shadow-sm hover:border-[#3157d5] hover:bg-[#f8fbf6]"
                    }`}
                    title={`Ver productos de ${cat.nombre}`}
                  >
                    <div className="border-b border-[#d5ddf8] bg-[linear-gradient(90deg,#e8f4ec,#eef2ff)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
                      Categoría
                    </div>
                    <div className="grid flex-1 place-items-center bg-[#fffdf8] px-3">
                      <div className="grid h-16 w-full place-items-center rounded-sm bg-[linear-gradient(135deg,#e8f4ec,#ffffff)]">
                        <Boxes size={34} className="text-[#3157d5]" strokeWidth={2.6} />
                      </div>
                    </div>
                    <div className="border-t border-[#e2e8ff] px-2 pb-2 pt-1.5">
                      <h3 className="truncate text-[12px] font-black uppercase leading-tight text-[#1f2926]">
                        {cat.nombre}
                      </h3>
                      <div className="mt-1 rounded-full border border-[#b7c4ee] bg-[#eef2ff] px-3 py-0.5 text-[11px] font-black text-[#111827] shadow-sm">
                        {count} productos
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !normalizedSearch ? (
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className={`relative flex h-[184px] cursor-pointer flex-col overflow-hidden rounded-sm border text-center transition hover:-translate-y-0.5 ${
                  theme === "dark"
                    ? "bg-slate-900 border border-slate-700 hover:bg-slate-900 hover:text-white"
                    : "border-[#b7c4ee] bg-[#fffdf8] shadow-sm hover:border-[#3157d5] hover:bg-[#f8fbf6] hover:shadow-md hover:shadow-[#3157d5]/10"
                }`}
              >
                <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-white px-1 text-sm font-black text-rose-600 shadow-sm">*</span>
                <div className="border-b border-[#d5ddf8] bg-[linear-gradient(90deg,#e8f4ec,#eef2ff)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
                  {product.category || "Producto"}
                </div>
                <div className="grid h-[76px] place-items-center bg-[#fffdf8] px-2 py-2">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-[68px] w-full rounded-sm object-cover"
                    />
                  ) : (
                    <div className="grid h-[68px] w-full place-items-center rounded-sm bg-[linear-gradient(135deg,#e8f4ec,#ffffff)] text-3xl">
                      {product.image}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between border-t border-[#e2e8ff] px-2 pb-2 pt-1.5">
                  <h3 className="line-clamp-2 min-h-[30px] text-[11px] font-black uppercase leading-tight text-[#1f2926]">{product.name}</h3>
                  <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-1">
                    <span className="rounded-full border border-[#b7c4ee] bg-[#eef2ff] px-3 py-0.5 text-[11px] font-black text-[#111827] shadow-sm">
                      {Number(product.stock).toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-right text-[12px] font-black text-[#1f2926]">
                      ${product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : null}
        </section>
      </main>

      {/* ===== Factura ===== */}
      <aside
        className={`flex ${sidebarOpen ? "w-[clamp(380px,44vw,700px)]" : "w-[clamp(430px,50vw,760px)]"} shrink-0 flex-col overflow-hidden border-l shadow-lg transition-[width,background-color,border-color] duration-200 ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-slate-200"
            : "border-[#c7d2fe] bg-[linear-gradient(180deg,#fffdf8,#f5f1e8_48%,#eef5ef)] text-[#303735]"
        }`}
      >
        <div
          className={`border-b px-3 py-2 ${
            theme === "dark"
              ? "border-slate-700 bg-slate-950 text-white"
              : "border-[#c7d2fe] bg-white text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <button className="rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] px-3 py-1.5 text-xs font-black text-white shadow-sm">
              &lt;&lt;
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-[#c7d2fe] bg-[linear-gradient(90deg,#eef2ff,#ffffff)] px-2 py-1.5 text-xs font-bold text-[#233876]">
              <span>Factura</span>
              <span className="truncate">{nextInvoice?.numero_factura || "Calculando..."}</span>
            </div>
            <span className="rounded-full bg-[#e0e7ff] px-2 py-1 text-[11px] font-black text-[#233876]">
              POS
            </span>
          </div>
        </div>

        <div className={`border-b p-2 ${theme === "dark" ? "border-slate-700 bg-slate-900" : "border-[#dbe4ff] bg-[#fffdf8]"}`}>
          <div className="mb-1.5 grid grid-cols-[1fr_auto] gap-1.5">
            <button
              onClick={() => setShowSelectorResponsable(true)}
              className="flex min-w-0 items-center gap-1.5 rounded-sm border border-[#c7d2fe] bg-white px-2 py-1.5 text-left text-xs font-black text-[#233876]"
            >
              <Users size={14} />
              <span className="truncate">
                {responsableSeleccionado?.nombre || cajero.nombre || "Seleccionar Responsable"}
              </span>
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-white shadow-sm">
              <ShoppingCart size={16} strokeWidth={2.6} />
            </button>
          </div>
          <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_112px] gap-1.5">
            <input
              ref={quickScanInputRef}
              value={quickScanCode}
              onChange={(event) => setQuickScanCode(event.target.value)}
              onKeyDown={handleQuickScanKeyDown}
              placeholder="Escanear producto"
              className="min-w-0 rounded-sm border border-[#c7d2fe] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] outline-none placeholder:text-[#5f6b66] focus:border-[#3157d5]"
            />
            <button
              onClick={() => setShowSelectorCliente(true)}
              className="rounded-sm border border-[#c7d2fe] bg-white px-2 py-1.5 text-[11px] font-black leading-tight text-[#233876]"
            >
              Cliente
            </button>
          </div>
          <div
            className={`flex min-h-[34px] items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 ${
              clienteSeleccionado
                ? "border-[#c7d2fe] bg-white"
                : "border-[#dbe4ff] bg-[#f8fbf7]"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Users size={15} className="shrink-0 text-[#3157d5]" />
              <span className="min-w-0">
                <span className="mr-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
                  Cliente:
                </span>
                <span className="text-xs font-black text-[#111827]">
                  {clienteSeleccionado?.nombre || "Consumidor final"}
                </span>
                {clienteSeleccionado?.identificacion && (
                  <span className="ml-2 text-[10px] font-bold text-[#47524e]">
                    {clienteSeleccionado.identificacion}
                  </span>
                )}
                {!clienteSeleccionado && (
                  <span className="ml-2 text-[10px] font-bold text-[#47524e]">
                    por defecto
                  </span>
                )}
              </span>
            </div>
            {clienteSeleccionado ? (
              <button
                type="button"
                onClick={() => setClienteSeleccionado(null)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-rose-200 bg-rose-50 text-[#7f1d1d] transition hover:bg-rose-100"
                title="Quitar cliente"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className={`grid grid-cols-[44px_minmax(0,1fr)_70px_92px_44px] items-center gap-2 border-b px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
            theme === "dark"
              ? "border-slate-700 bg-slate-800 text-slate-300"
              : "border-[#c7d2fe] bg-[#f4f6ff] text-[#233876]"
          }`}>
            <span></span>
            <span>Producto</span>
            <span className="text-center">Cant.</span>
            <span className="text-right">Total</span>
            <span></span>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
          {cart.length === 0 ? (
            <div className="mt-24 p-4 text-center text-[#111827]">
              <ShoppingCart
                size={42}
                className="mx-auto mb-3 text-[#3157d5]"
              />
              <p className="font-black text-[#111827]">Documento vacio</p>
              <p className="text-sm font-semibold text-[#111827]">
                Selecciona productos para agregar
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {cart.map((item) => {
                const lineTotalAmount = lineTotal(item);
                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-[44px_minmax(0,1fr)_70px_92px_32px] items-center gap-2 rounded-sm border px-2 py-1.5 text-xs ${
                      theme === "dark"
                        ? "bg-slate-800 border-slate-700"
                        : "border-[#d8dfef] bg-[#fffef8] shadow-sm"
                    }`}
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-[#b7c4ee] bg-[#eef2ff]">
                      <Search size={15} className="text-[#3157d5]" strokeWidth={2.8} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[11px] font-black uppercase leading-tight text-[#1f2926]">{item.name}</h3>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[9px] font-bold text-[#4b5551]">
                        <span className="truncate rounded-full bg-[#eef5ef] px-1.5 py-0.5">{item.category}</span>
                        <span className="shrink-0">${item.price.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      {item.is_weighed ? (
                        <button
                          onClick={() => openEditModal(item)}
                          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-1.5 py-1 text-[10px] font-black text-[#303735] transition hover:bg-[#eef2ff]"
                          title="Editar cantidad"
                        >
                          {Number(item.quantity).toLocaleString("es-CO", { maximumFractionDigits: 3 })}
                        </button>
                      ) : (
                        <div className="grid grid-cols-[18px_1fr_18px] items-center rounded-sm border border-[#d8dfef] bg-white">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="grid h-6 place-items-center text-slate-700 transition hover:bg-rose-100 hover:text-rose-600"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="min-w-0 px-1 text-center text-[11px] font-black text-[#303735]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="grid h-6 place-items-center text-slate-800 transition hover:bg-[#e0e7ff]"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-[#233876]">${lineTotalAmount.toLocaleString()}</div>
                      {itemDiscount(item) > 0 && (
                        <div className="text-[9px] font-black text-emerald-700">
                          -${itemDiscount(item).toLocaleString("es-CO")}
                        </div>
                      )}
                      <div className="text-[9px] font-bold text-[#6b7280]">{item.unit_abrev || "ud"}</div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700"
                      title="Eliminar producto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
                      </div>
        </div>

        <div
          className={`border-t p-1.5 ${
            theme === "dark"
              ? "border-slate-700 bg-slate-950"
              : "border-[#c7d2fe] bg-white"
          }`}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0 && !clienteSeleccionado}
              className="shrink-0 rounded-sm bg-[#d7d9d2] px-2.5 py-1.5 text-[11px] font-black text-[#303735] transition hover:bg-[#c9ccc4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setShowDiscountModal(true)}
              disabled={cart.length === 0}
              className="shrink-0 rounded-sm border border-[#c7d2fe] bg-[#eef2ff] px-2.5 py-1.5 text-[11px] font-black text-[#233876] transition hover:border-[#3157d5] hover:bg-[#e0e7ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Descuento
            </button>
            <input
            placeholder="Observaciones del documento"
              className="min-w-0 flex-1 rounded-sm border border-[#c7d2fe] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#000000] outline-none placeholder:text-[#69736f] focus:border-[#3157d5]"
            />
          </div>
          <div className="mb-1.5 rounded-sm border border-[#dbe4ff] bg-[#fffdf8] p-1.5">
            <div className="grid grid-cols-2 gap-1 text-[10px] sm:grid-cols-4">
              <CartSummaryChip label="Total bruto" value={`$${totalBruto.toLocaleString("es-CO")}`} />
              <CartSummaryChip label="Descuento" value={`$${totalDiscount.toLocaleString("es-CO")}`} />
              <CartSummaryChip label="Subtotal" value={`$${subtotalAfterDiscounts.toLocaleString("es-CO")}`} />
              <CartSummaryChip label="Total a pagar" value={`$${total.toLocaleString("es-CO")}`} strong />
            </div>
          </div>
          <button
            onClick={() => setShowCobrar(true)}
            className="w-full rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] py-2.5 text-sm font-black text-white shadow-md shadow-[#3157d5]/10 transition hover:bg-[#233876] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={cart.length === 0}
          >
            Facturar
          </button>
        </div>
      </aside>

      {/* ===== Menú de perfil del cajero ===== */}
      {showProfile && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`w-80 rounded-lg p-6 shadow-xl border ${theme === "dark" ? "bg-slate-900 text-white border-slate-700" : "bg-white border-slate-200"}`}
          >
            <div className="flex flex-col items-center gap-2">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Perfil" className="w-16 h-16 rounded-full object-cover border-4 border-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl text-white font-bold">
                  {cajero.nombre[0]}
                </div>
              )}
              <h3 className="text-lg font-semibold">{cajero.nombre}</h3>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{cajero.rol}</p>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{cajero.correo}</p>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  setShowProfile(false);
                  setShowPerfilCajera(true);
                }}
                className="w-full py-2 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition"
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
                className="w-full text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-gray-300 mt-3"
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
          scaleConfig={scaleConfig}
          onReadScale={handleReadScale}
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
            descuentoGlobalInicial={documentDiscountAmount}
            descuentoPorcentajeInicial={documentDiscountPercent}
            usuario={usuarioVenta}
            idCaja={idCajaAbierta}
            onClose={() => setShowCobrar(false)}
            onSuccess={handleCobrarSuccess}
          />
        </div>
      )}
      {showCerrarCaja && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <CerrarCaja
            ventas={{ efectivo: 200000, tarjeta: 150000, nequi: 50000 }}
            onClosed={handleCajaCerrada}
            onClose={() => {
              setShowCerrarCaja(false);
            }}
          />
        </div>
      )}
      <ConsultaFacturas open={showFacturas} onClose={() => setShowFacturas(false)} fechaInicial={fechaHoy} />
      <ConsultaProductos
        open={showInventario}
        onClose={() => setShowInventario(false)}
        initialTab={inventarioInitialTab}
        onProductsChanged={refreshProductsForSale}
      />
      <Clientes
        open={showClientes}
        onClose={() => setShowClientes(false)}
        initialTab={clientesInitialTab}
      />
      <ReportesCajero
        open={showReportesCajero}
        onClose={() => setShowReportesCajero(false)}
        initialTab={reportesInitialTab}
      />
      <AbrirCaja 
        open={showAbrirCaja} 
        onClose={() => setShowAbrirCaja(false)}
        onOpened={refreshCajaActual}
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
      {showSelectorResponsable && (
        <SelectorResponsable
          cajero={cajero}
          onClose={() => setShowSelectorResponsable(false)}
          onSelect={(responsable) => {
            setResponsableSeleccionado(responsable);
            setShowSelectorResponsable(false);
          }}
        />
      )}
      {showDiscountModal && (
        <DiscountModal
          cart={cart}
          documentDiscountPercent={documentDiscountPercent}
          onSetDocumentDiscount={setDocumentDiscountPercent}
          onSetProductDiscount={applyProductDiscount}
          onClose={() => setShowDiscountModal(false)}
        />
      )}
    </div>
  );
}

function CartSummaryChip({ label, value, strong = false }) {
  return (
    <div
      className="rounded-sm border px-2 py-1 shadow-sm"
      style={{
        backgroundColor: strong ? "#eef2ff" : "#ffffff",
        borderColor: strong ? "#b7c4ee" : "#0a0a0aff",
        color: "#111827",
      }}
    >
      <div className="text-[9px] font-black uppercase tracking-wide text-[#4b5551]">
        {label}
      </div>
      <div className={`truncate text-right ${strong ? "text-xs" : "text-[11px]"} font-black text-[#111827]`}>
        {value}
      </div>
    </div>
  );
}

function DiscountModal({
  cart,
  documentDiscountPercent,
  onSetDocumentDiscount,
  onSetProductDiscount,
  onClose,
}) {
  const [scope, setScope] = useState("documento");
  const [selectedProductId, setSelectedProductId] = useState(cart[0]?.id || "");
  const percentages = [0, 5, 10, 15, 20, 25];
  const selectedItem = cart.find((item) => String(item.id) === String(selectedProductId));

  const money = (value) =>
    Number(value || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const applyDiscount = (percent) => {
    if (scope === "documento") {
      onSetDocumentDiscount(percent);
      return;
    }
    if (selectedProductId) {
      onSetProductDiscount(selectedProductId, percent);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 px-3 py-4" onClick={onClose}>
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-md border border-[#c7d2fe] bg-[#f4f6ff] text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#ffffff_58%,#f8f9ff)] px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#3157d5]">Carrito</p>
            <h3 className="text-base font-black text-[#111827]">Aplicar descuento</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876] transition hover:bg-[#eef2ff]"
            title="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "documento", label: "Factura completa" },
              { id: "producto", label: "Producto" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setScope(option.id)}
                className="h-9 rounded-sm border text-xs font-black transition"
                style={{
                  backgroundColor: scope === option.id ? "#3157d5" : "#ffffff",
                  borderColor: scope === option.id ? "#3157d5" : "#c7d2fe",
                  color: scope === option.id ? "#ffffff" : "#233876",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {scope === "producto" && (
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">
                Producto del carrito
              </span>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="h-10 w-full rounded-sm border border-[#c7d2fe] bg-white px-3 text-xs font-black text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              >
                {cart.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {money(Number(item.price || 0) * Number(item.quantity || 0))}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="rounded-sm border border-[#dbe4ff] bg-white p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#233876]">
                Porcentaje
              </span>
              <span className="truncate text-[10px] font-black text-[#111827]">
                {scope === "documento"
                  ? `${documentDiscountPercent}% en factura`
                  : selectedItem
                    ? `${selectedItem.discountPercent || 0}% en ${selectedItem.name}`
                    : "Sin producto"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {percentages.map((percent) => {
                const active = scope === "documento"
                  ? Number(documentDiscountPercent) === percent
                  : Number(selectedItem?.discountPercent || 0) === percent;
                return (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => applyDiscount(percent)}
                    className="h-8 rounded-sm border text-[11px] font-black transition hover:brightness-105"
                    style={{
                      backgroundColor: active ? (scope === "documento" ? "#3157d5" : "#18a36b") : "#f8f9ff",
                      borderColor: active ? (scope === "documento" ? "#3157d5" : "#18a36b") : "#c7d2fe",
                      color: active ? "#ffffff" : "#233876",
                    }}
                  >
                    {percent === 0 ? "Sin desc." : `${percent}%`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-[#c7d2fe] bg-white p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] py-2 text-sm font-black text-white transition hover:brightness-105"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectorResponsable({ cajero, onClose, onSelect }) {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const theme = "light";

  useEffect(() => {
    listarPerfiles()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setUsuarios(list);
      })
      .catch(() => setUsuarios([]))
      .finally(() => setLoading(false));
  }, []);

  const baseCajero = {
    id: cajero.id,
    nombre: cajero.nombre,
    rol: cajero.rol || "Cajero",
    correo: cajero.correo,
  };

  const usuariosDisponibles = [
    baseCajero,
    ...usuarios
      .filter((u) => String(u.id || u.id_usuario) !== String(cajero.id))
      .map((u) => ({
        id: u.id || u.id_usuario,
        nombre: u.nombre || u.correo || "Usuario",
        rol: u.cargo || u.rol || "Usuario",
        correo: u.correo || u.email || "",
      })),
  ];

  const filtrados = usuariosDisponibles.filter((usuario) => {
    const texto = `${usuario.nombre} ${usuario.rol} ${usuario.correo}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`w-[460px] max-h-[620px] overflow-hidden rounded-sm border shadow-2xl ${
          theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : "border-[#c7d2fe] bg-white text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#c7d2fe] bg-[#eef2ff] p-4">
          <h3 className="text-base font-black text-[#233876]">Seleccionar responsable</h3>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Por defecto se usa la cajera de la sesión actual.
          </p>
          <label className="mt-3 block text-[10px] font-black uppercase tracking-wide text-[#233876]">
            Filtro por nombre responsable
          </label>
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="mt-1 w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm outline-none focus:border-[#3157d5]"
          />
        </div>

        <div className="max-h-[410px] space-y-2 overflow-y-auto p-3">
          {loading ? (
            <div className="py-8 text-center text-sm font-semibold text-slate-600">Cargando usuarios...</div>
          ) : (
            filtrados.map((usuario) => (
              <button
                key={usuario.id || usuario.correo || usuario.nombre}
                onClick={() => onSelect(usuario)}
                className="flex w-full items-center justify-between rounded-sm border border-[#dbe4ff] bg-white p-3 text-left transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-800">{usuario.nombre}</span>
                  <span className="block truncate text-xs font-semibold text-slate-600">{usuario.rol}</span>
                </span>
                {String(usuario.id) === String(cajero.id) && (
                  <span className="rounded-full bg-[#e0e7ff] px-2 py-1 text-[11px] font-black text-[#233876]">
                    Activa
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-[#c7d2fe] p-3">
          <button
            onClick={onClose}
            className="w-full rounded-sm bg-slate-200 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente Selector de Cliente
function SelectorCliente({ onClose, onSelect }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listarClientes()
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-md border border-[#c7d2fe] bg-[#f4f6ff] text-[#111827] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#ffffff_58%,#f8f9ff)] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-[#3157d5]">Carrito de compras</p>
              <h3 className="text-lg font-black text-[#111827]">Seleccionar cliente</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876] transition hover:bg-[#eef2ff]"
              title="Cerrar"
            >
              <X size={17} />
            </button>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-wide text-[#233876]">
            Filtro por nombre o identificacion cliente
            <span className="mt-1 flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 shadow-sm">
              <Search size={16} className="text-[#3157d5]" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm font-black normal-case text-[#111827] outline-none placeholder:text-[#64748b]"
              />
            </span>
          </label>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {loading ? (
            <div className="rounded-sm border border-dashed border-[#c7d2fe] bg-white py-8 text-center text-sm font-black text-[#111827]">
              Cargando clientes...
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="rounded-sm border border-dashed border-[#c7d2fe] bg-white py-8 text-center text-sm font-black text-[#111827]">
              No se encontraron clientes
            </div>
          ) : (
            clientesFiltrados.map(cliente => (
              <button
                key={cliente.id || cliente.id_cliente || cliente.identificacion}
                onClick={() => onSelect(cliente)}
                className="grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-[#dbe4ff] bg-white p-3 text-left shadow-sm transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-sm bg-[#e0e7ff] text-sm font-black uppercase text-[#3157d5]">
                  {(cliente.nombre || "C").slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#111827]">{cliente.nombre}</span>
                  <span className="block truncate text-xs font-bold text-[#4b5563]">
                    Documento: {cliente.identificacion || "Sin documento"}
                  </span>
                  {cliente.telefono && (
                    <span className="block truncate text-xs font-bold text-[#4b5563]">
                      Tel: {cliente.telefono}
                    </span>
                  )}
                </span>
                <span className="rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-2 py-1 text-[10px] font-black uppercase text-[#233876]">
                  Usar
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-[#c7d2fe] bg-white p-3">
          <button
            onClick={onClose}
            className="w-full rounded-sm border border-slate-200 bg-white py-2 text-sm font-black text-[#111827] transition hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
