import React, { useState, useEffect } from "react";
import { Building2, Briefcase, Calendar, CheckCircle, CheckCircle2, IdCard, KeyRound, Mail, Phone, Shield, Upload, UserPlus } from "lucide-react";
import { crearPerfil } from "../../services/perfilesService";
import { inicializarPermisosUsuario } from "../../services/permisosService";
import { listarSucursalesActivas } from "../../services/sucursalesService";

export default function CrearUsuario({ onClose }) {
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    contrasena: "",
    roles: [],
    documento_identidad: "",
    direccion: "",
    telefono: "",
    fecha_nacimiento: "",
    genero: "otro",
    cargo: "",
    estado: 1,
    id_sucursal: 1,
  });
  const [foto, setFoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [notice, setNotice] = useState(null);

  // Cargar sucursales al montar el componente
  useEffect(() => {
    const fetchSucursales = async () => {
      try {
        const data = await listarSucursalesActivas();
        setSucursales(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, id_sucursal: data[0].id_sucursal }));
        }
      } catch (error) {
        console.error("Error al cargar sucursales:", error);
      }
    };
    fetchSucursales();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(URL.createObjectURL(file));
    }
  };

  // La función onClose debe llamarse sólo cuando la creación fue exitosa, no al pulsar Cancelar.
  const handleGuardar = async () => {
    if (!formData.nombre || !formData.correo || !formData.contrasena) {
      setError("Nombre, correo y contraseña son obligatorios");
      return;
    }

    if (formData.roles.length === 0) {
      setError("Debe seleccionar al menos un rol");
      return;
    }
    if (formData.telefono && !/^[0-9+\s()-]{7,20}$/.test(formData.telefono.trim())) {
      setError("El teléfono debe contener solo números y signos habituales como +, espacios o guiones.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo.trim())) {
      setError("Ingresa un correo válido.");
      return;
    }
    if (formData.documento_identidad && formData.documento_identidad.trim().length < 4) {
      setError("El documento de identidad parece demasiado corto.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Preparar datos para enviar
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'roles' && formData.roles.length > 0) {
          // Enviar el rol principal (el primero seleccionado)
          formDataToSend.append('rol', formData.roles[0]);
        } else if (key !== 'roles') {
          formDataToSend.append(key, formData[key]);
        }
      });

      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput && fileInput.files[0]) {
        formDataToSend.append('foto', fileInput.files[0]);
      }

      // Crear usuario
      const response = await crearPerfil(formDataToSend);

      if (!response.id) {
        throw new Error("No se recibió el ID del usuario creado");
      }

      const userId = response.id;

      // Inicializar permisos automáticamente según el rol
      try {
        await inicializarPermisosUsuario(userId);
      } catch (permError) {
        console.warn('Advertencia: No se pudieron inicializar los permisos:', permError);
        // No bloqueamos la creación del usuario si falla la inicialización de permisos
      }

      // Reset form on success
      setFormData({
        nombre: "",
        correo: "",
        contrasena: "",
        roles: [],
        documento_identidad: "",
        direccion: "",
        telefono: "",
        fecha_nacimiento: "",
        genero: "otro",
        cargo: "",
        estado: 1,
        id_sucursal: sucursales.length > 0 ? sucursales[0].id_sucursal : 1,
      });
      setFoto(null);
      setError(null);

      setNotice({
        title: "Usuario creado correctamente",
        message: `Los permisos iniciales se configuraron para el rol ${formData.roles[0]}.`,
        onAccept: () => {
          if (typeof onClose === 'function') {
            onClose();
          }
        },
      });
    } catch (err) {
      console.error("Error al crear usuario:", err);
      setError(err.message || "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  // Nueva función para cancelar con seguridad (sin llamar a onClose si no existe)
  const handleCancel = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const inputClass = "w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe4ff]";
  const labelClass = "mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#233876]";

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <UserPlus size={20} />
          </div>
          <div>
            <h1 className="admin-module-title">Crear usuario</h1>
            <p className="admin-module-subtitle">Registra datos, sede activa y permisos iniciales.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-sm border border-[#c7d2fe] bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-sm border border-[#c7d2fe] bg-[linear-gradient(135deg,#eef2ff,#f8f9ff)] shadow-inner">
                {foto ? (
                  <img src={foto} alt="Foto de usuario" className="h-full w-full object-cover" />
                ) : (
                  <UserPlus size={42} className="text-[#3157d5]" />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 grid h-10 w-10 cursor-pointer place-items-center rounded-sm border border-[#3157d5] bg-[#3157d5] text-white shadow-sm transition hover:bg-[#233876]">
                <Upload size={17} />
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
            <h2 className="mt-5 text-base font-black text-[#233876]">Perfil del usuario</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">La foto es opcional y ayuda a identificar rápidamente al usuario.</p>
          </div>

          <div className="mt-5 rounded-sm border border-[#e0e7ff] bg-[#f8f9ff] p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-black text-slate-900">
              <span className="inline-flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                Usuario activo
              </span>
              <input
                type="checkbox"
                name="estado"
                checked={formData.estado === 1}
                onChange={(e) => setFormData({ ...formData, estado: e.target.checked ? 1 : 0 })}
                className="h-4 w-4 accent-[#3157d5]"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-sm border border-[#c7d2fe] bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#233876]">
              <IdCard size={17} />
              Datos personales
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Número de documento" icon={<IdCard size={14} />} labelClass={labelClass}>
                <input type="text" name="documento_identidad" value={formData.documento_identidad} onChange={handleChange} className={inputClass} placeholder="Ej: 1032456789" />
              </Field>
              <Field label="Nombre completo *" icon={<UserPlus size={14} />} labelClass={labelClass}>
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} className={inputClass} placeholder="Ej: Karina Audoro" />
              </Field>
              <Field label="Teléfono" icon={<Phone size={14} />} labelClass={labelClass}>
                <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className={inputClass} placeholder="Ej: 3124567890" />
              </Field>
              <Field label="Email *" icon={<Mail size={14} />} labelClass={labelClass}>
                <input type="email" name="correo" value={formData.correo} onChange={handleChange} className={inputClass} placeholder="Ej: usuario@marketsys.com" />
              </Field>
              <Field label="Dirección" icon={<Building2 size={14} />} labelClass={labelClass}>
                <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className={inputClass} placeholder="Ej: Calle 10 #45-23" />
              </Field>
              <Field label="Cargo" icon={<Briefcase size={14} />} labelClass={labelClass}>
                <input type="text" name="cargo" value={formData.cargo} onChange={handleChange} className={inputClass} placeholder="Ej: Cajera principal" />
              </Field>
              <Field label="Género" icon={<UserPlus size={14} />} labelClass={labelClass}>
                <select name="genero" value={formData.genero} onChange={handleChange} className={inputClass}>
                  <option value="otro">Otro</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </Field>
              <Field label="Fecha de nacimiento" icon={<Calendar size={14} />} labelClass={labelClass}>
                <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} className={inputClass} />
              </Field>
            </div>
          </section>

          <section className="rounded-sm border border-[#c7d2fe] bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#233876]">
              <Shield size={17} />
              Acceso y permisos
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Field label="Contraseña *" icon={<KeyRound size={14} />} labelClass={labelClass}>
                <input type="password" name="contrasena" value={formData.contrasena} onChange={handleChange} className={inputClass} />
              </Field>
              <Field label="Sucursal activa *" icon={<Building2 size={14} />} labelClass={labelClass}>
                <select name="id_sucursal" value={formData.id_sucursal} onChange={handleChange} className={inputClass} required>
                  {sucursales.length === 0 ? (
                    <option value="">Cargando sucursales...</option>
                  ) : (
                    sucursales.map(s => (
                      <option key={s.id_sucursal} value={s.id_sucursal}>
                        {s.nombre} - {s.ciudad}
                      </option>
                    ))
                  )}
                </select>
              </Field>
              <div>
                <span className={labelClass}>
                  <Shield size={14} />
                  Roles *
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {['admin', 'cajero'].map(role => {
                    const active = formData.roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleChange(role)}
                        className={`rounded-sm border px-3 py-2 text-left text-sm font-black transition ${
                          active
                            ? "border-[#3157d5] bg-[#eef2ff] text-[#233876]"
                            : "border-slate-200 bg-[#f8f9ff] text-slate-700 hover:bg-[#eef2ff]"
                        }`}
                      >
                        {role === 'admin' ? 'Administrador' : 'Cajero'}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Los permisos se inicializan automáticamente según el rol.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={handleCancel} disabled={loading} className="rounded-sm border border-slate-300 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-sm border border-[#3157d5] bg-[#3157d5] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#233876] disabled:opacity-50">
              <UserPlus size={16} />
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <UserNotice
          title={notice.title}
          message={notice.message}
          onClose={() => {
            const onAccept = notice.onAccept;
            setNotice(null);
            onAccept?.();
          }}
        />
      )}
    </div>
  );
}

function UserNotice({ title, message, onClose }) {
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
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-sm bg-[linear-gradient(135deg,#3157d5,#18a36b)] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}

function Field({ label, icon, labelClass, children }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
