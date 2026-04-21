import React, { useState, useEffect } from "react";
import CrearCliente from "./CrearCliente";
import EditarCliente from "./EditarCliente";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function GestionClientes() {
  const [clientes, setClientes] = useState([]);
  const [showCrear, setShowCrear] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemsPerPage = 10;

  const tipoMap = {
    persona: "Persona",
    empresa: "Empresa",
    generico: "Generico"
  };

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("http://localhost:5000/api/clientes");
        if (!res.ok) {
          throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
        }
        const data = await res.json();
        setClientes(
          data.map((c) => ({
            id: c.id,
            documento: c.identificacion || "",
            tipo: tipoMap[c.tipo] || c.tipo,
            nombre: c.nombre || "",
            telefono: c.telefono || "",
            email: c.correo || "",
            direccion: c.direccion || "",
          }))
        );
      } catch (err) {
        console.error("Error al fetch clientes:", err);
        setError(err.message || "Error de conexión al servidor");
        setClientes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  const refetchClientes = async () => {
    try {
      setError(null);
      const res = await fetch("http://localhost:5000/api/clientes");
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
      }
      const data = await res.json();
      setClientes(
        data.map((c) => ({
          id: c.id,
          documento: c.identificacion || "",
          tipo: tipoMap[c.tipo] || c.tipo,
          nombre: c.nombre || "",
          telefono: c.telefono || "",
          email: c.correo || "",
          direccion: c.direccion || "",
        }))
      );
      setCurrentPage(1);
    } catch (err) {
      console.error("Error al refetch:", err);
      setError(err.message || "Error al recargar datos");
    }
  };

  const handleEditar = (cliente) => {
    setClienteEditando(cliente);
    setShowEditar(true);
  };

  const handleGuardarEdicion = async (clienteActualizado) => {
    try {
      const res = await fetch(`http://localhost:5000/api/clientes/${clienteActualizado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: clienteActualizado.nombre,
          identificacion: clienteActualizado.documento,
          direccion: clienteActualizado.direccion,
          telefono: clienteActualizado.telefono,
          correo: clienteActualizado.email,
          tipo: Object.keys(tipoMap).find(key => tipoMap[key] === clienteActualizado.tipo) || "persona",
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Error al actualizar cliente");
      }
      setShowEditar(false);
      await refetchClientes();
    } catch (err) {
      console.error("Error al guardar edición:", err);
      setError(err.message);
    }
  };

  const handleEliminar = async (id) => {
    if (window.confirm("¿Seguro deseas eliminar este cliente?")) {
      try {
        setError(null);
        const res = await fetch(`http://localhost:5000/api/clientes/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Error al eliminar cliente");
        }
        await refetchClientes();
      } catch (err) {
        console.error("Error al eliminar:", err);
        setError(err.message);
      }
    }
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      c.documento.includes(filtro)
  );

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
    <div className="w-full min-h-screen flex flex-col items-center px-2 md:px-0 py-8 bg-gradient-to-br from-orange-50 via-white to-pink-50">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 text-center sm:text-left">
            Gestión de Clientes
          </h1>
          <p className="text-sm text-slate-500 mt-2 sm:mt-0">
            Total de clientes: <span className="font-semibold text-orange-600">{clientes.length}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm text-center">
            {error}
            <button
              onClick={refetchClientes}
              className="ml-2 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6 justify-center sm:justify-between items-center">
          <button
            onClick={() => setShowCrear(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm shadow-md transition"
          >
            + Crear Cliente
          </button>
          <div className="flex items-center bg-white border border-orange-100 rounded-lg shadow-sm px-3 py-1.5 w-full sm:w-64">
            <Search size={16} className="text-orange-400 mr-2" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full text-sm outline-none bg-transparent text-slate-700"
            />
          </div>
        </div>

        <div className="bg-white/95 border border-orange-100 rounded-2xl shadow p-4 sm:p-6 flex flex-col items-center">
          <h2 className="text-lg font-semibold mb-4 text-slate-700 text-center">
            Lista de Clientes ({clientesFiltrados.length})
          </h2>

          {loading ? (
            <div className="text-center text-slate-400 py-8">Cargando clientes...</div>
          ) : (
            <>
              <div className="w-full flex justify-center">
                <table className="w-full max-w-[890px] text-sm border border-orange-100 rounded-lg overflow-hidden table-fixed">
                  <colgroup>
                    <col style={{ width: "88px" }} />
                    <col style={{ width: "70px" }} />
                    <col style={{ width: "128px" }} />
                    <col style={{ width: "92px" }} />
                    <col style={{ width: "150px" }} />
                    <col style={{ width: "140px" }} />
                    <col style={{ width: "98px" }} />
                  </colgroup>
                  <thead className="bg-gradient-to-r from-orange-400/90 to-fuchsia-400/90 text-white">
                    <tr>
                      <th className="px-2 py-2 text-left">Doc.</th>
                      <th className="px-2 py-2 text-left">Tipo</th>
                      <th className="px-2 py-2 text-left">Nombre</th>
                      <th className="px-2 py-2 text-left">Tel.</th>
                      <th className="px-2 py-2 text-left">Email</th>
                      <th className="px-2 py-2 text-left">Dirección</th>
                      <th className="px-2 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentClientes.length > 0 ? (
                      currentClientes.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-orange-100 even:bg-orange-50/20 hover:bg-orange-50/70 transition"
                        >
                          <td className="px-2 py-2 max-w-[82px] text-ellipsis overflow-hidden whitespace-nowrap">{c.documento}</td>
                          <td className="px-2 py-2 max-w-[60px] text-ellipsis overflow-hidden whitespace-nowrap">{c.tipo}</td>
                          <td className="px-2 py-2 max-w-[120px] text-ellipsis overflow-hidden whitespace-nowrap">{c.nombre}</td>
                          <td className="px-2 py-2 max-w-[80px] text-ellipsis overflow-hidden whitespace-nowrap">{c.telefono}</td>
                          <td className="px-2 py-2 max-w-[142px] text-ellipsis overflow-hidden whitespace-nowrap">{c.email}</td>
                          <td className="px-2 py-2 max-w-[120px] text-ellipsis overflow-hidden whitespace-nowrap">{c.direccion}</td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleEditar(c)}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs shadow transition"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleEliminar(c.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs shadow transition"
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-6 text-slate-400">
                          No se encontraron clientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center mt-6 gap-8">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 disabled:opacity-50 rounded text-sm disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>
                  <span className="text-sm text-slate-600 whitespace-nowrap">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 disabled:opacity-50 rounded text-sm disabled:cursor-not-allowed"
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCrear && <CrearCliente onClose={() => setShowCrear(false)} onGuardar={refetchClientes} />}
      {showEditar && (
        <EditarCliente
          cliente={clienteEditando}
          onClose={() => setShowEditar(false)}
          onGuardar={handleGuardarEdicion}
        />
      )}
    </div>
  );
}