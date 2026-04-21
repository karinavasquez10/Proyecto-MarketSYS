// src/Admin/AgregarCategoria.jsx
import React, { useState } from "react";
import { X } from "lucide-react";

export default function AgregarCategoria({ visible, onClose, onSave }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [impuesto, setImpuesto] = useState(0.00);

  if (!visible) return null;

  const handleGuardar = () => {
    if (!nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }
    const nuevaCategoria = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      impuesto: parseFloat(impuesto) || 0.00,
    };
    if (onSave) {
      onSave(nuevaCategoria);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 px-3">
      <div className="relative w-full max-w-3xl bg-white/90 backdrop-blur-lg border border-orange-100 rounded-2xl shadow-xl p-8 overflow-y-auto max-h-[90vh] transition-all duration-300">
        {/* ===== Botón Cerrar ===== */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/70 hover:bg-rose-100 text-slate-600 hover:text-red-600 shadow-sm transition"
        >
          <X size={18} />
        </button>

        {/* ===== Título ===== */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-fuchsia-500 bg-clip-text text-transparent">
            Agregar nueva categoría
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Las categorías se aplican en todas las sedes activas del sistema.
          </p>
        </div>

        {/* ===== Formulario ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-orange-300 outline-none"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-orange-300 outline-none"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-orange-300 outline-none resize-none"
              placeholder="Descripción opcional de la categoría..."
            />
          </div>
        </div>

        {/* ===== Botones ===== */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm shadow-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            className="bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:brightness-110 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            Guardar Categoría
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
    </div>
  );
}