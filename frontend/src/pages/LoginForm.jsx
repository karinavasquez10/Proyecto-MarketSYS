// LoginForm.jsx (actualizado - permite login a cualquier usuario activo y redirecciona acorde a rol devuelto desde auth.js)
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Store, UserRound } from "lucide-react";
import { cambiarContrasenaObligatoria, login } from "../services/authService";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [mensajeTipo, setMensajeTipo] = useState("error");
  const [loading, setLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  // Mapeo de rutas por roles, para adaptar fácilmente los nuevos roles/vistas
  const rutasPorRol = {
    "admin": { storageKey: "authUser", ruta: "/HomeAdmin" },
    "cajero": { storageKey: "user", ruta: "/Home" },
  };

  const showMessage = (text, type = "error") => {
    setMensaje(text);
    setMensajeTipo(type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);
    try {
      // Petición al backend: /auth/login retorna user con el rol preciso desde MySQL
      const data = await login({ email, password });
      if (remember) {
        localStorage.setItem("last_email", email);
      }
      const user = data.user;
      const rol = (user?.rol || "").toLowerCase().trim();

      // Si existe token, lo guardamos localmente (por ejemplo para API protegidas)
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      if (user?.debe_cambiar_contrasena) {
        setPendingLogin({ data, user, rol, passwordActual: password });
        showMessage("Debes crear una nueva contraseña antes de continuar.", "warning");
        setLoading(false);
        return;
      }

      // Buscar la ruta correspondiente según el rol
      if (rol && rutasPorRol[rol]) {
        // Guardamos los datos del usuario en el storage adecuado
        if (rol === "admin") localStorage.removeItem("user");
        if (rol === "cajero") localStorage.removeItem("authUser");
        localStorage.setItem(rutasPorRol[rol].storageKey, JSON.stringify(user));
        navigate(rutasPorRol[rol].ruta);
      } else {
        // Para roles no mapeados, puedes mostrar un error o redirigir a un dashboard genérico
        showMessage("No se pudo determinar el rol del usuario o el acceso aún no está configurado para tu perfil.");
      }
    } catch (error) {
      // Captura errores de login del backend
      if (error.status === 401) {
        showMessage(error.message || "Credenciales inválidas.");
      } else {
        showMessage("No se pudo conectar con el servidor. Intenta nuevamente.");
        console.error('Error en login:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (data, user, rol) => {
    if (rol && rutasPorRol[rol]) {
      if (rol === "admin") localStorage.removeItem("user");
      if (rol === "cajero") localStorage.removeItem("authUser");
      localStorage.setItem(rutasPorRol[rol].storageKey, JSON.stringify({
        ...user,
        debe_cambiar_contrasena: false,
      }));
      navigate(rutasPorRol[rol].ruta);
    } else {
      showMessage("No se pudo determinar el rol del usuario o el acceso aún no está configurado para tu perfil.");
    }
  };

  const handleForcedPasswordChange = async (event) => {
    event.preventDefault();
    setMensaje("");

    if (newPassword.length < 6) {
      showMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await cambiarContrasenaObligatoria({
        email: pendingLogin.user.email,
        password_actual: pendingLogin.passwordActual,
        nueva_contrasena: newPassword,
      });
      showMessage("Contraseña actualizada correctamente.", "success");
      completeLogin(pendingLogin.data, pendingLogin.user, pendingLogin.rol);
    } catch (error) {
      showMessage(error.message || "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const last = localStorage.getItem("last_email");
      if (last) setEmail(last);
    } catch {
      // Si el navegador bloquea localStorage, el login sigue funcionando sin correo recordado.
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef5ef] px-4 py-6 text-[#111827]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(122,143,106,0.28),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(49,87,213,0.18),transparent_30%),linear-gradient(135deg,rgba(35,56,118,0.52),rgba(238,245,239,0.72)_48%,rgba(255,253,248,0.95))]" />
      <div className="absolute inset-0 opacity-45" style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0 8%, rgba(255,255,255,.45) 8% 8.35%, transparent 8.35% 16%), linear-gradient(0deg, rgba(255,255,255,.38) 0 1px, transparent 1px 88px)",
        backgroundSize: "150px 100%, 100% 88px",
      }} />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,#fffdf8)]" />

      <main className="relative z-10 flex min-h-[calc(100vh-48px)] items-center justify-center">
        <div className="grid w-full max-w-[940px] overflow-hidden rounded-lg border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur md:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden min-h-[480px] overflow-hidden bg-[#233876] text-white md:block">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(35,56,118,.96),rgba(49,87,213,.88)_58%,rgba(122,143,106,.86))]" />
            <div className="absolute inset-0 opacity-25" style={{
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,.28) 0 1px, transparent 1px 42px)",
              backgroundSize: "42px 42px",
            }} />
            <div className="relative flex h-full flex-col items-center justify-between p-8 text-center">
              <div>
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-lg border border-white/35 bg-white text-[#233876] shadow-xl shadow-slate-950/20">
                  <Store size={42} strokeWidth={2.4} />
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-tight">MARKETSYS</h1>
                <p className="mx-auto mt-2 max-w-[260px] text-sm font-bold leading-6 text-white/90">
                  Sistema POS, inventario y administración para minimercados.
                </p>
              </div>

              <div className="w-full rounded-md border border-white/25 bg-white/12 p-4 text-left shadow-lg shadow-slate-950/10 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/80">Acceso por rol</p>
                <div className="mt-3 grid gap-2">
                  {["Cajero: facturación y caja", "Admin: productos y reportes", "Inventario: stock y movimientos"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-bold">
                      <ShieldCheck size={15} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[linear-gradient(180deg,#ffffff,#fffdf8)] px-6 py-7 sm:px-8">
            <div className="mx-auto max-w-md">
              <div className="mb-6 flex items-center justify-center gap-3 md:hidden">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#3157d5] text-white">
                  <Store size={22} />
                </span>
                <div>
                  <div className="text-lg font-black leading-tight text-[#111827]">MARKETSYS</div>
                  <div className="text-xs font-black uppercase text-[#233876]">MarketSYS POS</div>
                </div>
              </div>

              <div className="mb-5 flex items-center gap-3">
                <div className="hidden h-px flex-1 bg-slate-200 md:block" />
                <h2 className="text-center text-sm font-black italic text-[#303735]">Iniciar sesión</h2>
                <div className="hidden h-px flex-1 bg-slate-200 md:block" />
              </div>

              {mensaje && (
                <div className={`mb-4 rounded-sm border px-3 py-2 text-sm font-bold ${
                  mensajeTipo === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : mensajeTipo === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}>
                  {mensaje}
                </div>
              )}

              {pendingLogin ? (
                <form onSubmit={handleForcedPasswordChange} className="space-y-3">
                  <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    Estás usando una contraseña temporal. Crea una nueva para entrar al sistema.
                  </div>
                  <LoginInput icon={LockKeyhole} label="Nueva contraseña">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-transparent px-3 py-3 text-sm font-bold text-[#111827] outline-none placeholder:text-slate-400"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </LoginInput>
                  <LoginInput icon={LockKeyhole} label="Confirmar contraseña">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-transparent px-3 py-3 text-sm font-bold text-[#111827] outline-none placeholder:text-slate-400"
                      placeholder="Repite la nueva contraseña"
                    />
                  </LoginInput>
                  <button type="submit" disabled={loading} className="mt-2 w-full rounded-full bg-[linear-gradient(135deg,#3157d5,#233876)] py-3 text-sm font-black text-white shadow-lg shadow-[#3157d5]/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? "Actualizando..." : "Cambiar contraseña y entrar"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <LoginInput icon={UserRound} label="Usuario">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3 text-sm font-bold text-[#111827] outline-none placeholder:text-slate-400"
                      placeholder="Correo electrónico"
                    />
                  </LoginInput>

                  <LoginInput icon={LockKeyhole} label="Contraseña">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3 pr-10 text-sm font-bold text-[#111827] outline-none placeholder:text-slate-400"
                      placeholder="Contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="grid h-10 w-10 place-items-center text-slate-500 transition hover:text-[#233876]"
                      aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </LoginInput>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#59625f]">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="accent-[#3157d5]"
                      />
                      Recordarme
                    </label>
                    <Link to="/recuperar" className="text-xs font-bold text-[#3157d5] hover:underline">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <button type="submit" disabled={loading} className="mt-3 w-full rounded-full bg-[linear-gradient(135deg,#3157d5,#233876)] py-3 text-sm font-black text-white shadow-lg shadow-[#3157d5]/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? "Ingresando..." : "Iniciar sesión"}
                  </button>
                </form>
              )}

              <div className="mt-8 border-t border-[#dbe4ff] pt-5 text-sm text-[#4b5551]">
                <div className="mb-2 flex items-center gap-2 font-black italic text-[#303735]">
                  <Mail size={15} />
                  Datos de contacto
                </div>
                <p>Soporte: soporte@marketsys.local</p>
                <p>Horario: lunes a sábado, 8:00 a.m. a 6:00 p.m.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function LoginInput({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div className="flex items-center overflow-hidden rounded-sm border border-[#c7d2fe] bg-white shadow-sm transition focus-within:border-[#3157d5] focus-within:ring-2 focus-within:ring-[#c7d2fe]">
        <span className="grid h-12 w-12 shrink-0 place-items-center border-r border-[#dbe4ff] bg-[#eef2ff] text-[#233876]">
          <Icon size={17} strokeWidth={2.8} />
        </span>
        {children}
      </div>
    </label>
  );
}

export default LoginForm;
