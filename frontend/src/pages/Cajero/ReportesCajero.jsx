import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ClipboardList,
  CreditCard,
  Printer,
  Receipt,
  RefreshCw,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { obtenerReporteResumen } from "../../services/reportesService";
import { listarCajas } from "../../services/cajasService";

const tabs = [
  { id: "resumen", label: "Resumen diario", icon: BarChart3 },
  { id: "cierres", label: "Cierres de caja", icon: Receipt },
  { id: "categorias", label: "Categorías", icon: Tags },
  { id: "tickets", label: "Tickets", icon: Printer },
];

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const money = (value) =>
  Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const shortDateTime = (value) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const normalizeDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const ticketStyles = `
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #000; font-family: Arial, "Courier New", monospace; font-size: 11px; }
  .ticket { width: 74mm; padding: 5px 4px; }
  .center { text-align: center; }
  .brand { font-size: 18px; font-weight: 900; line-height: 1.04; letter-spacing: .5px; }
  .muted { font-size: 9px; font-weight: 700; color: #222; }
  .report-title { margin-top: 5px; padding: 5px 2px; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 12px; font-weight: 900; letter-spacing: .4px; text-align: center; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .soft-line { border-top: 1px dotted #555; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:first-child { font-weight: 700; }
  .row strong { text-align: right; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; vertical-align: top; }
  th { border-bottom: 1px solid #000; border-top: 1px solid #000; font-size: 9px; text-align: left; font-weight: 900; }
  td { border-bottom: 1px dotted #d7d7d7; font-size: 10px; }
  td:last-child, th:last-child { text-align: right; }
  td:nth-child(2), th:nth-child(2) { text-align: center; }
  .section { margin: 7px 0 3px; padding: 3px 2px; background: #000; color: #fff; font-size: 10px; font-weight: 900; text-align: center; text-transform: uppercase; }
  .total { font-size: 12px; font-weight: 900; }
  .grand-total { padding: 5px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .foot { margin-top: 8px; font-size: 9px; line-height: 1.25; }
`;

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function MetricCard({ title, value, helper, icon: Icon }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">{title}</p>
          <p className="mt-1 break-words text-xl font-black text-[#111827]">{value}</p>
          {helper && <p className="mt-1 text-xs font-bold text-[#4b5563]">{helper}</p>}
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
          <Icon size={19} strokeWidth={2.7} />
        </span>
      </div>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-sm border border-dashed border-[#c7d2fe] bg-[#f8f9ff] p-6 text-center">
      <p className="text-sm font-black text-[#111827]">{title}</p>
      <p className="mt-1 text-xs font-bold text-[#4b5563]">{text}</p>
    </div>
  );
}

