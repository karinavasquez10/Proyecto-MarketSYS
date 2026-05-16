import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, User, Edit2, Save, Shield, Lock, Camera } from "lucide-react";
import { actualizarPerfil, obtenerPerfil } from "../../services/perfilesService";

const EMPTY_PROFILE = {
  nombre: "",
  correo: "",
  cargo: "",
  direccion: "",
  telefono: "",
  contrasena: "",
  genero: "",
  documento_identidad: "",
  fecha_nacimiento: "",
  foto_perfil: "",
  foto_url: "",
};

const normalizeProfile = (profile = {}) => ({
  ...EMPTY_PROFILE,
  ...profile,
  nombre: profile?.nombre || "",
  correo: profile?.correo || "",
  cargo: profile?.cargo || "",
  direccion: profile?.direccion || "",
  telefono: profile?.telefono || "",
  contrasena: "",
  genero: profile?.genero || "",
  documento_identidad: profile?.documento_identidad || "",
  fecha_nacimiento: profile?.fecha_nacimiento
    ? String(profile.fecha_nacimiento).slice(0, 10)
    : "",
  foto_perfil: profile?.foto_perfil || "",
  foto_url: profile?.foto_url || "",
});

export default function PerfilAdmin() {
  const [editing, setEditing] = useState(false);
  const [foto, setFoto] = useState("");
  const [datos, setDatos] = useState(EMPTY_PROFILE);
  const [imgVersion, setImgVersion] = useState(Date.now());
  const [notice, setNotice] = useState(null);

  const userId = (() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null")?.id;
    } catch {
      return null;
    }
  })();

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  })();

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";

  // Mantiene el control si ya se hizo fetch
  const fetchedProfile = useRef(false);

  // Función adaptada de fetchPhoto de HomeAdmin: carga todo el perfil + foto dinámica
  const fetchPerfil = async () => {
    if (fetchedProfile.current) return; // <--- Solo permite una carga inicial
    if (!userId) return;
    fetchedProfile.current = true;
    try {
      const data = await obtenerPerfil(userId);
      const perfilNormalizado = normalizeProfile(data);

      // Setear todos los datos del perfil
      setDatos(perfilNormalizado);

      // Siempre usar foto_url del backend (dinámica con versión), igual que HomeAdmin
      if (data?.foto_url) {
        setFoto(data.foto_url);
      } else if (data?.foto_perfil && cloudName) {
        const fallbackUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${data.foto_perfil}.jpg`;
        setFoto(fallbackUrl);
      } else {
        setFoto("");
      }

      // Actualizar localStorage, igual que HomeAdmin
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          ...storedUser,
          ...data, // Sobrescribe con datos completos del backend
          foto_url: data.foto_url,
          foto_perfil: data.foto_perfil,
        })
      );

      // Refresh version para cache-bust
      setImgVersion(Date.now());
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback a local si fetch falla, igual que HomeAdmin
      if (storedUser?.foto_url) {
        setFoto(storedUser.foto_url);
        setDatos(normalizeProfile(storedUser));
        setImgVersion(Date.now());
      }
    }
  };

  // Solo carga la imagen una vez al montar el componente, pero permite refresco via evento especial
  useEffect(() => {
    fetchedProfile.current = false; // Permite fetch inicial al cambiar userId/etc
    fetchPerfil();

    const handlePhotoUpdate = () => {
      // Solo al evento forzamos refetch sin problema, pero evitamos bucle
      fetchedProfile.current = false;
      fetchPerfil();
    };
    window.addEventListener("profilePhotoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("profilePhotoUpdated", handlePhotoUpdate);
    // Solo userId,cloudName como dep, NOT storedUser (prevendría dobles loads innecesarios)
  }, [userId, cloudName]);

  const handleChange = (e) =>
    setDatos({ ...datos, [e.target.name]: e.target.value });

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file); // Guardamos File real, no solo URL
    }
  };

  const handleGuardar = async () => {
    if (!userId) {
      setNotice({
        type: "error",
        title: "Usuario no identificado",
        message: "No se encontró el ID del usuario activo. Inicia sesión nuevamente.",
      });
      return;
    }

    const formData = new FormData();
    // Append todos los campos, igual que antes
    formData.append("nombre", datos.nombre || "");
    formData.append("correo", datos.correo || "");
    formData.append("rol", storedUser?.rol || "admin");
    formData.append("cargo", datos.cargo || "");
    formData.append("direccion", datos.direccion || "");
    formData.append("telefono", datos.telefono || "");
    if (datos.contrasena) formData.append("contrasena", datos.contrasena);
    if (datos.genero) formData.append("genero", datos.genero);
    if (datos.documento_identidad) formData.append("documento_identidad", datos.documento_identidad);
    if (datos.fecha_nacimiento) formData.append("fecha_nacimiento", datos.fecha_nacimiento);
    formData.append("estado", "1");

    if (foto instanceof File) {
      formData.append("foto", foto);
    }

    try {
      const result = await actualizarPerfil(userId, formData);

      if (result.message) {
        setNotice({
          type: "success",
          title: "Perfil actualizado",
          message: "Los cambios del perfil se guardaron correctamente.",
        });
        setEditing(false);

        // Actualizar localStorage inmediatamente
        const nuevoPublicId = result.foto || datos.foto_perfil;
        let nuevaFotoUrl = result.foto_url || datos.foto_url;
        if (!nuevaFotoUrl && nuevoPublicId) {
          nuevaFotoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${nuevoPublicId}.jpg`;
        }

        const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");
        localStorage.setItem(
          "authUser",
          JSON.stringify({
            ...authUser,
            foto_perfil: nuevoPublicId,
            foto_url: nuevaFotoUrl,
            nombre: datos.nombre,
            cargo: datos.cargo,
            // Agrega más campos si cambian
          })
        );

        // Emitir evento para actualizar otras vistas
        window.dispatchEvent(new Event("profilePhotoUpdated"));

        // El preview lo mantendrá fetchPerfil por el evento
        setFoto(foto instanceof File ? foto : nuevaFotoUrl);
        setImgVersion(Date.now());
      } else {
        throw new Error("Respuesta inválida del servidor");
      }
    } catch (err) {
      console.error("Error en handleGuardar:", err);
      setNotice({
        type: "error",
        title: "No se pudo actualizar el perfil",
        message: err.message || "Ocurrió un error inesperado al guardar los cambios.",
      });
    }
  };

  const generoOptions = ["femenino", "masculino", "otro"];

  // Determinar src para img (con cache-bust)
  const getImgSrc = () => {
    if (foto instanceof File) {
      return URL.createObjectURL(foto);
    } else if (foto) {
      return `${foto}?v=${imgVersion}`;
    }
    return null;
  };

  return (
    <div className="admin-module-page">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-gradient-to-r from-cyan-600 to-indigo-600 p-2.5 rounded-sm shadow-sm text-white">
          <User size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Perfil del Administrador
        </h1>
      </div>

      {/* ===== Tarjeta principal ===== */}
      <div className="bg-white/90 border border-cyan-100 rounded-sm shadow-sm p-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* FOTO */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {getImgSrc() ? (
                <img
                  src={getImgSrc()}
                  alt="Foto de perfil"
                  className="w-32 h-32 object-cover rounded-full border-4 border-cyan-200 shadow-sm"
                  key={imgVersion}
                  onLoad={() => null}
                  onError={e => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-32 h-32 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-cyan-200 ${getImgSrc() ? 'hidden' : ''}`}>
                {(datos?.nombre?.[0] || "A").toUpperCase()}
              </div>
              {editing && (
                <label className="absolute bottom-1 right-1 bg-cyan-500 text-white p-2 rounded-full shadow cursor-pointer hover:bg-cyan-700 transition">
                  <Camera size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFoto}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-800">
              {datos.nombre}
            </h2>
            <p className="text-sm text-slate-500">{datos.cargo}</p>
          </div>

          {/* Información del administrador */}
          <div className="md:col-span-2 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                <Shield size={18} className="text-cyan-600" />
                Datos personales
              </h2>

              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white px-4 py-2 rounded-md text-sm shadow-sm hover:brightness-110 transition"
                >
                  <Edit2 size={14} /> Editar
                </button>
              ) : (
                <button
                  onClick={handleGuardar}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-md text-sm shadow-sm hover:brightness-110 transition"
                >
                  <Save size={14} /> Guardar
                </button>
              )}
            </div>

            {/* Formulario */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="nombre"
                    value={datos.nombre || ""}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                    : "bg-slate-50 text-slate-600"
                    }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  name="cargo"
                    value={datos.cargo || ""}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                    : "bg-slate-50 text-slate-600"
                    }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  name="correo"
                    value={datos.correo || ""}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                    : "bg-slate-50 text-slate-600"
                    }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  name="telefono"
                    value={datos.telefono || ""}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                    : "bg-slate-50 text-slate-600"
                    }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Contraseña
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    name="contrasena"
                    value={datos.contrasena || ""}
                    disabled={!editing}
                    onChange={handleChange}
                    className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                      ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                      : "bg-slate-50 text-slate-600"
                      }`}
                  />
                  {editing && (
                    <button className="text-cyan-600 hover:text-cyan-700" type="button">
                      <Lock size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="direccion"
                    value={datos.direccion || ""}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                    : "bg-slate-50 text-slate-600"
                    }`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Género
                </label>
                <select
                  name="genero"
                  value={datos.genero !== undefined && datos.genero !== null ? datos.genero : ""}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-sm px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300"
                    : "bg-slate-50 text-slate-600"
                    }`}
                >
                  <option value="">Selecciona género</option>
                  {generoOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferencias */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-3">
                <Shield size={18} className="text-indigo-500" />
                Preferencias del sistema
              </h2>
              <p className="text-sm text-slate-500">
                Próximamente podrás cambiar tu tema, idioma o notificaciones desde
                aquí.
              </p>
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <ProfileNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function ProfileNotice({ type = "success", title, message, onClose }) {
  const success = type === "success";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  const iconClass = success
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : "border-rose-200 bg-rose-100 text-rose-700";
  const buttonClass = success
    ? "bg-[linear-gradient(135deg,#3157d5,#18a36b)]"
    : "bg-[#b91c1c]";

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${iconClass}`}>
            <Icon size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`mt-5 w-full rounded-sm px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 ${buttonClass}`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
