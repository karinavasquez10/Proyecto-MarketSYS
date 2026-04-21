// src/pages/HomeAdmin.jsx
import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { User, LogOut, Settings, Bell, AlertTriangle, Clock, CheckCircle } from "lucide-react";

// Variable de entorno con endpoint base - normalizamos y garantizamos el sufijo /api
const RAW_API_URL = import.meta.env.VITE_API_URL || "";
const API = (() => {
  try {
    let u = RAW_API_URL || "http://localhost:5000";
    u = u.replace(/\/+$/, ""); // quitar slash final
    if (!u.endsWith("/api")) u = u + "/api";
    return u;
  } catch {
    return "http://localhost:5000/api";
  }
})();

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

// Spinner de carga importado de ListarPrecios.jsx
function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col flex-1 justify-center items-center min-h-[300px] w-full">
      <svg className="animate-spin h-11 w-11 text-orange-400 mb-4 opacity-80" viewBox="0 0 45 45">
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
      <span className="text-orange-500 text-lg font-medium tracking-wide">{label}</span>
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
  const location = useLocation();
  const navigate = useNavigate();

  // (Removido el estado y useEffect para currentTime del padre)

  const handleLogout = () => {
    localStorage.removeItem("authUser");
    navigate("/LoginForm");
  };

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  })();

  const admin = {
    nombre: storedUser?.nombre || storedUser?.correo || "Admin",
    rol: storedUser?.cargo || storedUser?.rol || "Administrador",
    correo: storedUser?.correo || "",
    id: storedUser?.id,
  };

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";

  useEffect(() => {
    const userId = admin.id;
    if (!userId) return;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
    if (!cloudName) {
      console.error("❌ VITE_CLOUDINARY_CLOUD_NAME no configurado en .env frontend");
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
        const response = await fetch(`${API}/perfil/${userId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

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

  // Cargar permisos del usuario
  useEffect(() => {
    const loadPermisos = async () => {
      if (!admin.id) return;
      
      try {
        const response = await fetch(`${API}/permisos/${admin.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserPermisos(data);
          console.log('[HomeAdmin] Permisos cargados:', data);
        }
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
        const response = await fetch(`${API}/mermas/notificaciones?horas=24`);
        if (response.ok) {
          const data = await response.json();
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
      children: [
        { name: "Gestión de Categorías", path: "GestionCategorias", moduloId: "gestion_categorias" },
        { name: "Gestión Mermas", path: "ProductosRecogidos", moduloId: "productos_recogidos" },
        { name: "Compras", path: "RegistroCompras", moduloId: "registro_compras" },
        { name: "Lista de Precios", path: "ListaPrecios", moduloId: "lista_precios" },
        { name: "Productos por Calibrar", path: "CalibrarProductos", moduloId: "calibrar_productos" },
        { name: "Registro de Productos", path: "RegistroProductos", moduloId: "registro_productos" },
      ],
    },
    {
      label: "Ventas",
      children: [
        { name: "Consultar Ventas", path: "ConsultarVentas", moduloId: "consultar_ventas" },
        { name: "Cierres de Caja", path: "CierresCaja", moduloId: "cierres_caja" },
        { name: "Registro de Ventas", path: "RegistroVentas", moduloId: "registro_ventas" },
      ],
    },
    {
      label: "Bodegas",
      children: [
        { name: "Consulta Inventario", path: "ConsultaInventarioProductos", moduloId: "consulta_inventario" },
        { name: "Movimientos", path: "Movimientos", moduloId: "movimientos" },
      ],
    },
    {
      label: "Gestión sedes",
      children: [{ name: "Sucursales", path: "SedePrincipal", moduloId: "sede_principal" }],
    },
    {
      label: "Usuarios",
      children: [
        { name: "Crear Usuario", path: "CrearUsuario", moduloId: "crear_usuario" },
        { name: "Buscar Usuario", path: "BuscarUsuarios", moduloId: "buscar_usuarios" },
      ],
    },
    {
      label: "Clientes",
      children: [
        { name: "Gestión de Clientes", path: "GestionClientes", moduloId: "gestion_clientes" },
        { name: "Indicadores", path: "Indicadores", moduloId: "indicadores" },
      ],
    },
    {
      label: "Proveedores",
      children: [{ name: "Gestión de Proveedores", path: "GestionProveedores", moduloId: "gestion_proveedores" }],
    },
    {
      label: "Papelera",
      children: [{ name: "Gestión de Papelera", path: "GestionPapelera", moduloId: "gestion_papelera" }],
    },
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
    <div className="bg-gradient-to-br from-orange-50 via-white to-pink-50 text-slate-800 min-h-screen w-screen flex flex-row">
      {/* ===== Sidebar ===== */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 shadow-lg z-40 flex flex-col">
        <div className="h-16 flex items-center px-4 border-b">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white font-bold">
              IN
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-800">
                InventNet
              </div>
              <div className="text-[11px] text-slate-500">
                Panel Administrativo
              </div>
            </div>
          </div>
        </div>

        {/* Menú lateral */}
        <nav className="flex-1 overflow-y-auto p-3">
          {filteredMenuItems.map((item, idx) => (
            <div key={idx} className="mb-2">
              <button
                onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-slate-700 hover:bg-orange-50 transition ${
                  openMenu === idx ? "bg-orange-100" : ""
                }`}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs">{openMenu === idx ? "▲" : "▼"}</span>
              </button>

              {openMenu === idx && item.children && (
                <div className="ml-5 mt-1 space-y-1">
                  {item.children.map((child, cIdx) => (
                    <Link
                      key={cIdx}
                      to={child.path}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-orange-100 ${
                        location.pathname.includes(child.path)
                          ? "bg-orange-200 font-semibold text-slate-900"
                          : "text-slate-700"
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Configuración adicional */}
          <div className="mt-4 border-t border-slate-300 pt-3">
            <div className="flex items-center gap-2 px-3 text-orange-600 font-semibold text-sm mb-2">
              <Settings size={16} />
              Configuración
            </div>
            <Link
              to="ConfiguracionSistema"
              className="block ml-5 px-3 py-1.5 text-sm rounded bg-gradient-to-r from-orange-100 to-pink-100 hover:brightness-105 text-slate-700 font-medium"
            >
              Configuración del programa
            </Link>
            <Link
              to="UsuariosPermiso"
              className="block ml-5 px-3 py-1.5 text-sm rounded bg-gradient-to-r from-orange-100 to-pink-100 hover:brightness-105 text-slate-700 font-medium"
            >
              Permisos Usuarios
            </Link>
            <Link
              to="Auditoria"
              className="block ml-5 px-3 py-1.5 text-sm rounded bg-gradient-to-r from-orange-100 to-pink-100 hover:brightness-105 text-slate-700 font-medium"
            >
              Auditoría
            </Link>
          </div>
        </nav>
      </aside>

      {/* Contenedor principal “a la derecha del sidebar”, llenando el área restante */}
      <div className="flex flex-col flex-1 min-h-screen ml-64 relative">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur border-b sticky top-0 left-0 z-30 shadow-sm w-full">
          <div className="h-16 flex items-center justify-between px-6 w-full">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setShowDropdown(true)}
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Perfil"
                  className="w-10 h-10 rounded-full object-cover border-2 border-orange-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                  {admin.nombre[0]}
                </div>
              )}
              <div className="leading-tight hidden sm:block">
                <div className="text-sm font-semibold text-slate-800">
                  {admin.nombre}
                </div>
                <div className="text-xs text-slate-500">{admin.rol}</div>
              </div>
            </div>
            {/* Fecha y hora en tiempo real: solo lo refresca FechaHoraActual */}
            <FechaHoraActual />
            <div className="flex items-center gap-3 relative">
              {/* Botón de notificaciones */}
              <div className="relative">
                <button
                  onClick={handleAbrirNotificaciones}
                  className="relative text-white bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1.5 rounded text-sm shadow hover:brightness-110 flex items-center gap-2"
                >
                  <Bell size={16} />
                  {notificacionesNoLeidas > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      {notificacionesNoLeidas}
                    </span>
                  )}
                </button>
                
                {/* Panel de notificaciones */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50 max-h-[500px] overflow-y-auto">
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell size={18} />
                        <span className="font-semibold">Notificaciones del Sistema</span>
                      </div>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-white hover:bg-white/20 rounded p-1 transition"
                      >
                        ✕
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
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Ver todas las mermas →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              
              <Link
                to="/HomeAdmin"
                className="text-white bg-gradient-to-r from-orange-500 to-fuchsia-500 px-3 py-1.5 rounded text-sm shadow hover:brightness-110"
              >
                Home
              </Link>
              <button 
                onClick={() => window.location.reload()}
                className="text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded text-sm shadow"
              >
                Actualizar
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-sm hover:brightness-110"
                >
                  <User size={16} /> Admin
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("PerfilAdmin");
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-orange-50 w-full text-left"
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
        <section className="flex-1 flex flex-col w-full h-[calc(100vh-4rem)] px-8 py-10 bg-transparent overflow-y-auto">
          <div className="flex-1 w-full max-w-7xl mx-auto space-y-10">
            {isDashboard ? <DashboardContent /> : <Outlet />}
          </div>
        </section>
      </div>
    </div>
  );
}

/* =========================================================
DASHBOARD CON DATOS REALES (ventas, productos, cajas, usuarios, proveedores, compras)
========================================================= */
function DashboardContent() {
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
        const [ventasRes, productosRes, clientesRes, usuariosRes, comprasRes, mermasRes] = await Promise.all([
          fetch(`${API}/ventas`),
          fetch(`${API}/products/productos`),
          fetch(`${API}/clientes`),
          fetch(`${API}/perfil`),
          fetch(`${API}/compras`),
          fetch(`${API}/mermas`)
        ]);

        // ===== Procesar Usuarios/Cajeros =====
        let cajerosActivos = [];
        let usuariosArray = [];
        if (usuariosRes.ok) {
          usuariosArray = await usuariosRes.json();
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
        }

        // ===== Procesar Ventas y Detalles de Ventas (optimizado) =====
        let ventas = [];
        let productStats = {};
        let ventasMesActual = []; // Declarar aquí para acceso global
        if (ventasRes.ok) {
          ventas = await ventasRes.json();
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
                const detRes = await fetch(`${API}/ventas/${venta.id_venta}`);
                if (!detRes.ok) return null;
                const { detalles } = await detRes.json();
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
        if (productosRes.ok) {
          const productosData = await productosRes.json();
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
        if (clientesRes.ok) {
          const clientesData = await clientesRes.json();
          setClientes(Array.isArray(clientesData) ? clientesData : []);
        }

        // ===== Procesar Compras del mes =====
        let comprasMesActual = []; // Declarar aquí para acceso global
        if (comprasRes.ok) {
          const compras = await comprasRes.json();
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
        if (mermasRes.ok) {
          const mermas = await mermasRes.json();
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
  }, []);

  // KPIs calculations
  const totalStock = productos.reduce(
    (a, p) => a + (parseStock(p.stock_actual)),
    0
  );
  const ventasPct = Math.min(Math.round((ventasMes / 10000000) * 100), 100);
  const comprasPct = Math.min(Math.round((comprasMes / 5000000) * 100), 100);

  return (
    <div className="flex flex-col flex-1 min-h-[540px] w-full justify-start gap-10">
      {loading ? (
        <Spinner label="Cargando datos del Dashboard..." />
      ) : (
        <>
          {/* === KPIs === */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            <Kpi 
              title="Ventas del mes" 
              value={`$${ventasMes.toLocaleString()}`} 
              subtitle={`${numCajeros} Cajeros activos`}
              bar="from-orange-500 to-pink-500" 
            />
            <Kpi 
              title="Stock total" 
              value={totalStock.toLocaleString(undefined, {maximumFractionDigits: 2})} 
              subtitle={`${productos.length} productos`}
              bar="from-green-400 to-lime-400" 
            />
            <Kpi 
              title="Clientes" 
              value={clientes.length} 
              subtitle="registrados"
              bar="from-emerald-500 to-teal-500" 
            />
            <Kpi 
              title="Compras del mes" 
              value={`$${comprasMes.toLocaleString()}`} 
              subtitle="en adquisiciones"
              bar="from-amber-500 to-orange-500" 
            />
          </div>

          {/* === Gráficos principales === */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card title="Rendimiento de Ventas">
              <div className="flex flex-col items-center space-y-2">
                <Donut value={ventasPct} label="Meta mensual" />
                <div className="text-center">
                  <p className="mt-2 text-lg font-bold text-slate-700">
                    ${ventasMes.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    Total en ventas este mes
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Compras del Mes">
              <div className="flex flex-col items-center space-y-2">
                <Donut value={comprasPct} label="Inversión" color="from-amber-500 to-orange-600" />
                <div className="text-center">
                  <p className="mt-2 text-lg font-bold text-slate-700">
                    ${comprasMes.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    Total en compras este mes
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Inventario">
              <div className="flex flex-col items-center space-y-2">
                <Donut
                  value={productos.length > 0 ? 
                    Math.round(productos.filter(p => parseStock(p.stock_actual) > parseStock(p.stock_minimo)).length * 100 / productos.length) : 0
                  }
                  label="Stock saludable"
                />
                <div className="text-center">
                  <p className="mt-2 text-lg font-bold text-slate-700">
                    {productos.filter(p => parseStock(p.stock_actual) > parseStock(p.stock_minimo)).length} productos
                  </p>
                  <p className="text-xs text-slate-500">
                    con stock sobre el mínimo
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* === Ganancias y Pérdidas === */}
          <Card title="Análisis Financiero">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="text-xs text-green-600 font-semibold mb-2">INGRESOS (Ventas)</div>
                <div className="text-2xl font-bold text-green-700">${ventasMes.toLocaleString()}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <div className="text-xs text-orange-600 font-semibold mb-2">EGRESOS (Compras)</div>
                <div className="text-2xl font-bold text-orange-700">${comprasMes.toLocaleString()}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-lg border border-red-200">
                <div className="text-xs text-red-600 font-semibold mb-2">PÉRDIDAS (Mermas)</div>
                <div className="text-2xl font-bold text-red-700">${mermasMes.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {mermasMes > 0 ? 'Pérdida de inventario' : '✓ Sin pérdidas'}
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-600 font-semibold mb-2">GANANCIA NETA</div>
                <div className={`text-2xl font-bold ${gananciasNetas >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  ${gananciasNetas.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {gananciasNetas >= 0 ? '✓ Rentable' : '✗ Pérdida'}
                </div>
              </div>
            </div>
          </Card>

          {/* === Ventas por Usuario === */}
          <Card title="Ventas por usuario">
            <div className="flex flex-col lg:flex-row items-start justify-center gap-10 py-4">
              <div className="relative flex-shrink-0">
                <Pie
                  data={ventasPorUsuario.map((entry) => entry.totalVentas)}
                  labels={ventasPorUsuario.map((entry) => entry.nombre)}
                  size={260}
                />
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg border border-orange-200">
                  <div className="text-xs text-slate-500 mb-1">Total del mes</div>
                  <div className="text-2xl font-bold text-slate-700">
                    ${ventasMes.toLocaleString()}
                  </div>
                </div>
                <div className="mb-3 pb-2 border-b border-slate-200">
                  <div className="text-sm font-medium text-slate-400">
                    Top Cajeros Activos del Mes
                  </div>
                </div>
                <ul className="text-sm text-slate-600 space-y-3">
                  {ventasPorUsuario.map((cajero, index) => (
                    <li key={cajero.id || cajero.nombre} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                        index === 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
                        index === 2 ? 'bg-gradient-to-r from-amber-700 to-orange-800' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{cajero.nombre}</div>
                        <div className="text-xs text-slate-400">
                          {ventasMes > 0
                            ? `${Math.round((cajero.totalVentas / ventasMes) * 100)}% del total`
                            : "0% del total"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {cajero.email || cajero.correo || cajero.usuario || ""}
                        </div>
                      </div>
                      <div className="font-semibold text-orange-600">
                        ${parseFloat(cajero.totalVentas || 0).toLocaleString()}
                      </div>
                    </li>
                  ))}
                  {ventasPorUsuario.length === 0 && (
                    <li className="text-xs text-slate-400 text-center py-2">No hay ventas registradas por cajeros activos este mes.</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>

          {/* === Top Productos Más Vendidos === */}
          <Card title="Top 10 productos más vendidos">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="flex items-center justify-center">
                {topProductos.length > 0 ? (
                  <Pie 
                    data={topProductos.map(p => p.total)} 
                    labels={topProductos.map(p => p.name)} 
                    size={240} 
                  />
                ) : (
                  <div className="text-slate-400 text-sm">Sin datos</div>
                )}
              </div>
              <div className="lg:col-span-2">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-orange-50 text-slate-600">
                      <tr>
                        <Th>#</Th>
                        <Th>Nombre</Th>
                        <Th className="text-right">Cant</Th>
                        <Th className="text-right">Total</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {topProductos.map((r, i) => (
                        <tr key={i} className="hover:bg-orange-50">
                          <Td>{i + 1}</Td>
                          <Td>{r.name}</Td>
                          <Td className="text-right">
                            {parseStock(r.qty).toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </Td>
                          <Td className="text-right">
                            ${parseStock(r.total).toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </Td>
                        </tr>
                      ))}
                      {topProductos.length === 0 && (
                        <tr>
                          <Td colSpan={4} className="text-center text-slate-400 py-4">
                            No hay productos vendidos este mes
                          </Td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          {/* === Bottom 10 Productos Menos Vendidos === */}
          <Card title="Top 10 productos menos vendidos">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="flex items-center justify-center">
                {bottomProductos.length > 0 ? (
                  <Pie 
                    data={bottomProductos.map(p => p.total)} 
                    labels={bottomProductos.map(p => p.name)} 
                    size={240} 
                  />
                ) : (
                  <div className="text-slate-400 text-sm">Sin datos</div>
                )}
              </div>
              <div className="lg:col-span-2">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-red-50 text-slate-600">
                      <tr>
                        <Th className="whitespace-nowrap">#</Th>
                        <Th className="whitespace-nowrap">Nombre</Th>
                        <Th className="text-right whitespace-nowrap">Cantidad</Th>
                        <Th className="text-right whitespace-nowrap">Total</Th>
                        <Th className="text-right whitespace-nowrap">Frecuencia</Th>
                        <Th className="text-center whitespace-nowrap">Estado</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bottomProductos.map((r, i) => (
                        <tr key={i} className="hover:bg-red-50">
                          <Td className="whitespace-nowrap">{i + 1}</Td>
                          <Td className="font-medium min-w-[150px]">{r.name}</Td>
                          <Td className="text-right whitespace-nowrap">
                            {parseStock(r.qty).toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </Td>
                          <Td className="text-right text-red-600 font-semibold whitespace-nowrap">
                            ${parseStock(r.total).toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs whitespace-nowrap">
                              {r.frequency} {r.frequency === 1 ? 'venta' : 'ventas'}
                            </span>
                          </Td>
                          <Td className="text-center whitespace-nowrap">
                            <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold whitespace-nowrap">
                              ⚠️ Baja rotación
                            </span>
                          </Td>
                        </tr>
                      ))}
                      {bottomProductos.length === 0 && (
                        <tr>
                          <Td colSpan={6} className="text-center text-slate-400 py-4">
                            No hay productos con baja rotación
                          </Td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                💡 <strong>Recomendación:</strong> Productos con baja rotación pueden requerir descuentos promocionales o revisión de inventario.
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
function Card({ children, title }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200">
      {title && (
        <div className="p-5 border-b bg-gradient-to-r from-orange-50 to-pink-50">
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

function Kpi({ title, value, subtitle, bar }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between min-h-[110px]">
      <div className="text-slate-500 text-sm mb-2">{title}</div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
      )}
      <div className={`mt-4 h-2 rounded-full bg-gradient-to-r ${bar}`} />
    </div>
  );
}

function Donut({ value = 75, size = 160, label = "", color = "from-orange-500 to-pink-500" }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  
  // Extraer colores del gradiente
  const gradientId = `grad-${label.replace(/\s/g, '-')}`;
  const colorStart = color.includes('from-') ? color.split('from-')[1].split(' ')[0] : 'orange-500';
  const colorEnd = color.includes('to-') ? color.split('to-')[1].split(' ')[0] : 'pink-500';
  
  // Mapeo de colores Tailwind a hex
  const colorMap = {
    'orange-500': '#fb923c',
    'pink-500': '#ec4899',
    'amber-500': '#f59e0b',
    'orange-600': '#ea580c',
    'green-400': '#4ade80',
    'lime-400': '#a3e635',
  };
  
  const startColor = colorMap[colorStart] || '#fb923c';
  const endColor = colorMap[colorEnd] || '#ec4899';
  
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
  const r = size / 2;
  let acc = 0;
  const colors = [
    "#fb923c",
    "#ec4899",
    "#a855f7",
    "#f59e0b",
    "#f97316",
    "#f43f5e",
    "#e879f9",
  ];
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
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {parts}
      </svg>
      <ul className="space-y-1">
        {labels.map((l, i) => (
          <li key={l} className="text-xs text-slate-600">
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