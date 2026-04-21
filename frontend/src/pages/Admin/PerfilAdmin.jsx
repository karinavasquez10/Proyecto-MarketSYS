import React, { useState, useEffect, useRef } from "react";
import { User, Edit2, Save, Shield, Lock, Camera } from "lucide-react";

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

export default function PerfilAdmin() {
  const [editing, setEditing] = useState(false);
  const [foto, setFoto] = useState("");
  const [datos, setDatos] = useState({});
  const [imgVersion, setImgVersion] = useState(Date.now());

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
    if (!cloudName) {
      console.error("❌ VITE_CLOUDINARY_CLOUD_NAME no configurado en .env frontend");
      return;
    }
    fetchedProfile.current = true;
    try {
      const response = await fetch(`${API}/perfil/${userId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Setear todos los datos del perfil
      setDatos(data);

      // Siempre usar foto_url del backend (dinámica con versión), igual que HomeAdmin
      if (data?.foto_url) {
        setFoto(data.foto_url);
      } else if (data?.foto_perfil) {
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
        setDatos(storedUser);
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
      alert("❌ Error: No se encontró el ID de usuario");
      return;
    }

    const formData = new FormData();
    // Append todos los campos, igual que antes
    formData.append("nombre", datos.nombre || "");
    formData.append("correo", datos.correo || "");
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
      const res = await fetch(`${API}/perfil/${userId}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status}`);
      }

      const result = await res.json();

      if (result.message) {
        alert("✅ Perfil actualizado correctamente");
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
      console.error("❌ Error en handleGuardar:", err);
      alert(`❌ Error al actualizar perfil: ${err.message}`);
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-6 sm:px-22 py-10">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-2.5 rounded-lg shadow-md text-white">
          <User size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Perfil del Administrador
        </h1>
      </div>

      {/* ===== Tarjeta principal ===== */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* FOTO */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {getImgSrc() ? (
                <img
                  src={getImgSrc()}
                  alt="Foto de perfil"
                  className="w-32 h-32 object-cover rounded-full border-4 border-orange-200 shadow-md"
                  key={imgVersion}
                  onLoad={() => null}
                  onError={e => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-32 h-32 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-orange-200 ${getImgSrc() ? 'hidden' : ''}`}>
                {(datos?.nombre?.[0] || "A").toUpperCase()}
              </div>
              {editing && (
                <label className="absolute bottom-1 right-1 bg-orange-500 text-white p-2 rounded-full shadow cursor-pointer hover:bg-orange-600 transition">
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
                <Shield size={18} className="text-orange-500" />
                Datos personales
              </h2>

              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 rounded-md text-sm shadow-md hover:brightness-110 transition"
                >
                  <Edit2 size={14} /> Editar
                </button>
              ) : (
                <button
                  onClick={handleGuardar}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-md text-sm shadow-md hover:brightness-110 transition"
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
                  value={datos.nombre}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                  value={datos.cargo}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                  value={datos.correo}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                  value={datos.telefono}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                    value={datos.contrasena}
                    disabled={!editing}
                    onChange={handleChange}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                      ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                      : "bg-slate-50 text-slate-600"
                      }`}
                  />
                  {editing && (
                    <button className="text-orange-500 hover:text-orange-600" type="button">
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
                  value={datos.direccion}
                  disabled={!editing}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${editing
                    ? "focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                <Shield size={18} className="text-pink-500" />
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
    </div>
  );
}