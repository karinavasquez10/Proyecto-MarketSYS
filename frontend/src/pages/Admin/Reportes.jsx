import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Package,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import * as XLSX from "xlsx";
import useReportes from "../../hooks/useReportes";

const money = (value) =>
  Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function Reportes() {
  const [desde, setDesde] = useState(monthStart);
  const [hasta, setHasta] = useState(today);
  const [reporteActivo, setReporteActivo] = useState("ventas_generales");
  const params = useMemo(() => ({ desde, hasta }), [desde, hasta]);
  const { data, loading, error, refetchReportes } = useReportes(params);

  const resumen = data?.resumen || {};
  const topProductos = data?.top_productos || [];
  const movimientosFinancieros = data?.movimientos_financieros || [];
  const movimientosInventario = data?.movimientos_inventario || [];
  const creditos = data?.creditos || [];
  const inventarioPorTipo = data?.inventario_por_tipo || [];
  const ventasPorMetodo = data?.ventas_por_metodo || [];
  const ventasPorCategoria = data?.ventas_por_categoria || [];
  const ventasRecientes = data?.ventas_recientes || [];
  const existenciasProductos = data?.existencias_productos || [];
  const resumenDiario = data?.resumen_diario || [];
  const cierresCajaDetalle = data?.cierres_caja_detalle || [];
  const deudasClientes = data?.deudas_clientes || [];
  const pagosProveedores = data?.pagos_proveedores || [];
  const facturasImpuestos = data?.facturas_impuestos || [];
  const facturasDetalle = data?.facturas_detalle || [];

  const reportes = [
    { id: "ventas_generales", label: "Ventas generales", rows: ventasRecientes.length },
    { id: "resumen_diario", label: "Resumen diario", rows: resumenDiario.length },
    { id: "productos_rotacion", label: "Productos más vendidos", rows: topProductos.length },
    { id: "existencias", label: "Existencias por producto", rows: existenciasProductos.length },
    { id: "cuadres_caja", label: "Cuadres de caja", rows: cierresCajaDetalle.length },
    { id: "deudas_clientes", label: "Deudas de clientes", rows: deudasClientes.length },
    { id: "pagos_proveedores", label: "Pagos a proveedores", rows: pagosProveedores.length },
    { id: "impuestos", label: "Facturas con impuestos", rows: facturasImpuestos.length },
    { id: "facturas", label: "Facturas", rows: facturasDetalle.length },
    { id: "ventas_categoria", label: "Ventas por categoría", rows: ventasPorCategoria.length },
    { id: "ventas_metodo", label: "Ventas por método", rows: ventasPorMetodo.length },
    { id: "financieros", label: "Movimientos financieros", rows: movimientosFinancieros.length },
    { id: "inventario_movimientos", label: "Movimientos de inventario", rows: movimientosInventario.length },
    { id: "creditos_estado", label: "Créditos por estado", rows: creditos.length },
    { id: "inventario_tipo", label: "Inventario por movimiento", rows: inventarioPorTipo.length },
  ];

  const exportarExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Ventas", Valor: resumen.ventas_total },
      { Indicador: "Compras", Valor: resumen.compras_total },
      { Indicador: "Gastos", Valor: resumen.gastos },
      { Indicador: "Utilidad estimada", Valor: resumen.utilidad_estimada },
      { Indicador: "Impuesto ventas", Valor: resumen.impuesto_ventas },
      { Indicador: "Costo inventario", Valor: resumen.costo_inventario },
      { Indicador: "Valor venta inventario", Valor: resumen.valor_venta_inventario },
    ]), "Resumen");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topProductos), "Top productos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movimientosFinancieros), "Financieros");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(creditos), "Creditos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventasRecientes), "Ventas generales");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenDiario), "Resumen diario");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(existenciasProductos), "Existencias");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cierresCajaDetalle), "Cuadres caja");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deudasClientes), "Deudas clientes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagosProveedores), "Pagos proveedores");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facturasImpuestos), "Impuestos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facturasDetalle), "Facturas");
    XLSX.writeFile(wb, `Reporte_MARKETSYS_${desde}_${hasta}.xlsx`);
  };

  const exportarReporteActivo = () => {
    if (!data) return;
    const selected = getReporteConfig(reporteActivo, {
      topProductos,
      movimientosFinancieros,
      movimientosInventario,
      creditos,
      inventarioPorTipo,
      ventasPorMetodo,
      ventasPorCategoria,
      ventasRecientes,
      existenciasProductos,
      resumenDiario,
      cierresCajaDetalle,
      deudasClientes,
      pagosProveedores,
      facturasImpuestos,
      facturasDetalle,
    }, money);

    const rows = selected.exportRows();
    const headers = rows.length ? Object.keys(rows[0]) : ["Resultado"];
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csvLines = [
      [escapeCsv("MARKETSYS"), escapeCsv(selected.title)].join(";"),
      [escapeCsv("Rango"), escapeCsv(`${desde} a ${hasta}`)].join(";"),
      [escapeCsv("Generado"), escapeCsv(new Date().toLocaleString("es-CO"))].join(";"),
      "",
      headers.map(escapeCsv).join(";"),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(";")),
    ];
    const csvContent = `\uFEFF${csvLines.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.title.replace(/\s+/g, "_")}_${desde}_${hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <p className="font-semibold text-slate-600">Generando reportes...</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {error && (
        <div className="mb-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
          <button onClick={refetchReportes} className="ml-2 underline">Reintentar</button>
        </div>
      )}

      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Reportes</h1>
            <p className="admin-module-subtitle">Ventas, compras, caja, inventario, impuestos y créditos.</p>
          </div>
        </div>
        <button
          onClick={exportarExcel}
          disabled={!data}
          className="inline-flex items-center gap-2 rounded-sm border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Download size={16} />
          Exportar
        </button>
      </div>

      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-cyan-600" />
            <h2 className="admin-module-card-title">Rango del reporte</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_180px_auto]">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold"
          />
          <button
            onClick={refetchReportes}
            className="rounded-sm border border-[#3157d5] bg-[#3157d5] px-4 py-2 text-sm font-black text-white"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Ventas" value={money(resumen.ventas_total)} note={`${resumen.ventas_cantidad || 0} facturas`} icon={Receipt} tone="blue" />
        <SummaryCard label="Compras" value={money(resumen.compras_total)} note={`${resumen.compras_cantidad || 0} registros`} icon={Package} tone="amber" />
        <SummaryCard label="Gastos" value={money(resumen.gastos)} note="Egresos operativos" icon={Wallet} tone="rose" />
        <SummaryCard label="Utilidad estimada" value={money(resumen.utilidad_estimada)} note="Según costos actuales" icon={TrendingUp} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <MetricPanel title="Caja e impuestos" icon={FileSpreadsheet}>
          <Metric label="Impuesto ventas" value={money(resumen.impuesto_ventas)} />
          <Metric label="Cierres de caja" value={resumen.cierres_caja || 0} />
          <Metric label="Diferencia caja" value={money(resumen.diferencia_caja)} />
        </MetricPanel>
        <MetricPanel title="Inventario" icon={Package}>
          <Metric label="Productos activos" value={resumen.productos_activos || 0} />
          <Metric label="Unidades" value={Number(resumen.unidades_inventario || 0).toLocaleString("es-CO")} />
          <Metric label="Costo inventario" value={money(resumen.costo_inventario)} />
          <Metric label="Valor venta" value={money(resumen.valor_venta_inventario)} />
        </MetricPanel>
        <MetricPanel title="Alertas" icon={AlertTriangle}>
          <Metric label="Bajo stock" value={resumen.productos_bajo_stock || 0} />
          <Metric label="Ingresos financieros" value={money(resumen.ingresos_financieros)} />
          <Metric label="Egresos financieros" value={money(resumen.egresos_financieros)} />
        </MetricPanel>
      </div>

      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <div>
            <h2 className="admin-module-card-title">Biblioteca de reportes</h2>
            <p className="text-xs font-semibold text-slate-500">Selecciona el reporte y revisa la tabla a pantalla completa.</p>
          </div>
          <button
            type="button"
            onClick={exportarReporteActivo}
            disabled={!data}
            className="inline-flex items-center gap-2 rounded-sm border border-[#3157d5] bg-white px-3 py-2 text-xs font-black text-[#233876] transition hover:bg-[#eef2ff] disabled:opacity-50"
          >
            <Download size={14} />
            Descargar CSV
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {reportes.map((reporte) => (
              <button
                key={reporte.id}
                type="button"
                onClick={() => setReporteActivo(reporte.id)}
                className={`flex shrink-0 items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm transition ${
                  reporteActivo === reporte.id
                    ? "border-[#3157d5] bg-[#eef2ff] text-[#233876] shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-[#f8f9ff]"
                }`}
              >
                <span className="font-black">{reporte.label}</span>
                <span className="rounded-sm bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{reporte.rows}</span>
              </button>
            ))}
          </div>
          <div className="min-w-0">
            <ReporteDetalle
              id={reporteActivo}
              money={money}
              data={{
                topProductos,
                movimientosFinancieros,
                movimientosInventario,
                creditos,
                inventarioPorTipo,
                ventasPorMetodo,
                ventasPorCategoria,
                ventasRecientes,
                existenciasProductos,
                resumenDiario,
                cierresCajaDetalle,
                deudasClientes,
                pagosProveedores,
                facturasImpuestos,
                facturasDetalle,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReporteDetalle({ id, data, money }) {
  const config = getReporteConfig(id, data, money);
  return <ReportTable title={config.title} columns={config.columns} rows={config.rows} renderRow={config.renderRow} />;
}

function getReporteConfig(id, data, money) {
  const {
    topProductos,
    movimientosFinancieros,
    movimientosInventario,
    creditos,
    inventarioPorTipo,
    ventasPorMetodo,
    ventasPorCategoria,
    ventasRecientes,
    existenciasProductos,
    resumenDiario,
    cierresCajaDetalle,
    deudasClientes,
    pagosProveedores,
    facturasImpuestos,
    facturasDetalle,
  } = data;

  const formatDate = (value) => value ? new Date(value).toLocaleString("es-CO") : "-";
  const formatDay = (value) => value ? new Date(value).toLocaleDateString("es-CO") : "-";
  const number = (value) => Number(value || 0).toLocaleString("es-CO");
  const clean = (value) => value ?? "";

  const configs = {
    ventas_generales: {
      title: "Ventas generales",
      columns: ["Factura", "Fecha", "Cliente", "Responsable", "Método", "Estado", "Total"],
      rows: ventasRecientes,
      exportRows: () => ventasRecientes.map((row) => ({
        Factura: row.numero_factura || `FV-${row.id_venta}`,
        Fecha: formatDate(row.fecha),
        Cliente: clean(row.cliente),
        Responsable: clean(row.responsable),
        Metodo: clean(row.metodo_pago),
        Estado: clean(row.estado),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_venta} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black text-[#233876]">{row.numero_factura || `FV-${row.id_venta}`}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cliente}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.responsable}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.metodo_pago || "-"}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.estado || "-"}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total)}</td>
        </tr>
      ),
    },
    resumen_diario: {
      title: "Resumen diario",
      columns: ["Fecha", "Facturas", "Subtotal", "Impuesto", "Total"],
      rows: resumenDiario,
      exportRows: () => resumenDiario.map((row) => ({
        Fecha: formatDay(row.fecha),
        Facturas: Number(row.facturas || 0),
        Subtotal: Number(row.subtotal || 0),
        Impuesto: Number(row.impuesto || 0),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={row.fecha} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black">{formatDay(row.fecha)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.facturas}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.subtotal)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.impuesto)}</td>
          <td className="px-3 py-3 text-right text-xs font-black text-emerald-700">{money(row.total)}</td>
        </tr>
      ),
    },
    productos_rotacion: {
      title: "Productos con más rotación",
      columns: ["Producto", "Código", "Cantidad", "Vendido", "Utilidad"],
      rows: topProductos,
      exportRows: () => topProductos.map((row) => ({
        Producto: clean(row.nombre),
        Codigo: clean(row.codigo_barras),
        Cantidad: Number(row.cantidad_vendida || 0),
        Vendido: Number(row.total_vendido || 0),
        Utilidad: Number(row.utilidad_estimada || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_producto} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-bold text-slate-800">{row.nombre}</td>
          <td className="px-3 py-3 text-xs font-mono font-semibold">{row.codigo_barras || "-"}</td>
          <td className="px-3 py-3 text-right text-xs font-semibold">{number(row.cantidad_vendida)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total_vendido)}</td>
          <td className="px-3 py-3 text-right text-xs font-black text-emerald-700">{money(row.utilidad_estimada)}</td>
        </tr>
      ),
    },
    existencias: {
      title: "Existencias por producto",
      columns: ["Producto", "Código", "Categoría", "Unidad", "Stock", "Mínimo", "Costo inv.", "Valor venta"],
      rows: existenciasProductos,
      exportRows: () => existenciasProductos.map((row) => ({
        Producto: clean(row.nombre),
        Codigo: row.codigo_barras || row.codigo_interno || "",
        Categoria: clean(row.categoria),
        Unidad: clean(row.unidad),
        Stock: Number(row.stock_actual || 0),
        Minimo: Number(row.stock_minimo || 0),
        PrecioCompra: Number(row.precio_compra || 0),
        PrecioVenta: Number(row.precio_venta || 0),
        CostoInventario: Number(row.costo_inventario || 0),
        ValorVenta: Number(row.valor_venta || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_producto} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-bold">{row.nombre}</td>
          <td className="px-3 py-3 text-xs font-mono font-semibold">{row.codigo_barras || row.codigo_interno || "-"}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.categoria}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.unidad || "-"}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{number(row.stock_actual)}</td>
          <td className="px-3 py-3 text-right text-xs font-semibold">{number(row.stock_minimo)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.costo_inventario)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.valor_venta)}</td>
        </tr>
      ),
    },
    cuadres_caja: {
      title: "Cuadres de caja",
      columns: ["Caja", "Responsable", "Apertura", "Cierre", "Inicial", "Ventas", "Final", "Diferencia"],
      rows: cierresCajaDetalle,
      exportRows: () => cierresCajaDetalle.map((row) => ({
        Caja: row.id_caja,
        Responsable: clean(row.responsable),
        Sede: clean(row.sede),
        Apertura: formatDate(row.fecha_apertura),
        Cierre: formatDate(row.fecha_cierre),
        Inicial: Number(row.monto_inicial || 0),
        Ventas: Number(row.total_ventas || 0),
        Final: Number(row.monto_final || 0),
        Diferencia: Number(row.diferencia || 0),
        Estado: clean(row.estado),
      })),
      renderRow: (row) => (
        <tr key={row.id_caja} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black">#{row.id_caja}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.responsable}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha_apertura)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha_cierre)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.monto_inicial)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total_ventas)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.monto_final)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.diferencia)}</td>
        </tr>
      ),
    },
    deudas_clientes: {
      title: "Deudas de clientes",
      columns: ["Cliente", "Documento", "Factura", "Estado", "Emisión", "Vence", "Total", "Saldo"],
      rows: deudasClientes,
      exportRows: () => deudasClientes.map((row) => ({
        Cliente: clean(row.cliente),
        Documento: clean(row.numero_documento),
        Factura: clean(row.numero_factura),
        Estado: clean(row.estado),
        Emision: formatDay(row.fecha_emision),
        Vence: formatDay(row.fecha_vencimiento),
        Total: Number(row.monto_total || 0),
        Saldo: Number(row.saldo_pendiente || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_credito} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-bold">{row.cliente}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.numero_documento || "-"}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.numero_factura || "-"}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.estado}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDay(row.fecha_emision)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDay(row.fecha_vencimiento)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.monto_total)}</td>
          <td className="px-3 py-3 text-right text-xs font-black text-rose-700">{money(row.saldo_pendiente)}</td>
        </tr>
      ),
    },
    pagos_proveedores: {
      title: "Pagos a proveedores",
      columns: ["Fecha", "Proveedor", "Método", "Usuario", "Observación", "Monto"],
      rows: pagosProveedores,
      exportRows: () => pagosProveedores.map((row) => ({
        Fecha: formatDate(row.fecha),
        Proveedor: clean(row.proveedor),
        Metodo: clean(row.metodo_pago),
        Usuario: clean(row.usuario),
        Observacion: clean(row.observacion),
        Monto: Number(row.monto || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_movimiento_financiero} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha)}</td>
          <td className="px-3 py-3 text-xs font-bold">{row.proveedor}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.metodo_pago || "-"}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.usuario}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.observacion || "-"}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.monto)}</td>
        </tr>
      ),
    },
    impuestos: {
      title: "Facturas con impuestos",
      columns: ["Factura", "Fecha", "Cliente", "Responsable", "Subtotal", "Impuesto", "Total"],
      rows: facturasImpuestos,
      exportRows: () => facturasImpuestos.map((row) => ({
        Factura: row.numero_factura || `FV-${row.id_venta}`,
        Fecha: formatDate(row.fecha),
        Cliente: clean(row.cliente),
        Responsable: clean(row.responsable),
        Subtotal: Number(row.subtotal || 0),
        Impuesto: Number(row.impuesto || 0),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_venta} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black text-[#233876]">{row.numero_factura || `FV-${row.id_venta}`}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cliente}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.responsable}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.subtotal)}</td>
          <td className="px-3 py-3 text-right text-xs font-black text-amber-700">{money(row.impuesto)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total)}</td>
        </tr>
      ),
    },
    facturas: {
      title: "Facturas",
      columns: ["Factura", "Fecha", "Cliente", "Responsable", "Método", "Estado", "Total"],
      rows: facturasDetalle,
      exportRows: () => facturasDetalle.map((row) => ({
        Factura: row.numero_factura || `FV-${row.id_venta}`,
        Fecha: formatDate(row.fecha),
        Cliente: clean(row.cliente),
        Responsable: clean(row.responsable),
        Metodo: clean(row.metodo_pago),
        Estado: clean(row.estado),
        Subtotal: Number(row.subtotal || 0),
        Impuesto: Number(row.impuesto || 0),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={row.id_venta} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black text-[#233876]">{row.numero_factura || `FV-${row.id_venta}`}</td>
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cliente}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.responsable}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.metodo_pago || "-"}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.estado || "-"}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total)}</td>
        </tr>
      ),
    },
    ventas_categoria: {
      title: "Ventas por categoría",
      columns: ["Categoría", "Facturas", "Unidades", "Total"],
      rows: ventasPorCategoria,
      exportRows: () => ventasPorCategoria.map((row) => ({
        Categoria: clean(row.categoria),
        Facturas: Number(row.facturas || 0),
        Unidades: Number(row.unidades || 0),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={row.categoria} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black">{row.categoria}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.facturas}</td>
          <td className="px-3 py-3 text-right text-xs font-semibold">{number(row.unidades)}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total)}</td>
        </tr>
      ),
    },
    ventas_metodo: {
      title: "Ventas por método de pago",
      columns: ["Método", "Facturas", "Total"],
      rows: ventasPorMetodo,
      exportRows: () => ventasPorMetodo.map((row) => ({
        Metodo: clean(row.metodo_pago),
        Facturas: Number(row.cantidad || 0),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={row.metodo_pago} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black capitalize">{row.metodo_pago}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cantidad}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total)}</td>
        </tr>
      ),
    },
    financieros: {
      title: "Movimientos financieros",
      columns: ["Tipo", "Categoría", "Cantidad", "Total"],
      rows: movimientosFinancieros,
      exportRows: () => movimientosFinancieros.map((row) => ({
        Tipo: clean(row.tipo),
        Categoria: String(row.categoria || "").replace(/_/g, " "),
        Cantidad: Number(row.cantidad || 0),
        Total: Number(row.total || 0),
      })),
      renderRow: (row) => (
        <tr key={`${row.tipo}-${row.categoria}`} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black capitalize">{row.tipo}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{String(row.categoria).replace(/_/g, " ")}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cantidad}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.total)}</td>
        </tr>
      ),
    },
    inventario_movimientos: {
      title: "Movimientos recientes de inventario",
      columns: ["Fecha", "Producto", "Tipo", "Cantidad", "Usuario"],
      rows: movimientosInventario,
      exportRows: () => movimientosInventario.map((row) => ({
        Fecha: formatDate(row.fecha),
        Producto: clean(row.nombre_producto),
        Tipo: clean(row.tipo),
        Cantidad: Number(row.cantidad || 0),
        Usuario: row.nombre_usuario || "Sistema",
      })),
      renderRow: (row) => (
        <tr key={row.id_movimiento_inventario} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-semibold">{formatDate(row.fecha)}</td>
          <td className="px-3 py-3 text-xs font-bold text-slate-800">{row.nombre_producto}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.tipo}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{number(row.cantidad)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.nombre_usuario || "Sistema"}</td>
        </tr>
      ),
    },
    creditos_estado: {
      title: "Créditos por estado",
      columns: ["Tipo", "Estado", "Cantidad", "Saldo"],
      rows: creditos,
      exportRows: () => creditos.map((row) => ({
        Tipo: row.tipo === "por_cobrar" ? "Por cobrar" : "Por pagar",
        Estado: clean(row.estado),
        Cantidad: Number(row.cantidad || 0),
        Saldo: Number(row.saldo || 0),
      })),
      renderRow: (row) => (
        <tr key={`${row.tipo}-${row.estado}`} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black">{row.tipo === "por_cobrar" ? "Por cobrar" : "Por pagar"}</td>
          <td className="px-3 py-3 text-xs font-semibold capitalize">{row.estado}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cantidad}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{money(row.saldo)}</td>
        </tr>
      ),
    },
    inventario_tipo: {
      title: "Inventario por movimiento",
      columns: ["Tipo", "Movimientos", "Unidades"],
      rows: inventarioPorTipo,
      exportRows: () => inventarioPorTipo.map((row) => ({
        Tipo: clean(row.tipo),
        Movimientos: Number(row.cantidad || 0),
        Unidades: Number(row.unidades || 0),
      })),
      renderRow: (row) => (
        <tr key={row.tipo} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
          <td className="px-3 py-3 text-xs font-black capitalize">{row.tipo}</td>
          <td className="px-3 py-3 text-xs font-semibold">{row.cantidad}</td>
          <td className="px-3 py-3 text-right text-xs font-black">{number(row.unidades)}</td>
        </tr>
      ),
    },
  };

  return configs[id] || configs.ventas_generales;
}

function SummaryCard({ label, value, note, icon: Icon, tone }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="flex items-center justify-between rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
        <p className="text-xs font-semibold text-slate-500">{note}</p>
      </div>
      <span className={`grid h-11 w-11 place-items-center rounded-sm border ${tones[tone] || tones.blue}`}>
        <Icon size={23} />
      </span>
    </div>
  );
}

function MetricPanel({ title, icon: Icon, children }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-sm bg-[#eef2ff] text-[#3157d5]">
          <Icon size={17} />
        </span>
        <h2 className="text-sm font-black text-[#233876]">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}

function ReportTable({ title, columns, rows, renderRow }) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-black text-[#233876]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gradient-to-r from-[#233876] to-[#3157d5] text-white">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-3 text-left text-xs uppercase tracking-wide">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map(renderRow) : (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm font-semibold text-slate-400">
                  Sin datos en este rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
