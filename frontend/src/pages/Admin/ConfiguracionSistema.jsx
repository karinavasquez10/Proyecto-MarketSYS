// src/pages/Admin/ConfiguracionSistema.jsx
import React, { useState, useEffect } from "react";
import {
  Settings,
  Palette,
  Users,
  ShieldCheck,
  Building2,
  Printer,
  Save,
  RefreshCcw,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../Admin/ThemeContext"; 
import { useNavigate } from "react-router-dom"; 

export default function ConfiguracionSistema() {
  const { theme, toggleTheme, setTheme } = useTheme(); // ✅ Acceso al contexto
  const [colorPrimario, setColorPrimario] = useState("emerald");
   const navigate = useNavigate();
  const [empresa, setEmpresa] = useState({
    
    nombre: "MERKA FRUVER FLORENCIA",
    nit: "900123456-7",
    direccion: "Cra 12 #7-45",
    telefono: "3214657756",
  });
  const [impresora, setImpresora] = useState("Predeterminada");

  // ✅ Mantener sincronizado el botón con el tema global
  const [temaOscuro, setTemaOscuro] = useState(theme === "dark");
  useEffect(() => setTemaOscuro(theme === "dark"), [theme]);

  // ✅ Cambiar tema global desde este módulo
  const handleCambiarTema = () => {
    toggleTheme();
    setTemaOscuro(!temaOscuro);
  };

    const handleGestionarPermisos = () => {
    navigate("/HomeAdmin/UsuariosPermiso");
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 px-6 sm:px-12 py-10 rounded-xl ${
        theme === "dark"
          ? "bg-slate-900 text-slate-100"
          : "bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-800"
      }`}
    >
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className={`p-2.5 rounded-lg shadow-md text-white ${
            theme === "dark"
              ? "bg-gradient-to-r from-fuchsia-600 to-orange-500"
              : "bg-gradient-to-r from-sky-500 to-indigo-500"
          }`}
        >
          <Settings size={22} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Configuración del Sistema
        </h1>
      </div>

      {/* ===== Secciones ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* === Apariencia y tema === */}
        <section
          className={`rounded-2xl shadow-md p-6 border transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-slate-700"
              : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Palette
              className={`${
                theme === "dark" ? "text-orange-400" : "text-sky-500"
              }`}
              size={20}
            />
            <h2 className="text-lg font-semibold">Apariencia y Tema</h2>
          </div>

          <div className="flex justify-between items-center mb-4">
            <p className="text-sm opacity-80">Tema del sistema</p>
            <button
              onClick={handleCambiarTema}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm text-white transition ${
                temaOscuro
                  ? "bg-slate-700 hover:bg-slate-800"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {temaOscuro ? (
                <>
                  <Moon size={16} /> Modo Oscuro
                </>
              ) : (
                <>
                  <Sun size={16} /> Modo Claro
                </>
              )}
            </button>
          </div>

          <div className="mb-6">
            <p className="text-sm opacity-80 mb-2">Color primario</p>
            <div className="flex gap-3">
              {["emerald", "sky", "violet", "amber", "rose"].map((color) => (
                <button
                  key={color}
                  onClick={() => setColorPrimario(color)}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    colorPrimario === color
                      ? theme === "dark"
                        ? "border-white"
                        : "border-slate-800"
                      : "border-transparent"
                  } bg-${color}-500`}
                ></button>
              ))}
            </div>
          </div>
        </section>

        {/* === Datos de la empresa === */}
        <section
          className={`rounded-2xl shadow-md p-6 border transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-slate-700"
              : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2
              className={`${
                theme === "dark" ? "text-emerald-400" : "text-emerald-500"
              }`}
              size={20}
            />
            <h2 className="text-lg font-semibold">Información de la Empresa</h2>
          </div>

          <div className="space-y-4 text-sm">
            {Object.entries(empresa).map(([key, value]) => (
              <div key={key}>
                <label className="block mb-1 capitalize opacity-80">
                  {key}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    setEmpresa({ ...empresa, [key]: e.target.value })
                  }
                  className={`w-full rounded-lg px-3 py-2 text-sm border transition focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-700 border-slate-600 focus:ring-orange-400 text-slate-100"
                      : "bg-white border-slate-200 focus:ring-emerald-200 text-slate-800"
                  }`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* === Usuarios y roles === */}
        <section
          className={`rounded-2xl shadow-md p-6 border transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-slate-700"
              : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Users
              className={`${
                theme === "dark" ? "text-indigo-400" : "text-indigo-500"
              }`}
              size={20}
            />
            <h2 className="text-lg font-semibold">Usuarios y Roles</h2>
          </div>

          <div className="text-sm space-y-3 opacity-90">
            <p>
              🔹 <span className="font-semibold">Administrador:</span> Acceso
              completo al sistema (Ventas, Productos, Configuración).
            </p>
            <p>
              🔹 <span className="font-semibold">Cajero:</span> Acceso al módulo
              de ventas y consulta de inventario.
            </p>
            <p>
              🔹 <span className="font-semibold">Auxiliar:</span> Solo lectura de
              reportes y carga de productos.
            </p>

      <button
      onClick={handleGestionarPermisos}
      className={`mt-3 px-4 py-2 rounded-lg text-sm shadow-sm text-white ${
        theme === "dark"
          ? "bg-indigo-600 hover:bg-indigo-700"
          : "bg-indigo-500 hover:bg-indigo-600"
      }`}
    >
      Gestionar Permisos
    </button>

          </div>
        </section>

        {/* === Facturación y POS === */}
        <section
          className={`rounded-2xl shadow-md p-6 border transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-slate-700"
              : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Printer
              className={`${
                theme === "dark" ? "text-amber-400" : "text-amber-500"
              }`}
              size={20}
            />
            <h2 className="text-lg font-semibold">
              Configuración de Facturación y POS
            </h2>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block mb-1">Moneda</label>
              <select
                className={`w-full rounded-lg px-3 py-2 border transition focus:ring-2 ${
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 focus:ring-amber-400 text-slate-100"
                    : "bg-white border-slate-200 focus:ring-amber-200 text-slate-800"
                }`}
              >
                <option>COP - Peso Colombiano</option>
                <option>USD - Dólar Estadounidense</option>
              </select>
            </div>

            <div>
              <label className="block mb-1">Impresora</label>
              <input
                type="text"
                value={impresora}
                onChange={(e) => setImpresora(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 text-sm border transition focus:ring-2 ${
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 focus:ring-amber-400 text-slate-100"
                    : "bg-white border-slate-200 focus:ring-amber-200 text-slate-800"
                }`}
              />
            </div>

            <div>
              <label className="block mb-1">Prefijo de Factura</label>
              <input
                type="text"
                placeholder="Ej: POS-001"
                className={`w-full rounded-lg px-3 py-2 text-sm border transition focus:ring-2 ${
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 focus:ring-amber-400 text-slate-100"
                    : "bg-white border-slate-200 focus:ring-amber-200 text-slate-800"
                }`}
              />
            </div>
          </div>
        </section>

        {/* === Seguridad y respaldo === */}
        <section
          className={`rounded-2xl shadow-md p-6 border transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-slate-700"
              : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck
              className={`${
                theme === "dark" ? "text-red-400" : "text-red-500"
              }`}
              size={20}
            />
            <h2 className="text-lg font-semibold">Seguridad y Respaldo</h2>
          </div>

          <div className="text-sm space-y-3 opacity-90">
            <p>🗝️ Control de acceso mediante roles y contraseñas seguras.</p>
            <p>📦 Copias automáticas de base de datos cada 24 horas.</p>
            <p>🔒 Bloqueo automático tras 5 minutos de inactividad.</p>

            <div className="flex gap-3 mt-4">
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm shadow-sm text-white ${
                  theme === "dark"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                <Save size={16} /> Guardar cambios
              </button>
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm shadow-sm text-white ${
                  theme === "dark"
                    ? "bg-slate-500 hover:bg-slate-600"
                    : "bg-slate-400 hover:bg-slate-500"
                }`}
              >
                <RefreshCcw size={16} /> Restaurar valores
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
