import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Building2, Calculator, CheckCircle2, CircleDollarSign, ClipboardList, User, Wallet, X } from "lucide-react";
import { abrirCaja } from "../../services/cajasService";
import { ensureOk } from "../../services/responseUtils";
import { listarSucursalesActivas } from "../../services/sucursalesService";

/* =================== Hook para sincronizar modo global =================== */
function useSystemTheme() {
  React.useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return "light";
}

/* =========== Control global: caja abierta (bloqueo de abrir caja) =========== */
function isCajaAbiertaLocal() {
  const local = localStorage.getItem("caja_abierta");
  if (!local) return null;
  try {
    const obj = JSON.parse(local);
    if (obj && obj.estado === "abierta" && obj.id_caja) {
      return obj;
    }
  } catch {
    return null;
  }
  return null;
}

/* ====================== Modal público ====================== */
function AbrirCaja({ open, onClose, usuario, onOpened }) {
  useSystemTheme();
  const [cajaEnCurso, setCajaEnCurso] = React.useState(isCajaAbiertaLocal());
  const [bloqueada, setBloqueada] = React.useState(!!cajaEnCurso);

  React.useEffect(() => {
    const actualizar = () => {
      const active = isCajaAbiertaLocal();
      setCajaEnCurso(active);
      setBloqueada(!!active);
    };
    window.addEventListener("storage", actualizar);
    return () => window.removeEventListener("storage", actualizar);
  }, []);

  React.useEffect(() => {
    const active = isCajaAbiertaLocal();
    setCajaEnCurso(active);
    setBloqueada(!!active);
  }, [open]);

  const handleBloqueoExitoso = React.useCallback(() => {
    const active = isCajaAbiertaLocal();
    setCajaEnCurso(active);
    setBloqueada(!!active);
  }, []);

  if (!open) return null;

  if (bloqueada) {
    return createPortal(
      <ModalShell onClose={onClose}>
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fbf7,#eef2ff_60%,#fffdf8)] p-4 text-[#111827]">
          <div className="w-full max-w-[560px] rounded-md border border-[#c7d2fe] bg-white p-5 text-center shadow-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Wallet size={28} />
            </div>
            <h2 className="mt-3 text-2xl font-black text-[#111827]">Caja abierta</h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-6 text-[#47524e]">
              Ya existe una caja activa para este turno. No es necesario abrir otra; puedes seguir facturando o cerrarla desde la opción de cierre.
            </p>

            <div className="mt-4 grid gap-2 rounded-md border border-[#dbe4ff] bg-[#f8fbf7] p-3 text-left sm:grid-cols-2">
              <InfoItem label="Caja" value={cajaEnCurso?.id_caja ? `Caja #${cajaEnCurso.id_caja}` : "Caja activa"} />
              <InfoItem label="Cajero" value={cajaEnCurso?.usuario || usuario?.nombre || "Usuario activo"} />
              <InfoItem label="Base inicial" value={money(cajaEnCurso?.monto_inicial)} />
              <InfoItem label="Fecha apertura" value={formatDateTime(cajaEnCurso?.fecha_apertura)} />
            </div>

            <div className="mt-5 flex justify-center">
              <button
                onClick={onClose}
                className="rounded-sm bg-[linear-gradient(135deg,#3157d5,#18a36b)] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
                type="button"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </ModalShell>,
      document.body
    );
  }

  return createPortal(
    <ModalShell onClose={onClose}>
      <AbrirCajaBody onClose={onClose} usuario={usuario} onCajaAbierta={handleBloqueoExitoso} onOpened={onOpened} />
    </ModalShell>,
    document.body
  );
}

/* ====================== Shell con overlay ====================== */
function ModalShell({ children, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="cashier-modal-light relative grid h-[84vh] max-h-[760px] w-[94vw] max-w-[860px] grid-rows-[auto,1fr] overflow-hidden rounded-md border border-[#c7d2fe] bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ====================== Utilidades ====================== */
const money = (n) =>
  (Number(n) || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatDateTime = (value) => {
  if (!value) return "No registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function InfoItem({ label, value }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white px-3 py-2 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-wide text-[#233876]">{label}</div>
      <div className="mt-0.5 truncate text-sm font-black text-[#111827]">{value || "Sin dato"}</div>
    </div>
  );
}

const toMysqlDateTime = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(":");
};

const DENOMS = [
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

/* ====================== Cuerpo del modal ====================== */
function AbrirCajaBody({ onClose, usuario, onCajaAbierta, onOpened }) {
  useSystemTheme();
  const now = new Date();
  const storedUser = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const usuarioActivo = usuario || storedUser || {};
  const usuarioId = usuarioActivo?.id || usuarioActivo?.id_usuario;
  const [cajero, setCajero] = React.useState(usuarioActivo?.nombre || usuarioActivo?.email || "");
  const [sede, setSede] = React.useState('1');
  const [caja, setCaja] = React.useState("Caja 1");
  
  // ====== CORRECCIÓN CRÍTICA: Manejo de base como STRING puro ======
  const [base, setBase] = React.useState(""); // Siempre string para el input
  
  const [obs, setObs] = React.useState("");
  const [denoms, setDenoms] = React.useState(DENOMS.map((d) => ({ ...d, qty: 0 })));
  const [loading, setLoading] = React.useState(false);
  const [sucursales, setSucursales] = React.useState([]);
  const [sucLoading, setSucLoading] = React.useState(true);
  const [sucError, setSucError] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [confirmMismatch, setConfirmMismatch] = React.useState(false);

  React.useEffect(() => {
    const fetchSucursales = async () => {
      try {
        setSucLoading(true);
        setSucError(null);
        const data = await listarSucursalesActivas();
        setSucursales(data);
        if (data.length > 0 && !data.some(s => s.id_sucursal.toString() === sede)) {
          setSede(data[0].id_sucursal.toString());
        }
      } catch (err) {
        console.error("Error fetching sucursales:", err);
        setSucError(err.message);
      } finally {
        setSucLoading(false);
      }
    };
    fetchSucursales();
  }, []);

  const registrarCajaAbierta = (infoCaja) => {
    localStorage.setItem(
      "caja_abierta",
      JSON.stringify({
        ...infoCaja,
        fecha_apertura: infoCaja.fecha_apertura,
        id_caja: infoCaja.id_caja,
        estado: "abierta"
      })
    );
  };

  // ====== CONVERSIÓN SEGURA A NÚMERO ======
  // Convertir base (string) a número entero SIN DECIMALES
  const baseNumber = parseInt(base || "0", 10);
  
  const totalDesglose = denoms.reduce((s, d) => s + (Number(d.qty) || 0) * d.value, 0);
  const mismatch = baseNumber > 0 && totalDesglose > 0 && totalDesglose !== baseNumber;

  const setQty = (idx, qty) => {
    const n = Math.max(0, parseInt(qty || "0", 10));
    setDenoms((prev) => prev.map((d, i) => (i === idx ? { ...d, qty: n } : d)));
  };

  const setFromDesglose = () => setBase(totalDesglose.toString());

  const abrirCajaConfirmada = async () => {
    const montoInicialFinal = parseInt(base || "0", 10);

    // ====== PAYLOAD LIMPIO ======
    const payload = {
      id_usuario: usuarioId,
      id_sucursal: Number(sede),
      numero_caja: caja.replace("Caja ", ""),
      fecha_apertura: toMysqlDateTime(),
      monto_inicial: montoInicialFinal,
      monto_final: montoInicialFinal,
      estado: "abierta",
      observaciones: obs,
      desglose: denoms.map(d => ({
        denominacion: d.value,
        cantidad: Number(d.qty) || 0
      }))
    };

    try {
      setLoading(true);

      const res = await abrirCaja(payload);
      await ensureOk(res, "No se pudo abrir la caja.");
      const data = await res.json();

      // ====== VERIFICACIÓN DE INTEGRIDAD ======
      if (data.monto_inicial !== montoInicialFinal) {
        console.error('Discrepancia en monto_inicial', {
          enviado: montoInicialFinal,
          recibido: data.monto_inicial,
          diferencia: Math.abs(data.monto_inicial - montoInicialFinal)
        });
      }

      const idCajaAbierta = data.id_caja || data.id;

      registrarCajaAbierta({
        id_caja: idCajaAbierta,
        id_usuario: usuarioId,
        fecha_apertura: data.fecha_apertura,
        monto_inicial: data.monto_inicial,
        monto_final: data.monto_final,
        caja: caja,
        usuario: cajero,
        estado: "abierta"
      });

      setNotice({
        type: "success",
        title: "Caja abierta correctamente",
        message: `La caja #${idCajaAbierta} quedó lista para facturar.`,
        details: [
          { label: "Monto inicial", value: money(data.monto_inicial) },
          { label: "Cajero", value: cajero },
        ],
        onAccept: () => {
          if (typeof onCajaAbierta === "function") {
            onCajaAbierta();
          }
          if (typeof onOpened === "function") {
            onOpened();
          }
          onClose();
        },
      });
    } catch (err) {
      console.error("Error en handleSubmit:", err);
      setNotice({
        type: "error",
        title: "No se pudo abrir la caja",
        message: err.message || "Ocurrió un error inesperado al abrir la caja.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!usuarioId) {
      setNotice({
        type: "error",
        title: "Usuario no autenticado",
        message: "Inicia sesión nuevamente antes de abrir una caja.",
      });
      return;
    }
    if (!cajero.trim()) {
      setNotice({
        type: "error",
        title: "Falta el cajero",
        message: "El nombre del cajero es requerido para abrir la caja.",
      });
      return;
    }

    // ====== VALIDACIÓN ESTRICTA ======
    const montoInicialFinal = parseInt(base || "0", 10);

    if (!montoInicialFinal || montoInicialFinal <= 0 || isNaN(montoInicialFinal)) {
      setNotice({
        type: "error",
        title: "Base inválida",
        message: "Ingresa un valor de base válido, mayor a cero y sin decimales.",
      });
      return;
    }

    if (mismatch) {
      setConfirmMismatch(true);
      return;
    }

    await abrirCajaConfirmada();
  };

  const sedeOptions = sucursales.map(s => ({
    value: s.id_sucursal.toString(),
    label: `${s.nombre}${s.ciudad ? ` (${s.ciudad})` : ''}`
  }));

  return (
    <>
      {/* HEADER */}
      <div className="flex min-h-[62px] items-center justify-between border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#ffffff,#eef2ff_60%,#e0e7ff)] px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-white shadow-sm">
            <Wallet size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-[#111827]">Abrir caja</h2>
            <p className="text-xs font-bold text-[#374151]">
              {now.toLocaleDateString("es-CO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              {now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#c7d2fe] bg-white text-[#233876] shadow-sm transition hover:bg-[#eef2ff]"
          title="Cerrar"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* BODY */}
      <div className="overflow-y-auto bg-[linear-gradient(180deg,#f8f9ff,#f4f6ff)] p-3 text-[#111827] sm:p-4">
        <section className="mb-3 grid gap-2 md:grid-cols-3">
          <SummaryCard
            icon={<CircleDollarSign size={19} />}
            label="Base ingresada"
            value={money(baseNumber)}
          />
          <SummaryCard
            icon={<Calculator size={19} />}
            label="Suma del desglose"
            value={money(totalDesglose)}
          />
          <SummaryCard
            icon={<ClipboardList size={19} />}
            label="Diferencia"
            value={money(Math.abs(baseNumber - totalDesglose))}
            tone={mismatch ? "warn" : "neutral"}
          />
        </section>

        {/* DATOS GENERALES */}
        <section className="mb-3 rounded-md border border-[#c7d2fe] bg-white p-3 shadow-sm">
          <SectionTitle icon={<User size={18} />} title="Datos del turno" subtitle="Confirma quién abre la caja y dónde operará." />
          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <Field label="Cajero" icon={<User size={15} />}>
              <Input
                className={`${usuarioActivo?.nombre ? "bg-[#f4f6ff]" : ""}`}
                placeholder="Nombre del cajero"
                value={cajero}
                onChange={(e) => setCajero(e.target.value)}
                disabled={!!usuarioActivo?.nombre}
                autoComplete="off"
              />
            </Field>
            <Field label="Sede" icon={<Building2 size={15} />}>
              <Select
                value={sede}
                onChange={e => setSede(e.target.value)}
                disabled={sucLoading}
              >
                {sucLoading ? (
                  <option value="">Cargando sedes...</option>
                ) : sucError ? (
                  <option value="">Error al cargar sedes (usando fallback)</option>
                ) : sedeOptions.length === 0 ? (
                  <option value="">No hay sucursales disponibles</option>
                ) : (
                  sedeOptions.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))
                )}
              </Select>
            </Field>
            <Field label="Número de caja" icon={<Wallet size={15} />}>
              <Select
                value={caja}
                onChange={e => setCaja(e.target.value)}
                options={["Caja 1", "Caja 2", "Caja 3"]}
              />
            </Field>
          </div>
        </section>

        {/* BASE Y DESGLOSE */}
        <section className="mb-3 rounded-md border border-[#c7d2fe] bg-white p-3 shadow-sm">
          <SectionTitle icon={<CircleDollarSign size={18} />} title="Base y desglose" subtitle="Ingresa el efectivo inicial o calcula la base desde las denominaciones." />
          <div className="mt-3 grid grid-cols-1 items-end gap-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Label>Plata base (efectivo inicial)</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={base}
                  onChange={e => {
                    // ====== SOLO PERMITIR NÚMEROS ENTEROS ======
                    const val = e.target.value.replace(/\D/g, "");
                    setBase(val);
                  }}
                  placeholder="0"
                  autoComplete="off"
                  className="text-lg font-black"
                />
                <span className="rounded-md border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2.5 text-right text-sm font-black text-[#111827] shadow-sm sm:min-w-[150px]">
                  {money(baseNumber)}
                </span>
              </div>
            </div>
            <div>
              <GradientBtn onClick={setFromDesglose} disabled={totalDesglose === 0}>
                Usar suma del desglose
              </GradientBtn>
            </div>
          </div>

          {/* DESGLOSE */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {denoms.map((d, idx) => (
              <div key={d.value} className="rounded-md border border-[#c7d2fe] bg-[linear-gradient(180deg,#ffffff,#f8f9ff)] p-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#111827]">{d.label}</span>
                  <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-black text-[#111827]">
                    COP
                  </span>
                </div>
                <div className="space-y-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={d.qty}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "");
                      setQty(idx, val);
                    }}
                    autoComplete="off"
                    className="text-center font-black"
                  />
                  <span className="block rounded-sm bg-white px-2 py-1 text-right text-xs font-black text-[#111827]">
                    {money((Number(d.qty) || 0) * d.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* TOTAL */}
          <div className="mt-3 text-right">
            <span className="inline-block rounded-md border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2 text-sm font-black text-[#111827] shadow-sm">
              Suma desglose: {money(totalDesglose)}
            </span>
          </div>
          {mismatch && (
            <div className="mt-2 text-right">
              <span className="text-xs font-black text-[#111827]">
                La suma del desglose no coincide con la base.
              </span>
            </div>
          )}
        </section>

        {/* OBSERVACIONES */}
        <section className="rounded-md border border-[#c7d2fe] bg-white p-3 shadow-sm">
          <SectionTitle icon={<ClipboardList size={18} />} title="Observaciones" subtitle="Notas opcionales para el inicio del turno." />
          <div className="mt-3">
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Anota algo relevante para el inicio del turno…" />
          </div>
        </section>

        {/* BOTONES */}
        <div className="sticky bottom-0 mt-3 flex items-center justify-end gap-2 border-t border-[#c7d2fe] bg-[#f8f9ff]/95 py-2.5">
          <SmallBtn variant="outline" onClick={onClose}>Cancelar</SmallBtn>
          <GradientBtn onClick={handleSubmit} disabled={loading || sucLoading}>
            {loading ? "Guardando..." : "Abrir caja"}
          </GradientBtn>
        </div>

        {confirmMismatch && (
          <CajaNotice
            type="warning"
            title="El desglose no coincide"
            message="La suma de billetes y monedas es diferente a la base ingresada. Puedes volver a revisar o continuar si el valor de base es correcto."
            details={[
              { label: "Base", value: money(baseNumber) },
              { label: "Desglose", value: money(totalDesglose) },
              { label: "Diferencia", value: money(Math.abs(baseNumber - totalDesglose)) },
            ]}
            primaryText="Continuar"
            secondaryText="Revisar"
            onPrimary={() => {
              setConfirmMismatch(false);
              abrirCajaConfirmada();
            }}
            onSecondary={() => setConfirmMismatch(false)}
          />
        )}

        {notice && (
          <CajaNotice
            type={notice.type}
            title={notice.title}
            message={notice.message}
            details={notice.details}
            primaryText="Aceptar"
            onPrimary={() => {
              const onAccept = notice.onAccept;
              setNotice(null);
              onAccept?.();
            }}
          />
        )}
      </div>
    </>
  );
}

/* ====================== COMPONENTES REUTILIZABLES ====================== */
function Input({ className = "", style = {}, ...props }) {
  return (
    <input
      {...props}
      className={
        [
          "appearance-none w-full rounded-md border border-[#c7d2fe]",
          "bg-white text-[#111827]",
          "px-3 py-2.5 text-sm font-bold focus:outline-none",
          "focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]",
          "transition shadow-sm",
          "placeholder:text-[#4b5563]",
          "!text-[#111827]",
          className,
        ].join(" ")
      }
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        ...style,
      }}
    />
  );
}

function Select({ options, className = "", style = {}, children, ...props }) {
  return (
    <select
      {...props}
      className={
        [
          "appearance-none w-full rounded-md border border-[#c7d2fe]",
          "bg-white text-[#111827]",
          "px-3 py-2.5 text-sm font-bold focus:outline-none",
          "focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]",
          "transition shadow-sm",
          "!text-[#111827]",
          className,
        ].join(" ")
      }
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        ...style,
      }}
    >
      {children || (options?.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      )))}
    </select>
  );
}

function Textarea({ className = "", style = {}, ...props }) {
  return (
    <textarea
      {...props}
      rows={3}
      className={
        [
          "appearance-none w-full rounded-md border border-[#c7d2fe]",
          "bg-white text-[#111827]",
          "px-3 py-2.5 text-sm font-bold focus:outline-none",
          "focus:border-[#3157d5] focus:ring-2 focus:ring-[#c7d2fe]",
          "transition shadow-sm",
          "placeholder:text-[#4b5563]",
          "!text-[#111827]",
          className,
        ].join(" ")
      }
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        ...style,
      }}
    />
  );
}

function Label({ children }) {
  return <div className="mb-1.5 text-xs font-black uppercase tracking-wide text-[#111827]">{children}</div>;
}

function Field({ label, icon, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#111827]">
        {icon && <span className="text-[#3157d5]">{icon}</span>}
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#eef2ff] text-[#3157d5]">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-black text-[#111827]">{title}</h3>
        <p className="text-xs font-bold text-[#374151]">{subtitle}</p>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone = "neutral" }) {
  const border = tone === "warn" ? "border-amber-300" : "border-[#c7d2fe]";
  const bg = tone === "warn" ? "bg-amber-50" : "bg-white";

  return (
    <div className={`rounded-md border ${border} ${bg} p-2.5 shadow-sm`}>
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[#111827]">
        <span className="text-[#3157d5]">{icon}</span>
        {label}
      </div>
      <div className="text-base font-black text-[#111827]">{value}</div>
    </div>
  );
}

function CajaNotice({
  type = "success",
  title,
  message,
  details = [],
  primaryText = "Aceptar",
  secondaryText,
  onPrimary,
  onSecondary,
}) {
  const map = {
    success: {
      icon: CheckCircle2,
      iconClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
      buttonClass: "bg-[linear-gradient(135deg,#3157d5,#18a36b)] text-white",
    },
    warning: {
      icon: AlertTriangle,
      iconClass: "bg-amber-100 text-amber-700 border-amber-200",
      buttonClass: "bg-[#111827] text-white",
    },
    error: {
      icon: AlertTriangle,
      iconClass: "bg-rose-100 text-rose-700 border-rose-200",
      buttonClass: "bg-[#b91c1c] text-white",
    },
  };
  const current = map[type] || map.success;
  const Icon = current.icon;

  return (
    <div className="absolute inset-0 z-[70] grid place-items-center bg-[#111827]/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${current.iconClass}`}>
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
            className={`rounded-sm px-4 py-2.5 text-sm font-black shadow-sm transition hover:brightness-105 ${current.buttonClass}`}
          >
            {primaryText}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmallBtn({ children, onClick, variant = "solid", disabled }) {
  const base = "px-3 py-2 rounded-sm text-sm font-bold transition";
  const style =
    variant === "outline"
      ? "border border-[#c7d2fe] text-[#111827] hover:bg-[#eef2ff]"
      : "bg-[linear-gradient(135deg,#3157d5,#4f46e5)] text-white hover:bg-[#233876]";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

function GradientBtn({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-sm text-sm font-bold text-white bg-[linear-gradient(135deg,#3157d5,#4f46e5)] hover:bg-[#233876] transition disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export default AbrirCaja;
