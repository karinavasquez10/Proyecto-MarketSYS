import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.MARKETSYS_PRINT_CONNECTOR_PORT || 5124);
const HOST = process.env.MARKETSYS_PRINT_CONNECTOR_HOST || "127.0.0.1";

const defaultProfile = {
  mode: process.env.MARKETSYS_PRINT_MODE || "mock",
  profile: process.env.MARKETSYS_PRINT_PROFILE || "jaltech_pos_80",
  printerName: process.env.MARKETSYS_PRINT_NAME || "JALTECH POS",
  width: Number(process.env.MARKETSYS_PRINT_WIDTH_MM || 80),
};

const sendJson = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
};

const money = (value) =>
  (Number(value) || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const configValue = (config, group, key, fallback = "") => config?.[group]?.[key]?.valor ?? fallback;

const boolConfig = (config, group, key, fallback = false) => {
  const value = configValue(config, group, key, fallback);
  return value === true || value === "true" || value === 1 || value === "1";
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7EñÑ]/g, "")
    .replace(/[ñ]/g, "n")
    .replace(/[Ñ]/g, "N");

const textBytes = (value = "") => Buffer.from(normalizeText(value), "ascii");

const esc = (...bytes) => Buffer.from(bytes);

const align = {
  left: esc(0x1b, 0x61, 0x00),
  center: esc(0x1b, 0x61, 0x01),
  right: esc(0x1b, 0x61, 0x02),
};

const style = {
  normal: esc(0x1b, 0x21, 0x00),
  boldOn: esc(0x1b, 0x45, 0x01),
  boldOff: esc(0x1b, 0x45, 0x00),
  doubleOn: esc(0x1b, 0x21, 0x30),
  doubleOff: esc(0x1b, 0x21, 0x00),
};

const command = {
  init: esc(0x1b, 0x40),
  feed: (lines = 1) => esc(0x1b, 0x64, Math.max(0, Math.min(10, lines))),
  cut: esc(0x1d, 0x56, 0x00),
  openDrawer: esc(0x1b, 0x70, 0x00, 0x40, 0x50),
};

const line = (text = "") => Buffer.concat([textBytes(text), esc(0x0a)]);

const padRow = (left, right, width = 48) => {
  const cleanLeft = normalizeText(left);
  const cleanRight = normalizeText(right);
  const spaces = Math.max(1, width - cleanLeft.length - cleanRight.length);
  return `${cleanLeft}${" ".repeat(spaces)}${cleanRight}`;
};

const wrapText = (value, width = 32) => {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
    } else if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, width);
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const buildEscposPreview = ({ ticket, config }) => {
  const businessName = configValue(config, "empresa", "empresa.nombre", "MARKETSYS");
  const nit = configValue(config, "empresa", "empresa.nit", "");
  const footer = configValue(config, "impresion", "impresion.pie_ticket", "Gracias por su compra");
  const lines = [];

  lines.push(businessName);
  if (nit) lines.push(`NIT: ${nit}`);
  lines.push("--------------------------------");
  lines.push(`Factura: ${ticket.numero || ""}`);
  lines.push(`Fecha: ${ticket.fecha || ""}`);
  lines.push(`Cliente: ${ticket.cliente || "Cliente General"}`);
  lines.push(`Cajero: ${ticket.cajero || ""}`);
  lines.push("--------------------------------");

  for (const item of ticket.productos || []) {
    const qty = Number(item.cantidad || 0);
    const price = Number(item.precio || item.precio_unitario || 0);
    lines.push(String(item.nombre || "Producto").slice(0, 32));
    lines.push(`${qty} x ${money(price)} = ${money(qty * price)}`);
  }

  lines.push("--------------------------------");
  lines.push(`Subtotal: ${money(ticket.subtotal)}`);
  lines.push(`Descuento: ${money(ticket.descuento)}`);
  lines.push(`Impuesto: ${money(ticket.iva)}`);
  lines.push(`TOTAL: ${money(ticket.total)}`);
  lines.push(`Recibido: ${money(ticket.recibido)}`);
  lines.push(`Cambio: ${money(ticket.cambio)}`);
  lines.push("--------------------------------");
  lines.push(footer);
  lines.push("Software MARKETSYS");

  return lines.join("\n");
};

