import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck, Store } from "lucide-react";
import { solicitarRecuperacionContrasena } from "../services/authService";

export default function RecuperarContrasena() {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem("last_email");
      if (last) setEmail(last);
    } catch {
      // Si el navegador bloquea localStorage, la solicitud se puede hacer escribiendo el correo.
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setRespuesta("");
    setError("");

    if (!email.trim()) {
      setError("Ingresa el correo del usuario registrado.");
      return;
    }

    try {
      setLoading(true);
      const data = await solicitarRecuperacionContrasena({
        email: email.trim(),
        mensaje: mensaje.trim(),
      });
      setRespuesta(data.message || "Solicitud enviada correctamente.");
      setMensaje("");
    } catch (err) {
      setError(err.message || "No se pudo enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

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
        <div className="grid w-full max-w-[900px] overflow-hidden rounded-lg border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur md:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden min-h-[470px] overflow-hidden bg-[#233876] text-white md:block">
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
                <p className="mx-auto mt-2 max-w-[270px] text-sm font-bold leading-6 text-white/90">
                  Solicitud segura para recuperar el acceso sin entregar permisos directos.
                </p>
              </div>

              <div className="w-full rounded-md border border-white/25 bg-white/12 p-4 text-left shadow-lg shadow-slate-950/10 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/80">Flujo de recuperación</p>
                <div className="mt-3 grid gap-2 text-sm font-bold">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} />
                    El administrador revisa la solicitud.
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} />
                    Si aprueba, genera una clave temporal.
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} />
                    Al entrar, el usuario crea su nueva clave.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[linear-gradient(180deg,#ffffff,#fffdf8)] px-6 py-7 sm:px-8">
            <div className="mx-auto max-w-md">
              <Link
                to="/"
                className="mb-6 inline-flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-xs font-black text-[#152b73] shadow-sm transition hover:bg-[#eef4ff]"
              >
                <ArrowLeft size={15} />
                Volver al inicio de sesión
              </Link>

              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-wide text-[#3157d5]">Recuperar acceso</p>
                <h1 className="mt-1 text-2xl font-black text-[#111827]">Solicitar cambio de contraseña</h1>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#47524e]">
                  Escribe el correo del usuario. La solicitud llegará al administrador para que genere una contraseña temporal.
                </p>
              </div>

              {respuesta && (
                <div className="mb-4 flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  {respuesta}
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Correo registrado</span>
                  <div className="flex items-center overflow-hidden rounded-sm border border-[#c7d2fe] bg-white shadow-sm transition focus-within:border-[#3157d5] focus-within:ring-2 focus-within:ring-[#c7d2fe]">
                    <span className="grid h-12 w-12 shrink-0 place-items-center border-r border-[#dbe4ff] bg-[#eef2ff] text-[#233876]">
                      <Mail size={17} strokeWidth={2.8} />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3 text-sm font-bold text-[#111827] outline-none placeholder:text-slate-400"
                      placeholder="usuario@correo.com"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Mensaje opcional</span>
                  <textarea
                    value={mensaje}
                    onChange={(event) => setMensaje(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-sm border border-[#c7d2fe] bg-white px-3 py-3 text-sm font-bold text-[#111827] outline-none transition placeholder:text-slate-400 focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
                    placeholder="Ej: Soy Karina, no recuerdo mi clave para ingresar al cajero."
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#3157d5,#233876)] py-3 text-sm font-black text-white shadow-lg shadow-[#3157d5]/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={17} />
                  {loading ? "Enviando solicitud..." : "Enviar solicitud"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
