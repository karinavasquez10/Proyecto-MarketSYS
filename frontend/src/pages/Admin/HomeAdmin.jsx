// src/pages/HomeAdmin.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  LogOut,
  Settings,
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle,
  X,
  Home,
  RefreshCw,
  Package,
  ShoppingCart,
  ClipboardList,
  Warehouse,
  Building2,
  Users,
  Truck,
  Trash2,
  Wallet,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { listarClientes } from "../../services/clientesService";
import { listarCompras } from "../../services/comprasService";
import { listarMermas, listarNotificacionesMermas } from "../../services/mermasService";
import { obtenerPerfil, listarPerfiles } from "../../services/perfilesService";
import { listarPermisosUsuario } from "../../services/permisosService";
import { listarProductos } from "../../services/productosService";
import { listarVentas, obtenerVenta } from "../../services/ventasService";
import { obtenerConfiguracionSistema } from "../../services/configService";

// Función utilitaria para obtener un valor numérico correcto del stock
// Normaliza - si es NaN, null, "", undefined o no es finito, retorna 0
function parseStock(value) {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? value.replace(/[^-0-9.,]/g, "").replace(/,/g, ".")
        : 0;
  const parsed = parseFloat(num);
  // limitamos a 2 decimales y solo si es finito
  if (!isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

const safeList = async (request, label) => {
  try {
    const data = await request();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`[HomeAdmin] Error al cargar ${label}:`, error);
    return [];
  }
};

// Spinner de carga importado de ListarPrecios.jsx
function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col flex-1 justify-center items-center min-h-[300px] w-full">
      <svg className="animate-spin h-11 w-11 text-cyan-500 mb-4 opacity-80" viewBox="0 0 45 45">
        <circle
          className="opacity-20"
          cx="22.5"
          cy="22.5"
          r="20"
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
        />
        <path
          d="M42.5,22.5a20,20 0 1,1-40,0"
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          className="opacity-70"
        />
      </svg>
      <span className="text-cyan-700 text-lg font-medium tracking-wide">{label}</span>
    </div>
  );
}

