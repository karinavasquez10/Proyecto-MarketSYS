// CrearCliente.jsx (versión actualizada - campo nombre único, tipo de cliente, integración con API)
import React, { useState } from "react";

export default function CrearCliente({ onClose, onGuardar }) {
  const [formData, setFormData] = useState({
    documento: "",
    tipo: "persona",
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGuardar = async () => {
    if (!formData.nombre || !formData.documento) {
      setError("Nombre e identificación son obligatorios");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("http://localhost:5000/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          identificacion: formData.documento,
          direccion: formData.direccion,
          telefono: formData.telefono,
          correo: formData.email,
          tipo: formData.tipo,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Error al crear cliente");
      }
      onClose();
      if (onGuardar) onGuardar();
    } catch (err) {
      console.error("Error al crear cliente:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-3 backdrop-blur-md">
      <div className="bg-white/80 backdrop-blur-lg border border-white/30 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] w-full max-w-3xl p-8 relative overflow-y-auto max-h-[90vh] animate-fadeIn">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-red-500 text-xl font-bold transition"
        >
          ✕
        </button>

        {/* Encabezado con gradiente */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 drop-shadow-sm">
            Crear Nuevo Cliente
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Complete los datos para registrar un nuevo cliente en el sistema.
          </p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-orange-400 to-pink-400 mx-auto rounded-full" />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            {error}
          </div>
        )}

        {/* Formulario */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Documento */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Número de documento
            </label>
            <input
              type="text"
              name="documento"
              value={formData.documento}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 shadow-sm transition"
              placeholder="Ej: 1032456789"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tipo de cliente
            </label>
            <select
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 shadow-sm transition"
            >
              <option value="persona">Persona</option>
              <option value="empresa">Empresa</option>
              <option value="generico">Generico</option>
            </select>
          </div>

          {/* Nombre */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 shadow-sm transition"
              placeholder="Ej: Karen Hoyos"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Teléfono
            </label>
            <input
              type="text"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 shadow-sm transition"
              placeholder="Ej: 3109876543"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 shadow-sm transition"
              placeholder="Ej: correo@gmail.com"
            />
          </div>

          {/* Dirección */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 shadow-sm transition"
              placeholder="Ej: Calle 10 #45-23"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            disabled={loading}
            className="bg-slate-400/90 hover:bg-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:brightness-110 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Cliente"}
          </button>
        </div>
      </div>

      {/* Animaciones */}
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.96) translateY(10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
}