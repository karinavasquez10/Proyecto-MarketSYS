import React, { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  PlusCircle,
  Search,
  Wallet,
} from "lucide-react";
import * as XLSX from "xlsx";
import useMovimientosFinancieros from "../../hooks/useMovimientosFinancieros";
import { crearMovimientoFinanciero } from "../../services/movimientosService";
import { ensureOk } from "../../services/responseUtils";

const categorias = [
  { value: "venta_manual", label: "Venta manual sin caja" },
  { value: "gasto", label: "Gasto general" },
  { value: "ajuste", label: "Ajuste de caja" },
  { value: "abono_cliente", label: "Abono de cliente" },
  { value: "pago_proveedor", label: "Pago a proveedor" },
  { value: "otro", label: "Otro movimiento" },
];

const metodosPago = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mixto", label: "Mixto" },
  { value: "otro", label: "Otro" },
];

const emptyForm = {
  tipo: "egreso",
  categoria: "gasto",
  monto: "",
  metodo_pago: "efectivo",
  observacion: "",
};

function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col justify-center items-center py-12">
      <svg className="animate-spin h-12 w-12 text-[#3157d5] mb-4" viewBox="0 0 45 45">
        <circle className="opacity-20" cx="22.5" cy="22.5" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
        <path d="M42.5,22.5a20,20 0 1,1-40,0" stroke="currentColor" strokeWidth="5" fill="none" className="opacity-70" />
      </svg>
      <span className="text-[#233876] text-base font-bold tracking-wide">{label}</span>
    </div>
  );
}

