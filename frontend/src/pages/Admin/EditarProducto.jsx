// src/components/Admin/EditarProducto.jsx - Form con campos reales, selects para cat/unidad
import React, { useState } from "react";
import { AlertTriangle, X, Tag, Barcode } from "lucide-react";
import { isUnlimitedStock, stockInputValue, stockSubmitValue } from "../../utils/stock";

export default function EditarProducto({ producto, onClose, onSave, categorias = [] }) {
  const [formData, setFormData] = useState({
    ...producto,
    stock_actual: stockInputValue(producto.stock_actual),
    stock_minimo: stockInputValue(producto.stock_minimo),
    stock_maximo: stockInputValue(producto.stock_maximo),
  });
  const [stockIlimitado, setStockIlimitado] = useState({
    stock_actual: isUnlimitedStock(producto.stock_actual),
    stock_minimo: isUnlimitedStock(producto.stock_minimo),
    stock_maximo: isUnlimitedStock(producto.stock_maximo),
  });
  const [notice, setNotice] = useState("");

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setNotice("");
  };

  const handleBarcodeKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.querySelector("#editar-producto-nombre")?.focus();
  };

  const handleStockIlimitado = (key, checked) => {
    setStockIlimitado((prev) => ({ ...prev, [key]: checked }));
    if (checked) handleChange(key, "");
  };

  const handleSubmit = () => {
    // Validar campos requeridos
    if (!formData.nombre || !formData.id_categoria || !formData.precio_compra || !formData.precio_venta) {
      setNotice("Completa los campos obligatorios: nombre, categoría, precio de compra y precio de venta.");
      return;
    }

    // Validación de campos de cambio automático
    if (
      (parseInt(formData.cambia_estado) === 1 || parseInt(formData.cambia_apariencia) === 1) &&
      (!formData.tiempo_cambio || parseInt(formData.tiempo_cambio) <= 0)
    ) {
      setNotice("Si el producto cambia de estado o apariencia, debes especificar el tiempo de cambio en días mayor a 0.");
      return;
    }

    onSave({
      ...formData,
      stock_actual: stockSubmitValue(formData.stock_actual, stockIlimitado.stock_actual),
      stock_minimo: stockSubmitValue(formData.stock_minimo, stockIlimitado.stock_minimo),
      stock_maximo: stockSubmitValue(formData.stock_maximo, stockIlimitado.stock_maximo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-sm shadow-xl w-[90%] max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Cerrar */}
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-rose-500">
          <X size={20} />
        </button>

        {/* Encabezado */}
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Tag size={18} className="text-cyan-600" />
          Editar Producto
        </h2>

        {notice && (
          <div className="mb-4 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          </div>
        )}

        {/* Campos */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Nombre *</label>
            <input
              id="editar-producto-nombre"
              type="text"
              value={formData.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Código de barras</label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600" size={15} />
                <input
                  type="text"
                  value={formData.codigo_barras || ""}
                  onChange={(e) => handleChange("codigo_barras", e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  className="w-full border rounded-sm py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-cyan-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Código interno</label>
              <input
                type="text"
                value={formData.codigo_interno || ""}
                onChange={(e) => handleChange("codigo_interno", e.target.value)}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion || ""}
              onChange={(e) => handleChange("descripcion", e.target.value)}
              rows={2}
              className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Categoría *</label>
              <select
                value={formData.id_categoria}
                onChange={(e) => handleChange("id_categoria", parseInt(e.target.value))}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              >
                <option value="">Selecciona...</option>
                {categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Unidad</label>
              <select
                value={formData.id_unidad || ""}
                onChange={(e) => handleChange("id_unidad", e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              >
                <option value="">Ninguna</option>
                {/* Asumir fetch de unidades en props o global; por ahora placeholder */}
                <option value={1}>Unidad (Ud)</option>
                <option value={2}>Kilo (Kg)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Precio Compra *</label>
              <input
                type="number"
                step="0.01"
                value={formData.precio_compra}
                onChange={(e) => handleChange("precio_compra", parseFloat(e.target.value))}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Precio Venta *</label>
              <input
                type="number"
                step="0.01"
                value={formData.precio_venta}
                onChange={(e) => handleChange("precio_venta", parseFloat(e.target.value))}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm text-slate-600">Stock Actual</label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-[#152b73]">
                  <input
                    type="checkbox"
                    checked={stockIlimitado.stock_actual}
                    onChange={(e) => handleStockIlimitado("stock_actual", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Ilimitado
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                value={formData.stock_actual}
                onChange={(e) => handleChange("stock_actual", e.target.value)}
                placeholder={stockIlimitado.stock_actual ? "Ilimitado" : "0.00"}
                disabled={stockIlimitado.stock_actual}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 disabled:bg-[#eef2ff] disabled:font-black disabled:text-[#111827]"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm text-slate-600">Stock Mínimo</label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-[#152b73]">
                  <input
                    type="checkbox"
                    checked={stockIlimitado.stock_minimo}
                    onChange={(e) => handleStockIlimitado("stock_minimo", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Ilimitado
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                value={formData.stock_minimo}
                onChange={(e) => handleChange("stock_minimo", e.target.value)}
                placeholder={stockIlimitado.stock_minimo ? "Ilimitado" : "0.00"}
                disabled={stockIlimitado.stock_minimo}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 disabled:bg-[#eef2ff] disabled:font-black disabled:text-[#111827]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm text-slate-600">Stock Máximo</label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-[#152b73]">
                  <input
                    type="checkbox"
                    checked={stockIlimitado.stock_maximo}
                    onChange={(e) => handleStockIlimitado("stock_maximo", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Ilimitado
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                value={formData.stock_maximo}
                onChange={(e) => handleChange("stock_maximo", e.target.value)}
                placeholder={stockIlimitado.stock_maximo ? "Ilimitado" : "0.00"}
                disabled={stockIlimitado.stock_maximo}
                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 disabled:bg-[#eef2ff] disabled:font-black disabled:text-[#111827]"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={formData.estado}
                onChange={(e) => handleChange("estado", e.target.checked)}
                className="h-4 w-4 text-emerald-600"
              />
              <label className="text-sm text-slate-700">Activo</label>
            </div>
          </div>

          {/* === Configuración de Cambio Automático === */}
          <div className="space-y-3 mt-5 pt-5 border-t border-slate-200">
            <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
              <Tag size={16} className="text-sky-500" />
              Cambio Automático
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  ¿Cambia de estado?
                </label>
                <select
                  value={formData.cambia_estado || 0}
                  onChange={(e) => handleChange("cambia_estado", parseInt(e.target.value))}
                  className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                >
                  <option value={0}>No</option>
                  <option value={1}>Sí</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  ¿Cambia de apariencia?
                </label>
                <select
                  value={formData.cambia_apariencia || 0}
                  onChange={(e) => handleChange("cambia_apariencia", parseInt(e.target.value))}
                  className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                >
                  <option value={0}>No</option>
                  <option value={1}>Sí</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  Tiempo (días)
                  {(formData.cambia_estado === 1 || formData.cambia_apariencia === 1) &&
                    <span className="text-rose-500 ml-1">*</span>}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.tiempo_cambio || ""}
                  onChange={(e) => handleChange("tiempo_cambio", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Ej: 5"
                  className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            {(formData.cambia_estado === 1 || formData.cambia_apariencia === 1) &&
              !formData.tiempo_cambio && (
              <div className="bg-amber-50 border border-amber-200 rounded-sm p-2">
                <p className="text-xs text-amber-700">
                  Debes especificar el tiempo de cambio en días.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-md text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
