import React from "react";
import { createPortal } from "react-dom";
import { UserPlus, Search, X, RefreshCcw, Upload, QrCode } from "lucide-react";

/* =============== 🔄 Hook para sincronizar el tema global =============== */
function useSystemTheme() {
  const [theme, setTheme] = React.useState(
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/* =============== Modal Público =============== */
function Clientes({ open, onClose }) {
  if (!open) return null;
  return createPortal(
    <ModalShell onClose={onClose}>
      <ClientesBody onClose={onClose} />
    </ModalShell>,
    document.body
  );
}

/* =============== Shell con overlay + ESC =============== */
function ModalShell({ children, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[95vw] max-w-[1200px] h-[88vh] rounded-2xl shadow-2xl overflow-hidden grid grid-rows-[auto,1fr]
        bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* =============== Cuerpo del Módulo Clientes =============== */
const API_URL = "http://localhost:5000/api";

function ClientesBody({ onClose }) {
  const theme = useSystemTheme();

  // Estado para la carga y errores
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Estado para listado de clientes
  const [rows, setRows] = React.useState([]);

  // Función para cargar clientes de la API
  const fetchClientes = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/clientes`);
      if (!res.ok) throw new Error("Error al cargar clientes");
      const data = await res.json();
      // Normalizar claves si fuese necesario
      setRows(
        Array.isArray(data)
          ? data.map((c) => ({
              id: c.id ?? c._id ?? c.doc ?? c.identificacion ?? Math.random(),
              doc: c.doc ?? c.identificacion ?? "",
              nombres: c.nombres ?? c.nombre ?? "",
              // apellidos: c.apellidos ?? "", // Eliminada columna Apellidos
              telefono: c.telefono ?? "",
              email: c.email ?? c.correo ?? "",
              direccion: c.direccion ?? "",
              tipo: c.tipo ?? "",
            }))
          : []
      );
    } catch (e) {
      setError(e.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar clientes al montar componente
  React.useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const [q, setQ] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  // Asegurarse de que las claves del formulario coincidan con las usadas en la tabla
  const [form, setForm] = React.useState({
    doc: "",
    nombres: "",
    telefono: "",
    email: "",
    direccion: "",
    tipo: ""
  });

  const [page, setPage] = React.useState(1);
  const perPage = 10;

  const filtered = rows.filter((r) =>
    Object.values(r).some((v) => String(v).toLowerCase().includes(q.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);
  const go = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  // CREAR cliente (ejemplo local, debería mandarse a la API normalmente)
  const handleCreate = async () => {
    if (!form.doc || !form.nombres) {
      alert("Documento y Nombres son obligatorios");
      return;
    }
    // Enviar al servidor
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          telefono: form.telefono,
          email: form.email,
          direccion: form.direccion,
          tipo: form.tipo,
        }),
      });
      if (!res.ok) {
        throw new Error("No se pudo crear el cliente");
      }
      // Opcional: podrías obtener el nuevo cliente de la API y agregar
      await fetchClientes();
      setForm({ doc: "", nombres: "", telefono: "", email: "", direccion: "", tipo: "" });
      setShowCreate(false);
      setPage(1);
    } catch (e) {
      setError(e.message || "Error al crear");
    } finally {
      setLoading(false);
    }
  };

  // Recargar clientes al pulsar el botón actualizar
  const handleRefresh = () => {
    fetchClientes();
  };

  return (
    <>
      {/* Header */}
      <div
        className={`h-14 px-5 flex items-center justify-between text-white transition-colors duration-300 shadow-sm ${
          theme === "dark"
            ? "bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-500"
            : "bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-500"
        }`}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Gestión de Clientes</h2>
          <span className="text-[11px] opacity-80 hidden sm:inline">InventNet</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-white/20 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div
        className={`overflow-y-auto p-5 transition-colors duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200"
            : "bg-gradient-to-br from-orange-50 via-white to-rose-50 text-slate-800"
        }`}
      >
        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
          <div className="flex flex-wrap gap-2">
            <SmallBtn variant="soft"><QrCode size={14} /> QR Auto Registro</SmallBtn>
            <SmallBtn variant="soft" onClick={handleRefresh}><RefreshCcw size={14} /> Actualizar</SmallBtn>
            <SmallBtn variant="soft"><Upload size={14} /> Creación Masiva</SmallBtn>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search
                className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500"
                size={16}
              />
              <input
                placeholder="Buscar cliente..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 w-60 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <SmallBtn onClick={() => setShowCreate((s) => !s)}>
              <UserPlus size={14} /> Crear Cliente
            </SmallBtn>
          </div>
        </div>

        {/* Errores / loading */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <span className="text-orange-500 font-semibold animate-pulse">Cargando...</span>
          </div>
        )}
        {error && (
          <div className="flex justify-center items-center py-4">
            <span className="text-red-500 font-semibold">{error}</span>
          </div>
        )}

        {/* Crear cliente */}
        {showCreate && (
          <div className="border border-orange-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm mb-5">
            <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-100">
              Nuevo Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ["Número documento", "doc"],
                ["Nombre completo", "nombres"],
                ["Dirección", "direccion"],
                ["Teléfono", "telefono"],
                ["Correo electrónico", "email"],
                ["Tipo de cliente", "tipo"],
              ].map(([label, key]) => (
                <Field key={key} label={label}>
                  <input
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </Field>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <SmallBtn variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </SmallBtn>
              <SmallBtn onClick={handleCreate}>Guardar</SmallBtn>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div
          className={`border rounded-xl overflow-x-auto shadow-sm transition ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700"
              : "bg-white border-orange-200"
          }`}
        >
          <table className="min-w-full text-sm">
            <thead
              className={`${
                theme === "dark"
                  ? "bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-500 text-white"
                  : "bg-orange-100 text-slate-800"
              }`}
            >
              <tr>
                <Th>#</Th>
                <Th>Identificación</Th>
                <Th>Nombres</Th>
                <Th>Teléfono</Th>
                <Th>Correo</Th>
                <Th>Dirección</Th>
                <Th className="text-center">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100 dark:divide-slate-800">
              {pageData.map((c, i) => (
                <tr
                  key={c.id || i}
                  className={`transition ${
                    theme === "dark"
                      ? "hover:bg-slate-800 text-slate-200"
                      : "hover:bg-orange-100 text-slate-800"
                  }`}
                >
                  <Td>{(page - 1) * perPage + i + 1}</Td>
                  <Td className="font-medium">{c.doc}</Td>
                  <Td>{c.nombres}</Td>
                  <Td>{c.telefono}</Td>
                  <Td>{c.email}</Td>
                  <Td>{c.direccion}</Td>
                  <Td className="text-center">
                    <div className="flex justify-center gap-2"> {/* Centrado botones */}
                      <SmallBtn variant="outline">✏️</SmallBtn>
                      <SmallBtn variant="soft">👁️</SmallBtn>
                    </div>
                  </Td>
                </tr>
              ))}
              {!pageData.length && !loading && (
                <tr>
                  <Td colSpan={7} className="text-center py-10 text-slate-500 dark:text-slate-400">
                    No se encontraron registros.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div>
            ({filtered.length}) resultados · Página {page} de {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <PagerBtn onClick={() => go(1)}>{"<<"}</PagerBtn>
            <PagerBtn onClick={() => go(page - 1)}>{"<"}</PagerBtn>
            {Array.from({ length: totalPages }).slice(0, 6).map((_, i) => {
              const n = i + 1;
              return (
                <PagerBtn key={n} active={n === page} onClick={() => go(n)}>
                  {n}
                </PagerBtn>
              );
            })}
            <PagerBtn onClick={() => go(page + 1)}>{">"}</PagerBtn>
            <PagerBtn onClick={() => go(totalPages)}>{">>"}</PagerBtn>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Contacto soporte · contacto@mysinventarios.com
        </div>
      </div>
    </>
  );
}

/* =============== Helpers UI =============== */
function Th({ children, className = "" }) {
  return <th className={`text-left px-3 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }) {
  return <td colSpan={colSpan} className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
function SmallBtn({ children, onClick, variant = "solid" }) {
  const base = "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition";
  const style =
    variant === "solid"
      ? "bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white hover:brightness-110"
      : variant === "soft"
      ? "bg-orange-50 dark:bg-slate-800 text-orange-700 dark:text-slate-200 hover:bg-orange-100 dark:hover:bg-slate-700 border border-orange-200 dark:border-slate-700"
      : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800";
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</div>
      {children}
    </div>
  );
}
function PagerBtn({ children, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-md border text-xs transition ${
        active
          ? "bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white"
          : "border-slate-300 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-slate-800"
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

export default Clientes;
