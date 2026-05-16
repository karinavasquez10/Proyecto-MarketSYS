import React, { useMemo, useState } from "react";
import { Banknote, CalendarRange, CreditCard, HandCoins, Search } from "lucide-react";
import useCreditos from "../../hooks/useCreditos";
import { crearAbonoCredito } from "../../services/creditosService";
import { ensureOk } from "../../services/responseUtils";

const money = (value) =>
  Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const estadoStyles = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  parcial: "bg-blue-50 text-blue-700 border-blue-200",
  pagado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  vencido: "bg-rose-50 text-rose-700 border-rose-200",
  anulado: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Creditos() {
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);
  const [abono, setAbono] = useState({
    monto: "",
    metodo_pago: "efectivo",
    observacion: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const params = useMemo(() => ({
    tipo: tipoFiltro,
    estado: estadoFiltro,
    tercero: busqueda,
  }), [busqueda, estadoFiltro, tipoFiltro]);

  const { creditos, loading, error, refetchCreditos } = useCreditos(params);

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  }, []);

  const resumen = useMemo(() => {
    const activos = creditos.filter((c) => !["pagado", "anulado"].includes(c.estado));
    return {
      porCobrar: activos
        .filter((c) => c.tipo === "por_cobrar")
        .reduce((sum, c) => sum + Number(c.saldo_pendiente || 0), 0),
      porPagar: activos
        .filter((c) => c.tipo === "por_pagar")
        .reduce((sum, c) => sum + Number(c.saldo_pendiente || 0), 0),
      vencidos: activos.filter((c) => c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date()).length,
      total: creditos.length,
    };
  }, [creditos]);

  const terceroNombre = (credito) =>
    credito.tipo === "por_cobrar"
      ? credito.nombre_cliente || "Cliente sin nombre"
      : credito.nombre_proveedor || "Proveedor sin nombre";

  const registrarAbono = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const monto = Number(abono.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setFormError("Ingresa un monto válido.");
      return;
    }
    if (monto > Number(selected.saldo_pendiente || 0)) {
      setFormError("El abono no puede superar el saldo pendiente.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await crearAbonoCredito(selected.id_credito, {
        ...abono,
        monto,
        id_usuario: storedUser?.id || storedUser?.id_usuario || 1,
      });
      await ensureOk(response, "No se pudo registrar el abono");
      setAbono({ monto: "", metodo_pago: "efectivo", observacion: "" });
      setSelected(null);
      await refetchCreditos();
    } catch (err) {
      setFormError(err.message || "No se pudo registrar el abono.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-module-card flex min-h-[360px] items-center justify-center">
        <p className="font-semibold text-slate-600">Cargando créditos...</p>
      </div>
    );
  }

  return (
    <div className="admin-module-page">
      {(error || formError) && (
        <div className="mb-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {formError || error}
        </div>
      )}

      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Créditos</h1>
            <p className="admin-module-subtitle">Cuentas por cobrar a clientes y por pagar a proveedores.</p>
          </div>
        </div>
        <div className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-right">
          <div className="text-[11px] font-black uppercase text-slate-400">Registros</div>
          <div className="text-lg font-black text-[#233876]">{resumen.total}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Por cobrar" value={money(resumen.porCobrar)} icon={HandCoins} tone="emerald" />
        <SummaryCard label="Por pagar" value={money(resumen.porPagar)} icon={Banknote} tone="rose" />
        <SummaryCard label="Vencidos" value={resumen.vencidos} icon={CalendarRange} tone="amber" />
        <SummaryCard label="Saldo neto" value={money(resumen.porCobrar - resumen.porPagar)} icon={CreditCard} tone="blue" />
      </div>

      <div className="admin-module-card">
        <div className="admin-module-card-header">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-cyan-600" />
            <h2 className="admin-module-card-title">Filtros</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_1fr]">
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            <option value="">Todos los tipos</option>
            <option value="por_cobrar">Por cobrar</option>
            <option value="por_pagar">Por pagar</option>
          </select>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagado">Pagado</option>
            <option value="vencido">Vencido</option>
            <option value="anulado">Anulado</option>
          </select>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, proveedor o documento"
            className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold"
          />
        </div>
      </div>

      <div className="admin-module-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-[#233876] to-[#3157d5] text-white">
              <tr>
                {["Documento", "Tipo", "Tercero", "Estado", "Total", "Abonado", "Saldo", "Vence", "Acciones"].map((col) => (
                  <th key={col} className="px-3 py-3 text-left text-xs uppercase tracking-wide">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditos.length > 0 ? (
                creditos.map((credito) => (
                  <tr key={credito.id_credito} className="border-b border-slate-100 hover:bg-[#f8f9ff]">
                    <td className="px-3 py-3 font-mono text-xs">{credito.numero_documento || `CR-${credito.id_credito}`}</td>
                    <td className="px-3 py-3 text-xs font-black text-[#233876]">
                      {credito.tipo === "por_cobrar" ? "Por cobrar" : "Por pagar"}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold">{terceroNombre(credito)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-sm border px-2 py-1 text-xs font-black uppercase ${estadoStyles[credito.estado] || estadoStyles.pendiente}`}>
                        {credito.estado}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-black">{money(credito.monto_total)}</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-emerald-700">{money(credito.total_abonado)}</td>
                    <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{money(credito.saldo_pendiente)}</td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      {credito.fecha_vencimiento ? new Date(credito.fecha_vencimiento).toLocaleDateString("es-CO") : "Sin fecha"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(credito);
                          setFormError("");
                        }}
                        disabled={["pagado", "anulado"].includes(credito.estado)}
                        className="rounded-sm border border-[#3157d5] px-3 py-1.5 text-xs font-black text-[#233876] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Abonar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="py-10 text-center text-sm font-semibold text-slate-400">
                    No hay créditos registrados con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={() => setSelected(null)}>
          <form
            onSubmit={registrarAbono}
            className="w-full max-w-md rounded-sm border border-[#c7d2fe] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-[#233876]">Registrar abono</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {terceroNombre(selected)} · Saldo {money(selected.saldo_pendiente)}
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={abono.monto}
                onChange={(e) => setAbono({ ...abono, monto: e.target.value })}
                placeholder="Monto del abono"
                className="w-full rounded-sm border border-[#c7d2fe] px-3 py-2 text-sm font-bold text-slate-900"
              />
              <select
                value={abono.metodo_pago}
                onChange={(e) => setAbono({ ...abono, metodo_pago: e.target.value })}
                className="w-full rounded-sm border border-[#c7d2fe] px-3 py-2 text-sm font-bold text-slate-800"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="mixto">Mixto</option>
                <option value="otro">Otro</option>
              </select>
              <textarea
                value={abono.observacion}
                onChange={(e) => setAbono({ ...abono, observacion: e.target.value })}
                placeholder="Observación o soporte"
                rows={3}
                className="w-full rounded-sm border border-[#c7d2fe] px-3 py-2 text-sm font-semibold text-slate-800"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 rounded-sm border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-sm border border-[#3157d5] bg-[#3157d5] px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? "Guardando" : "Guardar abono"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className="flex items-center justify-between rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
      </div>
      <span className={`grid h-11 w-11 place-items-center rounded-sm border ${tones[tone] || tones.blue}`}>
        <Icon size={23} />
      </span>
    </div>
  );
}