const money = (value) => `$${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

export default function Movimientos() {
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const itemsPerPage = 15;
  const { movimientos, loading, error, refetchMovimientos } = useMovimientosFinancieros();

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  }, []);

  const filteredMovimientos = useMemo(() => movimientos.filter((m) => {
    const texto = `${m.descripcion || ""} ${m.usuario || ""} ${m.categoriaLabel || ""}`.toLowerCase();
    const matchesTipo = tipoFiltro === "todos" || m.tipo.toLowerCase() === tipoFiltro;
    const matchesFechaInicio = !fechaInicio || new Date(m.fecha) >= new Date(fechaInicio);
    const matchesFechaFin = !fechaFin || new Date(m.fecha) <= new Date(`${fechaFin}T23:59:59`);
    const matchesBusqueda = !busqueda || texto.includes(busqueda.toLowerCase());
    return matchesTipo && matchesFechaInicio && matchesFechaFin && matchesBusqueda;
  }), [busqueda, fechaFin, fechaInicio, movimientos, tipoFiltro]);

  const ingresos = useMemo(() => filteredMovimientos
    .filter((m) => m.tipo === "Ingreso")
    .reduce((sum, m) => sum + m.monto, 0), [filteredMovimientos]);
  const egresos = useMemo(() => filteredMovimientos
    .filter((m) => m.tipo === "Egreso")
    .reduce((sum, m) => sum + m.monto, 0), [filteredMovimientos]);
  const saldo = ingresos - egresos;

  const totalPages = Math.ceil(filteredMovimientos.length / itemsPerPage);
  const paginatedMovimientos = filteredMovimientos.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const setField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "tipo" && value === "ingreso" && prev.categoria === "gasto" ? { categoria: "otro" } : {}),
    }));
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setFormError("Ingresa un monto válido mayor a cero.");
      return;
    }
    if (!form.observacion.trim()) {
      setFormError("Agrega una descripción breve del movimiento.");
      return;
    }

    setSaving(true);
    try {
      const response = await crearMovimientoFinanciero({
        ...form,
        monto,
        id_usuario: storedUser?.id || storedUser?.id_usuario || 1,
      });
      await ensureOk(response, "No se pudo registrar el movimiento financiero");
      setForm(emptyForm);
      await refetchMovimientos();
    } catch (err) {
      setFormError(err.message || "No se pudo registrar el movimiento financiero.");
    } finally {
      setSaving(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) setCurrentPage(newPage);
  };

  const handleLimpiarFiltros = () => {
    setTipoFiltro("todos");
    setFechaInicio("");
    setFechaFin("");
    setBusqueda("");
    setCurrentPage(0);
  };

  const handleExportarExcel = () => {
    const datosExportar = filteredMovimientos.map((m, index) => ({
      "N": index + 1,
      Fecha: new Date(m.fecha).toLocaleDateString("es-CO"),
      Hora: new Date(m.fecha).toLocaleTimeString("es-CO"),
      Tipo: m.tipo,
      Categoria: m.categoriaLabel,
      Descripcion: m.descripcion,
      Metodo: m.metodo,
      Usuario: m.usuario,
      Monto: m.monto,
    }));

    datosExportar.push({});
    datosExportar.push({ Tipo: "RESUMEN", Descripcion: "Total ingresos", Monto: ingresos });
    datosExportar.push({ Tipo: "", Descripcion: "Total egresos", Monto: egresos });
    datosExportar.push({ Tipo: "", Descripcion: "Saldo neto", Monto: saldo });

    const ws = XLSX.utils.json_to_sheet(datosExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    ws["!cols"] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 20 },
      { wch: 42 },
      { wch: 16 },
      { wch: 20 },
      { wch: 15 },
    ];
    XLSX.writeFile(wb, `Movimientos_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return <Spinner label="Cargando movimientos..." />;
  }

  return (
    <div className="w-full space-y-5 text-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-gradient-to-br from-[#3157d5] to-[#05a6c8] p-2.5 text-white shadow-sm">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1f2f5f] sm:text-2xl">Ingresos y Egresos</h1>
              <p className="text-sm font-semibold text-slate-500">Registro financiero operativo de MARKETSYS</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleExportarExcel}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Download size={16} />
          Exportar
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {formError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-sm border border-[#c7d2fe] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-sm bg-[#eef2ff] text-[#3157d5]">
            <PlusCircle size={17} />
          </span>
          <div>
            <h2 className="text-base font-black text-[#233876]">Registrar movimiento</h2>
            <p className="text-xs font-semibold text-slate-500">Para gastos, ajustes, abonos y pagos manuales.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Tipo</span>
            <select
              value={form.tipo}
              onChange={(e) => setField("tipo", e.target.value)}
              className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Categoría</span>
            <select
              value={form.categoria}
              onChange={(e) => setField("categoria", e.target.value)}
              className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
            >
              {categorias.map((categoria) => (
                <option key={categoria.value} value={categoria.value}>{categoria.label}</option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Monto</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monto}
              onChange={(e) => setField("monto", e.target.value)}
              placeholder="Monto"
              className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Método de pago</span>
            <select
              value={form.metodo_pago}
              onChange={(e) => setField("metodo_pago", e.target.value)}
              className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
            >
              {metodosPago.map((metodo) => (
                <option key={metodo.value} value={metodo.value}>{metodo.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">Descripción del movimiento</span>
            <input
              type="text"
              value={form.observacion}
              onChange={(e) => setField("observacion", e.target.value)}
              placeholder="Descripción del movimiento"
              className="w-full rounded-sm border border-[#c7d2fe] bg-[#f8f9ff] px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-0 inline-flex h-[38px] items-center justify-center gap-2 self-end rounded-sm border border-[#3157d5] bg-[#3157d5] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#233876] disabled:cursor-not-allowed disabled:opacity-60 lg:mt-5"
          >
            <PlusCircle size={16} />
            {saving ? "Guardando" : "Guardar"}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total ingresos" value={money(ingresos)} icon={ArrowUpCircle} tone="green" />
        <SummaryCard label="Total egresos" value={money(egresos)} icon={ArrowDownCircle} tone="rose" />
        <SummaryCard label="Saldo general" value={money(saldo)} icon={Wallet} tone={saldo >= 0 ? "blue" : "rose"} />
        <SummaryCard label="Movimientos" value={filteredMovimientos.length} icon={FileSpreadsheet} tone="amber" />
      </div>

      <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={18} className="text-[#3157d5]" />
          <h2 className="text-base font-black text-[#233876]">Filtros de búsqueda</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[180px_170px_170px_1fr_auto]">
          <select
            value={tipoFiltro}
            onChange={(e) => {
              setTipoFiltro(e.target.value);
              setCurrentPage(0);
            }}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
          >
            <option value="todos">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value);
              setCurrentPage(0);
            }}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
          />
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              setFechaFin(e.target.value);
              setCurrentPage(0);
            }}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
          />
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar descripción, usuario o categoría"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full rounded-sm border border-slate-200 py-2 pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]"
            />
          </div>
          <button
            onClick={handleLimpiarFiltros}
            className="rounded-sm border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Mostrando {filteredMovimientos.length === 0 ? 0 : currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, filteredMovimientos.length)} de {filteredMovimientos.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gradient-to-r from-[#233876] to-[#3157d5] text-white">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">Tipo</th>
                <th className="px-3 py-3 text-left">Categoría</th>
                <th className="px-3 py-3 text-left">Descripción</th>
                <th className="px-3 py-3 text-right">Monto</th>
                <th className="px-3 py-3 text-left">Método</th>
                <th className="px-3 py-3 text-left">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMovimientos.length > 0 ? (
                paginatedMovimientos.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 transition hover:bg-[#f8f9ff]">
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-700">
                      {new Date(m.fecha).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-sm px-2 py-1 text-xs font-black ${m.tipo === "Ingreso" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-bold text-[#233876]">{m.categoriaLabel}</td>
                    <td className="min-w-[240px] px-3 py-3 text-xs font-semibold text-slate-800" title={m.descripcion}>{m.descripcion}</td>
                    <td className={`whitespace-nowrap px-3 py-3 text-right text-xs font-black ${m.tipo === "Ingreso" ? "text-emerald-700" : "text-rose-700"}`}>
                      {money(m.monto)}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">{m.metodo}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">{m.usuario}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-sm font-semibold text-slate-400">
                    No hay movimientos financieros con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-4 py-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="rounded-sm border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-600">
              Página {currentPage + 1} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages - 1}
              className="rounded-sm border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className="flex items-center justify-between rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
      </div>
      <span className={`grid h-11 w-11 place-items-center rounded-sm border ${tones[tone] || tones.blue}`}>
        <Icon size={24} />
      </span>
    </div>
  );
}
