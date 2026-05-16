import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, FileText, Search, ChevronLeft, ChevronRight, ArchiveX, Ban, Eye, Printer } from "lucide-react";
import usePerfiles from "../../hooks/usePerfiles";
import useVentas from "../../hooks/useVentas";
import ModeloFactura from "./ModeloFactura";
import { anularVenta, obtenerVenta } from "../../services/ventasService";
import { obtenerConfiguracionSistema } from "../../services/configService";
import { imprimirTicketTermico } from "../../services/peripheralsService";
import { ensureOk } from "../../services/responseUtils";
import { normalizeTicketData, printTicket } from "../../utils/ticketPrinter";

export default function ConsultarVentas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // DESC por fecha por default
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Filtros
  const [fechaInicial, setFechaInicial] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState(""); // ID usuario o ""
  const [filtroEstado, setFiltroEstado] = useState("");

  const { ventas, loading: loadingVentas, error: ventasError, refetchVentas } = useVentas();
  const { perfiles: usuarios, loading: loadingUsuarios, error: usuariosError, refetchPerfiles } = usePerfiles();
  const loading = loadingVentas || loadingUsuarios;
  const error = ventasError || usuariosError;
  const [notice, setNotice] = useState(null);
  const [ventaAnular, setVentaAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [facturaVista, setFacturaVista] = useState(null);
  const [printConfig, setPrintConfig] = useState({});

  useEffect(() => {
    obtenerConfiguracionSistema()
      .then((data) => setPrintConfig(data?.grupos || {}))
      .catch(() => setPrintConfig({}));
  }, []);

  const configValue = (group, key, fallback = "") => printConfig?.[group]?.[key]?.valor ?? fallback;
  const resolveReceivedAmount = (venta, fallbackTotal = 0) => {
    const stored = Number(venta?.efectivo_recibido ?? venta?.valor_recibido ?? 0);
    if (stored > 0) return stored;
    if (String(venta?.metodo_pago || "").toLowerCase() === "credito") return 0;
    return Number(fallbackTotal || venta?.total || 0);
  };

  // Aplicar filtros y ordenamiento
  const filteredVentas = useMemo(() => ventas.filter((v) => {
    const fechaV = new Date(v.fecha).toISOString().split('T')[0];
    const inicial = fechaInicial ? new Date(fechaInicial).toISOString().split('T')[0] : '1900-01-01';
    const final = fechaFinal ? new Date(fechaFinal).toISOString().split('T')[0] : '2100-01-01';
    const matchesDate = fechaV >= inicial && fechaV <= final;
    const matchesUser = !filtroUsuario || v.id_usuario == filtroUsuario;
    const matchesEstado = !filtroEstado || (v.estado || "emitida") === filtroEstado;
    const matchesSearch = (v.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.nombre_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.numero_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.id_venta.toString().includes(searchTerm));
    return matchesDate && matchesUser && matchesEstado && matchesSearch;
  }), [fechaFinal, fechaInicial, filtroEstado, filtroUsuario, searchTerm, ventas]);

  const sortedVentas = useMemo(() => [...filteredVentas].sort((a, b) => {
    const dateA = new Date(a.fecha).getTime();
    const dateB = new Date(b.fecha).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  }), [filteredVentas, sortOrder]);

  const totalPages = Math.ceil(sortedVentas.length / itemsPerPage);
  const paginatedVentas = sortedVentas.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const recargarDatos = () => {
    refetchVentas();
    refetchPerfiles();
  };

  // Total general de ventas filtradas
  const totalGeneral = useMemo(
    () => filteredVentas
      .filter((v) => (v.estado || "emitida") !== "anulada")
      .reduce((sum, v) => sum + parseFloat(v.total || 0), 0),
    [filteredVentas]
  );

  const getStoredUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("authUser") || localStorage.getItem("user") || "null");
      return user?.id_usuario || user?.id || null;
    } catch {
      return null;
    }
  };

  const handleAnular = async (venta) => {
    if ((venta.estado || "emitida") === "anulada") return;
    setMotivoAnulacion("");
    setVentaAnular(venta);
  };

  const confirmarAnulacion = async () => {
    if (!ventaAnular) return;

    const motivo = motivoAnulacion.trim();
    if (!motivo) {
      setNotice({
        type: "warning",
        title: "Motivo requerido",
        message: "Escribe el motivo de anulación antes de continuar.",
      });
      return;
    }

    const id_usuario = getStoredUserId();
    if (!id_usuario) {
      setNotice({
        type: "error",
        title: "Usuario no encontrado",
        message: "No se encontró el usuario activo para registrar la anulación.",
      });
      return;
    }

    try {
      const response = await anularVenta(ventaAnular.id_venta, { id_usuario, motivo });
      await ensureOk(response, "No se pudo anular la factura");
      await refetchVentas();
      setVentaAnular(null);
      setMotivoAnulacion("");
      setNotice({
        type: "success",
        title: "Factura anulada",
        message: "La factura fue anulada correctamente y quedó registrada en el historial.",
      });
    } catch (error) {
      console.error("Error anulando factura:", error);
      setNotice({
        type: "error",
        title: "No se pudo anular",
        message: error.message || "No se pudo anular la factura.",
      });
    }
  };

  const prepararFactura = async (venta) => {
    try {
      const detalle = await obtenerVenta(venta.id_venta);
      const ventaCompleta = detalle.venta || detalle || {};
      const items = detalle.detalles || detalle.detalle || detalle.items || [];

      return {
        numero: venta.numero_factura || `FV-${String(venta.id_venta).padStart(6, "0")}`,
        fecha: new Date(venta.fecha).toLocaleString("es-CO"),
        empresa: configValue("empresa", "empresa.nombre", "MERKA FRUVER FLORENCIA"),
        sede: ventaCompleta.sucursal?.nombre || ventaCompleta.nombre_sucursal || venta.nombre_sucursal || "MERKA FRUVER FLORENCIA",
        nit: ventaCompleta.nit || configValue("empresa", "empresa.nit", ""),
        direccion: ventaCompleta.direccion || configValue("empresa", "empresa.direccion", ""),
        telefono: ventaCompleta.telefono || configValue("empresa", "empresa.telefono", ""),
        resolucion: configValue("facturacion", "facturacion.resolucion", configValue("empresa", "empresa.resolucion", "")),
        logoUrl: configValue("impresion", "impresion.logo_ticket", "/ticket-logo.jpeg"),
        caja: venta.numero_caja ? `Caja ${venta.numero_caja}` : "Caja principal",
        cliente: ventaCompleta.cliente?.nombre || ventaCompleta.nombre_cliente || venta.nombre_cliente || "Consumidor final",
        clienteDocumento: ventaCompleta.cliente?.identificacion || ventaCompleta.identificacion || "",
        cajero: venta.nombre_usuario || ventaCompleta.nombre_usuario || "Sin responsable",
        metodoPago: venta.metodo_pago || ventaCompleta.metodo_pago || "Sin medio",
        subtotal: ventaCompleta.subtotal || venta.subtotal || 0,
        descuento: ventaCompleta.descuento || venta.descuento || 0,
        iva: ventaCompleta.impuesto || venta.impuesto || 0,
        total: ventaCompleta.total || venta.total || 0,
        recibido: resolveReceivedAmount(ventaCompleta, venta.total),
        cambio: ventaCompleta.cambio_devuelto ?? ventaCompleta.vuelto ?? ventaCompleta.cambio ?? 0,
        productos: items.map((item) => ({
          id: item.id_producto || item.id || `${item.nombre_producto}-${item.precio_unitario}`,
          nombre: item.nombre || item.nombre_producto || "Producto",
          codigo: item.codigo_interno || item.codigo_barras || "",
          cantidad: item.cantidad || 1,
          precio: item.precio_unitario || item.precio || 0,
          unidad: item.unidad_abrev || item.unidad || "",
        })),
      };
    } catch (error) {
      console.error("Error preparando factura:", error);
      setNotice({
        type: "error",
        title: "No se pudo cargar la factura",
        message: error.message || "Intenta nuevamente para visualizar o imprimir la factura.",
      });
      return null;
    }
  };

  const imprimirFactura = async (venta) => {
    const datos = await prepararFactura(venta);
    if (!datos) return;

    try {
      const tipo = configValue("impresion", "impresion.tipo", "navegador");
      const ticket = normalizeTicketData(datos);

      if (tipo === "escpos_usb" || tipo === "escpos_lan") {
        const baseUrl = configValue("impresion", "impresion.conector_url", "http://127.0.0.1:5124");
        await imprimirTicketTermico({ baseUrl, ticket, config: printConfig });
      } else {
        printTicket(ticket, printConfig);
      }

      setNotice({
        type: "success",
        title: "Factura enviada a impresión",
        message: "La factura fue enviada usando la configuración de impresión del sistema.",
      });
    } catch (error) {
      console.error("Error imprimiendo factura:", error);
      setNotice({
        type: "error",
        title: "No se pudo imprimir",
        message: error.message || "Verifica la configuración de impresora y el conector POS.",
      });
    }
  };

  const visualizarFactura = async (venta) => {
    const datos = await prepararFactura(venta);
    if (datos) setFacturaVista(datos);
  };

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <p className="text-slate-600">Cargando ventas...</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {/* Error global */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">Error al cargar datos: {error}</p>
          <button onClick={recargarDatos} className="text-rose-600 hover:underline text-sm mt-1">
            Recargar
          </button>
        </div>
      )}

      {/* ===== Encabezado ===== */}
      <div className="admin-module-header">
        <div className="admin-module-heading">
        <div className="admin-module-icon">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="admin-module-title">Historial de Facturas</h1>
          <p className="admin-module-subtitle">Consulta, reimprime y anula facturas registradas.</p>
        </div>
        </div>
        <div className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-right">
          <div className="text-[11px] font-black uppercase text-slate-400">Facturas</div>
          <div className="text-lg font-black text-[#233876]">{filteredVentas.length}</div>
        </div>
      </div>

      {/* ===== Filtros ===== */}
      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <div className="flex items-center gap-2">
          <CalendarRange size={18} className="text-cyan-600" />
          <h2 className="admin-module-card-title">
            Filtros de búsqueda
          </h2>
          </div>
        </div>

        <div className="admin-module-grid">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha Inicial
            </label>
            <input
              type="date"
              value={fechaInicial}
              onChange={(e) => {
                setFechaInicial(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha Final
            </label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => {
                setFechaFinal(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Usuario
            </label>
            <select
              value={filtroUsuario}
              onChange={(e) => {
                setFiltroUsuario(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map((u) => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="emitida">Emitida</option>
              <option value="anulada">Anulada</option>
              <option value="credito">Crédito</option>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Búsqueda
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Cliente, factura o ID..."
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-sm text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Total General ===== */}
      <div className="admin-module-summary">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Total General Facturado</h3>
          <strong>{totalGeneral.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</strong>
        </div>
        <p className="text-cyan-100 text-sm mt-1">No incluye facturas anuladas ({filteredVentas.length} registros filtrados)</p>
      </div>

      {/* ===== Listado de facturas ===== */}
      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <h2 className="admin-module-card-title">
            Listado de Facturas ({sortedVentas.length})
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="text-slate-600">Ordenar por fecha:</label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(0);
              }}
              className="border border-slate-200 rounded-sm px-3 py-1 focus:ring-2 focus:ring-cyan-200"
            >
              <option value="desc">Más reciente</option>
              <option value="asc">Más antiguo</option>
            </select>
          </div>
        </div>

        <div className="mb-4 overflow-hidden">
          <table className="w-full table-fixed text-sm border border-slate-200 rounded-sm overflow-hidden">
            <thead className="bg-gradient-to-r from-cyan-600 to-indigo-600 text-white">
              <tr>
                <th className="w-[170px] px-3 py-2 text-left text-xs uppercase tracking-wide">Factura</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Cliente</th>
                <th className="w-[190px] px-3 py-2 text-left text-xs uppercase tracking-wide">Responsable</th>
                <th className="w-[140px] px-3 py-2 text-left text-xs uppercase tracking-wide">Fecha / Estado</th>
                <th className="w-[150px] px-3 py-2 text-right text-xs uppercase tracking-wide">Pago / Total</th>
                <th className="w-[138px] px-3 py-2 text-center text-xs uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-100 align-top">
              {paginatedVentas.length > 0 ? (
                paginatedVentas.map((v) => (
                  <tr key={v.id_venta} className="h-14 hover:bg-cyan-50 transition">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-700">
                      {v.numero_factura || `FV-${v.id_venta.toString().padStart(6, '0')}`}
                    </td>
                    <td className="min-w-0 px-3 py-2">
                      <div className="truncate font-semibold text-slate-800" title={v.nombre_cliente || 'Cliente Genérico'}>
                        {v.nombre_cliente || 'Cliente Genérico'}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        ID venta: {v.id_venta}
                      </div>
                    </td>
                    <td className="min-w-0 px-3 py-2">
                      <div className="truncate font-semibold text-slate-700" title={v.nombre_usuario || 'N/A'}>
                        {v.nombre_usuario || 'N/A'}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Caja: {v.numero_caja || 'N/A'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-semibold text-slate-700">
                        {new Date(v.fecha).toLocaleDateString('es-ES')}
                      </div>
                      <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${
                        (v.estado || "emitida") === "anulada"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {v.estado || "emitida"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-[11px] font-black uppercase text-slate-500">{v.metodo_pago || 'efectivo'}</div>
                      <div className={`font-black ${(v.estado || "emitida") === "anulada" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        ${parseFloat(v.total || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => visualizarFactura(v)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100"
                          title="Visualizar factura"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => imprimirFactura(v)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
                          title="Imprimir factura"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnular(v)}
                          disabled={(v.estado || "emitida") === "anulada"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-rose-600 text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                          title="Anular factura"
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="h-[560px] text-center py-8 text-slate-400 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <ArchiveX size={32} className="text-slate-300" />
                      <p>No hay ventas que coincidan con los filtros...</p>
                    </div>
                  </td>
                </tr>
              )}
              {paginatedVentas.length > 0 &&
                paginatedVentas.length < itemsPerPage &&
                Array.from({ length: itemsPerPage - paginatedVentas.length }, (_, index) => (
                  <tr key={`empty-row-${index}`} className="h-14">
                    <td colSpan="6" className="px-3 py-2">&nbsp;</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-6 gap-4">
            <div className="text-sm text-slate-600">
              Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, sortedVentas.length)} de {sortedVentas.length} ventas
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="px-3 py-2 border border-slate-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-600 px-3 py-2">
                Página {currentPage + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="px-3 py-2 border border-slate-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      {ventaAnular && (
        <CancelSaleDialog
          venta={ventaAnular}
          motivo={motivoAnulacion}
          onChangeMotivo={setMotivoAnulacion}
          onCancel={() => {
            setVentaAnular(null);
            setMotivoAnulacion("");
          }}
          onConfirm={confirmarAnulacion}
        />
      )}
      {facturaVista && (
        <ModeloFactura
          open
          onClose={() => setFacturaVista(null)}
          datos={facturaVista}
        />
      )}
      {notice && (
        <SalesNotice
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function formatFactura(venta) {
  return venta?.numero_factura || `FV-${String(venta?.id_venta || 0).padStart(6, "0")}`;
}

function CancelSaleDialog({ venta, motivo, onChangeMotivo, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-rose-100 text-rose-700">
            <Ban size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-900">Anular factura</h3>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Registra el motivo para anular {formatFactura(venta)}. Esta acción queda en el historial administrativo.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs font-black uppercase tracking-wide text-slate-600 sm:grid-cols-3">
          <div>
            <span className="block text-slate-400">Factura</span>
            <strong className="text-slate-900">{formatFactura(venta)}</strong>
          </div>
          <div>
            <span className="block text-slate-400">Cliente</span>
            <strong className="text-slate-900">{venta.nombre_cliente || "Cliente genérico"}</strong>
          </div>
          <div>
            <span className="block text-slate-400">Total</span>
            <strong className="text-slate-900">${parseFloat(venta.total || 0).toLocaleString()}</strong>
          </div>
        </div>

        <label className="mt-4 block text-sm font-black uppercase tracking-wide text-slate-700">
          Motivo de anulación
        </label>
        <textarea
          value={motivo}
          onChange={(event) => onChangeMotivo(event.target.value)}
          rows={4}
          placeholder="Ejemplo: error en forma de pago, producto mal facturado, cliente solicitó anulación..."
          className="mt-2 w-full resize-none rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        />

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-rose-700"
          >
            Anular factura
          </button>
        </div>
      </div>
    </div>
  );
}

function SalesNotice({ type = "info", title, message, onClose }) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const iconClass = isSuccess
    ? "bg-emerald-100 text-emerald-700"
    : isError
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${iconClass}`}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-cyan-600 px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
