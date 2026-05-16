// src/Admin/EditarCategoria.jsx
import React, { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function EditarCategoria({ visible, onClose, categoria, onSave }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [impuesto, setImpuesto] = useState(0.00);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (categoria) {
      setNombre(categoria.nombre || "");
      setDescripcion(categoria.descripcion || "");
      setImpuesto(parseFloat(categoria.impuesto) || 0.00);
    }
  }, [categoria]);

  if (!visible) return null;

  const handleGuardar = () => {
    if (!nombre.trim()) {
      setNotice({
        title: "Nombre requerido",
        message: "Escribe el nombre de la categoría antes de guardar los cambios.",
      });
      return;
    }
    const categoriaEditada = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      impuesto: parseFloat(impuesto) || 0.00,
    };
    if (onSave) {
      onSave(categoriaEditada);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 px-3">
      <div className="relative w-full max-w-3xl bg-white/90 backdrop-blur-lg border border-cyan-100 rounded-sm shadow-xl p-8 overflow-y-auto max-h-[90vh] transition-all duration-300">
        {/* ===== Botón Cerrar ===== */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/70 hover:bg-rose-100 text-slate-600 hover:text-red-600 shadow-sm transition"
        >
          <X size={18} />
        </button>

        {/* ===== Encabezado ===== */}
        <div className="bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-sm text-white py-4 px-5 mb-4 shadow-sm text-center">
          <h2 className="text-2xl font-bold">Editar Categoría</h2>
          <p className="text-sm opacity-90">
            Actualiza los datos de la categoría seleccionada
          </p>
        </div>

        {/* ===== Formulario ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-cyan-300 outline-none"
              placeholder="Ej: Verduras"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Impuesto (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={impuesto}
              onChange={(e) => setImpuesto(e.target.value)}
              className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-cyan-300 outline-none"
              placeholder="0.00"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descripción
            </label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-cyan-300 outline-none resize-none"
              placeholder="Descripción opcional de la categoría..."
            />
          </div>
        </div>

        {/* ===== Botones ===== */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-sm text-sm shadow-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white px-5 py-2 rounded-sm text-sm font-medium shadow-sm"
          >
            Guardar Cambios
          </button>
        </div>

        {/* ===== Media Queries ===== */}
        <style>
          {`
            @media (max-width: 640px) {
              .max-w-3xl {
                width: 95%;
              }
              .text-xl {
                font-size: 1.25rem;
              }
              .text-sm {
                font-size: 0.85rem;
              }
            }
            @media (min-width: 768px) {
              .max-w-3xl {
                width: 85%;
              }
            }
            @media (min-width: 1024px) {
              .max-w-3xl {
                width: 70%;
              }
            }
          `}
        </style>
      </div>

      {notice && (
        <CategoryNotice
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function CategoryNotice({ title, message, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-100 text-amber-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-sm bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
