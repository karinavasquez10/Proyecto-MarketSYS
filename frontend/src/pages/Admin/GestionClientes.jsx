import React, { useMemo, useState, useEffect } from "react";
import CrearCliente from "./CrearCliente";
import EditarCliente from "./EditarCliente";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import useClientes, { tipoClienteLabels } from "../../hooks/useClientes";
import { actualizarCliente, eliminarCliente } from "../../services/clientesService";
import { ensureOk } from "../../services/responseUtils";

export default function GestionClientes() {
  const { clientes, loading, error, setError, refetchClientes } = useClientes();
  const [showCrear, setShowCrear] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [clienteEliminar, setClienteEliminar] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleEditar = (cliente) => {
    setClienteEditando(cliente);
    setShowEditar(true);
  };

  const handleGuardarEdicion = async (clienteActualizado) => {
    try {
      const res = await actualizarCliente(clienteActualizado.id, {
        nombre: clienteActualizado.nombre,
        identificacion: clienteActualizado.documento,
        direccion: clienteActualizado.direccion,
        telefono: clienteActualizado.telefono,
        correo: clienteActualizado.email,
        tipo: Object.keys(tipoClienteLabels).find(key => tipoClienteLabels[key] === clienteActualizado.tipo) || "persona",
      });
      await ensureOk(res, "Error al actualizar cliente");
      setShowEditar(false);
      setClienteEditando(null);
      await refetchClientes({ resetPage: () => setCurrentPage(1) });
    } catch (err) {
      console.error("Error al guardar edición:", err);
      setError(err.message);
    }
  };

  const confirmarEliminar = async () => {
    if (!clienteEliminar?.id) return;
    try {
      setError(null);
      const res = await eliminarCliente(clienteEliminar.id);
      await ensureOk(res, "Error al eliminar cliente");
      setClienteEliminar(null);
      await refetchClientes({ resetPage: () => setCurrentPage(1) });
    } catch (err) {
      console.error("Error al eliminar:", err);
      setError(err.message);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const filtroNormalizado = filtro.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(filtroNormalizado) ||
      c.documento.includes(filtro)
    );
  }, [clientes, filtro]);

  const resumen = useMemo(() => {
    const personas = clientes.filter((c) => String(c.tipo || "").toLowerCase().includes("persona")).length;
    const empresas = clientes.filter((c) => String(c.tipo || "").toLowerCase().includes("empresa")).length;
    const conCorreo = clientes.filter((c) => Boolean(c.email)).length;

    return [
      { label: "Clientes", value: clientes.length, icon: Users },
      { label: "Personas", value: personas, icon: UserRound },
      { label: "Empresas", value: empresas, icon: Building2 },
      { label: "Con correo", value: conCorreo, icon: Mail },
    ];
  }, [clientes]);

  const totalPages = Math.ceil(clientesFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClientes = clientesFiltrados.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filtro]);

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <Users size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Gestión de Clientes</h1>
            <p className="admin-module-subtitle">Administra datos de contacto, documentos y clientes registrados.</p>
          </div>
        </div>
        <button
          onClick={() => refetchClientes({ resetPage: () => setCurrentPage(1) })}
          className="inline-flex items-center gap-2 rounded-sm border border-[#9eb8ff] bg-white px-4 py-2 text-sm font-black text-[#152b73] shadow-sm transition hover:bg-[#f0f5ff]"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-sm text-rose-700 text-sm text-center">
            {error}
            <button
              onClick={() => refetchClientes({ resetPage: () => setCurrentPage(1) })}
              className="ml-2 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {resumen.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-sm border border-[#c8d7ff] bg-white/95 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#152b73]">{label}</p>
                <Icon size={17} className="text-[#3157d5]" />
              </div>
              <p className="mt-1 text-2xl font-black text-[#111827]">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-sm border border-[#c8d7ff] bg-[#f8fbf7] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <button
            onClick={() => setShowCrear(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-4 text-sm font-black text-white shadow-sm transition hover:brightness-110"
          >
            <Plus size={16} /> Crear Cliente
          </button>
          <label className="block w-full lg:max-w-xl">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Buscar cliente</span>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3157d5]" />
              <input
                type="text"
                placeholder="Nombre o documento"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="h-11 w-full rounded-sm border border-[#b9caff] bg-white pl-10 pr-3 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              />
            </div>
          </label>
        </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-white px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
            <Users size={18} className="text-[#3157d5]" />
            Lista de Clientes ({clientesFiltrados.length})
          </h2>
          <span className="rounded-sm bg-[#e9f2e9] px-3 py-1 text-xs font-black text-[#152b73]">
            Página {Math.min(currentPage, totalPages || 1)} de {totalPages || 1}
          </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-[#152b73]">Cargando clientes...</div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "16%" }} />
                  </colgroup>
                  <thead className="bg-[#eef4ff] text-[#152b73]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase">Documento</th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase">Teléfono</th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase">Contacto</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {currentClientes.length > 0 ? (
                      currentClientes.map((c) => (
                        <tr
                          key={c.id}
                          className="transition hover:bg-[#f7fbf3]"
                        >
                          <td className="px-4 py-3">
                            <p className="flex min-w-0 items-center gap-1 truncate font-black text-[#111827]">
                              <IdCard size={14} className="shrink-0 text-[#3157d5]" />
                              {c.documento || "Sin documento"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-sm border border-[#b9caff] bg-[#f5f8ff] px-2 py-1 text-xs font-black uppercase text-[#152b73]">
                              {c.tipo || "Cliente"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate font-black text-[#111827]">{c.nombre}</p>
                            <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]">
                              <MapPin size={13} className="shrink-0 text-[#3157d5]" />
                              {c.direccion || "Sin dirección"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="flex min-w-0 items-center gap-1 truncate font-bold text-[#111827]">
                              <Phone size={14} className="shrink-0 text-[#3157d5]" />
                              {c.telefono || "Sin teléfono"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="flex min-w-0 items-center gap-1 truncate font-bold text-[#111827]">
                              <Mail size={14} className="shrink-0 text-[#3157d5]" />
                              {c.email || "Sin correo"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleEditar(c)}
                                className="rounded-sm border border-amber-300 bg-white p-2 text-amber-800 shadow-sm transition hover:bg-amber-50 [&_svg]:stroke-[2.8]"
                                title="Editar cliente"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setClienteEliminar(c)}
                                className="rounded-sm border border-rose-300 bg-white p-2 text-[#7f1d1d] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                                title="Eliminar cliente"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 py-10 text-center text-sm font-bold text-[#47524e]">
                          No se encontraron clientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-[#d9e3ff] bg-[#f8fbf7] px-4 py-4">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-black text-[#152b73] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>
                  <span className="rounded-sm bg-white px-3 py-2 text-sm font-black text-[#111827] shadow-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-black text-[#152b73] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      {showCrear && (
        <CrearCliente
          onClose={() => setShowCrear(false)}
          onGuardar={() => refetchClientes({ resetPage: () => setCurrentPage(1) })}
        />
      )}
      {showEditar && (
        <EditarCliente
          cliente={clienteEditando}
          onClose={() => setShowEditar(false)}
          onGuardar={handleGuardarEdicion}
        />
      )}
      {clienteEliminar && (
        <ConfirmDialog
          title="Eliminar cliente"
          message="Esta acción quitará el cliente de la gestión activa."
          details={[
            { label: "Cliente", value: clienteEliminar.nombre || "Sin nombre" },
            { label: "Documento", value: clienteEliminar.documento || "Sin documento" },
          ]}
          onCancel={() => setClienteEliminar(null)}
          onConfirm={confirmarEliminar}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ title, message, details = [], onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[430px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-100 text-rose-700">
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
                <span className="max-w-[220px] truncate text-right font-black text-[#111827]">{item.value}</span>
              </div>
            ))}
          </div>
        )}

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
            className="rounded-sm bg-[#b91c1c] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
