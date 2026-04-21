import React, { useState, useEffect, useRef } from "react";
import { User, Edit2, Save, Camera, X } from "lucide-react";

/* ========= Hook de sincronización global ========= */
function useSystemTheme() {
  const [theme, setTheme] = useState(
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

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

/* ========= Componente principal ========= */
export default function PerfilCajera({ onClose }) {
  const theme = useSystemTheme();
  const [editing, setEditing] = useState(false);
  const [foto, setFoto] = useState("");
  const [datos, setDatos] = useState({});
  const [imgVersion, setImgVersion] = useState(Date.now());

  const userId = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")?.id;
    } catch {
      return null;
    }
  })();

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";

  // Mantiene el control si ya se hizo fetch
  const fetchedProfile = useRef(false);

  // Carga el perfil, siguiendo la lógica de PerfilAdmin.jsx para tomar la foto activa
  const fetchPerfil = async () => {
    if (fetchedProfile.current) return;
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

      setDatos(data);

      // Si backend da una URL absoluta, úsala, sino arma desde cloudinary
      if (data?.foto_url) {
        setFoto(data.foto_url);
      } else if (data?.foto_perfil) {
        setFoto(`https://res.cloudinary.com/${cloudName}/image/upload/${data.foto_perfil}.jpg`);
      } else {
        setFoto("");
      }

      // Actualiza localStorage igual que en admin para sincronía
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...storedUser,
          ...data, // Sobrescribe con datos del backend
          foto_url: data.foto_url,
          foto_perfil: data.foto_perfil,
        })
      );

      setImgVersion(Date.now());
    } catch (error) {
      console.error("Error fetching profile:", error);
      // fallback a localStorage si fetch falla, igual que admin
      if (storedUser?.foto_url) {
        setFoto(storedUser.foto_url);
        setDatos(storedUser);
        setImgVersion(Date.now());
      }
    }
  };

  // Carga inicial y escucha para actualización por eventos globales:
  useEffect(() => {
    fetchedProfile.current = false;
    fetchPerfil();

    const handlePhotoUpdate = () => {
      fetchedProfile.current = false;
      fetchPerfil();
    };
    window.addEventListener("profilePhotoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("profilePhotoUpdated", handlePhotoUpdate);
  // Solo userId y cloudName como deps
  }, [userId, cloudName]);

  const handleChange = (e) =>
    setDatos({ ...datos, [e.target.name]: e.target.value });

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) setFoto(file);
  };

  const handleGuardar = async () => {
    if (!userId) {
      alert("❌ Error: No se encontró el ID de usuario");
      return;
    }
    const formData = new FormData();
    Object.keys(datos).forEach((k) => formData.append(k, datos[k]));
    if (foto instanceof File) formData.append("foto", foto);

    const res = await fetch(`${API}/perfil/${userId}`, {
      method: "PUT",
      body: formData,
    });
    const result = await res.json();
    if (result.message || result.foto_url) {
      // Actualiza localStorage y el estado, igual que admin
      const nuevoPublicId = result.foto || datos.foto_perfil;
      let nuevaFotoUrl = result.foto_url || datos.foto_url;
      if (!nuevaFotoUrl && nuevoPublicId)
        nuevaFotoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${nuevoPublicId}.jpg`;

      const prevUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...prevUser,
          foto_perfil: nuevoPublicId,
          foto_url: nuevaFotoUrl,
          nombre: datos.nombre,
          cargo: datos.cargo,
        })
      );

      // Emite evento para refrescar en otras pestañas/vistas
      window.dispatchEvent(new Event("profilePhotoUpdated"));

      // El preview lo mantendrá fetchPerfil por el evento
      setFoto(foto instanceof File ? foto : nuevaFotoUrl);
      setImgVersion(Date.now());
      setEditing(false);
      alert("✅ Perfil actualizado correctamente");
    }
  };

  const generoOptions = ["femenino", "masculino", "otro"];

  // Igual que admin: determina src de la imagen respetando versiones (para forzar recarga visual)
  const getImgSrc = () => {
    if (foto instanceof File) {
      return URL.createObjectURL(foto);
    } else if (foto) {
      return `${foto}?v=${imgVersion}`;
    }
    return null;
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border transition-all duration-300 overflow-hidden
          ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-slate-100"
              : "bg-white border-orange-100 text-slate-800"
          }`}
      >
        {/* Header */}
        <div
          className={`flex justify-between items-center border-b px-6 py-3 ${
            theme === "dark"
              ? "border-slate-700 text-slate-200"
              : "border-orange-100 text-slate-700"
          }`}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User size={18} /> Perfil de Cajera
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-rose-500 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* FOTO */}
          <div className="flex flex-col items-center">
            <div className="relative">
              {getImgSrc() ? (
                <img
                  src={getImgSrc()}
                  alt="Perfil"
                  className="w-28 h-28 rounded-full object-cover border-4 border-orange-200 dark:border-slate-600"
                  key={imgVersion}
                  onLoad={() => null}
                  onError={e => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-orange-200 dark:border-slate-600">
                  {(datos?.nombre?.[0] || "U").toUpperCase()}
                </div>
              )}
              {editing && (
                <label className="absolute bottom-1 right-1 bg-orange-500 text-white p-2 rounded-full cursor-pointer hover:brightness-110">
                  <Camera size={14} />
                  <input type="file" className="hidden" onChange={handleFoto} />
                </label>
              )}
            </div>
          </div>

          {/* DATOS */}
          <div className="md:col-span-2 space-y-3">
            {["nombre", "correo", "telefono", "direccion", "cargo"].map(
              (campo) => (
                <input
                  key={campo}
                  type={campo === "correo" ? "email" : "text"}
                  name={campo}
                  value={datos[campo] || ""}
                  disabled={campo === "correo" || campo === "cargo" ? true : !editing}
                  onChange={handleChange}
                  placeholder={
                    campo.charAt(0).toUpperCase() + campo.slice(1)
                  }
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition
                    ${
                      theme === "dark"
                        ? "bg-slate-800 border-slate-700 text-slate-100"
                        : "bg-white border-orange-200 text-slate-800"
                    }
                    ${editing && campo !== "correo" && campo !== "cargo"
                      ? "focus:ring-2 ring-orange-400 dark:ring-fuchsia-400"
                      : ""}`}
                />
              )
            )}

            <select
              name="genero"
              value={datos.genero || ""}
              disabled={!editing}
              onChange={handleChange}
              className={`w-full px-3 py-2 rounded-lg border text-sm transition
                ${
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 text-slate-100"
                    : "bg-white border-orange-200 text-slate-800"
                }`}
            >
              <option value="">Selecciona género</option>
              {generoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`border-t p-4 text-right ${
            theme === "dark" ? "border-slate-700" : "border-orange-100"
          }`}
        >
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white font-semibold hover:brightness-110 transition"
            >
              Editar
            </button>
          ) : (
            <button
              onClick={handleGuardar}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition"
            >
              Guardar cambios
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
