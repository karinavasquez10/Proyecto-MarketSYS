import React, { useState, useEffect } from "react";
import { AlertTriangle, Archive, Calculator, CheckCircle2, CircleDollarSign, ClipboardList, X } from "lucide-react";
import { cerrarCaja, obtenerCaja } from "../../services/cajasService";
import { ensureOk } from "../../services/responseUtils";

/* Hook: sincroniza con el modo oscuro global */
function useSystemTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return "light";
}

const denominaciones = [
  { label: "$100.000", value: 100000 },
  { label: "$50.000", value: 50000 },
  { label: "$20.000", value: 20000 },
  { label: "$10.000", value: 10000 },
  { label: "$5.000", value: 5000 },
  { label: "$2.000", value: 2000 },
  { label: "$1.000", value: 1000 },
  { label: "$500", value: 500 },
  { label: "$200", value: 200 },
  { label: "$100", value: 100 },
];

const CerrarCaja = ({ onClose, onClosed }) => {
  const theme = useSystemTheme();
  const [conteoGastos, setConteoGastos] = useState({});
  const [cajaData, setCajaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [confirmZeroOpen, setConfirmZeroOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Fetch datos de la caja abierta al montar
  useEffect(() => {
    const fetchCajaAbierta = async () => {
      try {
        const local = localStorage.getItem("caja_abierta");
        if (!local) {
          throw new Error("No se encontró caja abierta en localStorage.");
        }
        const cajaLocal = JSON.parse(local);
        if (!cajaLocal.id_caja) {
          throw new Error("ID de caja no válido en localStorage.");
        }

        const data = await obtenerCaja(cajaLocal.id_caja);
        const caja = data.caja || data;
        if (caja.estado !== 'abierta') {
          throw new Error("La caja ya está cerrada o no es válida.");
        }
        setCajaData(caja);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCajaAbierta();
  }, []);

  const handleChangeGasto = (value, cantidad) => {
    setConteoGastos({
      ...conteoGastos,
      [value]: cantidad ? parseInt(cantidad) : 0,
    });
  };

  // Suma de billetes y monedas contados físicamente al cierre.
  const totalContado = Object.entries(conteoGastos).reduce(
    (acc, [denStr, cant]) => {
      const den = parseInt(denStr);  // Asegura numérico
      return acc + (den * (cant || 0));
    },
    0
  );

  const montoInicial = Number(cajaData?.monto_inicial);
  const totalVentas = Number(cajaData?.total_ventas);
  const montoEsperado = Number(cajaData?.monto_final);

  const montoFinal = totalContado;
  const diferencia = montoFinal - montoEsperado;

  const money = (n) =>
    (Number(n) || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const finalizarCaja = async () => {
    try {
      setLoading(true);
      const payload = {
        fecha_cierre: new Date().toISOString(),
        monto_final: montoFinal,
        diferencia: diferencia,
        observaciones: observaciones || "",
      };

      const res = await cerrarCaja(cajaData.id_caja, payload);
      await ensureOk(res, "No se pudo cerrar la caja.");

      // Limpiar localStorage para desbloquear AbrirCaja
      localStorage.removeItem("caja_abierta");
      onClosed?.(cajaData);

      setFeedback({
        type: "success",
        title: "Caja cerrada correctamente",
        message: `Se cerró la caja #${cajaData.id_caja}.`,
        details: [
          { label: "Monto final", value: money(montoFinal) },
          { label: "Diferencia", value: money(diferencia) },
        ],
      });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "No se pudo cerrar la caja",
        message: err.message || "Ocurrió un error inesperado al cerrar la caja.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizar = async () => {
    if (!cajaData?.id_caja) {
      setFeedback({
        type: "error",
        title: "Caja no encontrada",
        message: "No se encontró el ID de la caja abierta. Cierra esta ventana y vuelve a intentarlo.",
      });
      return;
    }
    if (totalContado <= 0) {
      setConfirmZeroOpen(true);
      return;
    }

    await finalizarCaja();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className={`p-8 rounded-sm shadow-xl ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}>
          <p className="text-center">Cargando datos de caja...</p>
        </div>
      </div>
    );
  }

  if (error || !cajaData) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className={`p-8 rounded-sm shadow-xl ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}>
          <h2 className="text-lg font-bold mb-2 text-red-600">Error</h2>
          <p>{error || "No se encontraron datos de caja."}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-white rounded hover:bg-[#233876] transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <div
        className={`cashier-modal-light flex max-h-[92vh] w-[96vw] max-w-[1040px] flex-col overflow-hidden rounded-md border shadow-2xl transition-colors duration-300
          ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-[#f8f9ff] border-[#c7d2fe] text-[#111827]"
          }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3 text-white transition-colors duration-300 ${
            theme === "dark"
              ? "bg-slate-800 border-b border-slate-700"
              : "bg-[linear-gradient(135deg,#233876,#3157d5_58%,#18a36b)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm border border-white/30 bg-white/15">
              <Archive size={19} />
            </span>
            <div>
              <h2 className="text-lg font-black leading-tight">Cerrar caja</h2>
              <p className="text-xs font-bold text-white/85">Cuenta el efectivo físico y confirma el cierre del turno.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/20 transition"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:overflow-hidden">
          {/* Conteo de efectivo */}
          <section className="min-h-0 rounded-md border border-[#c7d2fe] bg-white p-4 shadow-sm lg:overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#111827]">
                  <Calculator size={17} className="text-[#3157d5]" />
                  Conteo físico de efectivo
                </h3>
                <p className="mt-1 text-xs font-bold text-[#47524e]">
                  Ingresa cuántos billetes o monedas tienes por denominación.
                </p>
              </div>
              <span className="rounded-sm bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#152b73]">
                {money(totalContado)}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
              {denominaciones.map((den) => {
                const cantidad = conteoGastos[den.value] || 0;
                const subtotal = cantidad * den.value;
                return (
                  <div
                    key={den.value}
                    className="grid grid-cols-[82px_72px_1fr] items-center gap-2 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] px-2.5 py-2 shadow-sm"
                  >
                    <span className="text-sm font-black text-[#111827]">{den.label}</span>
                    <input
                      type="number"
                      min="0"
                      value={cantidad || ""}
                      className="h-9 rounded-sm border border-[#c7d2fe] bg-white px-2 text-center text-sm font-black text-[#111827] outline-none transition focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                      placeholder="0"
                      onChange={(e) => handleChangeGasto(den.value, e.target.value)}
                    />
                    <span className="truncate rounded-sm bg-white px-2 py-1 text-right text-xs font-black text-[#152b73]">
                      {money(subtotal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Resumen y cierre */}
          <aside className="flex min-h-0 flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <ResumenBox label="Base inicial" value={montoInicial} tone="neutral" theme={theme} compact />
              <ResumenBox label="Ventas" value={totalVentas} tone="positive" theme={theme} compact />
              <ResumenBox label="Conteo" value={montoFinal} tone="warning" theme={theme} compact />
              <ResumenBox
                label="Diferencia"
                value={diferencia}
                tone={diferencia === 0 ? "positive" : "danger"}
                theme={theme}
                isNegative={diferencia < 0}
                compact
              />
            </div>

            <div className="rounded-md border border-[#c7d2fe] bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#111827]">
                <CircleDollarSign size={17} className="text-[#3157d5]" />
                Total esperado
              </h3>
              <p className="mt-2 text-3xl font-black text-[#111827]">{money(montoEsperado)}</p>
              <p className="mt-1 text-xs font-bold text-[#47524e]">
                Valor que el sistema espera según apertura y ventas registradas.
              </p>
            </div>

            <div className="rounded-md border border-[#c7d2fe] bg-white p-4 shadow-sm">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#111827]">
                <ClipboardList size={16} className="text-[#3157d5]" />
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-sm border border-[#c7d2fe] bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                placeholder="Notas sobre diferencias, retiros o novedades del cierre."
              />
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 rounded-md border border-[#dbe4ff] bg-[#eef2ff] p-3">
              <button
                onClick={onClose}
                className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#f8fbf7]"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizar}
                className="rounded-sm bg-[linear-gradient(135deg,#3157d5,#18a36b)] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Cerrando..." : "Finalizar caja"}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {confirmZeroOpen && (
        <CajaDialog
          tone="warning"
          icon={AlertTriangle}
          title="Conteo físico en cero"
          message="El conteo físico está en $0. Revisa las denominaciones antes de confirmar el cierre."
          details={[
            { label: "Total esperado", value: money(montoEsperado) },
            { label: "Diferencia", value: money(diferencia) },
          ]}
          primaryText="Cerrar con $0"
          secondaryText="Volver al conteo"
          onPrimary={() => {
            setConfirmZeroOpen(false);
            finalizarCaja();
          }}
          onSecondary={() => setConfirmZeroOpen(false)}
        />
      )}

      {feedback && (
        <CajaDialog
          tone={feedback.type === "success" ? "success" : "danger"}
          icon={feedback.type === "success" ? CheckCircle2 : AlertTriangle}
          title={feedback.title}
          message={feedback.message}
          details={feedback.details}
          primaryText="Aceptar"
          onPrimary={() => {
            setFeedback(null);
            if (feedback.type === "success") {
              onClose();
            }
          }}
        />
      )}
    </div>
  );
};

function CajaDialog({
  tone = "success",
  icon: Icon,
  title,
  message,
  details = [],
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
}) {
  const toneStyles = {
    success: {
      icon: "bg-emerald-100 text-emerald-700 border-emerald-200",
      button: "bg-[linear-gradient(135deg,#3157d5,#18a36b)] text-white",
    },
    warning: {
      icon: "bg-amber-100 text-amber-700 border-amber-200",
      button: "bg-[#111827] text-white",
    },
    danger: {
      icon: "bg-rose-100 text-rose-700 border-rose-200",
      button: "bg-[#b91c1c] text-white",
    },
  };
  const styles = toneStyles[tone] || toneStyles.success;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#111827]/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${styles.icon}`}>
            <Icon size={22} />
          </span>
          <div className="min-w-0">
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

        <div className={`mt-5 grid gap-3 ${secondaryText ? "grid-cols-2" : "grid-cols-1"}`}>
          {secondaryText && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff]"
            >
              {secondaryText}
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary}
            className={`rounded-sm px-4 py-2.5 text-sm font-black shadow-sm transition hover:brightness-105 ${styles.button}`}
          >
            {primaryText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== Subcomponente para los box resumen ================== */
function ResumenBox({ label, value, tone = "neutral", theme, isNegative = false, compact = false }) {
  const money = (n) =>
    (Number(n) || 0).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const lightStyles = {
    neutral: "bg-white border-[#c7d2fe] text-slate-900",
    positive: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-rose-50 border-rose-200 text-rose-900",
  };

  return (
    <div
      className={`rounded-sm p-4 text-center border shadow-sm transition ${
        theme === "dark"
          ? "bg-slate-800 border border-slate-700 text-white"
          : lightStyles[tone]
      }`}
    >
      <h3 className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</h3>
      <p className={`${compact ? "text-base" : "text-xl"} font-black mt-1 ${isNegative && theme === "dark" ? 'text-red-200' : ''}`}>
        {money(value)}
      </p>
    </div>
  );
}

export default CerrarCaja;
