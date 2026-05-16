import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  Boxes,
  CalendarDays,
  Database,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import usePapelera from "../../hooks/usePapelera";
import {
  eliminarDefinitivoPapelera,
  restaurarPapelera,
} from "../../services/papeleraService";
import { ensureOk } from "../../services/responseUtils";

const tipoLabels = {
  categorias: "Categorías",
  proveedores: "Proveedores",
  productos: "Productos",
  clientes: "Clientes",
  compras: "Compras",
  detalle_compras: "Detalle compras",
  usuarios: "Usuarios",
};

const tipoOrden = [
  "todos",
  "productos",
  "categorias",
  "clientes",
  "proveedores",
  "usuarios",
  "compras",
  "detalle_compras",
];

const getTipoLabel = (tipo) => tipoLabels[tipo] || tipo || "Registro";

export default function GestionPapelera() {
  const { items, loading, error, setError, refetchPapelera } = usePapelera();
  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [accionPendiente, setAccionPendiente] = useState(null);

  const tiposDisponibles = useMemo(() => {
    const tipos = new Set(items.map((item) => item.tipo));
    return tipoOrden.filter((tipo) => tipo === "todos" || tipos.has(tipo));
  }, [items]);

  const resumen = useMemo(() => {
    const registros = items.length;
    const tipos = new Set(items.map((item) => item.tipo)).size;
    const fechaReciente = items[0]?.fecha || "Sin registros";

    return [
      { label: "En papelera", value: registros, icon: Trash2 },
      { label: "Tipos afectados", value: tipos, icon: Boxes },
      { label: "Último eliminado", value: fechaReciente, icon: CalendarDays, small: true },
    ];
  }, [items]);

  const filtrados = useMemo(() => {
    const busquedaNormalizada = busqueda.trim().toLowerCase();
    return items.filter((item) => {
      const coincideTipo = tipoFiltro === "todos" || item.tipo === tipoFiltro;
      const coincideBusqueda = !busquedaNormalizada || [
        item.nombre,
        item.tipo,
        item.eliminadoPor,
        item.registroId,
      ].some((valor) => String(valor || "").toLowerCase().includes(busquedaNormalizada));

      return coincideTipo && coincideBusqueda;
    });
  }, [busqueda, items, tipoFiltro]);

  const ejecutarRestaurar = async (item) => {
    try {
      setError(null);
      const res = await restaurarPapelera(item.id);
      await ensureOk(res, "Error al restaurar");
      setAccionPendiente(null);
      await refetchPapelera();
    } catch (err) {
      console.error("Error al restaurar:", err);
      setError(err.message);
    }
  };

  const ejecutarEliminarDefinitivo = async (item) => {
    try {
      setError(null);
      const res = await eliminarDefinitivoPapelera(item.id);
      await ensureOk(res, "Error al eliminar definitivamente");
      setAccionPendiente(null);
      await refetchPapelera();
    } catch (err) {
      console.error("Error al eliminar definitivamente:", err);
      setError(err.message);
    }
  };

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <Trash2 size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Gestión de Papelera</h1>
            <p className="admin-module-subtitle">
              Restaura registros eliminados o confirma su eliminación permanente.
            </p>
          </div>
        </div>
        <button
          onClick={refetchPapelera}
          className="inline-flex items-center gap-2 rounded-sm border border-[#9eb8ff] bg-white px-4 py-2 text-sm font-black text-[#152b73] shadow-sm transition hover:bg-[#f0f5ff]"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {resumen.map(({ label, value, icon: Icon, small }) => (
          <div key={label} className="rounded-sm border border-[#c8d7ff] bg-white/95 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#152b73]">{label}</p>
              <Icon size={17} className="text-[#3157d5]" />
            </div>
            <p className={`${small ? "text-base" : "text-2xl"} mt-1 truncate font-black text-[#111827]`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-2 text-sm font-bold text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Restaurar recupera el registro en su módulo original. Eliminar definitivamente borra el registro de forma permanente.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-[#d9e3ff] bg-white px-4 py-3 lg:grid-cols-[1fr_220px] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Buscar eliminado</span>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3157d5]" />
              <input
                type="text"
                placeholder="Nombre, tipo, usuario o ID"
                className="h-11 w-full rounded-sm border border-[#b9caff] bg-white pl-10 pr-3 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Filtrar por tipo</span>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              {tiposDisponibles.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo === "todos" ? "Todos" : getTipoLabel(tipo)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-[#f8fbf7] px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
            <Database size={18} className="text-[#3157d5]" />
            Elementos eliminados
          </h2>
          <span className="rounded-sm bg-white px-3 py-1 text-xs font-black text-[#152b73] shadow-sm">
            {filtrados.length} resultado(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-bold text-[#152b73]">Cargando elementos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "36%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead className="bg-[#eef4ff] text-[#152b73]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Registro</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Eliminado por</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filtrados.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#f7fbf3]">
                    <td className="px-4 py-3">
                      <span className="rounded-sm border border-[#b9caff] bg-[#f5f8ff] px-2 py-1 text-xs font-black uppercase text-[#152b73]">
                        {getTipoLabel(item.tipo)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate font-black text-[#111827]" title={item.nombre}>
                        {item.nombre}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#47524e]">ID original: {item.registroId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex min-w-0 items-center gap-1 truncate font-bold text-[#111827]">
                        <UserRound size={14} className="shrink-0 text-[#3157d5]" />
                        {item.eliminadoPor}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#47524e]">{item.fecha || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setAccionPendiente({ tipo: "restaurar", item })}
                          className="rounded-sm border border-emerald-300 bg-white p-2 text-emerald-800 shadow-sm transition hover:bg-emerald-50 [&_svg]:stroke-[2.8]"
                          title="Restaurar registro"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => setAccionPendiente({ tipo: "eliminar", item })}
                          className="rounded-sm border border-rose-300 bg-white p-2 text-[#7f1d1d] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                          title="Eliminar definitivamente"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center text-sm font-bold text-[#47524e]">
                      <ArchiveRestore size={24} className="mx-auto mb-2 text-[#3157d5]" />
                      No hay elementos eliminados con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {accionPendiente && (
        <TrashActionDialog
          action={accionPendiente.tipo}
          item={accionPendiente.item}
          onCancel={() => setAccionPendiente(null)}
          onConfirm={() => {
            if (accionPendiente.tipo === "restaurar") {
              ejecutarRestaurar(accionPendiente.item);
            } else {
              ejecutarEliminarDefinitivo(accionPendiente.item);
            }
          }}
        />
      )}
    </div>
  );
}

function TrashActionDialog({ action, item, onCancel, onConfirm }) {
  const isDelete = action === "eliminar";
  const title = isDelete ? "Eliminar definitivamente" : "Restaurar registro";
  const message = isDelete
    ? "Esta acción borra el registro de la base de datos y no se puede deshacer."
    : "El registro volverá a estar disponible en su módulo original.";
  const iconClass = isDelete
    ? "border-rose-200 bg-rose-100 text-rose-700"
    : "border-emerald-200 bg-emerald-100 text-emerald-700";
  const buttonClass = isDelete
    ? "bg-[#b91c1c]"
    : "bg-[linear-gradient(135deg,#3157d5,#18a36b)]";

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[440px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${iconClass}`}>
            {isDelete ? <AlertTriangle size={22} /> : <RotateCcw size={22} />}
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Registro</span>
            <span className="max-w-[220px] truncate text-right font-black text-[#111827]">{item.nombre}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Tipo</span>
            <span className="font-black text-[#111827]">{getTipoLabel(item.tipo)}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-sm px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 ${buttonClass}`}
          >
            {isDelete ? "Eliminar" : "Restaurar"}
          </button>
        </div>
      </div>
    </div>
  );
}
