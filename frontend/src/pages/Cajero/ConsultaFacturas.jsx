// src/pages/Admin/ConsultaFacturas.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import ModeloFactura from "../Admin/ModeloFactura"; // ✅ Importa tu factura con diseño


/* =================== Hook: detectar tema del sistema =================== */
function useSystemTheme() {
  const [theme, setTheme] = React.useState(
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  React.useEffect(() => {
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

/* =================== Modal principal =================== */
function ConsultaFacturas({ open, onClose }) {
  if (!open) return null;

  return createPortal(
    <ModalShell onClose={onClose}>
      <ConsultaFacturasBody onClose={onClose} />
    </ModalShell>,
    document.body
  );
}

/* =================== Shell =================== */
function ModalShell({ children, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[95vw] max-w-[1200px] h-[88vh] rounded-2xl shadow-2xl overflow-hidden grid grid-rows-[auto,1fr]
        bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* =================== URL de la API =================== */
const API_URL = "http://localhost:5000/api";

/* =================== Cuerpo del modal =================== */
function ConsultaFacturasBody({ onClose }) {
  const theme = useSystemTheme();

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facturaDatos, setFacturaDatos] = useState(null); // ✅ Nuevo estado


  // Estados para filtros mejorados
  const [busqueda, setBusqueda] = useState("");
  const [fecha, setFecha] = useState("");
  const [cajero, setCajero] = useState("TODOS");
  const [medio, setMedio] = useState("TODOS");
  const [estado, setEstado] = useState("TODOS");
  // Estado de ordenamiento
  const [ordenarPor, setOrdenarPor] = useState("reciente");
  
  // Paginación
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;

  // Fetch facturas desde backend
  useEffect(() => {
    const fetchFacturas = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/ventas`);
        if (!res.ok) throw new Error(`Error ${res.status}: No se pudieron cargar facturas.`);
        const data = await res.json();
        setFacturas(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFacturas();
  }, []);

  // Opciones únicas para filtros (de datos reales)
  const cajeros = ["TODOS", ...Array.from(new Set(facturas.map(i => i.nombre_usuario || ""))).filter(Boolean)];
  const medios = ["TODOS", ...Array.from(new Set(facturas.map(i => i.metodo_pago || ""))).filter(Boolean)];
  const estados = ["TODOS", "SALDADA"]; // Asumir 'SALDADA' para todas

  // FILTRO MEJORADO: tipo global (como ConsultaProductos), y por filtros directos
  const filtrarFacturas = (listado) => {
    return listado.filter(i => {
      // Filtro búsqueda global
      const texto = busqueda.trim().toLowerCase();
      const camposBuscados =
        `${i.id_venta || ""} ${i.fecha || ""} ${i.nombre_usuario || ""} ${i.metodo_pago || ""} ${i.total || ""} ${i.observaciones || ""}`.toLowerCase();

      // Filtro por fecha exacta (date input)
      const pasaFecha = !fecha || (i.fecha && i.fecha.startsWith(fecha));

      // Filtro por select de cajero
      const pasaCajero = cajero === "TODOS" || i.nombre_usuario === cajero;

      // Filtro por select de medio
      const pasaMedio = medio === "TODOS" || i.metodo_pago === medio;

      // Filtro por select de estado
      const pasaEstado = estado === "TODOS" || estado === "SALDADA";

      // Búsqueda global permite buscar por cualquier campo textual
      const pasaBusqueda = !texto || camposBuscados.includes(texto);

      return pasaFecha && pasaCajero && pasaMedio && pasaEstado && pasaBusqueda;
    });
  };

  // ===== ORDENAMIENTO (como en ConsultaProductos) =====
  // Opciones de ordenamiento
  const opcionesOrden = [
    { value: "reciente", label: "Más reciente" },
    { value: "antiguo", label: "Más antiguo" },
    { value: "mayor_total", label: "Mayor total" },
    { value: "menor_total", label: "Menor total" },
    { value: "alfabetico", label: "Cajero (A-Z)" },
    { value: "alfabetico_inv", label: "Cajero (Z-A)" },
  ];

  // Función de ordenamiento
  function ordenarFacturas(list) {
    const arr = [...list];
    switch (ordenarPor) {
      case "reciente":
        // por fecha descendente
        arr.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        break;
      case "antiguo":
        arr.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        break;
      case "mayor_total":
        arr.sort((a, b) => (b.total || 0) - (a.total || 0));
        break;
      case "menor_total":
        arr.sort((a, b) => (a.total || 0) - (b.total || 0));
        break;
      case "alfabetico":
        arr.sort((a, b) =>
          (a.nombre_usuario || "").localeCompare(b.nombre_usuario || "")
        );
        break;
      case "alfabetico_inv":
        arr.sort((a, b) =>
          (b.nombre_usuario || "").localeCompare(a.nombre_usuario || "")
        );
        break;
      default:
        break;
    }
    return arr;
  }

  // Lista filtrada + ordenada según los filtros y opción seleccionada
  const filtered = ordenarFacturas(filtrarFacturas(facturas));

  // Paginación: calcular items visibles y total páginas
  const totalPaginas = Math.ceil(filtered.length / porPagina) || 1;
  const desde = (pagina - 1) * porPagina;
  const hasta = desde + porPagina;
  const filasActuales = filtered.slice(desde, hasta);

  // Si hay cambio de filtro u orden, reset a página 1
  useEffect(() => {
    setPagina(1);
  }, [busqueda, fecha, cajero, medio, estado, ordenarPor]);

  // ===== Total General: sumatoria de todas las facturas, NO sólo las filtradas =====
  const totalGeneral = facturas.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const money = (n) =>
    (Number(n) || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

    /* ==================== FUNCIONES: Vista previa y Reimpresión ==================== */
const openFacturaPreview = async (factura, modo = "print") => {
  try {
    // 1️⃣ Obtener datos del backend
    const res = await fetch(`${API_URL}/ventas/${factura.id_venta}`);
    const detalle = await res.json();

    const venta = detalle.venta || detalle || {};
    const items = detalle.detalle || detalle.items || [];

    const recibidoReal =
      venta.efectivo_recibido ??
      venta.valor_recibido ??
      venta.monto_recibido ??
      detalle.recibido ??
      factura.recibido ??
      factura.total ??
      0;

    const cambioReal =
      venta.cambio_devuelto ??
      venta.vuelto ??
      venta.cambio ??
      detalle.cambio ??
      factura.cambio ??
      0;

    const datosFactura = {
      numero: `F-${String(factura.id_venta).padStart(6, "0")}`,
      fecha: new Date(factura.fecha).toLocaleString("es-CO"),
      cliente: venta.cliente?.nombre || venta.nombre_cliente || "Cliente General",
      cajero: factura.nombre_usuario || venta.nombre_usuario,
      metodoPago: factura.metodo_pago || venta.metodo_pago,
      subtotal: venta.subtotal || factura.subtotal || 0,
      descuento: venta.descuento || factura.descuento || 0,
      iva: venta.impuesto || factura.impuesto || 0.19,
      total: venta.total || factura.total || 0,
      recibido: recibidoReal,
      cambio: cambioReal,
      productos: items.map((p) => ({
        id: p.id_producto || p.id || Math.random(),
        nombre: p.nombre || p.nombre_producto || "Producto",
        cantidad: p.cantidad || 1,
        precio: p.precio_unitario || p.precio || 0,
      })),
      modoVer: modo === "ver", // 👈 clave para ocultar botón de imprimir
    };

    // 🧩 Si es solo vista previa, mostramos el modal directamente
    if (modo === "ver") {
      setFacturaDatos(datosFactura);
      return;
    }

    // 🧩 Si es impresión, generar vista como antes
    setFacturaDatos(datosFactura);
    await new Promise((r) => setTimeout(r, 500));

    const facturaContainer = document.querySelector("#factura-pdf-container .relative");
    if (!facturaContainer) {
      alert("No se encontró el diseño de la factura.");
      return;
    }

    const facturaHTML = facturaContainer.outerHTML;
    const printWindow = window.open("", "_blank", "width=600,height=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>${datosFactura.numero}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>body{background:white;display:flex;justify-content:center;padding:20px}</style>
        </head>
        <body>${facturaHTML}
          <script>window.onload=function(){window.print()}</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    console.error("❌ Error mostrando factura:", err);
    alert("No se pudo mostrar la vista previa de la factura.");
  }
};


const handleVerFactura = (factura) => openFacturaPreview(factura, "ver");
const handleReimprimirFactura = (factura) => openFacturaPreview(factura, "print");



  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-center text-lg">Cargando facturas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-red-600 mb-2">Error</h3>
          <p>{error}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div
        className={`h-14 px-5 flex items-center justify-between text-white transition-colors duration-300 ${
          theme === "dark"
            ? "bg-slate-800 border-b border-slate-700"
            : "bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-400"
        }`}
      >
        <h2 className="text-base font-semibold">Consulta de Facturas</h2>
        <button
          onClick={() => {
            if (typeof onClose === "function") onClose();
          }}
          className="p-2 rounded-md hover:bg-white/20 transition"
          title="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div
        className={`overflow-y-auto p-5 space-y-6 transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
            : "bg-gradient-to-br from-orange-50 via-white to-rose-50 text-slate-800"
        }`}
      >
        {/* Filtros */}
        <section
          className={`rounded-xl p-5 shadow-md border transition ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700"
              : "bg-white border-orange-200"
          }`}
        >
          <h3 className="font-semibold mb-3 inline-block px-3 py-1 rounded-md text-white shadow-md bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-500">
            Filtros de búsqueda
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            {/* Filtro de búsqueda global */}
            <Field label="Buscar">
              <input
                type="text"
                placeholder="Factura, cajero, observación..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition
                  ${theme === "dark"
                    ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-fuchsia-400"
                    : "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300"}`}
              />
            </Field>

            <Field label="Fecha">
              <input
                type="date"
                className={`w-full rounded-lg border px-3 py-2 text-sm transition
                ${theme === "dark"
                  ? "border-slate-700 bg-slate-800 text-slate-100 focus:ring-2 focus:ring-fuchsia-400"
                  : "border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-orange-300"}`}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Field>

            <Select label="Cajero" options={cajeros} value={cajero} onChange={setCajero} theme={theme} />
            <Select label="Medio Pago" options={medios} value={medio} onChange={setMedio} theme={theme} />
            <Select label="Estado" options={estados} value={estado} onChange={setEstado} theme={theme} />

            {/* Filtro de ordenamiento */}
            <OrdenarPorSelect
              label="Ordenar por"
              value={ordenarPor}
              onChange={setOrdenarPor}
              options={opcionesOrden}
              theme={theme}
            />
          </div>
        </section>

        {/* Tabla */}
        <section
          className={`rounded-xl p-5 shadow-md border transition ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700"
              : "bg-white border-orange-200"
          }`}
        >
         {facturaDatos && (
          <ModeloFactura
            open={true}
            onClose={() => setFacturaDatos(null)}
            datos={facturaDatos}
          />
        )}



          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Lista de Facturas</h3>
            <PrintButton onClick={() => window.print()} />
          </div>

          <div className="overflow-x-auto border border-orange-100 dark:border-slate-700 rounded-xl">
            <table className="min-w-full text-sm">
              <thead
                className={`${theme === "dark"
                  ? "bg-slate-800 text-slate-200"
                  : "bg-orange-50 text-slate-800"
                }`}
              >
                <tr>
                  <Th># Factura</Th>
                  <Th>Fecha</Th>
                  <Th>Cajero</Th>
                  <Th>Medio</Th>
                  <Th>Hora</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-center w-40">Acciones</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100 dark:divide-slate-700">
                {filasActuales.length ? (
                  filasActuales.map((r) => {
                    const fechaObj = new Date(r.fecha);
                    const hora = fechaObj.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    return (
                      <tr
                        key={r.id_venta}
                        className={`hover:transition ${
                          theme === "dark"
                            ? "hover:bg-slate-800/60"
                            : "hover:bg-orange-50"
                        }`}
                      >
                        <Td>{r.id_venta}</Td>
                        <Td>{fechaObj.toLocaleDateString("es-CO")}</Td>
                        <Td>{r.nombre_usuario}</Td>
                        <Td>{r.metodo_pago}</Td>
                        <Td className="text-rose-600 dark:text-rose-400 font-medium">{hora}</Td>
                        <Td className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          SALDADA
                        </Td>
                        <Td className="text-right font-semibold">{money(r.total)}</Td>
                        <Td className="text-center">
                          <div className="flex justify-center gap-2">
                         <SmallBtn variant="outline" onClick={() => handleReimprimirFactura(r)}>
                          <Printer size={14} />
                        </SmallBtn>
                        <SmallBtn onClick={() => handleVerFactura(r)}>Ver</SmallBtn>

                          </div>
                        </Td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <Td colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No hay facturas que coincidan con los filtros seleccionados.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Contenedor oculto para renderizar el diseño de factura */}
        <div id="factura-pdf-container" style={{ display: "none" }}>
          {facturaDatos && <ModeloFactura open={true} datos={facturaDatos} />}
        </div>

          </div>

          {/* Paginación */}
          <Pagination
            pagina={pagina}
            setPagina={setPagina}
            totalPaginas={totalPaginas}
          />
        </section>

        {/* Totales */}
        <section
          className={`rounded-xl p-4 shadow-sm border transition ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700"
              : "bg-white border-orange-100"
          }`}
        >
          <div className="flex justify-between items-center p-3 rounded-md shadow-md text-white bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-500">
            <span className="text-sm font-semibold">Total general</span>
            <span className="text-lg font-bold">{money(totalGeneral)}</span>
          </div>
        </section>

        {/* Botón de cierre */}
        <div className="flex justify-end">
          <GradientBtn onClose={onClose}>Cerrar</GradientBtn>
        </div>
      </div>
    </>
  );
}

/* =================== Helpers UI =================== */
function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div className="inline-block px-2 py-1 mb-1 rounded-md text-xs font-semibold text-white bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-500 shadow-sm">
      {children}
    </div>
  );
}

function Select({ label, options, value, onChange, theme }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className={`w-full rounded-lg border px-3 py-2 text-sm transition
          ${theme === "dark"
            ? "border-slate-700 bg-slate-800 text-slate-100 focus:ring-2 focus:ring-fuchsia-400"
            : "border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-orange-300"}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// Nuevo: Componente OrdenarPorSelect para selector de orden (similar a ConsultaProductos)
function OrdenarPorSelect({ label, value, onChange, options, theme }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className={`w-full rounded-lg border px-3 py-2 text-sm transition
          ${theme === "dark"
            ? "border-slate-700 bg-slate-800 text-slate-100 focus:ring-2 focus:ring-fuchsia-400"
            : "border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-orange-300"}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option value={opt.value} key={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "", colSpan }) {
  return <td colSpan={colSpan} className={`px-4 py-2 ${className}`}>{children}</td>;
}

function PrintButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700 transition"
      type="button"
    >
      <Printer size={16} /> Imprimir
    </button>
  );
}

function SmallBtn({ children, variant = "solid", onClick }) {
  const base = "px-3 py-1.5 rounded-md text-xs font-medium transition";
  const styles =
    variant === "solid"
      ? "bg-gradient-to-r from-orange-400 to-fuchsia-500 text-white hover:brightness-110"
      : "border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700";
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function GradientBtn({ children, onClose }) {
  return (
    <button
      onClick={onClose}
      className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-400 to-fuchsia-500 hover:brightness-110 transition"
    >
      {children}
    </button>
  );
}

// Componente de paginación minimalista (como en ConsultaProductos)
function Pagination({ pagina, setPagina, totalPaginas }) {
  if (totalPaginas <= 1) return null;

  // Evita mostrar demasiados botones si hay muchas páginas
  let inicio = Math.max(1, pagina - 2);
  let fin = Math.min(totalPaginas, pagina + 2);
  if (pagina <= 2) {
    fin = Math.min(5, totalPaginas);
  } else if (pagina >= totalPaginas - 1) {
    inicio = Math.max(1, totalPaginas - 4);
  }

  const botones = [];
  for (let i = inicio; i <= fin; i++) {
    botones.push(i);
  }

  return (
    <div className="flex gap-2 justify-center mt-6 select-none">
      <button
        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          pagina === 1
            ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            : "bg-gradient-to-r from-orange-100 to-pink-100 dark:from-slate-900 dark:to-slate-800 text-orange-700 dark:text-fuchsia-300 hover:brightness-110"
        }`}
        disabled={pagina === 1}
        onClick={() => setPagina(1)}
        tabIndex={pagina === 1 ? -1 : 0}
      >
        ⏮
      </button>
      <button
        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          pagina === 1
            ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            : "bg-gradient-to-r from-orange-100 to-pink-100 dark:from-slate-900 dark:to-slate-800 text-orange-700 dark:text-fuchsia-300 hover:brightness-110"
        }`}
        disabled={pagina === 1}
        onClick={() => setPagina((p) => Math.max(1, p - 1))}
        tabIndex={pagina === 1 ? -1 : 0}
      >
        ◀
      </button>
      {botones.map((num) => (
        <button
          key={num}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
            num === pagina
              ? "bg-gradient-to-r from-orange-400 to-fuchsia-500 text-white shadow"
              : "bg-white dark:bg-slate-900 text-orange-700 dark:text-fuchsia-300 hover:bg-orange-50 dark:hover:bg-slate-700"
          }`}
          onClick={() => setPagina(num)}
          aria-current={num === pagina ? "page" : undefined}
        >
          {num}
        </button>
      ))}
      <button
        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          pagina === totalPaginas
            ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            : "bg-gradient-to-r from-orange-100 to-pink-100 dark:from-slate-900 dark:to-slate-800 text-orange-700 dark:text-fuchsia-300 hover:brightness-110"
        }`}
        disabled={pagina === totalPaginas}
        onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
        tabIndex={pagina === totalPaginas ? -1 : 0}
      >
        ▶
      </button>
      <button
        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          pagina === totalPaginas
            ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            : "bg-gradient-to-r from-orange-100 to-pink-100 dark:from-slate-900 dark:to-slate-800 text-orange-700 dark:text-fuchsia-300 hover:brightness-110"
        }`}
        disabled={pagina === totalPaginas}
        onClick={() => setPagina(totalPaginas)}
        tabIndex={pagina === totalPaginas ? -1 : 0}
      >
        ⏭
      </button>
    </div>
  );
}

export default ConsultaFacturas;