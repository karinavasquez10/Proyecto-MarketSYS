import React, { useState, useEffect, useRef } from "react";
import { Briefcase, Mail, MapPin, Phone, ShieldCheck, User, X } from "lucide-react";
import { obtenerPerfil } from "../../services/perfilesService";

/* ========= Hook de sincronización global ========= */
function useSystemTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return "light";
}

/* ========= Componente principal ========= */
export default function PerfilCajera({ onClose }) {
  const theme = useSystemTheme();
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
      console.error("VITE_CLOUDINARY_CLOUD_NAME no configurado en .env frontend");
      return;
    }
    fetchedProfile.current = true;
    try {
      const data = await obtenerPerfil(userId);

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
        className={`cashier-modal-light w-full max-w-2xl rounded-md shadow-2xl border transition-all duration-300 overflow-hidden
          ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-slate-100"
              : "bg-white border-slate-200 text-slate-800"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#ffffff,#eef2ff_58%,#e8f4ec)] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#3157d5]">Ajustes del cajero</p>
            <h2 className="flex items-center gap-2 text-lg font-black text-[#111827]">
              <User size={18} /> Datos del perfil
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876] transition hover:bg-[#eef2ff]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="grid grid-cols-1 gap-5 bg-[#f8f9ff] p-5 md:grid-cols-[190px_1fr]">
          {/* FOTO */}
          <div className="flex flex-col items-center rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
            <div className="relative">
              {getImgSrc() ? (
                <img
                  src={getImgSrc()}
                  alt="Perfil"
                  className="h-28 w-28 rounded-full border-4 border-[#dbe4ff] object-cover"
                  key={imgVersion}
                  onLoad={() => null}
                  onError={e => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#dbe4ff] bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-3xl font-black text-white">
                  {(datos?.nombre?.[0] || "U").toUpperCase()}
                </div>
              )}
            </div>
            <h3 className="mt-3 text-center text-sm font-black text-[#111827]">{datos?.nombre || "Usuario"}</h3>
            <p className="mt-1 rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#233876]">{datos?.cargo || "Cajero"}</p>
          </div>

          {/* DATOS */}
          <div className="space-y-3">
            <ReadOnlyField icon={<User size={15} />} label="Nombre" value={datos?.nombre} />
            <ReadOnlyField icon={<Mail size={15} />} label="Correo" value={datos?.correo || datos?.email} />
            <ReadOnlyField icon={<Phone size={15} />} label="Teléfono" value={datos?.telefono} />
            <ReadOnlyField icon={<MapPin size={15} />} label="Dirección" value={datos?.direccion} />
            <ReadOnlyField icon={<Briefcase size={15} />} label="Cargo" value={datos?.cargo} />
            <ReadOnlyField icon={<ShieldCheck size={15} />} label="Género" value={datos?.genero} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#c7d2fe] bg-white px-5 py-3">
          <p className="text-xs font-bold text-[#4b5563]">
            Vista solo lectura. Los cambios de usuario y permisos se gestionan desde el módulo de administrador.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ icon, label, value }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#233876]">
        <span className="text-[#3157d5]">{icon}</span>
        {label}
      </div>
      <div className="min-h-[20px] text-sm font-black text-[#111827]">{value || "No registrado"}</div>
    </div>
  );
}
