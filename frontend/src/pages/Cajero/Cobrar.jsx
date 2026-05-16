import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ReceiptText, Wallet, X, UserPlus } from "lucide-react";
import { crearCliente as crearClienteService } from "../../services/clientesService";
import { obtenerConfiguracionSistema } from "../../services/configService";
import { imprimirTicketTermico } from "../../services/peripheralsService";
import { ensureOk } from "../../services/responseUtils";
import { crearVenta } from "../../services/ventasService";
import { normalizeTicketData, printTicket } from "../../utils/ticketPrinter";

/* ======= Hook para sincronizar el modo de color global ======= */

function useSystemTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return "light";
}

/* ======= Componente principal ======= */
function Cobrar({
  initialCliente = null,
  carrito = [],
  descuentoGlobalInicial = 0,
  descuentoPorcentajeInicial = 0,
  usuario,
  idCaja,
  onClose,
  onSuccess,
}) {
  const theme = useSystemTheme();
  const [printConfig, setPrintConfig] = useState({});

  const [efectivo, setEfectivo] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [cliente, setCliente] = useState(initialCliente);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [saleResult, setSaleResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    identificacion: "",
    direccion: "",
    telefono: "",
    correo: "",
    tipo: "persona",
  });

  // Normalizar items recibidos
  const [items, setItems] = useState([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(Number(descuentoGlobalInicial || 0));

  useEffect(() => {
    obtenerConfiguracionSistema()
      .then((data) => setPrintConfig(data?.grupos || {}))
      .catch(() => setPrintConfig({}));
  }, []);

  useEffect(() => {
    const normalizedItems = (carrito || []).map((it) => ({
        id_producto: it.id_producto ?? it.id,
        nombre: it.nombre || it.name || it.producto || it.nombre_producto || "",
        codigo: it.codigo_interno || it.internalCode || it.codigo_barras || it.barcode || "",
        categoria: it.categoria || it.category || "",
        cantidad: it.cantidad ?? it.quantity ?? 1,
        precio_unitario: it.precio_unitario ?? it.price ?? 0,
        descuento: it.descuento ?? 0,
        descuento_porcentaje: it.descuento_porcentaje ?? it.discountPercent ?? 0,
        tax_rate: it.tax_rate ?? 0,
        unidad: it.unidad ?? it.unit ?? it.unit_abrev ?? it.unidad_abrev ?? "",
      }));
    setItems(normalizedItems);
  }, [carrito]);

  useEffect(() => {
    setDescuentoGlobal(Number(descuentoGlobalInicial || 0));
  }, [descuentoGlobalInicial]);

  const handleClear = () => setEfectivo("");

  const includedTax = (amount, rate) => {
    const numericAmount = Number(amount || 0);
    const numericRate = Number(rate || 0);
    if (numericAmount <= 0 || numericRate <= 0) return 0;
    return numericAmount - numericAmount / (1 + numericRate);
  };

  // El precio de venta ya incluye impuesto. El impuesto se calcula por dentro.
  function calcularSubtotalBruto() {
    return items.reduce(
      (s, it) => s + (it.precio_unitario * it.cantidad) - (it.descuento || 0),
      0
    );
  }

  function calcularImpuesto() {
    if (descuentoGlobal === 0) {
      return items.reduce(
        (s, it) => s + includedTax((it.precio_unitario * it.cantidad) - (it.descuento || 0), it.tax_rate),
        0
      );
    }

    // Con descuento global: prorratear descuento por ítem
    const subtotalBruto = calcularSubtotalBruto();
    if (subtotalBruto <= 0) return 0;
    return items.reduce((s, it) => {
      const base_item = (it.precio_unitario * it.cantidad) - (it.descuento || 0);
      const prorated_desc = (base_item / subtotalBruto) * descuentoGlobal;
      const discounted_item = base_item - prorated_desc;
      return s + includedTax(discounted_item, it.tax_rate);
    }, 0);
  }

  function calcularTotal() {
    const subtotalBruto = calcularSubtotalBruto();
    const subtotalNeto = subtotalBruto - descuentoGlobal;
    return subtotalNeto;
  }

  const subtotalBruto = calcularSubtotalBruto();
  const subtotalNeto = subtotalBruto - descuentoGlobal;
  const impuesto = calcularImpuesto();
  const total = calcularTotal();
  const descuentoProductos = items.reduce((sum, item) => sum + Number(item.descuento || 0), 0);

  const efectivoFloat = parseFloat(efectivo || "0") || 0;
  const requiereValorRecibido = metodoPago === "efectivo" || metodoPago === "mixto";
  const valorMostradoRecibido = requiereValorRecibido ? efectivoFloat : total;
  const cambio = requiereValorRecibido ? efectivoFloat - total : 0;

  const money = (n) =>
    (Number(n) || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const quickPaymentOptions = [
    { label: "Exacto", value: total },
    { label: "$5.000", value: 5000 },
    { label: "$10.000", value: 10000 },
    { label: "$20.000", value: 20000 },
    { label: "$50.000", value: 50000 },
    { label: "$100.000", value: 100000 },
  ].filter((option, index, array) =>
    Number(option.value) > 0 &&
    array.findIndex((item) => Math.round(item.value) === Math.round(option.value)) === index
  );

  const applyQuickPayment = (value) => {
    if (!requiereValorRecibido) return;
    setEfectivo(String(Math.round(Number(value) || 0)));
  };

  const configValue = (group, key, fallback = "") => printConfig?.[group]?.[key]?.valor ?? fallback;

  const imprimirTicket = async (datosFactura) => {
    const tipo = configValue("impresion", "impresion.tipo", "navegador");
    const ticket = normalizeTicketData(datosFactura);

    if (tipo === "escpos_usb" || tipo === "escpos_lan") {
      const baseUrl = configValue("impresion", "impresion.conector_url", "http://127.0.0.1:5124");
      await imprimirTicketTermico({
        baseUrl,
        ticket,
        config: printConfig,
      });
      return;
    }

    printTicket(ticket, printConfig);
  };

  const validatePayment = (metodoPago = "efectivo") => {
    if (items.length === 0) {
      setNotice({
        type: "warning",
        title: "Documento vacío",
        message: "Agrega productos al carrito antes de procesar el pago.",
      });
      return false;
    }
    if (metodoPago === "credito") {
      if (!cliente) {
        setNotice({
          type: "warning",
          title: "Cliente requerido",
          message: "Selecciona o crea un cliente para registrar la factura a crédito.",
        });
        return false;
      }
      return true;
    }
    const requiereEfectivo = metodoPago === "efectivo" || metodoPago === "mixto";
    if (requiereEfectivo && efectivoFloat < total) {
      setNotice({
        type: "warning",
        title: "Valor recibido insuficiente",
        message: "El efectivo recibido debe ser igual o mayor al total de la venta.",
        details: [
          { label: "Total", value: money(total) },
          { label: "Recibido", value: money(efectivoFloat) },
          { label: "Faltante", value: money(total - efectivoFloat) },
        ],
      });
      return false;
    }
    return true;
  };

  async function crearCliente() {
    if (!nuevoCliente.nombre || !nuevoCliente.identificacion) {
      setNotice({
        type: "warning",
        title: "Datos incompletos",
        message: "Nombre e identificación son obligatorios para crear el cliente.",
      });
      return;
    }

    try {
      const res = await crearClienteService(nuevoCliente);
      await ensureOk(res, "Error creando cliente");

      const c = await res.json();
      setCliente(c);
      setShowNuevoCliente(false);
      setNuevoCliente({
        nombre: "",
        identificacion: "",
        direccion: "",
        telefono: "",
        correo: "",
        tipo: "persona",
      });
    } catch (error) {
      console.error("Error creando cliente:", error);
      setNotice({
        type: "error",
        title: "No se pudo crear el cliente",
        message: error.message || "Revisa los datos del cliente e intenta nuevamente.",
      });
    }
  }

async function confirmarVenta(metodo_pago = "efectivo", imprimir = false) {
  const esCredito = metodo_pago === "credito";
  if (!validatePayment(metodo_pago)) return;

  if (!esCredito && !idCaja) {
    setNotice({
      type: "error",
      title: "No hay caja abierta",
      message: "Abre una caja antes de facturar ventas de contado.",
    });
    return;
  }

  // Cálculos finales
  const subtotalFinal = subtotalBruto;
  const descuentoFinal = descuentoGlobal;
  const subtotalNetoFinal = subtotalNeto;
  const impuestoFinal = impuesto;
  const totalFinal = total;

  // ====== CORRECCIÓN: Calcular cambio REAL ======
  const requiereEfectivo = metodo_pago === "efectivo" || metodo_pago === "mixto";
  const efectivoDado = esCredito ? 0 : requiereEfectivo ? (parseFloat(efectivo || "0") || 0) : totalFinal;
  const cambioReal = requiereEfectivo ? Math.max(0, efectivoDado - totalFinal) : 0;
  
  // Calcular total por ítem con prorrateo
  const itemsWithTotals = items.map((it) => {
    const base_item = (it.precio_unitario * it.cantidad) - (it.descuento || 0);
    let subtotal_item = base_item;
    let tax_item = includedTax(base_item, it.tax_rate);
    if (descuentoGlobal > 0) {
      const prorated_desc = subtotalBruto > 0 ? (base_item / subtotalBruto) * descuentoGlobal : 0;
      subtotal_item = base_item - prorated_desc;
      tax_item = includedTax(subtotal_item, it.tax_rate);
    }
    const total_item = subtotal_item;
    return {
      id_producto: it.id_producto,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      descuento: it.descuento || 0,
      subtotal: subtotal_item,
      impuesto: tax_item,
      total: total_item,
    };
  });

  const payload = {
    id_cliente: cliente ? cliente.id_cliente || cliente.id : null,
    id_usuario: usuario.id_usuario || usuario.id,
    id_caja: idCaja,
    subtotal: subtotalFinal,
    descuento: descuentoFinal,
    subtotal_neto: subtotalNetoFinal,
    impuesto: impuestoFinal,
    total: totalFinal,
    metodo_pago,
    valor_recibido: efectivoDado,
    cambio: cambioReal,
    cambio_devuelto: cambioReal,
    fecha_vencimiento: esCredito && fechaVencimiento ? fechaVencimiento : null,
    observaciones: esCredito
      ? `Venta a crédito. Vence: ${fechaVencimiento || "sin fecha"}. Descuento global: ${money(descuentoGlobal)}`
      : `Descuento global: ${money(descuentoGlobal)}. Efectivo: ${money(efectivoDado)}. Cambio: ${money(cambioReal)}`,
    items: itemsWithTotals,
  };

  try {
    // 1. Registrar venta
    const res = await crearVenta(payload);
    await ensureOk(res, "No se pudo guardar la venta.");

    const data = await res.json();

    // 4. Limpiar carrito
    if (onSuccess) {
      onSuccess();
    }

if (imprimir) {
  try {
    // 1️⃣ Datos de la factura
    const datosFactura = {
      numero: data.numero_factura || `FV-${String(data.id_venta).padStart(6, "0")}`,
      fecha: new Date().toLocaleString("es-CO"),
      cliente: cliente?.nombre || "Consumidor final",
      clienteDocumento: cliente?.identificacion || cliente?.documento || "",
      cajero: usuario?.nombre || "Cajero",
      metodoPago: metodo_pago,
      caja: idCaja ? `Caja ${idCaja}` : "Caja principal",
      sede: "MERKA FRUVER FLORENCIA",
      logoUrl: "/ticket-logo.jpeg",
      subtotal: subtotalFinal,
      descuento: descuentoFinal,
      iva: impuestoFinal,
      total: totalFinal,
      recibido: efectivoDado,
      cambio: cambioReal,
      productos: items.map((it) => ({
        id: it.id_producto,
        nombre: it.nombre,
        codigo: it.codigo_interno || it.codigo_barras || "",
        cantidad: it.cantidad,
        precio: it.precio_unitario,
        unidad: it.unidad,
      })),
    };
    await imprimirTicket(datosFactura);

  } catch (err) {
    console.error("Error al mostrar factura:", err);
    setNotice({
      type: "error",
      title: "No se pudo imprimir",
      message: "La venta fue registrada, pero no se pudo abrir la vista previa o enviar la impresión.",
    });
  }
}

    setSaleResult({
      idVenta: data.id_venta,
      numero: data.numero_factura || `FV-${String(data.id_venta).padStart(6, "0")}`,
      metodo: metodo_pago,
      esCredito,
      total: totalFinal,
      recibido: efectivoDado,
      cambio: cambioReal,
      cliente: cliente?.nombre || "Consumidor final",
      imprimio: imprimir,
    });
  } catch (err) {
    console.error("Error en confirmarVenta:", err);
    setNotice({
      type: "error",
      title: "No se pudo registrar la venta",
      message: err.message || "Ocurrió un error inesperado al confirmar el pago.",
    });
  }
}

  const closeSuccessModal = () => {
    setSaleResult(null);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`cashier-modal-light relative grid h-[88vh] max-h-[700px] w-[94vw] max-w-[980px] grid-rows-[auto,minmax(0,1fr)] overflow-hidden rounded-md border shadow-2xl transition-all duration-300
          ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-[#c7d2fe]"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#233876,#3157d5)] px-2 py-0.5 text-white dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="text-[9px] font-black uppercase tracking-wide text-white/90">Caja POS</div>
            <h2 className="text-xs font-black leading-tight">Cobrar documento</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-5 w-5 place-items-center rounded-sm border border-white/20 transition hover:bg-white/15"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:grid-cols-[1.08fr_0.92fr] md:overflow-hidden">
        {/* Panel izquierdo */}
        <div
          className={`flex min-h-0 flex-col justify-between overflow-y-auto p-2.5 transition-colors duration-300 sm:p-3
            ${
              theme === "dark"
                ? "bg-slate-900 text-slate-100"
                : "bg-[#f4f6ff] text-[#111827]"
            }
          `}
        >
          <div>
            <div className="mb-2 grid gap-1.5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-sm border border-[#c7d2fe] bg-white p-2.5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-wide text-[#233876]">
                  Total a pagar
                </div>
                <div className="mt-0.5 text-2xl font-black tracking-tight text-[#111827]">
                  {money(total)}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#e0e7ff]">
                  <div className="h-full w-full bg-[linear-gradient(90deg,#3157d5,#16a34a)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <InfoChip label="Productos" value={items.length} />
                <InfoChip label="Pago" value={metodoPago} />
                <InfoChip label="Desc. prod." value={money(descuentoProductos)} />
                <InfoChip label="Imp." value={money(impuesto)} />
              </div>
            </div>

            <div className="rounded-sm border border-[#c7d2fe] bg-white p-1.5 text-xs shadow-sm">
              <div className="grid grid-cols-3 gap-1.5 [&_*]:!text-[#111827]">
                <InfoChip label="Subtotal" value={money(subtotalBruto)} />
                <InfoChip label="Desc. doc." value={money(descuentoGlobal)} />
                <InfoChip label="Neto" value={money(subtotalNeto)} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-[#dbe4ff] pt-1.5 dark:border-slate-700">
                <span className="text-[11px] font-black uppercase tracking-wide text-[#59625f]">Cliente</span>
                {cliente ? (
                  <div className="text-right">
                    <div className="text-xs font-black">{cliente.nombre}</div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{cliente.identificacion}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs font-black text-[#111827]">Consumidor final</div>
                      <div className="text-[10px] font-semibold text-[#4b5563]">Cliente por defecto</div>
                    </div>
                    <button
                      className="flex items-center gap-1 rounded-sm bg-[#3157d5] px-2 py-1.5 text-[10px] font-black text-white transition hover:bg-[#233876]"
                      onClick={() => setShowNuevoCliente(true)}
                    >
                      <UserPlus size={13} />
                      Nuevo
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-1 mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#233876]">Productos facturados</span>
              <span className="text-[10px] font-bold text-[#4b5563]">Descuento desde carrito</span>
            </div>

            <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1 lg:max-h-[345px]">
              {items.map((item, idx) => {
                const nombreProducto = item.nombre || item.codigo || `Producto ${idx + 1}`;
                const base_item = (item.precio_unitario * item.cantidad) - (item.descuento || 0);
                let subtotal_item = base_item;
                let tax_item = includedTax(base_item, item.tax_rate);
                let total_item = base_item;
                if (descuentoGlobal > 0) {
                  const prorated_desc = (base_item / subtotalBruto) * descuentoGlobal;
                  subtotal_item = base_item - prorated_desc;
                  tax_item = includedTax(subtotal_item, item.tax_rate);
                  total_item = subtotal_item;
                }
                return (
                  <div
                    key={idx}
                    className="rounded-sm border border-[#dbe4ff] bg-white px-2 py-1 text-[10px] shadow-sm"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0">
                        <span className="block truncate text-[11px] font-black uppercase leading-tight text-[#111827] dark:text-white">
                          {nombreProducto}
                        </span>
                        {(item.categoria || item.codigo) && (
                          <span className="mt-0.5 block truncate text-[8px] font-black uppercase tracking-wide text-[#4b5563]">
                            {[item.categoria, item.codigo].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-[11px] font-black text-[#233876]">{money(total_item)}</span>
                        {item.descuento > 0 && (
                          <span className="block text-[9px] font-black text-emerald-700">
                            -{money(item.descuento)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <span className="rounded-full bg-[#eef2ff] px-1.5 py-0.5 text-[9px] font-black text-[#111827]">
                        {item.cantidad} {item.unidad || "ud"}
                      </span>
                      <span className="text-[9px]">x {money(item.precio_unitario)}</span>
                      {item.descuento > 0 && (
                        <span className="text-[9px] font-black text-emerald-700">
                          Desc. {item.descuento_porcentaje || ""}% {money(item.descuento)}
                        </span>
                      )}
                      {item.tax_rate > 0 && <span className="text-[9px]">IVA: {money(tax_item)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 text-center text-[10px] font-semibold text-slate-600 dark:text-slate-400">
            MARKETSYS POS
          </div>
        </div>

        {/* Panel derecho */}
        <div
          className={`flex min-h-0 flex-col overflow-hidden border-l p-2 transition-colors duration-300
            ${
              theme === "dark"
                ? "bg-slate-800 border-slate-700 text-slate-100"
                : "bg-[#fbfcff] border-[#c7d2fe] text-[#111827]"
            }
          `}
        >
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <section className="rounded-sm border border-[#c7d2fe] bg-white p-2 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-[0.85fr_1.15fr]">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">Método</span>
                <select
                  value={metodoPago}
                  onChange={(event) => setMetodoPago(event.target.value)}
                  className="h-10 w-full rounded-sm border border-[#3157d5] bg-[#fffdf8] px-3 text-xs font-black capitalize text-[#111827] outline-none transition focus:ring-2 focus:ring-[#c7d2fe]"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="nequi">Nequi</option>
                  <option value="mixto">Mixto</option>
                  <option value="credito">Crédito</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">
                  {requiereValorRecibido ? "Valor recibido" : "Valor registrado"}
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="$0"
                  value={efectivo}
                  onChange={(e) => setEfectivo(e.target.value)}
                  disabled={!requiereValorRecibido}
                  className="h-10 w-full rounded-sm border border-[#3157d5] bg-[#f8f9ff] px-3 text-right text-lg font-black text-[#111827] outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-[#c7d2fe]"
                />
              </label>
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-xs">
              <div className="rounded-sm border border-[#dbe4ff] bg-[#f8f9ff] px-2 py-1.5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-wide text-[#4b5563]">Recibido</div>
                <div className="mt-0.5 text-sm font-black text-[#111827]">{money(valorMostradoRecibido)}</div>
              </div>
              <div className={`rounded-sm border px-2 py-1.5 shadow-sm ${
                cambio < 0
                  ? "border-rose-300 bg-rose-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}>
                <div className={`text-[10px] font-black uppercase tracking-wide ${cambio < 0 ? "text-[#000000]" : "text-emerald-700"}`}>
                  {cambio < 0 ? "Faltante" : "Cambio"}
                </div>
                <div className={`mt-0.5 text-sm font-black ${cambio < 0 ? "text-[#7f1d1d]" : "text-emerald-700"}`}>
                  {money(cambio < 0 ? Math.abs(cambio) : cambio)}
                </div>
              </div>
            </div>
          </section>

          {/* Pagos rápidos */}
          <section className="rounded-sm border border-[#c7d2fe] bg-white p-2 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#233876]">Pagos rápidos</span>
              <span className="text-[10px] font-bold text-[#4b5563]">Teclado o botón</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {quickPaymentOptions.map((option) => (
                <button
                  key={`${option.label}-${Math.round(option.value)}`}
                  type="button"
                  onClick={() => applyQuickPayment(option.value)}
                  disabled={!requiereValorRecibido}
                  className="h-8 rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-1 py-1 text-center transition hover:border-[#3157d5] hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="block truncate text-[10px] font-black uppercase tracking-wide text-[#233876]">
                    {option.label}
                  </span>
                  <span className="block truncate text-[8px] font-black text-[#111827]">
                    {money(option.value)}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={!requiereValorRecibido || !efectivo}
                className="h-8 rounded-sm border border-rose-200 bg-rose-50 px-1 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#7f1d1d] transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-[#7f1d1d]"
              >
                Limpiar
              </button>
            </div>
            {!requiereValorRecibido && (
              <div className="mt-1.5 rounded-sm bg-[#eef2ff] px-2 py-1 text-center text-[10px] font-black text-[#111827]">
                Este método registra el valor exacto de la venta.
              </div>
            )}
          </section>

          {cliente && (
            <section className="rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] p-2.5">
              <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">
                Vencimiento crédito
              </label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
              />
            </section>
          )}

          </div>

          {/* Botones finales */}
          <div className="shrink-0 border-t border-[#dbe4ff] bg-white pt-1.5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex gap-2 mb-1">
            <button
              onClick={onClose}
              className={`flex-1 rounded-sm py-1.5 text-xs font-black transition ${
                theme === "dark"
                  ? "bg-rose-700 hover:bg-rose-800"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={() => confirmarVenta(metodoPago)}
              className={`flex-1 rounded-sm py-1.5 text-xs font-black transition ${
                theme === "dark"
                  ? "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] hover:bg-[#233876]"
                  : "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] hover:bg-[#233876] text-white"
              }`}
            >
              Confirmar
            </button>
          </div>

          <button
            onClick={() => confirmarVenta(metodoPago, true)}
            className={`mb-1 w-full rounded-sm py-2 text-sm font-black shadow-sm transition ${
              theme === "dark"
                ? "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] hover:bg-[#233876]"
                : "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] hover:bg-[#233876] text-white"
            }`}
          >
          Confirmar e Imprimir
        </button>
          {metodoPago === "credito" && !cliente && (
      <div
        className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-black !text-black"
        style={{ color: "#000000" }}
      >
        <span className="!text-black" style={{ color: "#000000" }}>
          Selecciona o crea un cliente para registrar la factura a crédito.
        </span>
      </div>
          )}
        </div>
        </div>
        </div>
      </div>

      {/* Modal Nuevo Cliente */}
      {showNuevoCliente && (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 p-3"
          onClick={() => setShowNuevoCliente(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[390px] overflow-y-auto rounded-sm border border-[#c7d2fe] bg-white p-4 text-[#111827] shadow-2xl [color-scheme:light]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#dbe4ff] pb-2.5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-[#3157d5]">Cliente rápido</div>
                <h3 className="text-base font-black text-[#111827]">Nuevo Cliente</h3>
              </div>
              <button
                onClick={() => setShowNuevoCliente(false)}
                className="rounded-sm border border-[#c7d2fe] bg-white p-2 text-[#152b73] transition hover:bg-[#eef2ff]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <InputField
                label="Nombre *"
                value={nuevoCliente.nombre}
                onChange={(v) => setNuevoCliente({ ...nuevoCliente, nombre: v })}
              />
              <InputField
                label="Identificación *"
                value={nuevoCliente.identificacion}
                onChange={(v) =>
                  setNuevoCliente({ ...nuevoCliente, identificacion: v })
                }
              />
              <select
                value={nuevoCliente.tipo}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, tipo: e.target.value })
                }
                className="h-9 w-full rounded-sm border border-[#c7d2fe] bg-white px-3 text-xs font-black text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              >
                <option value="persona">Persona</option>
                <option value="empresa">Empresa</option>
              </select>
              <InputField
                label="Teléfono"
                value={nuevoCliente.telefono}
                onChange={(v) => setNuevoCliente({ ...nuevoCliente, telefono: v })}
              />
              <InputField
                label="Correo"
                value={nuevoCliente.correo}
                onChange={(v) => setNuevoCliente({ ...nuevoCliente, correo: v })}
              />
              <textarea
                value={nuevoCliente.direccion}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })
                }
                className="w-full resize-none rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-xs font-black text-[#111827] outline-none placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                placeholder="Dirección completa"
                rows={2}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setShowNuevoCliente(false)}
                className="flex-1 rounded-sm border border-slate-200 bg-white py-1.5 text-xs font-black text-[#111827] transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={crearCliente}
                className="flex-1 rounded-sm bg-[linear-gradient(135deg,#3157d5,#4f46e5)] py-1.5 text-xs font-black text-white transition hover:bg-[#233876]"
              >
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <PaymentNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          details={notice.details}
          onClose={() => setNotice(null)}
        />
      )}

      {saleResult && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
          onClick={closeSuccessModal}
        >
          <div
            className="w-full max-w-[460px] overflow-hidden rounded-md border border-white/70 bg-white text-[#111827] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-[linear-gradient(135deg,#233876,#3157d5_58%,#18a36b)] px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-white/15">
                  <CheckCircle2 size={28} />
                </span>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-white/80">
                    Documento registrado
                  </div>
                  <h3 className="text-lg font-black leading-tight">
                    {saleResult.esCredito ? "Venta a crédito guardada" : "Venta registrada correctamente"}
                  </h3>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-2">
                <SuccessInfo label="Factura" value={saleResult.numero} icon={<ReceiptText size={15} />} />
                <SuccessInfo label="Método" value={saleResult.metodo} icon={<Wallet size={15} />} />
                <SuccessInfo label="Cliente" value={saleResult.cliente} />
                <SuccessInfo label="Total" value={money(saleResult.total)} strong />
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border border-[#dbe4ff] bg-[#f8fbf7] p-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-[#233876]">
                    {saleResult.esCredito ? "Saldo pendiente" : "Recibido"}
                  </div>
                  <div className="mt-1 text-xl font-black text-[#111827]">
                    {money(saleResult.esCredito ? saleResult.total : saleResult.recibido)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-wide text-[#233876]">
                    Cambio
                  </div>
                  <div className="mt-1 text-xl font-black text-emerald-700">
                    {money(saleResult.esCredito ? 0 : saleResult.cambio)}
                  </div>
                </div>
              </div>

              {saleResult.imprimio && (
                <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                  La factura fue enviada a impresión o vista previa.
                </div>
              )}

              <button
                type="button"
                onClick={closeSuccessModal}
                className="w-full rounded-sm bg-[linear-gradient(135deg,#3157d5,#18a36b)] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======= Componentes auxiliares ======= */
function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="font-semibold text-[#59625f]">{label}:</span>
      <span className="font-black text-[#303735]">{value}</span>
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div className="rounded-sm border border-[#b7c4ee] bg-white px-2 py-1 text-[#111827] shadow-sm">
      <div className="text-[9px] font-black uppercase tracking-wide text-[#111827]">
        {label}
      </div>
      <div className="truncate text-[11px] font-black text-[#111827]">
        {value}
      </div>
    </div>
  );
}

function SuccessInfo({ label, value, icon = null, strong = false }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
        {icon}
        {label}
      </div>
      <div className={`mt-1 truncate ${strong ? "text-base" : "text-sm"} font-black text-[#111827] capitalize`}>
        {value || "Sin dato"}
      </div>
    </div>
  );
}

function PaymentNotice({ type = "warning", title, message, details = [], onClose }) {
  const styles = {
    warning: {
      icon: "bg-amber-100 text-amber-700 border-amber-200",
      button: "bg-[#111827] text-white",
    },
    error: {
      icon: "bg-rose-100 text-rose-700 border-rose-200",
      button: "bg-[#b91c1c] text-white",
    },
    success: {
      icon: "bg-emerald-100 text-emerald-700 border-emerald-200",
      button: "bg-[linear-gradient(135deg,#3157d5,#18a36b)] text-white",
    },
  };
  const current = styles[type] || styles.warning;
  const Icon = type === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className="absolute inset-0 z-[85] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${current.icon}`}>
            <Icon size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight text-[#111827]">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>

        {details.length > 0 && (
          <div className="mt-4 grid gap-2 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] p-3">
            {details.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-black uppercase tracking-wide text-[#47524e]">{item.label}</span>
                <span className="font-black text-[#111827]">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-5 w-full rounded-sm px-4 py-2.5 text-sm font-black shadow-sm transition hover:brightness-105 ${current.button}`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-sm border border-[#c7d2fe] bg-white px-3 text-xs font-black text-[#111827] outline-none placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
      />
    </div>
  );
}

export default Cobrar;
