const money = (value) =>
  (Number(value) || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const configValue = (config, key, fallback = "") => {
  if (config?.[key]?.valor !== undefined) return config[key].valor;
  if (config?.[key] !== undefined && typeof config[key] !== "object") return config[key];

  const [group, ...rest] = String(key).split(".");
  const groupedKey = `${group}.${rest.join(".")}`;
  if (config?.[group]?.[groupedKey]?.valor !== undefined) return config[group][groupedKey].valor;
  if (config?.[group]?.[key]?.valor !== undefined) return config[group][key].valor;
  return fallback;
};

const lineTotal = (product) => {
  const qty = Number(product.cantidad || product.quantity || 0);
  const price = Number(product.precio || product.precio_unitario || product.price || 0);
  return qty * price;
};

export const buildTicketHtml = (datos = {}, config = {}) => {
  const width = Number(configValue(config, "impresion.ancho_ticket_mm", 80)) || 80;
  const businessName = datos.empresa || configValue(config, "empresa.nombre", "MERKA FRUVER FLORENCIA");
  const nit = datos.nit || configValue(config, "empresa.nit", "NIT: 000.000.000-0");
  const address = datos.direccion || configValue(config, "empresa.direccion", "Florencia - Caqueta");
  const phone = datos.telefono || configValue(config, "empresa.telefono", "");
  const rawSede = datos.sede || configValue(config, "empresa.sede", "MERKA FRUVER FLORENCIA");
  const sede = String(rawSede || "").trim().toUpperCase() === "MARKETSYS" ? "MERKA FRUVER FLORENCIA" : rawSede;
  const resolucion = datos.resolucion || configValue(config, "facturacion.resolucion", configValue(config, "empresa.resolucion", ""));
  const footer = configValue(config, "impresion.pie_ticket", "Gracias por su compra");
  const logoPath = datos.logoUrl || configValue(config, "impresion.logo_ticket", "/ticket-logo.jpeg");
  const logoUrl = logoPath && logoPath.startsWith("/") && typeof window !== "undefined"
    ? `${window.location.origin}${logoPath}`
    : logoPath;
  const caja = datos.caja || "Caja principal";
  const productos = Array.isArray(datos.productos) ? datos.productos : [];
  const impuesto = Number(datos.iva || 0);
  const subtotalNeto = Number(datos.subtotal || 0) - Number(datos.descuento || 0);
  const totalItems = productos.reduce((sum, product) => sum + Number(product.cantidad || product.quantity || 0), 0);
  const fechaObj = datos.fecha ? new Date(datos.fecha) : new Date();
  const fechaTexto = Number.isNaN(fechaObj.getTime()) ? String(datos.fecha || "").split(",")[0] : fechaObj.toLocaleDateString("es-CO");
  const horaTexto = Number.isNaN(fechaObj.getTime())
    ? String(datos.fecha || "").split(",").slice(1).join(",").trim()
    : fechaObj.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return `
    <html>
      <head>
        <title>${escapeHtml(datos.numero || "Ticket")}</title>
        <style>
          @page { size: ${width}mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            background: #e9edf3;
            color: #000;
            font-family: "Courier New", "Roboto Mono", monospace;
            font-size: 11px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 20px;
          }
          .screen-shell {
            width: ${width}mm;
          }
          .ticket {
            width: ${width}mm;
            background: #fff;
            padding: 3.5mm;
            border: 1px solid #d9dee8;
            border-radius: 10px;
            box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 900; }
          .title {
            font-size: 19px;
            font-weight: 900;
            text-transform: uppercase;
            line-height: 1.08;
            letter-spacing: .3px;
          }
          .business-meta {
            margin-top: 4px;
            color: #000;
            line-height: 1.35;
            font-weight: 700;
          }
          .ticket-logo {
            display: block;
            max-width: 48mm;
            max-height: 18mm;
            object-fit: contain;
            margin: 6px auto;
          }
          .subtitle {
            margin-top: 8px;
            padding: 5px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .4px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            line-height: 1.35;
            font-weight: 700;
          }
          .row span:last-child {
            text-align: right;
            max-width: 48mm;
          }
          .line {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .info {
            margin-top: 8px;
            padding: 6px 0;
          }
          .resolution {
            border: 1px dashed #000;
            padding: 5px;
            margin-top: 7px;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.25;
          }
          .upper { text-transform: uppercase; }
          .section {
            border-bottom: 1px dashed #000;
            padding: 6px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            padding: 3px 0;
            vertical-align: top;
          }
          th {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 10px;
          }
          .product-name {
            max-width: 30mm;
            word-break: break-word;
            font-weight: 900;
            text-transform: uppercase;
          }
          .product-row td {
            border-bottom: 1px dotted #bbb;
          }
          .product-row:last-child td {
            border-bottom: 0;
          }
          .muted {
            font-size: 10px;
            color: #000;
          }
          .totals {
            margin-top: 2px;
          }
          .total {
            font-size: 14px;
            font-weight: 900;
            border-top: 1px solid #000;
            padding: 5px 0;
            margin: 5px 0;
          }
          .footer {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            line-height: 1.35;
            font-weight: 700;
          }
          .terms {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            font-size: 9px;
            line-height: 1.2;
            font-weight: 700;
          }
          @media print {
            body {
              display: block;
              width: ${width}mm;
              min-height: 0;
              background: #fff;
              padding: 0;
              font-family: "Courier New", monospace;
            }
            .screen-shell { width: ${width}mm; }
            .ticket {
              width: ${width}mm;
              border: 0;
              border-radius: 0;
              box-shadow: none;
              padding: 3mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="screen-shell">
        <div class="ticket">
          <div class="center">
            <div class="title">${escapeHtml(businessName)}</div>
            <div class="business-meta">
              ${nit ? `<div class="bold">${escapeHtml(nit)}</div>` : ""}
              ${address ? `<div>${escapeHtml(address)}</div>` : ""}
              ${phone ? `<div>Tel: ${escapeHtml(phone)}</div>` : ""}
            </div>
            ${logoUrl ? `<img class="ticket-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(businessName)}" />` : ""}
            <div class="subtitle">Factura de venta ${escapeHtml(datos.numero)}</div>
            ${resolucion ? `<div class="resolution">${escapeHtml(resolucion)}</div>` : ""}
          </div>

          <div class="section upper">
            <div class="row"><span>Caja:</span><span class="bold">${escapeHtml(caja)}</span></div>
            <div class="row"><span>Vend:</span><span>${escapeHtml(datos.cajero || "Sin responsable")}</span></div>
            <div class="row"><span>Fecha:</span><span>${escapeHtml(fechaTexto)}</span><span>Hora:</span><span>${escapeHtml(horaTexto)}</span></div>
            <div class="row"><span>Sede:</span><span>${escapeHtml(sede)}</span></div>
          </div>

          <div class="section upper">
            <div class="row"><span>Cliente:</span><span>${escapeHtml(datos.cliente || "Cliente General")}</span></div>
            ${datos.clienteDocumento ? `<div class="row"><span>Documento:</span><span>${escapeHtml(datos.clienteDocumento)}</span></div>` : ""}
          </div>

          <table>
            <thead>
              <tr>
                <th class="right">#</th>
                <th class="product-name">Descripción</th>
                <th class="right">Cant</th>
                <th class="right">Valor</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productos.map((product, index) => `
                <tr class="product-row">
                  <td class="right bold">${index + 1}</td>
                  <td class="product-name">
                    ${product.codigo ? `<span class="muted">${escapeHtml(product.codigo)}</span><br />` : ""}
                    ${escapeHtml(product.nombre)}
                  </td>
                  <td class="right">${Number(product.cantidad || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })}</td>
                  <td class="right">${Number(product.precio || product.precio_unitario || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</td>
                  <td class="right">${money(lineTotal(product))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="line"></div>
          <div class="totals">
            <div class="row"><span>Total items:</span><span>${productos.length}</span></div>
            <div class="row"><span>Total unidades:</span><span>${totalItems.toLocaleString("es-CO", { maximumFractionDigits: 3 })}</span></div>
            <div class="row"><span>Total bruto:</span><span>${money(datos.subtotal)}</span></div>
            <div class="row"><span>Descuento:</span><span>${money(datos.descuento)}</span></div>
            <div class="row"><span>Subtotal:</span><span>${money(subtotalNeto)}</span></div>
            <div class="row"><span>Impuesto:</span><span>${money(impuesto)}</span></div>
            <div class="row total"><span>TOTAL:</span><span>${money(datos.total)}</span></div>
            <div class="center bold">Forma de pago: ${escapeHtml(datos.metodoPago || "")}</div>
            <div class="row"><span>Abonado:</span><span>${money(datos.recibido)}</span></div>
            <div class="row"><span>Pendiente:</span><span>${money(Math.max(Number(datos.total || 0) - Number(datos.recibido || 0), 0))}</span></div>
            <div class="row"><span>Cambio:</span><span>${money(Math.max(Number(datos.cambio || 0), 0))}</span></div>
          </div>

          <div class="center footer">
            <div><strong>¡${escapeHtml(footer)}!</strong></div>
            <div class="muted">Representacion impresa de la factura</div>
            <div class="muted">Software POS MARKETSYS</div>
            <div class="terms">
              Términos de Garantía: conserve este comprobante para cambios o reclamaciones según las políticas del establecimiento.
            </div>
          </div>
        </div>
        </div>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;
};

export const normalizeTicketData = (datos = {}) => ({
  numero: datos.numero || "Ticket",
  fecha: datos.fecha || new Date().toLocaleString("es-CO"),
  empresa: datos.empresa || "",
  nit: datos.nit || "",
  direccion: datos.direccion || "",
  telefono: datos.telefono || "",
  sede: datos.sede || "",
  resolucion: datos.resolucion || "",
  logoUrl: datos.logoUrl || "",
  caja: datos.caja || "",
  cliente: datos.cliente || "Cliente General",
  clienteDocumento: datos.clienteDocumento || "",
  cajero: datos.cajero || "",
  metodoPago: datos.metodoPago || "",
  subtotal: Number(datos.subtotal || 0),
  descuento: Number(datos.descuento || 0),
  iva: Number(datos.iva || 0),
  total: Number(datos.total || 0),
  recibido: Number(datos.recibido || 0),
  cambio: Number(datos.cambio || 0),
  productos: Array.isArray(datos.productos) ? datos.productos : [],
});

export const printTicket = (datos = {}, config = {}) => {
  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) {
    throw new Error("El navegador bloqueó la ventana de impresión.");
  }
  printWindow.document.write(buildTicketHtml(normalizeTicketData(datos), config));
  printWindow.document.close();
};
