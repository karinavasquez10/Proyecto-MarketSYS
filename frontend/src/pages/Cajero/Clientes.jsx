import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { crearCliente, listarClientes } from "../../services/clientesService";
import { ensureOk } from "../../services/responseUtils";

const tabs = [
  { id: "directorio", label: "Directorio", icon: Users },
  { id: "nuevo", label: "Nuevo cliente", icon: UserPlus },
  { id: "ficha", label: "Ficha rápida", icon: Eye },
];

const emptyForm = {
  doc: "",
  nombres: "",
  telefono: "",
  email: "",
  direccion: "",
  tipo: "",
};

function Clientes({ open, onClose, initialTab = "directorio" }) {
  if (!open) return null;

  return createPortal(
    <ModalShell onClose={onClose}>
      <ClientesBody onClose={onClose} initialTab={initialTab} />
    </ModalShell>,
    document.body
  );
}

function ModalShell({ children, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose?.();
    const prev = document.body.style.overflow;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#c7d2fe] bg-[#f4f6ff] text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function normalizeCliente(cliente) {
  return {
    id: cliente.id_cliente ?? cliente.id ?? cliente._id ?? cliente.identificacion ?? Math.random(),
    doc: cliente.identificacion ?? cliente.doc ?? "",
    nombres: cliente.nombre ?? cliente.nombres ?? "",
    telefono: cliente.telefono ?? "",
    email: cliente.correo ?? cliente.email ?? "",
    direccion: cliente.direccion ?? "",
    tipo: cliente.tipo ?? "General",
    raw: cliente,
  };
}

function ClientesBody({ onClose, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || "directorio");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    setActiveTab(initialTab || "directorio");
  }, [initialTab]);

  const fetchClientes = async () => {
    setRefreshing(true);
    setError("");
    try {
      const data = await listarClientes();
      const normalized = Array.isArray(data) ? data.map(normalizeCliente) : [];
      setRows(normalized);
      setSelected((current) => current || normalized[0] || null);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) =>
      `${row.doc} ${row.nombres} ${row.telefono} ${row.email} ${row.direccion} ${row.tipo}`.toLowerCase().includes(text)
    );
  }, [q, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  const resumen = useMemo(() => {
    const conTelefono = rows.filter((row) => row.telefono).length;
    const conCorreo = rows.filter((row) => row.email).length;
    return { clientes: rows.length, conTelefono, conCorreo };
  }, [rows]);

  const handleCreate = async (event) => {
    event?.preventDefault();
    if (!form.doc.trim() || !form.nombres.trim()) {
      setError("Documento y nombre completo son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await crearCliente({
        nombre: form.nombres.trim(),
        identificacion: form.doc.trim(),
        telefono: form.telefono.trim(),
        correo: form.email.trim(),
        direccion: form.direccion.trim(),
        tipo: form.tipo.trim(),
      });
      await ensureOk(res, "No se pudo crear el cliente");
      await fetchClientes();
      setForm(emptyForm);
      setActiveTab("directorio");
    } catch (err) {
      setError(err.message || "Error al crear el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const selectClient = (client) => {
    setSelected(client);
    setActiveTab("ficha");
  };

  if (loading) {
    return (
      <div className="grid min-h-[360px] place-items-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 animate-spin text-[#3157d5]" size={26} />
          <p className="text-sm font-black text-[#111827]">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-[#c7d2fe] bg-[linear-gradient(135deg,#dbe4ff,#ffffff_58%,#f8f9ff)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Módulo del cajero</p>
            <h2 className="text-xl font-black leading-tight text-[#111827]">Clientes</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchClientes}
              className="grid h-9 w-9 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#3157d5] shadow-sm transition hover:bg-[#e0e7ff]"
              title="Actualizar"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-sm bg-[#3157d5] text-white shadow-sm transition hover:brightness-105"
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-sm border px-3 py-2 text-xs font-black transition ${
                  active
                    ? "border-[#3157d5] bg-[#3157d5] text-white shadow-sm"
                    : "border-[#c7d2fe] bg-white text-[#111827] hover:bg-[#eef2ff]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard title="Clientes" value={resumen.clientes} helper="Registros activos" icon={Users} />
          <MetricCard title="Con teléfono" value={resumen.conTelefono} helper="Contacto directo" icon={Phone} />
          <MetricCard title="Con correo" value={resumen.conCorreo} helper="Contacto digital" icon={Mail} />
        </section>

        {activeTab === "directorio" && (
          <>
            <section className="mt-4 rounded-sm border border-[#dbe4ff] bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-[260px] flex-1">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#233876]">
                    Filtro por documento, nombre o telefono
                  </div>
                  <label className="flex items-center gap-2 rounded-sm border border-[#c7d2fe] bg-white px-3 py-2">
                    <Search size={16} className="text-[#3157d5]" />
                    <input
                      value={q}
                      onChange={(event) => setQ(event.target.value)}
                      placeholder="Buscar por documento, nombre, teléfono..."
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#111827] outline-none placeholder:text-[#6b7280]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("nuevo")}
                  className="flex items-center gap-2 rounded-sm bg-[#3157d5] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:brightness-105"
                >
                  <UserPlus size={15} />
                  Crear cliente
                </button>
              </div>
            </section>

            <section className="mt-4 overflow-hidden rounded-sm border border-[#dbe4ff] bg-white shadow-sm">
              <div className="grid grid-cols-[0.9fr_1.5fr_1fr_1.4fr_1.4fr_0.7fr] gap-3 border-b border-[#dbe4ff] bg-[#eef2ff] px-3 py-2 text-xs font-black uppercase text-[#233876] max-lg:hidden">
                <span>Documento</span>
                <span>Cliente</span>
                <span>Teléfono</span>
                <span>Correo</span>
                <span>Dirección</span>
                <span className="text-center">Acción</span>
              </div>

              {pageData.length ? (
                pageData.map((client) => (
                  <ClientRow key={client.id} client={client} onView={() => selectClient(client)} />
                ))
              ) : (
                <EmptyState text="No se encontraron clientes con esa búsqueda." />
              )}

              <Pagination page={page} setPage={setPage} totalPages={totalPages} total={filtered.length} />
            </section>
          </>
        )}

        {activeTab === "nuevo" && (
          <section className="mt-4 rounded-sm border border-[#dbe4ff] bg-white shadow-sm">
            <div className="border-b border-[#dbe4ff] bg-[#eef2ff] px-4 py-3">
              <p className="text-sm font-black uppercase tracking-wide text-[#233876]">Registro de cliente</p>
              <p className="mt-1 text-xs font-bold text-[#4b5563]">Documento y nombre son obligatorios. Los demás datos ayudan a futuras búsquedas y créditos.</p>
            </div>
            <form onSubmit={handleCreate} className="p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <InputField label="Número documento" value={form.doc} onChange={(value) => setForm({ ...form, doc: value })} required />
                <InputField label="Nombre completo" value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} required />
                <InputField label="Tipo de cliente" value={form.tipo} onChange={(value) => setForm({ ...form, tipo: value })} placeholder="General, frecuente, crédito..." />
                <InputField label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} />
                <InputField label="Correo electrónico" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                <InputField label="Dirección" value={form.direccion} onChange={(value) => setForm({ ...form, direccion: value })} />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#eef2ff] pt-4">
                <button
                  type="button"
                  onClick={() => setForm(emptyForm)}
                  className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2 text-sm font-black text-[#111827] transition hover:bg-[#eef2ff]"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-sm bg-[#3157d5] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar cliente"}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "ficha" && (
          <section className="mt-4">
            {selected ? (
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">{selected.doc || "Sin documento"}</p>
                      <h3 className="mt-1 text-xl font-black text-[#111827]">{selected.nombres || "Cliente sin nombre"}</h3>
                      <p className="mt-1 text-sm font-bold text-[#4b5563]">{selected.tipo || "General"}</p>
                    </div>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
                      <Users size={22} />
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoBox icon={Phone} label="Teléfono" value={selected.telefono || "-"} />
                  <InfoBox icon={Mail} label="Correo" value={selected.email || "-"} />
                  <InfoBox icon={MapPin} label="Dirección" value={selected.direccion || "-"} wide />
                </div>
              </div>
            ) : (
              <EmptyState text="Selecciona un cliente desde el directorio para ver su ficha." />
            )}
          </section>
        )}
      </main>
    </>
  );
}

function ClientRow({ client, onView }) {
  return (
    <div className="grid gap-2 border-b border-[#eef2ff] px-3 py-3 text-sm font-bold text-[#111827] last:border-b-0 lg:grid-cols-[0.9fr_1.5fr_1fr_1.4fr_1.4fr_0.7fr] lg:items-center">
      <span className="font-black text-[#3157d5]">{client.doc || "-"}</span>
      <span className="font-black">{client.nombres || "Sin nombre"}</span>
      <span>{client.telefono || "-"}</span>
      <span className="break-words">{client.email || "-"}</span>
      <span>{client.direccion || "-"}</span>
      <div className="flex lg:justify-center">
        <button
          type="button"
          onClick={onView}
          className="grid h-8 w-8 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#3157d5] transition hover:border-[#3157d5] hover:bg-[#eef2ff]"
          title="Ver ficha"
        >
          <Eye size={15} />
        </button>
      </div>
    </div>
  );
}

function MetricCard({ title, value, helper, icon: Icon }) {
  return (
    <div className="rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">{title}</p>
          <p className="mt-1 break-words text-xl font-black text-[#111827]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#4b5563]">{helper}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
          <Icon size={19} strokeWidth={2.7} />
        </span>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = "", required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#233876]">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm border border-[#c7d2fe] bg-white px-3 py-2.5 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#6b7280] focus:border-[#3157d5]"
      />
    </label>
  );
}

function InfoBox({ icon: Icon, label, value, wide = false }) {
  return (
    <div className={`rounded-sm border border-[#dbe4ff] bg-white p-4 shadow-sm ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-[#e0e7ff] text-[#3157d5]">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-[#3157d5]">{label}</p>
          <p className="mt-1 break-words text-sm font-black text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, setPage, totalPages, total }) {
  if (totalPages <= 1) {
    return <div className="border-t border-[#eef2ff] px-3 py-3 text-xs font-black text-[#4b5563]">{total} registros</div>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef2ff] px-3 py-3">
      <p className="text-xs font-black text-[#4b5563]">{total} registros · Página {page} de {totalPages}</p>
      <div className="flex gap-2">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-sm border border-[#c7d2fe] bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="m-3 rounded-sm border border-dashed border-[#c7d2fe] bg-[#f8f9ff] p-6 text-center">
      <p className="text-sm font-black text-[#111827]">{text}</p>
    </div>
  );
}

export default Clientes;
