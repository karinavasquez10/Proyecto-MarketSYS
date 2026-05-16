import React, { useRef } from "react";
import { X } from "lucide-react";

/* ===================== Componente principal ===================== */
export default function ModeloFactura({ open, onClose, datos = {} }) {
  const facturaRef = useRef(null);

 const {
  numero = "F-000231",
  fecha = new Date().toLocaleString("es-CO"),
  cliente = "Cliente General",
  cajero = "Juliana Hoyos",
  metodoPago = "Efectivo",
  sede = "MERKA FRUVER FLORENCIA",
  empresa = "MERKA FRUVER FLORENCIA",
  nit = "NIT: 000.000.000-0",
  direccion = "Florencia - Caqueta",
  telefono = "",
  resolucion = "",
  logoUrl = "/ticket-logo.jpeg",
  caja = "Caja principal",
  clienteDocumento = "",
  subtotal = 0,
  descuento = 0,
  iva = 0,
  total = 0,
  recibido = 0,
  cambio = 0,
  productos = [],
} = datos;


const totalIva = Number(iva || 0);
const totalFinal = total || subtotal - descuento + totalIva;
const totalItems = productos.reduce((sum, product) => sum + Number(product.cantidad || 0), 0);
const sedeTicket = String(sede || "").trim().toUpperCase() === "MARKETSYS" ? "MERKA FRUVER FLORENCIA" : sede;
const fechaObj = fecha ? new Date(fecha) : new Date();
const fechaTexto = Number.isNaN(fechaObj.getTime()) ? String(fecha).split(",")[0] : fechaObj.toLocaleDateString("es-CO");
const horaTexto = Number.isNaN(fechaObj.getTime())
  ? String(fecha).split(",").slice(1).join(",").trim()
  : fechaObj.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });


  const money = (n) =>
    (Number(n) || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 print:static print:block print:bg-white print:p-0"
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          body * { visibility: hidden; }
          .ticket-print, .ticket-print * { visibility: visible; }
          .ticket-print { position: absolute; left: 0; top: 0; width: 74mm !important; box-shadow: none !important; border: 0 !important; }
          .ticket-actions { display: none !important; }
        }
      `}</style>
      <div
        ref={facturaRef}
        className="ticket-print relative max-h-[92vh] w-[80mm] overflow-y-auto rounded-sm border border-slate-300 bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-2xl print:max-h-none print:overflow-visible print:p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ticket-actions mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2 font-sans">
          <span className="text-xs font-black uppercase text-slate-700">Vista ticket 80mm</span>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-sm border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
            title="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        <div className="text-center">
          <h3 className="text-[18px] font-black uppercase leading-[1.05] tracking-wide">{empresa}</h3>
          <p className="mt-1 font-black uppercase">{nit}</p>
          <p className="font-bold uppercase">{direccion}</p>
          {telefono && <p>Tel: {telefono}</p>}
          {logoUrl && (
            <img
              src={logoUrl}
              alt={empresa}
              className="mx-auto my-2 max-h-[62px] max-w-[170px] object-contain print:max-h-[54px]"
            />
          )}
          <p className="border-y border-dashed border-black py-1 font-black uppercase">
            Factura de venta {numero}
          </p>
          {resolucion && (
            <div className="mt-2 border border-dashed border-black px-2 py-1 text-[10px] font-bold leading-tight">
              {resolucion}
            </div>
          )}
        </div>

        <div className="mt-2 space-y-0.5 border-b border-dashed border-black pb-2 font-bold uppercase">
          <div className="flex justify-between">
            <span>Caja:</span> <strong>{caja}</strong>
          </div>
          <div className="flex justify-between">
            <span>Vend:</span> <span>{cajero || "Sin responsable"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Fecha:</span> <span>{fechaTexto}</span>
            <span>Hora:</span> <span>{horaTexto}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Sede:</span> <span className="text-right">{sedeTicket}</span>
          </div>
        </div>

        <div className="space-y-0.5 border-b border-dashed border-black py-2 font-bold uppercase">
          <div className="flex justify-between">
            <span>Cliente:</span> <span className="font-semibold">{cliente}</span>
          </div>
          {clienteDocumento && (
            <div className="flex justify-between">
              <span>Documento:</span> <span className="font-semibold">{clienteDocumento}</span>
            </div>
          )}
        </div>

        <div className="py-2 border-b border-dashed border-black">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-y border-dashed border-black font-black uppercase">
                <th className="w-[8%] py-1 text-left">#</th>
                <th className="w-[43%] py-1 text-left">Descripción</th>
                <th className="w-[16%] py-1 text-right">Cnt</th>
                <th className="w-[16%] py-1 text-right">Valor</th>
                <th className="w-[17%] py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, index) => (
                <tr key={p.id || p.nombre} className="border-b border-slate-100 align-top">
                  <td className="py-1 pr-1 font-black">{index + 1}</td>
                  <td className="py-1 pr-1">
                    <span className="font-black uppercase">{p.nombre}</span>
                    {p.codigo && <span className="block text-[9px] font-bold">{p.codigo}</span>}
                  </td>
                  <td className="py-1 text-right font-bold">{Number(p.cantidad || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })}</td>
                  <td className="py-1 text-right font-bold">{Number(p.precio || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</td>
                  <td className="py-1 text-right font-black">{Number((p.cantidad || 0) * (p.precio || 0)).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="py-2 text-xs border-b border-dashed border-black space-y-0.5 font-bold">
          <div className="flex justify-between">
            <span>Total items:</span>
            <span>{productos.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total unidades:</span>
            <span>{totalItems.toLocaleString("es-CO", { maximumFractionDigits: 3 })}</span>
          </div>
          <div className="flex justify-between">
            <span>Total bruto:</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento:</span>
            <span>{money(descuento)}</span>
          </div>
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{money(subtotal - descuento)}</span>
          </div>
          <div className="flex justify-between">
            <span>Impuesto:</span>
            <span>{money(totalIva)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-black pt-1 text-sm font-black">
            <span>Total:</span>
            <span>{money(totalFinal)}</span>
          </div>
        </div>

        <div className="py-2 text-xs border-b border-dashed border-black space-y-1 font-bold">
          <div className="text-center font-black">Forma de pago: {metodoPago}</div>
          <div className="flex justify-between">
            <span>Abonado:</span>
            <span>{money(recibido)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Pendiente:</span>
            <span>{money(Math.max(totalFinal - recibido, 0))}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Cambio:</span>
            <span>{money(Math.max(cambio, 0))}</span>
          </div>
        </div>

        <div className="py-3 text-center text-[10px]">
          <p className="font-black italic">¡Gracias por su compra!</p>
          <p className="mt-2 border-t border-dashed border-black pt-2 text-[9px] text-black">
            Representacion impresa de la factura
          </p>
          <p className="mt-1 text-[9px] text-black">
            Software POS MARKETSYS
          </p>
          <div className="mt-3 border-t border-dashed border-black pt-2 text-[9px] font-bold leading-tight">
            Términos de Garantía: conserve este comprobante para cambios o reclamaciones según las políticas del establecimiento.
          </div>
        </div>

      </div>
    </div>
  );
}