const buildEscposBuffer = ({ ticket, config }) => {
  const businessName = configValue(config, "empresa", "empresa.nombre", "MARKETSYS");
  const nit = configValue(config, "empresa", "empresa.nit", "");
  const address = configValue(config, "empresa", "empresa.direccion", "");
  const phone = configValue(config, "empresa", "empresa.telefono", "");
  const footer = configValue(config, "impresion", "impresion.pie_ticket", "Gracias por su compra");
  const cut = boolConfig(config, "impresion", "impresion.corte_automatico", true);
  const openDrawer = boolConfig(config, "impresion", "impresion.abrir_cajon", false);
  const width = Number(configValue(config, "impresion", "impresion.ancho_ticket_mm", 80)) >= 80 ? 48 : 32;
  const chunks = [command.init];

  if (openDrawer) chunks.push(command.openDrawer);

  chunks.push(align.center, style.boldOn, style.doubleOn, line(businessName), style.doubleOff, style.boldOff);
  if (nit) chunks.push(line(`NIT: ${nit}`));
  if (address) chunks.push(line(address));
  if (phone) chunks.push(line(`Tel: ${phone}`));
  chunks.push(line("-".repeat(width)));
  chunks.push(align.left);
  chunks.push(line(padRow("Factura:", ticket.numero || "", width)));
  chunks.push(line(padRow("Fecha:", ticket.fecha || "", width)));
  chunks.push(line(padRow("Cliente:", ticket.cliente || "Cliente General", width)));
  chunks.push(line(padRow("Cajero:", ticket.cajero || "", width)));
  chunks.push(line(padRow("Pago:", ticket.metodoPago || "", width)));
  chunks.push(line("-".repeat(width)));

  for (const item of ticket.productos || []) {
    const qty = Number(item.cantidad || 0);
    const price = Number(item.precio || item.precio_unitario || 0);
    for (const productLine of wrapText(item.nombre || "Producto", width)) {
      chunks.push(line(productLine));
    }
    chunks.push(line(padRow(`${qty} x ${money(price)}`, money(qty * price), width)));
  }

  chunks.push(line("-".repeat(width)));
  chunks.push(line(padRow("Subtotal:", money(ticket.subtotal), width)));
  chunks.push(line(padRow("Descuento:", money(ticket.descuento), width)));
  chunks.push(line(padRow("Impuesto:", money(ticket.iva), width)));
  chunks.push(style.boldOn, line(padRow("TOTAL:", money(ticket.total), width)), style.boldOff);
  chunks.push(line(padRow("Recibido:", money(ticket.recibido), width)));
  chunks.push(line(padRow("Cambio:", money(ticket.cambio), width)));
  chunks.push(line("-".repeat(width)));
  chunks.push(align.center, line(footer), line("Software MARKETSYS"), align.left);
  chunks.push(command.feed(4));
  if (cut) chunks.push(command.cut);

  return Buffer.concat(chunks);
};

const sendRawToWindowsPrinter = async ({ printerName, data }) => {
  const script = String.raw`
param(
  [string]$PrinterName,
  [string]$Base64Data
)
$signature = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
}
"@
Add-Type -TypeDefinition $signature
$bytes = [Convert]::FromBase64String($Base64Data)
$hPrinter = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) { throw "No se pudo abrir la impresora $PrinterName" }
$di = New-Object RawPrinterHelper+DOCINFOA
$di.pDocName = "MarketSYS Ticket"
$di.pDataType = "RAW"
try {
  if (-not [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $di)) { throw "No se pudo iniciar documento RAW" }
  if (-not [RawPrinterHelper]::StartPagePrinter($hPrinter)) { throw "No se pudo iniciar pagina RAW" }
  $ptr = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $written = 0
    if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)) { throw "No se pudo escribir en la impresora" }
    if ($written -ne $bytes.Length) { throw "Escritura incompleta: $written de $($bytes.Length) bytes" }
  } finally {
    [Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
  }
  [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
  [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
} finally {
  [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
}
`;

  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
    "-PrinterName",
    printerName,
    "-Base64Data",
    data.toString("base64"),
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
};

const printTicket = async ({ ticket, config }) => {
  const mode = configValue(config, "impresion", "impresion.tipo", defaultProfile.mode);
  const copies = Number(configValue(config, "impresion", "impresion.copias", 1)) || 1;
  const cut = boolConfig(config, "impresion", "impresion.corte_automatico", true);
  const openDrawer = boolConfig(config, "impresion", "impresion.abrir_cajon", false);
  const printerName = configValue(config, "impresion", "impresion.impresora", defaultProfile.printerName);
  const preview = buildEscposPreview({ ticket, config });

  if (mode === "mock" || mode === "navegador") {
    console.log("\n--- MarketSYS ticket preview ---");
    console.log(preview);
    console.log("--- End ticket preview ---\n");
    return {
      ok: true,
      source: "mock",
      message: "Ticket recibido por el conector en modo simulación.",
      copies,
      cut,
      openDrawer,
      printedAt: new Date().toISOString(),
    };
  }

  if (mode === "escpos_usb") {
    const data = buildEscposBuffer({ ticket, config });
    for (let copy = 0; copy < copies; copy += 1) {
      await sendRawToWindowsPrinter({ printerName, data });
    }
    return {
      ok: true,
      source: "windows_raw_escpos",
      message: `Ticket enviado a ${printerName}.`,
      printerName,
      bytes: data.length,
      copies,
      cut,
      openDrawer,
      printedAt: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    source: "pending_escpos",
    message: "Conector ESC/POS preparado. La escritura USB directa se implementa cuando se instale y pruebe la impresora real.",
    copies,
    cut,
    openDrawer,
    printedAt: new Date().toISOString(),
  };
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "marketsys-print-connector",
      ...defaultProfile,
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && url.pathname === "/print/status") {
    return sendJson(res, 200, {
      ok: true,
      connected: defaultProfile.mode === "mock",
      escposEnabled: defaultProfile.mode !== "mock",
      ...defaultProfile,
    });
  }

  if (req.method === "POST" && url.pathname === "/print/ticket") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const result = await printTicket(payload);
        sendJson(res, result.ok ? 200 : 503, result);
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          message: error.message,
        });
      }
    });
    return;
  }

  return sendJson(res, 404, {
    ok: false,
    message: "Ruta no encontrada",
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MarketSYS print connector listening at http://${HOST}:${PORT}`);
  console.log(`Profile: ${defaultProfile.profile}, printer: ${defaultProfile.printerName}, width: ${defaultProfile.width}mm`);
});
