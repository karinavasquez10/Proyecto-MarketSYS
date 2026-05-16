import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Search,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ArchiveX,
  Eye,
  LockKeyhole,
  X,
  Wallet,
  RefreshCw,
} from "lucide-react";
import useCajas from "../../hooks/useCajas";
import { cerrarCaja, obtenerCaja } from "../../services/cajasService";
import { ensureOk } from "../../services/responseUtils";

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

export default function CierresCaja() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // DESC por fecha_cierre por default
  const [currentPage, setCurrentPage] = useState(0);
  const [activeTab, setActiveTab] = useState("abiertas");
  const [selectedCaja, setSelectedCaja] = useState(null);
  const itemsPerPage = 10;

  // Filtros
  const [fechaInicial, setFechaInicial] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");
  const [filtroCajero, ] = useState(""); // ID usuario o ""
  const { cajas, loading, error, refetchCajas } = useCajas();

  const cajasAbiertas = useMemo(
    () => cajas.filter((c) => c.estado === "abierta"),
    [cajas]
  );
  const cajasCerradas = useMemo(
    () => cajas.filter((c) => c.estado === "cerrada"),
    [cajas]
  );
  const baseCajas = activeTab === "abiertas" ? cajasAbiertas : cajasCerradas;

  // Aplicar filtros y ordenamiento
  const filteredCajas = useMemo(() => baseCajas.filter((c) => {
    const fechaBase = new Date(c.fecha_cierre || c.fecha_apertura).toISOString().split("T")[0];
    const inicial = fechaInicial
      ? new Date(fechaInicial).toISOString().split("T")[0]
      : "1900-01-01";
    const final = fechaFinal
      ? new Date(fechaFinal).toISOString().split("T")[0]
      : "2100-01-01";
    const matchesDate = fechaBase >= inicial && fechaBase <= final;
    const matchesCajero = !filtroCajero || c.id_usuario == filtroCajero;
    const matchesSearch =
      c.nombre_usuario
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      c.id_caja.toString().includes(searchTerm) ||
      c.nombre_sucursal
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesDate && matchesCajero && matchesSearch;
  }), [baseCajas, fechaFinal, fechaInicial, filtroCajero, searchTerm]);

  const sortedCajas = useMemo(() => [...filteredCajas].sort((a, b) => {
    const dateA = new Date(a.fecha_cierre || a.fecha_apertura).getTime();
    const dateB = new Date(b.fecha_cierre || b.fecha_apertura).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  }), [filteredCajas, sortOrder]);

  const totalPages = Math.ceil(sortedCajas.length / itemsPerPage);
  const paginatedCajas = sortedCajas.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Total descuadre (suma absoluta de diferencias)
  const totalDescuadre = useMemo(
    () => filteredCajas.reduce(
      (sum, c) => sum + Math.abs(parseFloat(c.diferencia || 0)),
      0
    ),
    [filteredCajas]
  );
  const totalVentasFiltradas = useMemo(
    () => filteredCajas.reduce((sum, c) => sum + Number(c.total_ventas || 0), 0),
    [filteredCajas]
  );
  const totalEsperadoAbiertas = useMemo(
    () => cajasAbiertas.reduce((sum, c) => sum + Number(c.monto_final || 0), 0),
    [cajasAbiertas]
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-1 w-full flex items-center justify-center min-h-[400px]">
        <p className="text-slate-600">Cargando cierres de caja...</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page min-h-screen w-full overflow-x-hidden bg-[#f4f6ff]">
      <div className="w-full space-y-4">
        {/* Error global */}
        {error && (
          <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-center text-rose-700">
            <p className="text-sm">Error al cargar datos: {error}</p>
            <button
              onClick={refetchCajas}
              className="text-rose-600 hover:underline text-sm mt-1"
            >
              Recargar
            </button>
          </div>
        )}

        {/* ===== Título ===== */}
        <div className="admin-module-header">
          <div className="admin-module-heading">
            <div className="admin-module-icon">
              <Calculator size={20} />
            </div>
            <div>
              <h1 className="admin-module-title">Cierres de caja</h1>
              <p className="admin-module-subtitle">
                Revisa cajas abiertas, cierres realizados y descuadres por turno.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refetchCajas}
            className="inline-flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-xs font-black text-[#233876] shadow-sm transition hover:bg-[#eef2ff]"
          >
            <RefreshCw size={15} />
            Actualizar
          </button>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Cajas abiertas" value={cajasAbiertas.length} helper={money(totalEsperadoAbiertas)} tone="emerald" />
          <MetricCard title="Cajas cerradas" value={cajasCerradas.length} helper="Histórico registrado" tone="blue" />
          <MetricCard title="Ventas filtradas" value={money(totalVentasFiltradas)} helper={`${filteredCajas.length} registros`} tone="cyan" />
          <MetricCard title="Descuadre" value={money(totalDescuadre)} helper="Solo registros filtrados" tone="rose" />
        </section>

        <section className="rounded-sm border border-[#dbe4ff] bg-white p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="grid grid-cols-2 gap-2 rounded-sm bg-[#f4f6ff] p-1">
              <TabButton
                active={activeTab === "abiertas"}
                onClick={() => {
                  setActiveTab("abiertas");
                  setCurrentPage(0);
                }}
              >
                Cajas abiertas ({cajasAbiertas.length})
              </TabButton>
              <TabButton
                active={activeTab === "cerradas"}
                onClick={() => {
                  setActiveTab("cerradas");
                  setCurrentPage(0);
                }}
              >
                Cajas cerradas ({cajasCerradas.length})
              </TabButton>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_150px_150px_150px_auto]">
              <FilterField label="Buscar">
                <div className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2">
                  <Search size={15} className="text-[#3157d5]" />
                  <input
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(0);
                    }}
                    placeholder="Caja, cajero o sede..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#111827] outline-none placeholder:text-[#64748b]"
                  />
                </div>
              </FilterField>
              <FilterField label="Fecha inicial">
                <input
                  type="date"
                  value={fechaInicial}
                  onChange={(e) => {
                    setFechaInicial(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="h-9 w-full rounded-sm border border-[#c7d2fe] bg-white px-2 text-sm font-bold text-[#111827] outline-none focus:ring-2 focus:ring-[#c7d2fe]"
                />
              </FilterField>
              <FilterField label="Fecha final">
                <input
                  type="date"
                  value={fechaFinal}
                  onChange={(e) => {
                    setFechaFinal(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="h-9 w-full rounded-sm border border-[#c7d2fe] bg-white px-2 text-sm font-bold text-[#111827] outline-none focus:ring-2 focus:ring-[#c7d2fe]"
                />
              </FilterField>
              <FilterField label="Orden">
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="h-9 w-full rounded-sm border border-[#c7d2fe] bg-white px-2 text-sm font-bold text-[#111827] outline-none focus:ring-2 focus:ring-[#c7d2fe]"
                >
                  <option value="desc">Más reciente</option>
                  <option value="asc">Más antiguo</option>
                </select>
              </FilterField>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setFechaInicial("");
                    setFechaFinal("");
                    setSearchTerm("");
                    setCurrentPage(0);
                  }}
                  className="h-9 rounded-sm border border-[#c7d2fe] bg-[#eef2ff] px-3 text-xs font-black text-[#233876] transition hover:bg-[#e0e7ff]"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-sm border border-[#dbe4ff] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff,#f8f9ff)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#111827]">
              {activeTab === "abiertas" ? "Gestión de cajas abiertas" : "Lista de cierres"}{" "}
              <span className="text-slate-500 text-sm">
                ({sortedCajas.length})
              </span>
            </h2>
            <p className="text-xs font-bold text-[#4b5563]">
              Mostrando {paginatedCajas.length} de {sortedCajas.length} registros filtrados.
            </p>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-[980px] w-full text-xs">
              <thead className="bg-[#eef2ff] text-[#233876]">
                <tr className="text-left">
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-wide">Caja</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-wide">Estado</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-wide">Responsable</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-wide">Apertura / cierre</th>
                  <th className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-wide">Ventas</th>
                  <th className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-wide">Base</th>
                  <th className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-wide">Esperado</th>
                  <th className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-wide">Diferencia</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-wide">Sede</th>
                  <th className="px-3 py-3 text-center text-[11px] font-black uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ff]">
                {paginatedCajas.length > 0 ? (
                  paginatedCajas.map((c) => {
                    const fechaApertura = new Date(c.fecha_apertura);
                    const fechaCierre = c.fecha_cierre ? new Date(c.fecha_cierre) : null;
                    return (
                      <tr
                        key={c.id_caja}
                        className="transition hover:bg-[#f8f9ff]"
                      >
                        <td className="px-3 py-3 font-mono text-xs font-black text-[#233876]">
                          {c.id_caja.toString().padStart(3, "0")}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge estado={c.estado} />
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-xs font-black text-[#111827]" title={c.nombre_usuario}>
                          {c.nombre_usuario || "N/A"}
                        </td>
                        <td className="px-3 py-3 text-xs font-bold text-[#4b5563]">
                          <span className="block text-[#111827]">{shortDateTime(fechaApertura)}</span>
                          <span className="block">{fechaCierre ? shortDateTime(fechaCierre) : "Pendiente de cierre"}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-black text-[#111827]">
                          {money(c.total_ventas)}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#4b5563]">{money(c.monto_inicial)}</td>
                        <td className="px-3 py-3 text-right text-xs font-black text-[#111827]">{money(c.monto_final)}</td>
                        <td
                          className={`px-3 py-3 text-right text-xs font-black ${
                            parseFloat(c.diferencia || 0) >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {c.estado === "abierta" ? "Pendiente" : money(c.diferencia)}
                        </td>
                        <td className="max-w-[130px] truncate px-3 py-3 text-xs font-bold text-[#4b5563]" title={c.nombre_sucursal}>
                          {c.nombre_sucursal || "N/A"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCaja(c)}
                            className="inline-flex items-center gap-1 rounded-sm border border-[#c7d2fe] bg-[#eef2ff] px-2.5 py-1.5 text-[11px] font-black text-[#233876] transition hover:border-[#3157d5] hover:bg-[#e0e7ff]"
                          >
                            <Eye size={13} />
                            Revisar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" className="py-10 text-center text-slate-500 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <ArchiveX size={32} className="text-slate-300" />
                        <p>No se encontraron registros.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2ff] px-4 py-3">
              <div className="text-sm text-slate-600">
                Mostrando {currentPage * itemsPerPage + 1} a{" "}
                {Math.min((currentPage + 1) * itemsPerPage, sortedCajas.length)}{" "}
                de {sortedCajas.length} cajas
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm text-[#233876] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm text-[#233876] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      {selectedCaja && (
        <GestionCajaModal
          caja={selectedCaja}
          onClose={() => setSelectedCaja(null)}
          onUpdated={() => {
            setSelectedCaja(null);
            refetchCajas();
          }}
        />
      )}
    </div>
  );
}

function GestionCajaModal({ caja, onClose, onUpdated }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [montoFinal, setMontoFinal] = useState(String(Math.round(Number(caja.monto_final || 0))));
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    let alive = true;
    obtenerCaja(caja.id_caja)
      .then((data) => {
        if (!alive) return;
        setDetalle(data);
        const esperado = Number(data?.caja?.monto_final ?? caja.monto_final ?? 0);
        setMontoFinal(String(Math.round(esperado)));
      })
      .catch((err) => {
        if (alive) setError(err.message || "No se pudo cargar el detalle de caja.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [caja.id_caja, caja.monto_final]);

  const cajaDetalle = detalle?.caja || caja;
  const ventas = detalle?.ventas || [];
  const esperado = Number(cajaDetalle.monto_final || 0);
  const contado = Number(montoFinal || 0);
  const diferencia = contado - esperado;
  const canClose = cajaDetalle.estado === "abierta";

  const cerrarAdministrativamente = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await cerrarCaja(cajaDetalle.id_caja, {
        fecha_cierre: new Date().toISOString(),
        monto_final: contado,
        diferencia,
        observaciones: `Cierre administrativo.${observaciones ? ` ${observaciones}` : ""}`,
      });
      await ensureOk(res, "No se pudo cerrar la caja.");
      onUpdated();
    } catch (err) {
      setError(err.message || "No se pudo cerrar la caja.");
    } finally {
      setSaving(false);
      setConfirmClose(false);
    }
  };

  const handleCerrar = async () => {
    if (!canClose) return;
    setConfirmClose(true);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-cyan-100 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cyan-100 bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-3 text-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-white/80">Gestión administrativa</p>
            <h3 className="text-lg font-black">Caja #{String(cajaDetalle.id_caja).padStart(3, "0")}</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-sm border border-white/30 hover:bg-white/15">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          {error && (
            <div className="mb-3 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="rounded-sm border border-cyan-100 bg-white p-8 text-center text-sm font-bold text-slate-600">
              Cargando detalle de caja...
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoBox label="Estado" value={cajaDetalle.estado} />
                  <InfoBox label="Responsable" value={cajaDetalle.nombre_usuario || "N/A"} />
                  <InfoBox label="Sede" value={cajaDetalle.nombre_sucursal || "N/A"} />
                  <InfoBox label="Apertura" value={shortDateTime(cajaDetalle.fecha_apertura)} />
                  <InfoBox label="Base inicial" value={money(cajaDetalle.monto_inicial)} />
                  <InfoBox label="Ventas" value={money(cajaDetalle.total_ventas)} />
                  <InfoBox label="Esperado sistema" value={money(esperado)} strong />
                  <InfoBox label="Facturas" value={ventas.length} />
                </div>

                {canClose && (
                  <div className="rounded-sm border border-cyan-100 bg-white p-3 shadow-sm">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                      <LockKeyhole size={16} className="text-cyan-700" />
                      Cierre administrativo
                    </h4>
                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase text-slate-600">Monto contado / final</span>
                      <input
                        value={montoFinal}
                        onChange={(e) => setMontoFinal(e.target.value.replace(/[^\d.-]/g, ""))}
                        className="w-full rounded-sm border border-cyan-100 px-3 py-2 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-cyan-200"
                      />
                    </label>
                    <div className={`mt-2 rounded-sm border px-3 py-2 text-sm font-black ${diferencia === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                      Diferencia: {money(diferencia)}
                    </div>
                    <label className="mt-3 block">
                      <span className="mb-1 block text-xs font-black uppercase text-slate-600">Observación</span>
                      <textarea
                        rows={3}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Motivo o nota del cierre administrativo..."
                        className="w-full rounded-sm border border-cyan-100 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-200"
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="rounded-sm border border-cyan-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-cyan-100 bg-cyan-50 px-3 py-2">
                  <h4 className="flex items-center gap-2 text-sm font-black text-slate-800">
                    <Wallet size={16} className="text-cyan-700" />
                    Ventas asociadas
                  </h4>
                  <span className="text-xs font-black text-slate-600">{ventas.length} facturas</span>
                </div>
                <div className="max-h-[430px] overflow-y-auto">
                  {ventas.length ? (
                    ventas.map((venta) => (
                      <div key={venta.id_venta} className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-800">{venta.numero_factura || `FV-${venta.id_venta}`}</p>
                          <p className="truncate text-xs font-bold text-slate-500">
                            {shortDateTime(venta.fecha)} · {venta.nombre_cliente || "Consumidor final"}
                          </p>
                        </div>
                        <p className="font-black text-slate-900">{money(venta.total)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm font-bold text-slate-500">No hay ventas asociadas a esta caja.</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-cyan-100 bg-white p-3">
          <button type="button" onClick={onClose} className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          {canClose && (
            <button
              type="button"
              onClick={handleCerrar}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LockKeyhole size={15} />
              {saving ? "Cerrando..." : "Cerrar caja"}
            </button>
          )}
        </div>
      </div>

      {confirmClose && (
        <AdminConfirmDialog
          title={`Cerrar caja #${cajaDetalle.id_caja}`}
          message="Esta acción cerrará administrativamente la caja con los valores registrados en esta ventana."
          details={[
            { label: "Esperado", value: money(esperado) },
            { label: "Contado", value: money(contado) },
            { label: "Diferencia", value: money(diferencia) },
          ]}
          loading={saving}
          onCancel={() => setConfirmClose(false)}
          onConfirm={cerrarAdministrativamente}
        />
      )}
    </div>
  );
}

function AdminConfirmDialog({ title, message, details = [], loading = false, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-[440px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-100 text-amber-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
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

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-sm bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
          >
            {loading ? "Cerrando..." : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, helper, tone = "blue" }) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-sm border bg-white p-4 shadow-sm ${styles[tone] || styles.blue}`}>
      <p className="text-[11px] font-black uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-2xl font-black text-[#111827]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#4b5563]">{helper}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-3 py-2 text-xs font-black transition ${
        active
          ? "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-white shadow-sm"
          : "bg-white text-[#233876] hover:bg-[#eef2ff]"
      }`}
    >
      {children}
    </button>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#233876]">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ estado }) {
  const open = estado === "abierta";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase ${
        open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
      }`}
    >
      {estado || "N/A"}
    </span>
  );
}

function InfoBox({ label, value, strong = false }) {
  return (
    <div className={`rounded-sm border border-cyan-100 bg-white px-3 py-2 shadow-sm ${strong ? "ring-1 ring-cyan-100" : ""}`}>
      <p className="text-[10px] font-black uppercase tracking-wide text-cyan-700">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value ?? "N/A"}</p>
    </div>
  );
}
