// LoginForm.jsx (actualizado - permite login a cualquier usuario activo y redirecciona acorde a rol devuelto desde auth.js)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Mapeo de rutas por roles, para adaptar fácilmente los nuevos roles/vistas
  const rutasPorRol = {
    "admin": { storageKey: "authUser", ruta: "/HomeAdmin" },
    "cajero": { storageKey: "user", ruta: "/Home" },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);
    try {
      // Petición al backend: /auth/login retorna user con el rol preciso desde MySQL
      const res = await api.post("/auth/login", { email, password });
      if (remember) {
        localStorage.setItem("last_email", email);
      }
      const user = res.data.user;
      const rol = (user?.rol || "").toLowerCase().trim();

      // Si existe token, lo guardamos localmente (por ejemplo para API protegidas)
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
      }

      // Buscar la ruta correspondiente según el rol
      if (rol && rutasPorRol[rol]) {
        // Guardamos los datos del usuario en el storage adecuado
        localStorage.setItem(rutasPorRol[rol].storageKey, JSON.stringify(user));
        navigate(rutasPorRol[rol].ruta);
      } else {
        // Para roles no mapeados, puedes mostrar un error o redirigir a un dashboard genérico
        setMensaje("❌ No se pudo determinar el rol del usuario o el acceso aún no está configurado para tu perfil.");
      }
    } catch (error) {
      // Captura errores de login del backend
      if (error.response?.status === 401) {
        setMensaje(error.response.data.error || "❌ Credenciales inválidas");
      } else {
        setMensaje("❌ Error en servidor. Intenta nuevamente.");
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const last = localStorage.getItem("last_email");
      if (last) setEmail(last);
    } catch (err) {
      console.log(err);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Panel izquierdo: Form */}
        <div className="p-7 sm:p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-orange-500 text-white font-bold grid place-items-center">
              IN
            </div>
            <div>
              <div className="font-semibold leading-tight">InventNet</div>
              <div className="text-xs text-slate-500 -mt-0.5">
                Controla tu negocio fácil
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa tus credenciales para continuar.
          </p>

          {mensaje && (
            <div
              className={`mt-5 text-sm rounded-lg px-3 py-2 border ${
                mensaje.startsWith("✅")
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {mensaje}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400"
                placeholder="ejemplo@correo.com"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute top-1/2 right-2 flex items-center justify-center text-slate-500 hover:text-slate-700 text-xs px-2 py-1 rounded-md hover:bg-slate-100"
                  style={{ transform: "translateY(-50%)" }}
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-orange-600"
                />
                Recordarme
              </label>
              <a
                href="/recuperar"
                className="text-sm text-orange-600 hover:text-orange-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 transition-colors shadow-sm"
            >
              {loading ? "Ingresando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-slate-500">
            Al continuar, aceptas nuestros{" "}
            <a href="/terminos" className="underline hover:text-slate-700">
              Términos
            </a>{" "}
            y{" "}
            <a href="/privacidad" className="underline hover:text-slate-700">
              Política de Privacidad
            </a>
            .
          </p>
        </div>

        {/* Panel derecho (ajustado, sin botón de registro) */}
        <div className="hidden md:block relative bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-500">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="h-full w-full text-white p-10 flex flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-extrabold drop-shadow-sm">
              Bienvenido a InventNet
            </h2>
            <p className="mt-3 max-w-sm text-white/90">
              Sistema integral de gestión de inventarios y ventas.
              <br />
              Acceso exclusivo para usuarios autorizados por el administrador.
            </p>

            {/* Nueva sección informativa */}
            <div className="mt-8 text-sm text-white/80 max-w-sm">
              Si necesitas acceso, contacta con el administrador del sistema
              o el área de soporte técnico.
            </div>

            <div className="mt-10 text-xs text-white/70">
              Soporte: lun–sáb 8:00am–6:00pm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;