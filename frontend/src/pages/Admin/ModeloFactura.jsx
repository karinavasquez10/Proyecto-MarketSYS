import React, { useEffect, useRef } from "react";
import { X, Printer } from "lucide-react";

/* ===================== Hook de tema global ===================== */
function useSystemTheme() {
  const [theme, setTheme] = React.useState(
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

/* ===================== Componente principal ===================== */
export default function ModeloFactura({ open, onClose, datos = {} }) {
  const theme = useSystemTheme();
  const facturaRef = useRef(null);

 const {
  numero = "F-000231",
  fecha = new Date().toLocaleString("es-CO"),
  cliente = "Cliente General",
  cajero = "Juliana Hoyos",
  metodoPago = "Efectivo",
  subtotal = 0,
  descuento = 0,
  iva = 0.19,
  total = 0,
  recibido = 0,
  cambio = 0,
  productos = [],
} = datos;


const totalIva = iva < 1 ? subtotal * iva : iva;
const totalFinal = total || subtotal - descuento + totalIva;


  const money = (n) =>
    (Number(n) || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const handlePrint = () => {
    window.print();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={facturaRef}
        className={`relative w-[380px] rounded-xl overflow-hidden shadow-2xl border text-sm ${
          theme === "dark"
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======= Encabezado superior ======= */}
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${
            theme === "dark"
              ? "border-slate-700 bg-gradient-to-r from-orange-700 via-pink-700 to-fuchsia-700"
              : "border-orange-200 bg-gradient-to-r from-orange-500 via-pink-400 to-fuchsia-500"
          } text-white`}
        >
          <h2 className="font-bold text-base tracking-wide">FACTURA DE VENTA</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/20 transition"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ======= Datos del negocio ======= */}
        <div className="px-4 py-3 text-center text-xs border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
            SUPERMERCADO INVENTNET
          </h3>
          <p>NIT: 901.567.234-5</p>
          <p>Cra 12 #34-56, Florencia - Caquetá</p>
          <p>Tel: (608) 435-8900</p>
        </div>

        {/* ======= Información de la factura ======= */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Número:</span> <strong>{numero}</strong>
          </div>
          <div className="flex justify-between">
            <span>Fecha:</span> <span>{fecha}</span>
          </div>
          <div className="flex justify-between">
            <span>Cliente:</span> <span className="font-semibold">{cliente}</span>
          </div>
          <div className="flex justify-between">
            <span>Cajero:</span> <span>{cajero}</span>
          </div>
          <div className="flex justify-between">
            <span>Método de pago:</span> <span>{metodoPago}</span>
          </div>
        </div>

        {/* ======= Detalle de productos ======= */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr
                className={`${
                  theme === "dark"
                    ? "text-orange-300 border-slate-700"
                    : "text-orange-600 border-slate-300"
                } border-b font-semibold`}
              >
                <th className="text-left w-[15%]">Cant</th>
                <th className="text-left w-[45%]">Producto</th>
                <th className="text-right w-[20%]">V. Unit</th>
                <th className="text-right w-[20%]">Total</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b ${
                    theme === "dark"
                      ? "border-slate-800"
                      : "border-slate-100"
                  }`}
                >
                  <td>{p.cantidad}</td>
                  <td>{p.nombre}</td>
                  <td className="text-right">{money(p.precio)}</td>
                  <td className="text-right">{money(p.cantidad * p.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ======= Totales ======= */}
        <div className="px-4 py-2 text-xs border-b border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento:</span>
            <span>{money(descuento)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA (19%):</span>
            <span>{money(totalIva)}</span>
          </div>
          <div
            className={`flex justify-between font-bold border-t mt-1 pt-1 rounded-md ${
              theme === "dark"
                ? "bg-slate-800 text-white"
                : "bg-orange-50 text-orange-700"
            }`}
          >
            <span>TOTAL A PAGAR:</span>
            <span>{money(totalFinal)}</span>
          </div>
        </div>

        {/* ======= Pago ======= */}
        <div className="px-4 py-2 text-xs border-b border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex justify-between">
            <span>Efectivo recibido:</span>
            <span>{money(recibido)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Cambio:</span>
            <span>{money(cambio)}</span>
          </div>
        </div>

        {/* ======= Pie ======= */}
        <div className="px-4 py-3 text-center text-[11px]">
          <p>¡Gracias por su compra!</p>
          <p>Vuelva pronto 💫</p>
          <p className="mt-2 text-[10px] text-slate-500">
            Software de facturación desarrollado por <strong>InventNet</strong> © 2025
          </p>
        </div>

        {/* ======= Botón imprimir ======= */}
 
        {!datos.modoVer && (
          <div className="absolute top-2 right-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white hover:brightness-110 transition"
            >
              <Printer size={14} /> Imprimir
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