export default function ReportesCajero({ open, onClose, initialTab = "resumen" }) {
  const today = useMemo(() => localDate(), []);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [reporte, setReporte] = useState(null);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (open) setActiveTab(initialTab || "resumen");
  }, [initialTab, open]);

  const fetchData = async () => {
    if (!open) return;
    setLoading(true);
    setError("");
    try {
      const [reporteData, cajasData] = await Promise.all([
        obtenerReporteResumen({ desde, hasta }),
        listarCajas(),
      ]);
      setReporte(reporteData);
      setCajas(Array.isArray(cajasData) ? cajasData : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, desde, hasta]);

  if (!open) return null;

  const resumen = reporte?.resumen || {};
  const cajasFiltradas = cajas
    .filter((caja) => {
      const fecha = normalizeDate(caja.fecha_cierre || caja.fecha_apertura);
      return fecha && fecha >= desde && fecha <= hasta;
    });
  const cajasAbiertas = cajasFiltradas.filter((caja) => caja.estado === "abierta");
  const cajasCerradas = cajasFiltradas.filter((caja) => caja.estado === "cerrada");

  const printReportTicket = (type) => {
    const titleMap = {
      productos: "PRODUCTOS VENDIDOS",
      categorias: "TICKET CATEGORIAS",
      precios: "LISTA DE PRECIOS",
      resumen: "RESUMEN DIARIO",
    };
    const title = titleMap[type] || "REPORTE";
    const sections = {
      productos: [
        {
          heading: "Mas vendidos",
          headers: ["Producto", "Cant.", "Total"],
          rows: (reporte?.top_productos || []).map((item) => [
            item.nombre,
            Number(item.cantidad_vendida || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 }),
            money(item.total_vendido),
          ]),
        },
      ],
      categorias: [
        {
          heading: "Ventas por categoria",
          headers: ["Categoria", "Und.", "Total"],
          rows: (reporte?.ventas_por_categoria || []).map((item) => [
            item.categoria,
            Number(item.unidades || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 }),
            money(item.total),
          ]),
        },
      ],
      precios: [
        {
          heading: "Productos activos",
          headers: ["Producto", "Stock", "Precio"],
          rows: (reporte?.existencias_productos || []).map((item) => [
            `${item.codigo_interno || item.codigo_barras || ""} ${item.nombre || ""}`.trim(),
            `${Number(item.stock_actual || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${item.unidad || ""}`.trim(),
            money(item.precio_venta),
          ]),
        },
      ],
      resumen: [
        {
          heading: "Totales",
          headers: ["Concepto", "Info", "Valor"],
          rows: [
            ["Ventas", `${resumen.ventas_cantidad || 0} facturas`, money(resumen.ventas_total)],
            ["Impuesto incluido", "", money(resumen.impuesto_ventas)],
            ["Ingresos", "", money(resumen.ingresos_financieros)],
            ["Egresos", "", money(resumen.egresos_financieros)],
            ["Diferencia caja", "", money(resumen.diferencia_caja)],
          ],
        },
        {
          heading: "Formas de pago",
          headers: ["Metodo", "Ops.", "Total"],
          rows: (reporte?.ventas_por_metodo || []).map((item) => [
            item.metodo_pago,
            Number(item.cantidad || 0).toLocaleString("es-CO"),
            money(item.total),
          ]),
        },
        {
          heading: "Resumen por dia",
          headers: ["Fecha", "Fact.", "Total"],
          rows: (reporte?.resumen_diario || []).map((item) => [
            normalizeDate(item.fecha),
            Number(item.facturas || 0).toLocaleString("es-CO"),
            money(item.total),
          ]),
        },
      ],
    }[type] || [];

    const reportFooter = {
      productos: [
        ["Items vendidos", (reporte?.top_productos || []).length.toLocaleString("es-CO")],
        ["Total vendido", money(resumen.ventas_total)],
      ],
      categorias: [
        ["Categorias", (reporte?.ventas_por_categoria || []).length.toLocaleString("es-CO")],
        ["Total vendido", money(resumen.ventas_total)],
      ],
      precios: [
        ["Productos activos", Number(resumen.productos_activos || 0).toLocaleString("es-CO")],
        ["Unidades en stock", Number(resumen.unidades_inventario || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })],
        ["Valor a precio venta", money(resumen.valor_venta_inventario)],
      ],
      resumen: [
        ["Facturas", Number(resumen.ventas_cantidad || 0).toLocaleString("es-CO")],
        ["Total ventas", money(resumen.ventas_total)],
        ["Impuesto incluido", money(resumen.impuesto_ventas)],
        ["Egresos", money(resumen.egresos_financieros)],
      ],
    }[type] || [];

    const reportNote = {
      productos: "Productos vendidos en el rango de fechas seleccionado.",
      categorias: "Ventas agrupadas por categoria en el rango seleccionado.",
      precios: "Lista de productos activos. No depende de las fechas; el valor es stock actual por precio de venta.",
      resumen: "Resumen financiero del rango de fechas seleccionado.",
    }[type] || "Reporte generado por MarketSYS.";

    const renderSection = (section) => `
      <div class="section">${escapeHtml(section.heading)}</div>
      <table>
        <thead><tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${section.rows.length
            ? section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell || "-")}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${section.headers.length}" class="center">Sin datos</td></tr>`}
        </tbody>
      </table>
    `;

    const html = `
      <html>
        <head><title>${title}</title><style>${ticketStyles}</style></head>
        <body>
          <div class="ticket">
            <div class="center brand">MERKA FRUVER<br/>FLORENCIA</div>
            <div class="center muted">MARKETSYS POS</div>
            <div class="report-title">${title}</div>
            <div class="row"><span>Desde:</span><strong>${desde}</strong></div>
            <div class="row"><span>Hasta:</span><strong>${hasta}</strong></div>
            <div class="row"><span>Fecha imp.:</span><strong>${shortDateTime(new Date())}</strong></div>
            <div class="line"></div>
            ${sections.map(renderSection).join('<div class="line"></div>')}
            <div class="line"></div>
            <div class="grand-total">
              ${reportFooter.map(([label, value]) => `<div class="row total"><span>${escapeHtml(label)}:</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
            </div>
            <div class="line"></div>
            <div class="center foot">${escapeHtml(reportNote)}</div>
            <div class="center muted">Reporte generado desde MARKETSYS</div>
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;
    const printWindow = window.open("", title, "width=420,height=640");
    if (!printWindow) {
      setNotice({
        title: "No se pudo abrir la impresión",
        message: "Revisa si el navegador está bloqueando las ventanas emergentes para este sistema.",
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const content = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#c7d2fe] bg-[#f4f6ff] text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#ffffff_62%,#f8f9ff)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Módulo del cajero</p>
              <h2 className="text-xl font-black leading-tight text-[#111827]">Reportes</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">Filtro fecha desde</div>
                <label className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-2.5 py-2 text-xs font-black text-[#111827] shadow-sm">
                  <CalendarRange size={15} className="text-[#3157d5]" />
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-transparent font-black outline-none" />
                </label>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">Filtro fecha hasta</div>
                <label className="rounded-sm border border-[#c7d2fe] bg-white px-2.5 py-2 text-xs font-black text-[#111827] shadow-sm">
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-transparent font-black outline-none" />
                </label>
              </div>
              <button
                type="button"
                onClick={fetchData}
                className="grid h-9 w-9 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#3157d5] shadow-sm transition hover:bg-[#e0e7ff]"
                title="Actualizar"
              >
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-sm bg-[#3157d5] text-white shadow-sm transition hover:brightness-105"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-sm border px-3 py-2 text-xs font-black transition ${
                    active
                      ? "border-[#3157d5] bg-[#3157d5] text-white shadow-sm"
                      : "border-[#c7d2fe] bg-white text-[#111827] hover:bg-[#eef2ff]"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {activeTab === "resumen" && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Ventas" value={money(resumen.ventas_total)} helper={`${resumen.ventas_cantidad || 0} facturas emitidas`} icon={Receipt} />
                <MetricCard title="Impuestos" value={money(resumen.impuesto_ventas)} helper="Impuesto causado en ventas" icon={ClipboardList} />
                <MetricCard title="Ingresos" value={money(resumen.ingresos_financieros)} helper="Movimientos financieros" icon={Wallet} />
                <MetricCard title="Egresos" value={money(resumen.egresos_financieros)} helper="Gastos y salidas registradas" icon={CreditCard} />
              </div>

              <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-wide text-[#111827]">Formas de pago</h3>
                  <div className="mt-3 space-y-2">
                    {(reporte?.ventas_por_metodo || []).length ? (
                      reporte.ventas_por_metodo.map((item) => (
                        <div key={item.metodo_pago} className="flex items-center justify-between gap-3 rounded-sm bg-[#f4f6ff] px-3 py-2">
                          <div>
                            <p className="text-sm font-black capitalize text-[#111827]">{item.metodo_pago}</p>
                            <p className="text-xs font-bold text-[#4b5563]">{item.cantidad} operaciones</p>
                          </div>
                          <p className="text-sm font-black text-[#111827]">{money(item.total)}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState title="Sin pagos" text="No hay pagos registrados en este rango." />
                    )}
                  </div>
                </div>

                <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-wide text-[#111827]">Facturas recientes</h3>
                  <div className="mt-3 space-y-2">
                    {(reporte?.ventas_recientes || []).length ? (
                      reporte.ventas_recientes.map((venta) => (
                        <div key={venta.id_venta} className="rounded-sm border border-[#eef2ff] px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-[#111827]">{venta.numero_factura || `FV-${venta.id_venta}`}</p>
                            <p className="text-sm font-black text-[#111827]">{money(venta.total)}</p>
                          </div>
                          <p className="mt-1 text-xs font-bold text-[#4b5563]">{venta.responsable} · {shortDateTime(venta.fecha)}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState title="Sin facturas" text="No hay facturas registradas en este rango." />
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "cierres" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard title="Cajas" value={cajasFiltradas.length} helper={`${cajasAbiertas.length} abiertas · ${cajasCerradas.length} cerradas`} icon={Receipt} />
                <MetricCard title="Ventas caja" value={money(cajasFiltradas.reduce((sum, item) => sum + Number(item.total_ventas || 0), 0))} helper="Total reportado en el rango" icon={Wallet} />
                <MetricCard title="Diferencia" value={money(cajasCerradas.reduce((sum, item) => sum + Number(item.diferencia || 0), 0))} helper="Solo cajas cerradas" icon={BarChart3} />
              </div>
              <div className="overflow-hidden rounded-sm border border-[#dbe4ff] bg-white shadow-sm">
                <div className="grid grid-cols-[0.8fr_1fr_1fr_0.8fr_0.8fr] gap-3 border-b border-[#dbe4ff] bg-[#eef2ff] px-3 py-2 text-xs font-black uppercase text-[#233876] max-md:hidden">
                  <span>Estado</span>
                  <span>Responsable</span>
                  <span>Apertura / cierre</span>
                  <span>Total ventas</span>
                  <span>Diferencia</span>
                </div>
                {cajasFiltradas.length ? (
                  cajasFiltradas.map((caja) => (
                    <div key={caja.id_caja} className="grid gap-2 border-b border-[#eef2ff] px-3 py-3 text-sm font-bold text-[#111827] last:border-b-0 md:grid-cols-[0.8fr_1fr_1fr_0.8fr_0.8fr]">
                      <span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                          caja.estado === "abierta" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {caja.estado}
                        </span>
                      </span>
                      <span>{caja.nombre_usuario || `Caja #${caja.id_caja}`}</span>
                      <span className="text-[#4b5563]">{shortDateTime(caja.fecha_apertura)} / {caja.fecha_cierre ? shortDateTime(caja.fecha_cierre) : "Abierta"}</span>
                      <span>{money(caja.total_ventas)}</span>
                      <span className={caja.estado === "abierta" ? "text-slate-500" : Number(caja.diferencia || 0) === 0 ? "text-emerald-700" : "text-red-700"}>
                        {caja.estado === "abierta" ? "Pendiente" : money(caja.diferencia)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4">
                    <EmptyState title="Sin cierres" text="No se encontraron cierres de caja en este rango." />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "categorias" && (
            <div className="space-y-3">
              <div className="rounded-sm border border-[#c7d2fe] bg-[#eef4ff] px-4 py-3 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-wide text-[#111827]">Ventas por categoría</h3>
                <p className="mt-1 text-xs font-bold leading-5 text-[#47524e]">
                  Este reporte se calcula con el rango de fechas seleccionado en la parte superior. Por defecto se carga la fecha de hoy; cambia “desde” y “hasta” si necesitas consultar otro día o periodo.
                </p>
                <div className="mt-2 inline-flex rounded-sm bg-white px-2 py-1 text-[11px] font-black text-[#233876]">
                  Rango actual: {desde} a {hasta}
                </div>
              </div>

              <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                <div className="mt-1 space-y-2">
                  {(reporte?.ventas_por_categoria || []).length ? (
                    reporte.ventas_por_categoria.map((item) => (
                      <div key={item.categoria} className="grid gap-2 rounded-sm border border-[#eef2ff] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-[#111827] sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.9fr]">
                        <span className="font-black">{item.categoria}</span>
                        <span>{Number(item.facturas || 0)} facturas</span>
                        <span>{Number(item.unidades || 0).toLocaleString("es-CO")} und.</span>
                        <span className="font-black">{money(item.total)}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="Sin categorías" text="No hay ventas por categoría en este rango." />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="space-y-4">
              <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-wide text-[#111827]">Impresión rápida de reportes</h3>
                <p className="mt-1 text-xs font-bold leading-5 text-[#47524e]">
                  Estos tickets están pensados para impresora térmica de 80mm. Los reportes de ventas usan el rango de fechas seleccionado; la lista de precios usa el inventario activo actual.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    label: "Ticket productos",
                    type: "productos",
                    description: "Ranking de productos vendidos en el rango.",
                    metric: `${(reporte?.top_productos || []).length} productos`,
                  },
                  {
                    label: "Ticket categorías",
                    type: "categorias",
                    description: "Ventas agrupadas por categoría y unidades.",
                    metric: `${(reporte?.ventas_por_categoria || []).length} categorías`,
                  },
                  {
                    label: "Lista detallada de precios",
                    type: "precios",
                    description: "Catálogo activo: código, stock y precio de venta actual.",
                    metric: `${Number(resumen.productos_activos || 0)} productos`,
                  },
                  {
                    label: "Resumen diario impreso",
                    type: "resumen",
                    description: "Totales, pagos, impuestos, egresos y ventas por día.",
                    metric: `${Number(resumen.ventas_cantidad || 0)} facturas`,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => printReportTicket(item.type)}
                    className="group rounded-md border border-[#dbe4ff] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#3157d5] hover:shadow-md"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-base font-black text-[#111827]">{item.label}</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-[#47524e]">{item.description}</span>
                      </span>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#eef2ff] text-[#3157d5] transition group-hover:bg-[#3157d5] group-hover:text-white">
                        <Printer size={19} />
                      </span>
                    </span>
                    <span className="mt-3 flex items-center justify-between border-t border-[#eef2ff] pt-3">
                      <span className="rounded-sm bg-[#f8fbf7] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
                        {item.metric}
                      </span>
                      <span className="text-xs font-black text-[#3157d5]">Imprimir</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      {notice && (
        <ReportNotice
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

function ReportNotice({ title, message, onClose }) {
  return (
    <div
      className="absolute inset-0 z-[90] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm"
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
            <h3 className="text-lg font-black leading-tight text-[#111827]">{title}</h3>
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
