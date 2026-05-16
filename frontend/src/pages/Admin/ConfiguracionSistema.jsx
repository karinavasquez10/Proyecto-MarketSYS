import React, { useEffect, useMemo, useState } from "react";
import {
  Barcode,
  Building2,
  Calculator,
  CreditCard,
  Printer,
  RefreshCcw,
  Save,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { obtenerConfiguracionSistema, guardarConfiguracionSistema } from "../../services/configService";
import { imprimirTicketTermico, leerPesoBascula, obtenerEstadoBascula, obtenerEstadoImpresora } from "../../services/peripheralsService";
import { ensureOk } from "../../services/responseUtils";

const grupos = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "facturacion", label: "Facturación", icon: CreditCard },
  { id: "impresion", label: "Impresión", icon: Printer },
  { id: "bascula", label: "Báscula", icon: Scale },
  { id: "codigo_barras", label: "Códigos", icon: Barcode },
  { id: "caja", label: "Caja", icon: Wallet },
  { id: "impuestos", label: "Impuestos", icon: Calculator },
  { id: "contabilidad", label: "Contabilidad", icon: ShieldCheck },
];

const labels = {
  "empresa.nombre": "Nombre del negocio",
  "empresa.nit": "NIT",
  "empresa.direccion": "Dirección",
  "empresa.telefono": "Teléfono",
  "empresa.correo": "Correo",
  "empresa.logo_sidebar": "Logo panel lateral",
  "facturacion.prefijo": "Prefijo de factura",
  "facturacion.consecutivo_actual": "Consecutivo actual",
  "facturacion.moneda": "Moneda",
  "facturacion.decimales": "Decimales",
  "impresion.impresora": "Impresora",
  "impresion.tipo": "Tipo de impresora",
  "impresion.modelo": "Modelo",
  "impresion.conector_url": "URL del conector",
  "impresion.ancho_ticket_mm": "Ancho ticket mm",
  "impresion.imprimir_automatico": "Impresión automática",
  "impresion.copias": "Copias",
  "impresion.corte_automatico": "Corte automático",
  "impresion.abrir_cajon": "Abrir cajón",
  "impresion.pie_ticket": "Pie de ticket",
  "bascula.modo": "Modo de báscula",
  "bascula.modelo": "Modelo",
  "bascula.conector_url": "URL del conector",
  "bascula.puerto": "Puerto",
  "bascula.baudios": "Baudios",
  "bascula.bits_datos": "Bits de datos",
  "bascula.bits_parada": "Bits de parada",
  "bascula.paridad": "Paridad",
  "bascula.unidad": "Unidad de lectura",
  "bascula.precision_decimales": "Decimales de peso",
  "bascula.timeout_ms": "Tiempo de espera ms",
  "bascula.peso_maximo": "Peso máximo",
  "bascula.lectura_automatica": "Lectura automática",
  "codigo_barras.habilitado": "Lectura de código de barras",
  "codigo_barras.modo_busqueda": "Modo de búsqueda",
  "codigo_barras.agregar_automatico": "Agregar al carrito",
  "codigo_barras.longitud_minima": "Longitud mínima",
  "codigo_barras.sufijo_enter": "Lector envía Enter",
  "caja.requiere_apertura": "Exigir caja abierta",
  "caja.permitir_venta_sin_stock": "Permitir venta sin stock",
  "impuestos.incluidos_en_precio": "Impuestos incluidos en precio",
  "contabilidad.habilitada": "Contabilidad habilitada",
  "contabilidad.cuenta_ventas": "Cuenta de ventas",
  "contabilidad.cuenta_compras": "Cuenta de compras",
};

const defaultConfigItems = [
  {
    clave: "empresa.logo_sidebar",
    valor: "/ticket-logo.jpeg",
    tipo: "texto",
    grupo: "empresa",
    descripcion: "Ruta o URL del logo del negocio que se muestra en los paneles laterales.",
  },
];

