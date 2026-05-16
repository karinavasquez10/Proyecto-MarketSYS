import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  CalendarRange,
  Eye,
  FileDown,
  FileText,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import ModeloFactura from "../Admin/ModeloFactura";
import { obtenerConfiguracionSistema } from "../../services/configService";
import { imprimirTicketTermico } from "../../services/peripheralsService";
import { listarVentas, obtenerVenta } from "../../services/ventasService";
import { normalizeTicketData, printTicket } from "../../utils/ticketPrinter";

const money = (value) =>
  Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const dateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const readableDate = (value) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CO");
};

const readableTime = (value) => {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const csvValue = (value) => {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
};

const resolveReceivedAmount = (venta, fallbackTotal = 0) => {
  const stored = Number(venta?.efectivo_recibido ?? venta?.valor_recibido ?? 0);
  if (stored > 0) return stored;
  if (String(venta?.metodo_pago || "").toLowerCase() === "credito") return 0;
  return Number(fallbackTotal || venta?.total || 0);
};

const tabs = [
  { id: "historico", label: "Histórico", icon: Receipt },
  { id: "anuladas", label: "Anuladas", icon: Ban },
  { id: "responsables", label: "Responsables", icon: UserRound },
];

function ConsultaFacturas({ open, onClose, fechaInicial = "" }) {
  if (!open) return null;

  return createPortal(
    <ModalShell onClose={onClose}>
      <ConsultaFacturasBody onClose={onClose} fechaInicial={fechaInicial} />
    </ModalShell>,
    document.body
  );
}

function ModalShell({ children, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose?.();
    const previousOverflow = document.body.style.overflow;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#c7d2fe] bg-[#f4f6ff] text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ConsultaFacturasBody({ onClose, fechaInicial = "" }) {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [facturaDatos, setFacturaDatos] = useState(null);
  const [printConfig, setPrintConfig] = useState({});
  const [activeTab, setActiveTab] = useState("historico");
  const [notice, setNotice] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [fecha, setFecha] = useState("");
  const [cajero, setCajero] = useState("TODOS");
  const [medio, setMedio] = useState("TODOS");
  const [estado, setEstado] = useState("TODOS");
  const [ordenarPor, setOrdenarPor] = useState("reciente");
  const [pagina, setPagina] = useState(1);
  const porPagina = 9;

  const clearFilters = () => {
    setBusqueda("");
    setFecha("");
    setCajero("TODOS");
    setMedio("TODOS");
    setEstado("TODOS");
    setOrdenarPor("reciente");
  };

  const fetchFacturas = async () => {
    setRefreshing(true);
    setError("");
    try {
      const [ventasData, configData] = await Promise.all([
        listarVentas(),
        obtenerConfiguracionSistema(),
      ]);
      setFacturas(Array.isArray(ventasData) ? ventasData : []);
      setPrintConfig(configData?.grupos || {});
    } catch (err) {
      setError(err.message || "No se pudieron cargar las facturas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFacturas();
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, fecha, cajero, medio, estado, ordenarPor, activeTab]);

  const cajeros = useMemo(
    () => ["TODOS", ...Array.from(new Set(facturas.map((item) => item.nombre_usuario || ""))).filter(Boolean)],
    [facturas]
  );
  const medios = useMemo(
    () => ["TODOS", ...Array.from(new Set(facturas.map((item) => item.metodo_pago || ""))).filter(Boolean)],
    [facturas]
  );
  const estados = useMemo(
    () => ["TODOS", ...Array.from(new Set(facturas.map((item) => item.estado || "emitida"))).filter(Boolean)],
    [facturas]
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const base = facturas.filter((item) => {
      const estadoFactura = item.estado || "emitida";
      const campos = `${item.numero_factura || ""} ${item.id_venta || ""} ${item.fecha || ""} ${item.nombre_usuario || ""} ${item.metodo_pago || ""} ${item.total || ""} ${item.observaciones || ""}`.toLowerCase();
      const pasaBusqueda = !texto || campos.includes(texto);
      const pasaFecha = !fecha || dateOnly(item.fecha) === fecha;
      const pasaCajero = cajero === "TODOS" || item.nombre_usuario === cajero;
      const pasaMedio = medio === "TODOS" || item.metodo_pago === medio;
      const pasaEstado = estado === "TODOS" || estadoFactura === estado;
      const pasaTab = activeTab !== "anuladas" || estadoFactura === "anulada";
      return pasaBusqueda && pasaFecha && pasaCajero && pasaMedio && pasaEstado && pasaTab;
    });

    return [...base].sort((a, b) => {
      if (ordenarPor === "antiguo") return new Date(a.fecha) - new Date(b.fecha);
      if (ordenarPor === "mayor_total") return Number(b.total || 0) - Number(a.total || 0);
      if (ordenarPor === "menor_total") return Number(a.total || 0) - Number(b.total || 0);
      if (ordenarPor === "cajero") return (a.nombre_usuario || "").localeCompare(b.nombre_usuario || "");
      return new Date(b.fecha) - new Date(a.fecha);
    });
  }, [activeTab, busqueda, cajero, estado, facturas, fecha, medio, ordenarPor]);

  const resumen = useMemo(() => {
    const emitidas = filtradas.filter((item) => (item.estado || "emitida") !== "anulada");
    const anuladas = filtradas.filter((item) => (item.estado || "emitida") === "anulada");
    return {
      emitidas: emitidas.length,
      anuladas: anuladas.length,
      total: emitidas.reduce((sum, item) => sum + Number(item.total || 0), 0),
      impuesto: emitidas.reduce((sum, item) => sum + Number(item.impuesto || 0), 0),
    };
  }, [filtradas]);

  const responsables = useMemo(() => {
    const map = new Map();
    filtradas.forEach((item) => {
      const key = item.nombre_usuario || "Sin responsable";
      const current = map.get(key) || { responsable: key, facturas: 0, anuladas: 0, total: 0 };
      current.facturas += 1;
      if ((item.estado || "emitida") === "anulada") current.anuladas += 1;
      else current.total += Number(item.total || 0);
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtradas]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const filasActuales = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);

  const configValue = (group, key, fallback = "") => printConfig?.[group]?.[key]?.valor ?? fallback;

  const exportarListado = () => {
    const fechaGeneracion = new Date().toLocaleString("es-CO");
    const filtros = [
      ["Fecha de generación", fechaGeneracion],
      ["Filtro fecha", fecha || "Todas"],
      ["Filtro cajero", cajero],
      ["Filtro medio de pago", medio],
      ["Filtro estado", estado],
      ["Búsqueda", busqueda || "Sin búsqueda"],
      ["Orden", ordenarPor],
    ];

    const headers = [
      "Factura",
      "Fecha",
      "Hora",
      "Responsable",
      "Cliente",
      "Medio de pago",
      "Estado",
      "Subtotal",
      "Impuesto",
      "Total",
      "Observaciones",
    ];

    const rows = filtradas.map((item) => [
      item.numero_factura || `FV-${String(item.id_venta || 0).padStart(6, "0")}`,
      readableDate(item.fecha),
      readableTime(item.fecha),
      item.nombre_usuario || "Sin responsable",
      item.nombre_cliente || "Consumidor final",
      item.metodo_pago || "Sin medio",
      item.estado || "emitida",
      Number(item.subtotal || 0),
      Number(item.impuesto || 0),
      Number(item.total || 0),
      item.observaciones || "",
    ]);

    const csvLines = [
      ["MARKETSYS - LISTADO DE FACTURAS"].map(csvValue).join(";"),
      [],
      ...filtros.map((row) => row.map(csvValue).join(";")),
      [],
      ["Resumen"].map(csvValue).join(";"),
      ["Registros filtrados", filtradas.length].map(csvValue).join(";"),
      ["Facturas emitidas", resumen.emitidas].map(csvValue).join(";"),
      ["Facturas anuladas", resumen.anuladas].map(csvValue).join(";"),
      ["Total vendido", resumen.total].map(csvValue).join(";"),
      ["Impuestos", resumen.impuesto].map(csvValue).join(";"),
      [],
      headers.map(csvValue).join(";"),
      ...rows.map((row) => row.map(csvValue).join(";")),
    ];

    const blob = new Blob([`\uFEFF${csvLines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Listado_facturas_MARKETSYS_${fecha || stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const imprimirTicket = async (datosFactura) => {
    const tipo = configValue("impresion", "impresion.tipo", "navegador");
    const ticket = normalizeTicketData(datosFactura);

    if (tipo === "escpos_usb" || tipo === "escpos_lan") {
      const baseUrl = configValue("impresion", "impresion.conector_url", "http://127.0.0.1:5124");
      await imprimirTicketTermico({ baseUrl, ticket, config: printConfig });
      return;
    }

    printTicket(ticket, printConfig);
  };

  const openFacturaPreview = async (factura, modo = "print") => {
    try {
      const detalle = await obtenerVenta(factura.id_venta);
      const venta = detalle.venta || detalle || {};
      const items = detalle.detalles || detalle.detalle || detalle.items || [];
      const datosFactura = {
        numero: factura.numero_factura || `FV-${String(factura.id_venta).padStart(6, "0")}`,
        fecha: new Date(factura.fecha).toLocaleString("es-CO"),
        empresa: configValue("empresa", "empresa.nombre", "MERKA FRUVER FLORENCIA"),
        nit: configValue("empresa", "empresa.nit", "NIT: 000.000.000-0"),
        direccion: configValue("empresa", "empresa.direccion", "Florencia - Caqueta"),
        telefono: configValue("empresa", "empresa.telefono", ""),
        resolucion: configValue("facturacion", "facturacion.resolucion", configValue("empresa", "empresa.resolucion", "")),
        logoUrl: "/ticket-logo.jpeg",
        caja: factura.numero_caja ? `Caja ${factura.numero_caja}` : "Caja principal",
        sede: venta.sucursal?.nombre || venta.nombre_sucursal || factura.nombre_sucursal || configValue("empresa", "empresa.sede", "MERKA FRUVER FLORENCIA"),
        cliente: venta.cliente?.nombre || venta.nombre_cliente || "Consumidor final",
        clienteDocumento: venta.cliente?.identificacion || venta.identificacion || "",
        cajero: factura.nombre_usuario || venta.nombre_usuario,
        metodoPago: factura.metodo_pago || venta.metodo_pago,
        subtotal: venta.subtotal || factura.subtotal || 0,
        descuento: venta.descuento || factura.descuento || 0,
        iva: venta.impuesto || factura.impuesto || 0,
        total: venta.total || factura.total || 0,
        recibido: resolveReceivedAmount(venta, factura.total),
        cambio: venta.cambio_devuelto ?? venta.vuelto ?? venta.cambio ?? 0,
        productos: items.map((item) => ({
          id: item.id_producto || item.id || `${item.nombre_producto}-${item.precio_unitario}`,
          nombre: item.nombre || item.nombre_producto || "Producto",
          codigo: item.codigo_interno || item.codigo_barras || "",
          cantidad: item.cantidad || 1,
          precio: item.precio_unitario || item.precio || 0,
          unidad: item.unidad_abrev || item.unidad || "",
        })),
        modoVer: modo === "ver",
      };

      if (modo === "ver") {
        setFacturaDatos(datosFactura);
        return;
      }

      await imprimirTicket(datosFactura);
    } catch (err) {
      console.error("Error mostrando factura:", err);
      setNotice({
        title: "No se pudo mostrar la factura",
        message: "Intenta nuevamente. Si estás reimprimiendo, revisa que el navegador permita ventanas emergentes.",
      });
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[360px] place-items-center bg-[#f4f6ff]">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 animate-spin text-[#3157d5]" size={26} />
          <p className="text-sm font-black text-[#111827]">Cargando facturación...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#ffffff_58%,#f8f9ff)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Módulo del cajero</p>
            <h2 className="text-xl font-black leading-tight text-[#111827]">Facturación</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchFacturas}
              className="grid h-9 w-9 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#3157d5] shadow-sm transition hover:bg-[#e0e7ff]"
              title="Actualizar"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Ventas emitidas" value={resumen.emitidas} helper={money(resumen.total)} icon={Receipt} />
          <MetricCard title="Anuladas" value={resumen.anuladas} helper="Facturas sin efecto" icon={Ban} />
          <MetricCard title="Impuestos" value={money(resumen.impuesto)} helper="Dentro del filtro actual" icon={FileText} />
          <MetricCard title="Responsables" value={responsables.length} helper="Cajeros con movimiento" icon={UserRound} />
        </section>

        <section className="mt-4 rounded-sm border border-[#dbe4ff] bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-[#4b5563]">
              Los filtros se aplican automaticamente al cambiar cualquier campo.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFecha(fechaInicial || localDate())}
                className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#3157d5] transition hover:bg-[#eef2ff]"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff]"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]">
            <FilterControl label="Filtro por factura, cajero o medio">
              <label className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2">
                <Search size={16} className="text-[#3157d5]" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar factura, cajero, medio..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#111827] outline-none placeholder:text-[#6b7280]"
                />
              </label>
            </FilterControl>
            <FilterControl label="Filtro por fecha">
              <FieldIcon icon={CalendarRange}>
                <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="w-full bg-transparent text-sm font-black outline-none" />
              </FieldIcon>
            </FilterControl>
            <FilterControl label="Filtro por nombre cajero">
              <Select value={cajero} onChange={setCajero} options={cajeros} />
            </FilterControl>
            <FilterControl label="Filtro por medio de pago">
              <Select value={medio} onChange={setMedio} options={medios} />
            </FilterControl>
            <FilterControl label="Filtro por estado">
              <Select value={estado} onChange={setEstado} options={estados} />
            </FilterControl>
            <FilterControl label="Ordenar resultados">
            <Select
              value={ordenarPor}
              onChange={setOrdenarPor}
              options={[
                { value: "reciente", label: "Más reciente" },
                { value: "antiguo", label: "Más antiguo" },
                { value: "mayor_total", label: "Mayor total" },
                { value: "menor_total", label: "Menor total" },
                { value: "cajero", label: "Cajero A-Z" },
              ]}
            />
            </FilterControl>
          </div>
        </section>

        {activeTab === "responsables" ? (
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {responsables.length ? (
              responsables.map((item) => (
                <div key={item.responsable} className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#111827]">{item.responsable}</p>
                      <p className="mt-1 text-xs font-bold text-[#4b5563]">
                        {item.facturas} facturas · {item.anuladas} anuladas
                      </p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
                      <UserRound size={17} />
                    </span>
                  </div>
                  <p className="mt-4 text-xl font-black text-[#111827]">{money(item.total)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="No hay responsables con movimientos para los filtros seleccionados." />
            )}
          </section>
        ) : (
          <section className="mt-4 overflow-hidden rounded-sm border border-[#dbe4ff] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbe4ff] bg-[#eef2ff] px-3 py-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#233876]">Facturas encontradas</p>
                <p className="text-sm font-black text-[#111827]">{filtradas.length} registros</p>
              </div>
              <button
                type="button"
                onClick={exportarListado}
                disabled={filtradas.length === 0}
                className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-xs font-black text-[#3157d5] transition hover:bg-[#f8f9ff]"
              >
                <FileDown size={15} />
                Exportar listado
              </button>
            </div>

            <div className="hidden grid-cols-[0.9fr_0.8fr_1fr_0.7fr_0.6fr_0.8fr_0.8fr] gap-3 border-b border-[#dbe4ff] bg-white px-3 py-2 text-xs font-black uppercase text-[#233876] lg:grid">
              <span>Factura</span>
              <span>Fecha</span>
              <span>Responsable</span>
              <span>Medio</span>
              <span>Estado</span>
              <span className="text-right">Total</span>
              <span className="text-center">Acciones</span>
            </div>

            {filasActuales.length ? (
              filasActuales.map((factura) => {
                const estadoFactura = factura.estado || "emitida";
                const anulada = estadoFactura === "anulada";
                return (
                  <div
                    key={factura.id_venta}
                    className="grid gap-2 border-b border-[#eef2ff] px-3 py-3 text-sm font-bold text-[#111827] last:border-b-0 lg:grid-cols-[0.9fr_0.8fr_1fr_0.7fr_0.6fr_0.8fr_0.8fr] lg:items-center"
                  >
                    <div>
                      <p className="font-black">{factura.numero_factura || `FV-${String(factura.id_venta).padStart(6, "0")}`}</p>
                      <p className="text-xs text-[#4b5563] lg:hidden">{readableDate(factura.fecha)} · {readableTime(factura.fecha)}</p>
                    </div>
                    <span className="hidden text-[#4b5563] lg:block">{readableDate(factura.fecha)} · {readableTime(factura.fecha)}</span>
                    <span>{factura.nombre_usuario || "Sin responsable"}</span>
                    <span className="capitalize">{factura.metodo_pago || "Sin medio"}</span>
                    <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-black uppercase ${anulada ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {estadoFactura}
                    </span>
                    <span className={`font-black lg:text-right ${anulada ? "text-slate-400 line-through" : "text-[#111827]"}`}>
                      {money(factura.total)}
                    </span>
                    <div className="flex gap-2 lg:justify-center">
                      <ActionButton title="Ver factura" onClick={() => openFacturaPreview(factura, "ver")}>
                        <Eye size={15} />
                      </ActionButton>
                      <ActionButton title="Reimprimir" onClick={() => openFacturaPreview(factura, "print")}>
                        <Printer size={15} />
                      </ActionButton>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState text="No hay facturas que coincidan con los filtros seleccionados." />
            )}

            <Pagination pagina={pagina} setPagina={setPagina} totalPaginas={totalPaginas} />
          </section>
        )}
      </main>

      {facturaDatos && (
        <ModeloFactura
          open
          onClose={() => setFacturaDatos(null)}
          datos={facturaDatos}
        />
      )}

      {notice && (
        <InvoiceNotice
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </>
  );
}

function MetricCard({ title, value, helper, icon: Icon }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">{title}</p>
          <p className="mt-1 break-words text-xl font-black text-[#111827]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#4b5563]">{helper}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
          <Icon size={19} strokeWidth={2.7} />
        </span>
      </div>
    </div>
  );
}

function FieldIcon({ icon: Icon, children }) {
  return (
    <label className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-[#111827]">
      <Icon size={16} className="text-[#3157d5]" />
      {children}
    </label>
  );
}

function FilterControl({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
        {label}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-black text-[#111827] outline-none transition focus:border-[#3157d5]"
    >
      {options.map((option) => {
        const valueOption = typeof option === "string" ? option : option.value;
        const labelOption = typeof option === "string" ? option : option.label;
        return (
          <option key={valueOption} value={valueOption}>
            {labelOption}
          </option>
        );
      })}
    </select>
  );
}

function ActionButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#3157d5] transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
    >
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="m-3 rounded-sm border border-dashed border-[#c7d2fe] bg-[#f8f9ff] p-6 text-center">
      <p className="text-sm font-black text-[#111827]">{text}</p>
    </div>
  );
}

function Pagination({ pagina, setPagina, totalPaginas }) {
  if (totalPaginas <= 1) return null;

  const pages = Array.from({ length: totalPaginas }, (_, index) => index + 1)
    .filter((page) => page === 1 || page === totalPaginas || Math.abs(page - pagina) <= 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[#eef2ff] px-3 py-3">
      <button
        type="button"
        disabled={pagina === 1}
        onClick={() => setPagina((current) => Math.max(1, current - 1))}
        className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      {pages.map((page, index) => {
        const previous = pages[index - 1];
        const showGap = previous && page - previous > 1;
        return (
          <React.Fragment key={page}>
            {showGap && <span className="text-xs font-black text-[#6b7280]">...</span>}
            <button
              type="button"
              onClick={() => setPagina(page)}
              className={`h-8 min-w-8 rounded-sm px-2 text-xs font-black transition ${
                page === pagina
                  ? "bg-[#3157d5] text-white"
                  : "border border-[#c7d2fe] bg-white text-[#111827] hover:bg-[#eef2ff]"
              }`}
            >
              {page}
            </button>
          </React.Fragment>
        );
      })}
      <button
        type="button"
        disabled={pagina === totalPaginas}
        onClick={() => setPagina((current) => Math.min(totalPaginas, current + 1))}
        className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}

function InvoiceNotice({ title, message, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-100 text-rose-700">
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
          className="mt-5 w-full rounded-sm bg-[#b91c1c] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default ConsultaFacturas;