// FechaHoraActual: muestra la fecha y la hora, pero SOLO se renderiza a sí misma cada segundo, no el padre
function FechaHoraActual() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="hidden sm:flex flex-col items-end mr-4 text-right">
      <span className="text-xs text-slate-500">
        {currentTime.toLocaleDateString("es-CO", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </span>
      <span className="text-sm font-semibold text-slate-700">
        {currentTime.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </div>
  );
}

export default function HomeAdmin() {
  const [openMenu, setOpenMenu] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [businessLogo, setBusinessLogo] = useState("/ticket-logo.jpeg");
  const [showDropdown, setShowDropdown] = useState(false);
  const [userPermisos, setUserPermisos] = useState({});
  const [permisosLoaded, setPermisosLoaded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificaciones, setNotificaciones] = useState({
    mermas_automaticas: [],
    productos_por_cambiar: [],
    productos_stock_bajo: [],
    total_notificaciones: 0
  });
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  // (Removido el estado y useEffect para currentTime del padre)

  const handleLogout = () => {
    localStorage.removeItem("authUser");
    navigate("/LoginForm");
  };

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  }, []);

  const admin = useMemo(() => ({
    nombre: storedUser?.nombre || storedUser?.correo || "Admin",
    rol: storedUser?.cargo || storedUser?.rol || "Administrador",
    correo: storedUser?.correo || "",
    id: storedUser?.id,
  }), [storedUser]);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";

  useEffect(() => {
    const userId = admin.id;
    if (!userId) return;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
    if (!cloudName) {
      console.error("VITE_CLOUDINARY_CLOUD_NAME no configurado en .env frontend");
      setProfilePhoto(""); // Placeholder vacío
      return;
    }

    // Fallback inicial desde localStorage (prioridad a foto_url)
    if (storedUser?.foto_url) {
      setProfilePhoto(storedUser.foto_url);
    } else if (storedUser?.foto_perfil) {
      setProfilePhoto(
        storedUser.foto_perfil.startsWith("http")
          ? storedUser.foto_perfil
          : `https://res.cloudinary.com/${cloudName}/image/upload/${storedUser.foto_perfil}.jpg`
      );
    }

    // Fetch para versión actualizada
    const fetchPhoto = async () => {
      try {
        const data = await obtenerPerfil(userId);

        // Siempre usar foto_url del backend (dinámica con versión)
        if (data?.foto_url) {
          setProfilePhoto(data.foto_url);
        } else if (data?.foto_perfil) {
          setProfilePhoto(`https://res.cloudinary.com/${cloudName}/image/upload/${data.foto_perfil}.jpg`);
        } else {
          setProfilePhoto("");
        }

        // Actualizar localStorage
        localStorage.setItem(
          "authUser",
          JSON.stringify({
            ...storedUser,
            foto_url: data.foto_url,
            foto_perfil: data.foto_perfil
          })
        );
      } catch (error) {
        console.error("Error fetching profile photo:", error);
        // Fallback a local si fetch falla
        if (storedUser?.foto_url) setProfilePhoto(storedUser.foto_url);
      }
    };

    fetchPhoto();

    const handlePhotoUpdate = () => fetchPhoto();
    window.addEventListener("profilePhotoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("profilePhotoUpdated", handlePhotoUpdate);
  }, [admin.id, storedUser, cloudName]);

  useEffect(() => {
    let alive = true;
    obtenerConfiguracionSistema()
      .then((data) => {
        if (!alive) return;
        setBusinessLogo(
          data?.grupos?.empresa?.["empresa.logo_sidebar"]?.valor ||
          data?.grupos?.impresion?.["impresion.logo_ticket"]?.valor ||
          "/ticket-logo.jpeg"
        );
      })
      .catch(() => {
        if (alive) setBusinessLogo("/ticket-logo.jpeg");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Cargar permisos del usuario
  useEffect(() => {
    const loadPermisos = async () => {
      if (!admin.id) return;

      try {
        const data = await listarPermisosUsuario(admin.id);
        setUserPermisos(data);
      } catch (error) {
        console.error('[HomeAdmin] Error al cargar permisos:', error);
      } finally {
        setPermisosLoaded(true);
      }
    };

    loadPermisos();
  }, [admin.id]);

  // Cargar notificaciones de cambios automáticos y stock bajo
  useEffect(() => {
    const loadNotificaciones = async () => {
      try {
        const data = await listarNotificacionesMermas({ horas: 24 });
        setNotificaciones(data);

        // Cargar contador de no leídas desde localStorage
        const ultimaVista = localStorage.getItem('ultimaVistaNotificaciones');
        const totalActual = data.total_notificaciones;

        if (!ultimaVista) {
          // Primera vez, todas son no leídas
          setNotificacionesNoLeidas(totalActual);
        } else {
          const ultimaVistaNum = parseInt(ultimaVista, 10);
          // Si hay más notificaciones que la última vista, son nuevas
          const nuevas = Math.max(0, totalActual - ultimaVistaNum);
          setNotificacionesNoLeidas(nuevas);
        }
      } catch (error) {
        console.error('[HomeAdmin] Error al cargar notificaciones:', error);
      }
    };

    loadNotificaciones();
    // Recargar notificaciones cada 5 minutos
    const interval = setInterval(loadNotificaciones, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Marcar notificaciones como leídas cuando se abre el panel
  const handleAbrirNotificaciones = () => {
    setShowNotifications(true);
    // Guardar el total actual como "visto"
    localStorage.setItem('ultimaVistaNotificaciones', notificaciones.total_notificaciones.toString());
    // Resetear contador de no leídas
    setNotificacionesNoLeidas(0);
  };

  const menuItems = [
    {
      label: "Productos",
      icon: Package,
      children: [
        { name: "Gestión de Categorías", path: "GestionCategorias", moduloId: "gestion_categorias" },
        { name: "Gestión Mermas", path: "ProductosRecogidos", moduloId: "productos_recogidos" },
        { name: "Lista de Precios", path: "ListaPrecios", moduloId: "lista_precios" },
        { name: "Productos por Calibrar", path: "CalibrarProductos", moduloId: "calibrar_productos" },
        { name: "Registro de Productos", path: "RegistroProductos", moduloId: "registro_productos" },
      ],
    },
    {
      label: "Ingreso Compras",
      icon: ClipboardList,
      children: [
        { name: "Registrar compra", path: "IngresoCompras", moduloId: "registro_compras" },
      ],
    },
    {
      label: "Facturación",
      icon: ShoppingCart,
      children: [
        { name: "Historial de facturas", path: "ConsultarVentas", moduloId: "consultar_ventas" },
        { name: "Cierres de Caja", path: "CierresCaja", moduloId: "cierres_caja" },
        { name: "Venta manual sin caja", path: "RegistroVentas", moduloId: "registro_ventas" },
      ],
    },
    {
      label: "Inventario",
      icon: Warehouse,
      children: [
        { name: "Consulta Inventario", path: "ConsultaInventarioProductos", moduloId: "consulta_inventario" },
      ],
    },
    {
      label: "Finanzas",
      icon: Wallet,
      children: [
        { name: "Ingresos y Egresos", path: "Movimientos", moduloId: "movimientos" },
        { name: "Créditos", path: "Creditos", moduloId: "creditos" },
        { name: "Reportes", path: "Reportes", moduloId: "reportes" },
      ],
    },
    {
      label: "Gestión sedes",
      icon: Building2,
      children: [{ name: "Sucursales", path: "SedePrincipal", moduloId: "sede_principal" }],
    },
    {
      label: "Usuarios",
      icon: Users,
      children: [
        { name: "Crear Usuario", path: "CrearUsuario", moduloId: "crear_usuario" },
        { name: "Gestión usuarios", path: "BuscarUsuarios", moduloId: "buscar_usuarios" },
      ],
    },
    {
      label: "Clientes",
      icon: User,
      children: [
        { name: "Gestión de Clientes", path: "GestionClientes", moduloId: "gestion_clientes" },
      ],
    },
    {
      label: "Proveedores",
      icon: Truck,
      children: [{ name: "Gestión de Proveedores", path: "GestionProveedores", moduloId: "gestion_proveedores" }],
    },
    {
      label: "Papelera",
      icon: Trash2,
      children: [{ name: "Gestión de Papelera", path: "GestionPapelera", moduloId: "gestion_papelera" }],
    },
  ];

  const configItems = [
    { name: "Configuración del programa", path: "ConfiguracionSistema" },
    { name: "Permisos Usuarios", path: "UsuariosPermiso" },
    { name: "Auditoría", path: "Auditoria" },
  ];

  // Filtrar menú según permisos del usuario
  const filteredMenuItems = menuItems.map(category => ({
    ...category,
    children: category.children.filter(child => {
      // Si no hay moduloId, mostrar por defecto (para compatibilidad)
      if (!child.moduloId) return true;
      // Si no se han cargado los permisos aún, no mostrar nada
      if (!permisosLoaded) return false;
      // Mostrar solo si el usuario tiene permiso
      return userPermisos[child.moduloId] === true;
    })
  })).filter(category => category.children.length > 0); // Eliminar categorías vacías

  const isDashboard = location.pathname === "/HomeAdmin";

  return (
    <div className="flex min-h-screen w-full flex-row bg-[#f3f7fa] text-slate-800">
      {/* ===== Sidebar ===== */}
      <aside
        className="fixed inset-y-0 left-0 z-40 flex w-[260px] shrink-0 flex-col overflow-hidden border-r border-[#c7d2fe] bg-[#f8f9ff] shadow-sm"
      >
        <div className="border-b border-[#c7d2fe] bg-[#eef2ff] p-4 text-slate-800">
          <div className="mb-3 flex h-20 items-center gap-3 rounded-sm border border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#eef2ff_52%,#ffffff)] p-3 shadow-sm">
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
                Panel administrativo
              </div>
              <div className="truncate text-xs font-bold text-[#1f2926]">
                Gestión activa
              </div>
            </div>
          </div>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#3157d5] text-sm font-black text-white">
              MS
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-black leading-tight text-[#233876]">
                MARKETSYS
              </div>
              <div className="truncate text-xs font-semibold text-slate-600">
                Gestión central
              </div>
              <div className="truncate text-xs font-bold text-slate-500">
                {admin.rol}
              </div>
            </div>
          </div>

          <button
            className="flex w-full items-center gap-3 rounded-sm border border-[#c7d2fe] bg-white p-3 text-left transition hover:bg-[#eef2ff]"
            onClick={() => {
              setShowDropdown(false);
              navigate("PerfilAdmin");
            }}
            title="Ir al perfil"
          >
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Perfil"
                className="h-12 w-12 rounded-full border border-white/30 object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#3157d5] text-lg font-bold text-white">
                {admin.nombre[0]}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{admin.nombre}</div>
              <div className="truncate text-xs text-slate-500">{admin.rol}</div>
            </div>
          </button>
        </div>

        {/* Menú lateral */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="text-[11px] font-black uppercase tracking-wide text-[#233876]">
              Administración
            </span>
            <span className="rounded-sm border border-[#c7d2fe] bg-white px-2 py-0.5 text-[10px] font-black text-[#3157d5]">
              {filteredMenuItems.length}
            </span>
          </div>
          {filteredMenuItems.map((item, idx) => (
            <div key={idx} className="mb-2.5">
              <button
                onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
                className={`group flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition ${
                  openMenu === idx || item.children.some((child) => location.pathname.includes(child.path))
                    ? "border-[#3157d5] bg-[#eef2ff] text-[#233876] shadow-sm"
                    : "border-[#dbe4ff] bg-white text-slate-700 hover:border-[#3157d5] hover:bg-[#eef2ff]"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm border transition ${
                    openMenu === idx || item.children.some((child) => location.pathname.includes(child.path))
                      ? "border-[#3157d5] bg-[#3157d5] text-white"
                      : "border-[#c7d2fe] bg-[#f8f9ff] text-[#3157d5] group-hover:border-[#3157d5]"
                  }`}
                >
                  {React.createElement(item.icon || Package, { size: 17 })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{item.label}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    {item.children.length} pestaña{item.children.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876]">
                  {openMenu === idx ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
              </button>

              {openMenu === idx && item.children && (
                <div className="mt-2 space-y-1.5 rounded-sm border border-[#dbe4ff] bg-white p-2 shadow-sm">
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={`group/tab flex w-full items-center gap-2 rounded-sm border px-3 py-2 text-left text-[13px] font-bold transition ${
                        location.pathname.includes(child.path)
                          ? "border-[#3157d5] bg-[#e0e7ff] text-[#233876]"
                          : "border-[#eef2ff] bg-white text-slate-700 hover:border-[#c7d2fe] hover:bg-[#eef2ff] hover:text-[#233876]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          location.pathname.includes(child.path)
                            ? "bg-[#3157d5]"
                            : "bg-[#c7d2fe] group-hover/tab:bg-[#3157d5]"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate">{child.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Configuración adicional */}
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="mb-2 px-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
              Configuración
            </div>
            <div className="rounded-sm border border-[#dbe4ff] bg-white p-2 shadow-sm">
              <div className="mb-2 flex items-center gap-2 rounded-sm bg-[#eef2ff] px-2.5 py-2 text-sm font-black text-[#233876]">
                <span className="grid h-7 w-7 place-items-center rounded-sm bg-[#3157d5] text-white">
                  <Settings size={15} />
                </span>
                Sistema
              </div>
              <div className="space-y-1.5">
                {configItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group/tab flex items-center gap-2 rounded-sm border px-3 py-2 text-[13px] font-bold transition ${
                      location.pathname.includes(item.path)
                        ? "border-[#3157d5] bg-[#e0e7ff] text-[#233876]"
                        : "border-[#eef2ff] bg-white text-slate-700 hover:border-[#c7d2fe] hover:bg-[#eef2ff] hover:text-[#233876]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        location.pathname.includes(item.path)
                          ? "bg-[#3157d5]"
                          : "bg-[#c7d2fe] group-hover/tab:bg-[#3157d5]"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="border-t border-[#c7d2fe] bg-white p-3 text-xs font-semibold text-slate-500">
          <div className="flex items-center justify-between rounded-sm border border-[#dbe4ff] bg-[#f8f9ff] px-3 py-2">
            <span>MARKETSYS</span>
            <span className="text-[#3157d5]">Activo</span>
          </div>
        </div>
      </aside>

      {/* Contenedor principal “a la derecha del sidebar”, llenando el área restante */}
      <div className="relative ml-[260px] flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 left-0 z-20 w-full border-b border-[#c7d2fe] bg-[#f8f9ff] shadow-sm backdrop-blur">
          <div className="grid min-h-14 grid-cols-1 items-center gap-3 px-3 py-2 lg:grid-cols-[minmax(190px,1fr)_auto_minmax(360px,auto)] lg:px-5">
            <div
              className="flex min-w-0 cursor-pointer items-center gap-3 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 shadow-sm transition hover:border-[#3157d5]"
              onClick={() => setShowDropdown(true)}
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Perfil"
                  className="h-10 w-10 shrink-0 rounded-full border-2 border-[#c7d2fe] object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3157d5] text-sm font-bold text-white">
                  {admin.nombre[0]}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[10px] font-black uppercase tracking-wide text-[#3157d5]">
                  Administrador activo
                </div>
                <div className="truncate text-sm font-semibold text-slate-800">
                  {admin.nombre}
                </div>
                <div className="truncate text-xs text-slate-500">{admin.rol}</div>
              </div>
            </div>
            {/* Fecha y hora en tiempo real: solo lo refresca FechaHoraActual */}
            <FechaHoraActual />
            <div className="relative flex w-full flex-wrap items-center justify-start gap-2 text-xs font-bold text-[#233876] lg:justify-end">
              {/* Botón de notificaciones */}
              <div className="relative">
                <button
                  onClick={handleAbrirNotificaciones}
                  className="relative inline-flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-[#233876] shadow-sm transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
                  title="Notificaciones"
                >
                  <Bell size={16} />
                  Alertas
                  {notificacionesNoLeidas > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      {notificacionesNoLeidas}
                    </span>
                  )}
                </button>

                {/* Panel de notificaciones */}
                {showNotifications && (
                  <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overflow-x-hidden rounded-sm border border-slate-200 bg-white shadow-xl sm:w-96">
                    <div className="flex items-center justify-between bg-[#174c6f] px-4 py-3 text-white">
                      <div className="flex items-center gap-2">
                        <Bell size={18} />
                        <span className="font-semibold">Notificaciones del Sistema</span>
                      </div>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="rounded-sm p-1 text-white transition hover:bg-white/20"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Mermas automáticas */}
                    {notificaciones.mermas_automaticas && notificaciones.mermas_automaticas.length > 0 && (
                      <div className="border-b border-slate-200">
                        <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                          MERMAS AUTOMÁTICAS (24h)
                        </div>
                        {notificaciones.mermas_automaticas.map((item, idx) => (
                          <div key={idx} className="px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100">
                            <div className="flex items-start gap-2">
                              <div className="bg-red-100 p-1.5 rounded">
                                <AlertTriangle size={14} className="text-red-600" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">{item.producto}</div>
                                <div className="text-xs text-slate-600 mt-1">
                                  Pérdida: <span className="font-semibold text-red-600">-{item.cantidad}</span> unidades
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {new Date(item.fecha).toLocaleString('es-CO')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Productos por cambiar */}
                    {notificaciones.productos_por_cambiar && notificaciones.productos_por_cambiar.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                          PRÓXIMOS CAMBIOS
                        </div>
                        {notificaciones.productos_por_cambiar.map((item, idx) => (
                          <div key={idx} className="px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100">
                            <div className="flex items-start gap-2">
                              <div className="bg-amber-100 p-1.5 rounded">
                                <Clock size={14} className="text-amber-600" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">{item.producto}</div>
                                <div className="text-xs text-amber-600 mt-1 font-semibold">
                                  Cambiará en {item.dias_restantes} día(s)
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {item.cambia_estado && <span className="mr-2">🔴 Vencimiento</span>}
                                  {item.cambia_apariencia && <span>🔄 Transformación</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {notificaciones.productos_stock_bajo && notificaciones.productos_stock_bajo.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                          STOCK BAJO
                        </div>
                        {notificaciones.productos_stock_bajo.map((item, idx) => (
                          <div key={idx} className="px-4 py-3 hover:bg-slate-50 transition border-b">
                            <div className="flex items-start gap-2">
                              <div className="bg-amber-100 p-1.5 rounded">
                                <AlertTriangle size={14} className="text-amber-600" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">{item.producto}</div>
                                <div className="text-xs text-amber-600 mt-1 font-semibold">
                                  Stock: {item.stock_actual?.toFixed(1)} / {item.stock_minimo?.toFixed(1)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Nivel: {item.porcentaje}% del mínimo
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {notificaciones.total_notificaciones === 0 && (
                      <div className="px-4 py-8 text-center text-slate-400 text-sm">
                        <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                        <p>No hay cambios recientes</p>
                      </div>
                    )}

                    <div className="bg-slate-50 px-4 py-2 text-center">
                      <Link
                        to="ProductosRecogidos"
                        onClick={() => setShowNotifications(false)}
                        className="text-xs text-cyan-700 hover:text-cyan-900 font-medium"
                      >
                        Ver todas las mermas
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link
                to="/HomeAdmin"
                className="inline-flex items-center gap-2 rounded-sm border border-[#3157d5] bg-[#3157d5] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#233876]"
              >
                <Home size={16} />
                Home
              </Link>
              <button
                onClick={() => setRefreshTick((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-[#233876] shadow-sm transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="inline-flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-[#233876] shadow-sm transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
                >
                  <User size={16} /> Admin
                </button>
                {showDropdown && (
                  <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("PerfilAdmin");
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-cyan-50"
                    >
                      <User size={14} /> Perfil del administrador
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut size={14} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard o submódulos: full-height usando flex-1, rellena todo el espacio restante excepto el header. */}
        <section className="admin-panel-content flex h-[calc(100vh-4rem)] w-full flex-1 flex-col overflow-y-auto bg-transparent px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-7xl flex-1 space-y-6">
            {isDashboard ? <DashboardContent refreshTick={refreshTick} /> : <Outlet key={refreshTick} />}
          </div>
        </section>
      </div>
    </div>
  );
}

/* =========================================================
DASHBOARD CON DATOS REALES (ventas, productos, cajas, usuarios, proveedores, compras)
========================================================= */
function DashboardContent({ refreshTick = 0 }) {
  const [ventasMes, setVentasMes] = useState(0);
  const [, setNumVentas] = useState(0);
  const [ventasPorUsuario, setVentasPorUsuario] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [comprasMes, setComprasMes] = useState(0);
  const [mermasMes, setMermasMes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [numCajeros, setNumCajeros] = useState(0);
  const [, setCajerosActivosDetalle] = useState([]);
  const [gananciasNetas, setGananciasNetas] = useState(0);
  const [topProductos, setTopProductos] = useState([]);
  const [bottomProductos, setBottomProductos] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ===== Fetch paralelo para optimizar velocidad =====
        const [ventasData, productosData, clientesData, usuariosArray, compras, mermas] = await Promise.all([
          safeList(listarVentas, "ventas"),
          safeList(listarProductos, "productos"),
          safeList(listarClientes, "clientes"),
          safeList(listarPerfiles, "usuarios"),
          safeList(listarCompras, "compras"),
          safeList(listarMermas, "mermas")
        ]);

        // ===== Procesar Usuarios/Cajeros =====
        let cajerosActivos = [];
        cajerosActivos = Array.isArray(usuariosArray)
          ? usuariosArray.filter(
              (user) =>
                String(user.estado) === "1" &&
                (
                  (typeof user.rol === "string" && user.rol.toLowerCase().includes("cajero")) ||
                  (typeof user.cargo === "string" && user.cargo.toLowerCase().includes("cajero"))
                )
            )
          : [];
        setNumCajeros(cajerosActivos.length);
        setCajerosActivosDetalle(cajerosActivos);

        // ===== Procesar Ventas y Detalles de Ventas (optimizado) =====
        let ventas = [];
        let productStats = {};
        let ventasMesActual = []; // Declarar aquí para acceso global
        if (Array.isArray(ventasData)) {
          ventas = ventasData.filter((v) => (v.estado || "emitida") !== "anulada");
          const month = new Date().getMonth();
          const year = new Date().getFullYear();

          // Filtrar ventas del mes actual
          ventasMesActual = ventas.filter((v) => {
            const fecha = v.fecha || v.fecha_venta || v.created_at;
            if (!fecha) return false;
            const fechaObj = new Date(fecha);
            return fechaObj.getMonth() === month && fechaObj.getFullYear() === year;
          });

          const totalVentasMes = ventasMesActual.reduce(
            (acc, v) => acc + parseFloat(v.total || v.total_venta || 0),
            0
          );
          setVentasMes(totalVentasMes);
          setNumVentas(ventasMesActual.length);

          // Ventas por cajero (top 5)
          const activeCajerosNames = cajerosActivos.map(u => u.nombre);
          const agrupado = {};
          ventas.forEach((v) => {
            const u = v.nombre_usuario || v.usuario || "Sin usuario";
            if (activeCajerosNames.includes(u)) {
              if (!agrupado[u]) agrupado[u] = 0;
              agrupado[u] += parseFloat(v.total || v.total_venta || 0);
            }
          });

          const topCajeros = cajerosActivos
            .map(cajero => ({
              ...cajero,
              totalVentas: agrupado[cajero.nombre] || 0
            }))
            .sort((a, b) => b.totalVentas - a.totalVentas)
            .slice(0, 5);

          setVentasPorUsuario(topCajeros);

          // ===== Optimización: Procesar productos vendidos en paralelo batch =====
          // En lugar de hacer fetch individual, hacemos batch de 10 en 10
          const ventasConDetalles = await Promise.all(
            ventasMesActual.map(async (venta) => {
              try {
                const { detalles } = await obtenerVenta(venta.id_venta);
                return { venta, detalles };
              } catch {
                return null;
              }
            })
          );

          // Procesar estadísticas de productos
          ventasConDetalles.forEach(item => {
            if (!item || !Array.isArray(item.detalles)) return;

            item.detalles.forEach(detalle => {
              const id = detalle.id_producto;
              if (!productStats[id]) {
                productStats[id] = {
                  id,
                  name: detalle.nombre_producto,
                  qty: 0,
                  total: 0,
                  frequency: 0
                };
              }

              const cantidad = parseStock(detalle.cantidad);
              const precioUnit = parseStock(detalle.precio_unitario);
              productStats[id].qty += cantidad;
              productStats[id].total += precioUnit * cantidad;
              productStats[id].frequency++;
            });
          });

          // Top 10 productos más vendidos
          const productsArray = Object.values(productStats).map(stats => ({
            ...stats,
            score: (stats.total * 0.7) + (stats.frequency * stats.qty * 0.3)
          }));

          const topList = productsArray
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          setTopProductos(topList);

          // Bottom 10 productos menos vendidos (pero que se han vendido al menos 1 vez)
          const bottomList = productsArray
            .filter(p => p.qty > 0)
            .sort((a, b) => a.score - b.score)
            .slice(0, 10);

          setBottomProductos(bottomList);
        }

        // ===== Procesar Productos =====
        if (Array.isArray(productosData)) {
          const productosNormalizados = Array.isArray(productosData)
            ? productosData.map(prod => ({
                ...prod,
                stock_actual: parseStock(prod.stock_actual != null ? prod.stock_actual : prod.stock),
                stock: parseStock(prod.stock),
                stock_minimo: parseStock(prod.stock_minimo),
                precio_compra: parseStock(prod.precio_compra),
                precio_venta: parseStock(prod.precio_venta)
              }))
            : [];
          setProductos(productosNormalizados);
        }

        // ===== Procesar Clientes =====
        setClientes(Array.isArray(clientesData) ? clientesData : []);

        // ===== Procesar Compras del mes =====
        let comprasMesActual = []; // Declarar aquí para acceso global
        if (Array.isArray(compras)) {
          const month = new Date().getMonth();
          const year = new Date().getFullYear();

          comprasMesActual = compras.filter((c) => {
            const fecha = c.fecha_compra || c.fecha || c.created_at;
            if (!fecha) return false;
            const fechaObj = new Date(fecha);
            return fechaObj.getMonth() === month && fechaObj.getFullYear() === year;
          });

          const totalComprasMes = comprasMesActual.reduce(
            (acc, c) => acc + (parseFloat(c.total) || 0),
            0
          );
          setComprasMes(totalComprasMes);
        }

        // ===== Procesar Mermas del mes =====
        let mermasMesActual = [];
        if (Array.isArray(mermas)) {
          const month = new Date().getMonth();
          const year = new Date().getFullYear();

          mermasMesActual = mermas.filter((m) => {
            const fecha = m.fecha;
            if (!fecha) return false;
            const fechaObj = new Date(fecha);
            return fechaObj.getMonth() === month && fechaObj.getFullYear() === year;
          });

          // Calcular valor total de pérdidas: cantidad * precio_venta
          const totalMermasMes = mermasMesActual.reduce(
            (acc, m) => {
              const cantidad = parseFloat(m.cantidad) || 0;
              const precioVenta = parseFloat(m.precio_venta) || 0;
              return acc + (cantidad * precioVenta);
            },
            0
          );
          setMermasMes(totalMermasMes);
        }

        // ===== Calcular Ganancias Netas =====
        // Ganancias netas = Ingresos (Ventas) - Egresos (Compras + Mermas)
        const totalVentas = ventasMesActual.reduce(
          (acc, v) => acc + parseFloat(v.total || v.total_venta || 0),
          0
        );
        const totalCompras = comprasMesActual.reduce(
          (acc, c) => acc + (parseFloat(c.total) || 0),
          0
        );
        // Calcular total de mermas: cantidad * precio_venta
        const totalMermas = mermasMesActual.reduce(
          (acc, m) => {
            const cantidad = parseFloat(m.cantidad) || 0;
            const precioVenta = parseFloat(m.precio_venta) || 0;
            return acc + (cantidad * precioVenta);
          },
          0
        );
        const ganancias = totalVentas - (totalCompras + totalMermas);
        setGananciasNetas(ganancias);

      } catch (err) {
        console.error("Error al cargar dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshTick]);

  // KPIs calculations
  const totalStock = productos.reduce(
    (a, p) => a + (parseStock(p.stock_actual)),
    0
  );
  const ventasPct = Math.min(Math.round((ventasMes / 10000000) * 100), 100);
  const comprasPct = Math.min(Math.round((comprasMes / 5000000) * 100), 100);

  const stockSaludable = productos.length > 0
    ? Math.round(productos.filter(p => parseStock(p.stock_actual) > parseStock(p.stock_minimo)).length * 100 / productos.length)
    : 0;
  const productosStockOk = productos.filter(p => parseStock(p.stock_actual) > parseStock(p.stock_minimo)).length;

  return (
    <div className="flex min-h-[540px] w-full flex-1 flex-col justify-start gap-5">
      {loading ? (
        <Spinner label="Cargando datos del Dashboard..." />
      ) : (
        <>
          <section className="overflow-hidden rounded-sm border border-[#c7d2fe] bg-white shadow-sm">
            <div className="grid gap-4 border-b border-[#c7d2fe] bg-[#eef2ff] p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">
                  Resumen operativo
                </div>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  Dashboard Administrativo
                </h2>
                <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
                  Ventas, inventario, compras y rotación del mes actual.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <MiniMetric label="Cajeros" value={numCajeros} />
                <MiniMetric label="Productos" value={productos.length} />
                <MiniMetric label="Clientes" value={clientes.length} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                title="Ventas del mes"
                value={`$${ventasMes.toLocaleString()}`}
                subtitle={`${numCajeros} cajeros activos`}
                bar="bg-[#3157d5]"
                tone="blue"
              />
              <Kpi
                title="Stock total"
                value={totalStock.toLocaleString(undefined, {maximumFractionDigits: 2})}
                subtitle={`${productos.length} productos`}
                bar="bg-lime-500"
                tone="lime"
              />
              <Kpi
                title="Clientes"
                value={clientes.length}
                subtitle="registrados"
                bar="bg-indigo-500"
                tone="indigo"
              />
              <Kpi
                title="Compras del mes"
                value={`$${comprasMes.toLocaleString()}`}
                subtitle="en adquisiciones"
                bar="bg-amber-500"
                tone="amber"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card title="Análisis Financiero" subtitle="Ingresos, egresos y utilidad neta del periodo.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FinanceTile label="Ingresos" value={`$${ventasMes.toLocaleString()}`} helper="Ventas registradas" tone="cyan" />
                <FinanceTile label="Egresos" value={`$${comprasMes.toLocaleString()}`} helper="Compras del mes" tone="amber" />
                <FinanceTile label="Mermas" value={`$${mermasMes.toLocaleString()}`} helper={mermasMes > 0 ? "Pérdida de inventario" : "Sin pérdidas"} tone="red" />
                <FinanceTile label="Ganancia neta" value={`$${gananciasNetas.toLocaleString()}`} helper={gananciasNetas >= 0 ? "Rentable" : "Pérdida"} tone={gananciasNetas >= 0 ? "indigo" : "red"} />
              </div>
            </Card>

            <Card title="Indicadores" subtitle="Progreso contra metas operativas.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <ProgressDonut title="Ventas" value={ventasPct} label="Meta mensual" detail={`$${ventasMes.toLocaleString()}`} />
                <ProgressDonut title="Compras" value={comprasPct} label="Inversión" detail={`$${comprasMes.toLocaleString()}`} color="from-amber-500 to-lime-500" />
                <ProgressDonut title="Inventario" value={stockSaludable} label="Stock saludable" detail={`${productosStockOk} productos`} />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Ventas por usuario" subtitle="Top cajeros activos del mes.">
              <div className="grid gap-5 lg:grid-cols-[auto,minmax(0,1fr)]">
                <div className="flex justify-center">
                  <Pie
                    data={ventasPorUsuario.map((entry) => entry.totalVentas)}
                    labels={ventasPorUsuario.map((entry) => entry.nombre)}
                    size={220}
                  />
                </div>
                <div className="min-w-0">
                  <div className="mb-3 rounded-sm border border-[#c7d2fe] bg-[#eef2ff] p-3">
                    <div className="text-[11px] font-black uppercase text-[#3157d5]">Total del mes</div>
                    <div className="text-2xl font-black text-slate-950">${ventasMes.toLocaleString()}</div>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {ventasPorUsuario.map((cajero, index) => (
                      <li key={cajero.id || cajero.nombre} className="flex items-center gap-3 rounded-sm border border-slate-200 bg-white p-3">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black text-white ${
                          index === 0 ? "bg-[#3157d5]" :
                          index === 1 ? "bg-slate-600" :
                          index === 2 ? "bg-amber-600" :
                          "bg-slate-300 text-slate-700"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-slate-800">{cajero.nombre}</div>
                          <div className="truncate text-xs text-slate-400">
                            {ventasMes > 0 ? `${Math.round((cajero.totalVentas / ventasMes) * 100)}% del total` : "0% del total"}
                            {cajero.email || cajero.correo || cajero.usuario ? ` · ${cajero.email || cajero.correo || cajero.usuario}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-black text-[#3157d5]">
                          ${parseFloat(cajero.totalVentas || 0).toLocaleString()}
                        </div>
                      </li>
                    ))}
                    {ventasPorUsuario.length === 0 && (
                      <li className="rounded-sm border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                        No hay ventas registradas por cajeros activos este mes.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>

            <Card title="Top 10 productos más vendidos" subtitle="Productos con mejor desempeño por valor vendido.">
              <ProductRanking products={topProductos} empty="No hay productos vendidos este mes" tone="cyan" />
            </Card>
          </div>

          <Card title="Top 10 productos menos vendidos" subtitle="Productos con baja rotación para revisar inventario o promoción.">
            <ProductRanking products={bottomProductos} empty="No hay productos con baja rotación" tone="red" showStatus />
            <div className="mt-4 rounded-sm border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">
                Recomendación: los productos con baja rotación pueden requerir descuentos promocionales o revisión de inventario.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* =========================================================
HELPERS (sin cambios estructurales)
========================================================= */
function Card({ children, title, subtitle }) {
  return (
    <section className="overflow-hidden rounded-sm border border-[#c7d2fe] bg-white shadow-sm">
      {title && (
        <div className="border-b border-[#c7d2fe] bg-[#f8f9ff] p-4">
          <h3 className="font-black text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-right shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base font-black text-[#233876]">{value}</div>
    </div>
  );
}

function Kpi({ title, value, subtitle, bar, tone = "blue" }) {
  const toneClass = {
    blue: "bg-[#eef2ff] text-[#3157d5] border-[#c7d2fe]",
    lime: "bg-lime-50 text-lime-700 border-lime-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  }[tone] || "bg-[#eef2ff] text-[#3157d5] border-[#c7d2fe]";

  return (
    <div className="flex min-h-[126px] flex-col justify-between rounded-sm border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3157d5] hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 text-sm font-bold text-slate-500">{title}</div>
          <div className="text-2xl font-black tracking-tight text-slate-950">{value}</div>
        </div>
        <span className={`h-3 w-3 shrink-0 rounded-full border ${toneClass}`} />
      </div>
      {subtitle && (
        <div className="mt-2 text-xs font-semibold text-slate-400">{subtitle}</div>
      )}
      <div className="mt-4 h-1.5 rounded-full bg-slate-100">
        <div className={`h-full w-2/3 rounded-full ${bar}`} />
      </div>
    </div>
  );
}

function FinanceTile({ label, value, helper, tone = "cyan" }) {
  const tones = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return (
    <div className={`rounded-sm border p-4 ${tones[tone] || tones.cyan}`}>
      <div className="text-[11px] font-black uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>
    </div>
  );
}

function ProgressDonut({ title, value, label, detail, color }) {
  return (
    <div className="flex items-center gap-4 rounded-sm border border-slate-200 bg-white p-3">
      <Donut value={value} label={label} size={116} color={color} />
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-900">{title}</div>
        <div className="mt-1 text-lg font-black text-[#233876]">{detail}</div>
        <div className="text-xs font-semibold text-slate-500">{value}% completado</div>
      </div>
    </div>
  );
}

function ProductRanking({ products, empty, tone = "cyan", showStatus = false }) {
  const isRed = tone === "red";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto,minmax(0,1fr)]">
      <div className="flex justify-center">
        {products.length > 0 ? (
          <Pie
            data={products.map(p => p.total)}
            labels={products.map(p => p.name)}
            size={210}
          />
        ) : (
          <div className="grid h-48 w-full place-items-center rounded-sm border border-dashed border-slate-200 text-sm text-slate-400">
            Sin datos
          </div>
        )}
      </div>
      <div className="min-w-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className={`${isRed ? "bg-red-50" : "bg-[#eef2ff]"} text-slate-600`}>
            <tr>
              <Th>#</Th>
              <Th>Nombre</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="text-right">Total</Th>
              {showStatus && <Th className="text-center">Estado</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((r, i) => (
              <tr key={i} className={isRed ? "hover:bg-red-50" : "hover:bg-[#f8f9ff]"}>
                <Td className="font-black text-slate-500">{i + 1}</Td>
                <Td className="min-w-[170px] font-bold text-slate-800">{r.name}</Td>
                <Td className="text-right">
                  {parseStock(r.qty).toLocaleString(undefined, {maximumFractionDigits: 2})}
                </Td>
                <Td className={`text-right font-black ${isRed ? "text-red-600" : "text-[#3157d5]"}`}>
                  ${parseStock(r.total).toLocaleString(undefined, {maximumFractionDigits: 2})}
                </Td>
                {showStatus && (
                  <Td className="text-center">
                    <span className="inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      Baja rotación
                    </span>
                  </Td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <Td colSpan={showStatus ? 5 : 4} className="py-8 text-center text-slate-400">
                  {empty}
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Donut({ value = 75, size = 160, label = "", color = "from-cyan-600 to-indigo-500" }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  // Extraer colores del gradiente
  const gradientId = `grad-${label.replace(/\s/g, '-')}`;
  const colorStart = color.includes('from-') ? color.split('from-')[1].split(' ')[0] : 'cyan-600';
  const colorEnd = color.includes('to-') ? color.split('to-')[1].split(' ')[0] : 'indigo-500';

  // Mapeo de colores Tailwind a hex
  const colorMap = {
    'cyan-600': '#0891b2',
    'indigo-500': '#6366f1',
    'lime-500': '#84cc16',
    'emerald-600': '#059669',
    'teal-500': '#14b8a6',
    'cyan-500': '#06b6d4',
    'indigo-600': '#4f46e5',
    'amber-500': '#f59e0b',
    'cyan-700': '#0e7490',
    'green-400': '#4ade80',
    'lime-400': '#a3e635',
  };

  const startColor = colorMap[colorStart] || '#059669';
  const endColor = colorMap[colorEnd] || '#14b8a6';

  return (
    <svg width={size} height={size} className="drop-shadow-sm">
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90)"
        />
        <defs>
          <linearGradient id={gradientId} gradientTransform="rotate(90)">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
        <text
          x="0"
          y="-4"
          textAnchor="middle"
          className="fill-slate-800 text-xl font-bold"
        >
          {value}%
        </text>
        <text
          x="0"
          y="18"
          textAnchor="middle"
          className="fill-slate-500 text-xs"
        >
          {label}
        </text>
      </g>
    </svg>
  );
}

function Pie({ data = [], labels = [], size = 220 }) {
  const total = data.reduce((a, b) => a + b, 0);
  if (!total) {
    return (
      <div className="grid h-48 w-full place-items-center rounded-sm border border-dashed border-slate-200 text-sm font-semibold text-slate-400">
        Sin datos
      </div>
    );
  }
  const r = size / 2;
  let acc = 0;
  const colors = ["#0891b2", "#6366f1", "#84cc16", "#f59e0b", "#ef4444", "#14b8a6", "#64748b"];
  const parts = data.map((v, i) => {
    const start = (acc / total) * 2 * Math.PI;
    acc += v;
    const end = (acc / total) * 2 * Math.PI;
    const la = end - start > Math.PI ? 1 : 0;
    const x1 = r + r * Math.cos(start);
    const y1 = r + r * Math.sin(start);
    const x2 = r + r * Math.cos(end);
    const y2 = r + r * Math.sin(end);
    const d = `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} Z`;
    return <path key={i} d={d} fill={colors[i % colors.length]} opacity="0.9" />;
  });
  return (
    <div className="flex max-w-full flex-col items-center gap-3 sm:flex-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {parts}
      </svg>
      <ul className="max-w-[220px] space-y-1">
        {labels.map((l, i) => (
          <li key={`${l}-${i}`} className="truncate text-xs font-semibold text-slate-600" title={l}>
            <span
              className="inline-block w-3 h-3 rounded-sm mr-2 align-middle"
              style={{ background: colors[i % colors.length] }}
            />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left px-4 py-3 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