const mergeDefaultItems = (items = []) => {
  const keys = new Set(items.map((item) => item.clave));
  return [
    ...items,
    ...defaultConfigItems.filter((item) => !keys.has(item.clave)),
  ];
};

const connectorLabel = (url, fallbackPort) => {
  try {
    const parsed = new URL(url);
    const isLocal =
      ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname) ||
      parsed.hostname.endsWith(".localhost");

    if (isLocal) {
      return `Equipo de caja${parsed.port ? ` - puerto ${parsed.port}` : fallbackPort ? ` - puerto ${fallbackPort}` : ""}`;
    }

    return `Servidor configurado${parsed.hostname ? ` - ${parsed.hostname}` : ""}`;
  } catch {
    return "Conector configurado";
  }
};

const friendlyConnectorError = (error, fallbackMessage) => {
  const rawMessage = String(error?.message || "").trim();
  if (!rawMessage) return fallbackMessage;

  if (/failed to fetch|networkerror|load failed|abort/i.test(rawMessage)) {
    return "No hubo respuesta del conector. Verifica que esté abierto en el equipo de caja.";
  }

  return rawMessage.replace(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/gi, "el equipo de caja");
};

export default function ConfiguracionSistema() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [activeGroup, setActiveGroup] = useState("empresa");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testingScale, setTestingScale] = useState(false);
  const [scaleTest, setScaleTest] = useState(null);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [printerTest, setPrinterTest] = useState(null);

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  }, []);

  const cargarConfiguracion = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await obtenerConfiguracionSistema();
      setItems(mergeDefaultItems(Array.isArray(data.items) ? data.items : []));
    } catch (error) {
      setMessage(error.message || "No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!acc[item.grupo]) acc[item.grupo] = [];
      acc[item.grupo].push(item);
      return acc;
    }, {});
  }, [items]);

  const visibleItems = groupedItems[activeGroup] || [];
  const scaleConfig = useMemo(() => {
    return (groupedItems.bascula || []).reduce((acc, item) => {
      acc[item.clave] = item;
      return acc;
    }, {});
  }, [groupedItems]);
  const printConfig = useMemo(() => {
    return (groupedItems.impresion || []).reduce((acc, item) => {
      acc[item.clave] = item;
      return acc;
    }, {});
  }, [groupedItems]);

  const setConfigValue = (clave, valor) => {
    setItems((prev) => prev.map((item) => item.clave === clave ? { ...item, valor } : item));
    setMessage("");
  };

  const guardarCambios = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await guardarConfiguracionSistema(
        items.map(({ clave, valor, tipo, grupo, descripcion }) => ({ clave, valor, tipo, grupo, descripcion })),
        storedUser?.id || storedUser?.id_usuario || 1
      );
      await ensureOk(response, "No se pudo guardar la configuración");
      const data = await response.json();
      setItems(mergeDefaultItems(Array.isArray(data.items) ? data.items : []));
      setMessage("Configuración guardada correctamente.");
    } catch (error) {
      setMessage(error.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const probarConexionBascula = async () => {
    setTestingScale(true);
    setScaleTest(null);
    try {
      const baseUrl = scaleConfig["bascula.conector_url"]?.valor || "http://127.0.0.1:5123";
      const data = await obtenerEstadoBascula({ baseUrl, scaleConfig });
      setScaleTest({
        ok: true,
        title: "Conector disponible",
        details: [
          `Modo: ${data.mode || "manual"}`,
          `Modelo: ${data.profile || "moresco_hy_918"}`,
          `Puerto: ${data.port || "COM3"}`,
          `Baudios: ${data.baudRate || 9600}`,
        ],
      });
    } catch (error) {
      setScaleTest({
        ok: false,
        title: "No se pudo conectar con el equipo de caja",
        details: [friendlyConnectorError(error, "Verifica que el conector esté encendido en el equipo de caja.")],
      });
    } finally {
      setTestingScale(false);
    }
  };

  const probarLecturaBascula = async () => {
    setTestingScale(true);
    setScaleTest(null);
    try {
      const baseUrl = scaleConfig["bascula.conector_url"]?.valor || "http://127.0.0.1:5123";
      const data = await leerPesoBascula({ baseUrl, scaleConfig });
      setScaleTest({
        ok: true,
        title: "Peso leído correctamente",
        details: [
          `Peso: ${Number(data.weight).toLocaleString("es-CO", { maximumFractionDigits: 3 })} ${data.unit || scaleConfig["bascula.unidad"]?.valor || "kg"}`,
          `Fuente: ${data.source || "bascula"}`,
          `Puerto: ${data.port || scaleConfig["bascula.puerto"]?.valor || "COM3"}`,
        ],
      });
    } catch (error) {
      setScaleTest({
        ok: false,
        title: "No se pudo leer peso",
        details: [friendlyConnectorError(error, "Para pruebas sin báscula, selecciona el modo Simulación. Para báscula física, usa RS232 y verifica el puerto COM.")],
      });
    } finally {
      setTestingScale(false);
    }
  };

  const probarConexionImpresora = async () => {
    setTestingPrinter(true);
    setPrinterTest(null);
    try {
      const baseUrl = printConfig["impresion.conector_url"]?.valor || "http://127.0.0.1:5124";
      const data = await obtenerEstadoImpresora({ baseUrl });
      setPrinterTest({
        ok: true,
        title: "Conector de impresión disponible",
        details: [
          `Perfil: ${data.profile || "jaltech_pos_80"}`,
          `Impresora: ${data.printerName || "JALTECH POS"}`,
          `Ancho: ${data.width || 80}mm`,
        ],
      });
    } catch (error) {
      setPrinterTest({
        ok: false,
        title: "No se pudo conectar con la impresora",
        details: [friendlyConnectorError(error, "Verifica que el conector de impresión esté abierto en el equipo de caja.")],
      });
    } finally {
      setTestingPrinter(false);
    }
  };

  const probarTicketImpresora = async () => {
    setTestingPrinter(true);
    setPrinterTest(null);
    try {
      const baseUrl = printConfig["impresion.conector_url"]?.valor || "http://127.0.0.1:5124";
      const ticket = {
        numero: "TEST-0001",
        fecha: new Date().toLocaleString("es-CO"),
        cliente: "Cliente de prueba",
        cajero: "Administrador",
        metodoPago: "Prueba",
        subtotal: 1000,
        descuento: 0,
        iva: 0,
        total: 1000,
        recibido: 1000,
        cambio: 0,
        productos: [{ nombre: "Producto prueba", cantidad: 1, precio: 1000 }],
      };
      const data = await imprimirTicketTermico({ baseUrl, ticket, config: groupedItems });
      setPrinterTest({
        ok: true,
        title: "Ticket enviado al conector",
        details: [
          data.message || "El conector recibió el ticket.",
          `Copias: ${data.copies || 1}`,
          `Corte: ${data.cut ? "sí" : "no"}`,
        ],
      });
    } catch (error) {
      setPrinterTest({
        ok: false,
        title: "No se pudo enviar el ticket",
        details: [friendlyConnectorError(error, "Verifica que la impresora y el conector estén disponibles.")],
      });
    } finally {
      setTestingPrinter(false);
    }
  };

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Configuración del Sistema</h1>
            <p className="admin-module-subtitle">Parámetros generales de empresa, POS, impresión, caja y contabilidad.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/HomeAdmin/UsuariosPermiso")}
            className="inline-flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-4 py-2 text-sm font-black text-[#233876] shadow-sm transition hover:bg-[#eef2ff]"
          >
            <Users size={16} />
            Permisos
          </button>
          <button
            onClick={cargarConfiguracion}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-200"
          >
            <RefreshCcw size={16} />
            Recargar
          </button>
          <button
            onClick={guardarCambios}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-sm border border-[#3157d5] bg-[#3157d5] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#233876] disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Guardando" : "Guardar"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-sm border px-4 py-3 text-sm font-semibold ${
          message.includes("correctamente")
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-sm border border-[#c7d2fe] bg-white p-3 shadow-sm">
          <div className="mb-3 rounded-sm bg-[#eef2ff] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#233876]">
            Secciones
          </div>
          <div className="space-y-2">
            {grupos.map((grupo) => {
              const Icon = grupo.icon;
              const active = activeGroup === grupo.id;
              return (
                <button
                  key={grupo.id}
                  onClick={() => setActiveGroup(grupo.id)}
                  className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left text-sm font-black transition ${
                    active
                      ? "border-[#3157d5] bg-[#eef2ff] text-[#233876]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[#c7d2fe] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-sm ${active ? "bg-[#3157d5] text-white" : "bg-slate-100 text-[#3157d5]"}`}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{grupo.label}</span>
                  <span className="rounded-sm bg-white px-2 py-0.5 text-xs text-slate-500">
                    {(groupedItems[grupo.id] || []).length}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-[#233876]">
                {grupos.find((grupo) => grupo.id === activeGroup)?.label || "Configuración"}
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Ajusta los parámetros y guarda los cambios para aplicarlos.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm font-semibold text-slate-500">
              Cargando configuración...
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-400">
              No hay parámetros para esta sección.
            </div>
          ) : (
            <>
              {activeGroup === "bascula" && (
                <ScaleTestPanel
                  testing={testingScale}
                  result={scaleTest}
                  config={scaleConfig}
                  onTestConnection={probarConexionBascula}
                  onReadWeight={probarLecturaBascula}
                />
              )}
              {activeGroup === "impresion" && (
                <PrinterTestPanel
                  testing={testingPrinter}
                  result={printerTest}
                  config={printConfig}
                  onTestConnection={probarConexionImpresora}
                  onPrintTest={probarTicketImpresora}
                />
              )}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {visibleItems.map((item) => (
                  <ConfigField
                    key={item.clave}
                    item={item}
                    label={labels[item.clave] || item.clave}
                    onChange={(value) => setConfigValue(item.clave, value)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ScaleTestPanel({ testing, result, config, onTestConnection, onReadWeight }) {
  const connectorUrl = config["bascula.conector_url"]?.valor || "http://127.0.0.1:5123";
  const connectorName = connectorLabel(connectorUrl, "5123");
  const mode = config["bascula.modo"]?.valor || "manual";
  const port = config["bascula.puerto"]?.valor || "COM3";

  return (
    <div className="mb-4 rounded-sm border border-[#c7d2fe] bg-[linear-gradient(135deg,#f8f9ff,#eef2ff)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-[#233876]">
            Prueba de báscula
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Conector: {connectorName} · Modo: {mode} · Puerto: {port}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={testing}
            className="rounded-sm border border-[#3157d5] bg-white px-4 py-2 text-sm font-black text-[#233876] shadow-sm transition hover:bg-[#eef2ff] disabled:cursor-wait disabled:opacity-60"
          >
            Probar conexión
          </button>
          <button
            type="button"
            onClick={onReadWeight}
            disabled={testing}
            className="rounded-sm bg-[#3157d5] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#233876] disabled:cursor-wait disabled:opacity-60"
          >
            Leer peso
          </button>
        </div>
      </div>

      {result && (
        <div className={`mt-3 rounded-sm border px-3 py-2 text-sm ${
          result.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          <div className="font-black">{result.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
            {result.details.map((detail) => (
              <span key={detail}>{detail}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PrinterTestPanel({ testing, result, config, onTestConnection, onPrintTest }) {
  const connectorUrl = config["impresion.conector_url"]?.valor || "http://127.0.0.1:5124";
  const connectorName = connectorLabel(connectorUrl, "5124");
  const type = config["impresion.tipo"]?.valor || "navegador";
  const model = config["impresion.modelo"]?.valor || "jaltech_pos_80";

  return (
    <div className="mb-4 rounded-sm border border-[#c7d2fe] bg-[linear-gradient(135deg,#f8f9ff,#eef2ff)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-[#233876]">
            Prueba de impresora
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Conector: {connectorName} · Tipo: {type} · Modelo: {model}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={testing}
            className="rounded-sm border border-[#3157d5] bg-white px-4 py-2 text-sm font-black text-[#233876] shadow-sm transition hover:bg-[#eef2ff] disabled:cursor-wait disabled:opacity-60"
          >
            Probar conexión
          </button>
          <button
            type="button"
            onClick={onPrintTest}
            disabled={testing}
            className="rounded-sm bg-[#3157d5] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#233876] disabled:cursor-wait disabled:opacity-60"
          >
            Enviar ticket prueba
          </button>
        </div>
      </div>

      {result && (
        <div className={`mt-3 rounded-sm border px-3 py-2 text-sm ${
          result.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          <div className="font-black">{result.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
            {result.details.map((detail) => (
              <span key={detail}>{detail}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigField({ item, label, onChange }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-[#f8f9ff] p-4">
      <label className="mb-1 block text-sm font-black text-slate-800">{label}</label>
      <p className="mb-3 min-h-[18px] text-xs font-semibold text-slate-500">{item.descripcion}</p>
      {item.tipo === "booleano" ? (
        <label className="inline-flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={Boolean(item.valor)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-5 w-5 rounded-sm border-[#c7d2fe] text-[#3157d5] focus:ring-[#c7d2fe]"
          />
          <span className="text-sm font-bold text-slate-700">
            {item.valor ? "Activo" : "Inactivo"}
          </span>
        </label>
      ) : item.clave === "facturacion.moneda" ? (
        <select
          value={item.valor || "COP"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="COP">COP - Peso colombiano</option>
          <option value="USD">USD - Dólar</option>
        </select>
      ) : item.clave === "impresion.tipo" ? (
        <select
          value={item.valor || "navegador"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="navegador">Navegador / impresora instalada</option>
          <option value="escpos_usb">ESC/POS USB</option>
          <option value="escpos_lan">ESC/POS LAN</option>
        </select>
      ) : item.clave === "impresion.modelo" ? (
        <select
          value={item.valor || "jaltech_pos_80"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="jaltech_pos_80">JALTECH POS 80mm ESC/POS</option>
          <option value="epson_escpos_80">Epson compatible 80mm</option>
          <option value="generica_80">Genérica 80mm</option>
          <option value="generica_58">Genérica 58mm</option>
        </select>
      ) : item.clave === "codigo_barras.modo_busqueda" ? (
        <select
          value={item.valor || "codigo_barras"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="codigo_barras">Código de barras</option>
          <option value="codigo_interno">Código interno</option>
          <option value="ambos">Ambos</option>
        </select>
      ) : item.clave === "bascula.modo" ? (
        <select
          value={item.valor || "manual"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="manual">Manual</option>
          <option value="mock">Simulación / peso de prueba</option>
          <option value="rs232">RS232 / Puerto serial</option>
          <option value="etiqueta">Etiqueta con código de barras</option>
        </select>
      ) : item.clave === "bascula.modelo" ? (
        <select
          value={item.valor || "moresco_hy_918"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="moresco_hy_918">Moresco / Mavin HY-918 RS232</option>
          <option value="generica_rs232">Genérica RS232</option>
          <option value="manual">Manual sin conexión</option>
        </select>
      ) : item.clave === "bascula.unidad" ? (
        <select
          value={item.valor || "kg"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="kg">Kilogramos</option>
          <option value="lb">Libras</option>
          <option value="g">Gramos</option>
        </select>
      ) : item.clave === "bascula.paridad" ? (
        <select
          value={item.valor || "none"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        >
          <option value="none">Sin paridad</option>
          <option value="even">Par</option>
          <option value="odd">Impar</option>
        </select>
      ) : (
        <input
          type={item.tipo === "numero" ? "number" : "text"}
          value={item.valor ?? ""}
          onChange={(e) => onChange(item.tipo === "numero" ? Number(e.target.value) : e.target.value)}
          className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
        />
      )}
      <div className="mt-2 text-[11px] font-semibold text-slate-400">{item.clave}</div>
    </div>
  );
}
