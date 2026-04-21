import React, { useState, useEffect } from "react";
import {
  CalendarRange,
  Search,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ArchiveX,
} from "lucide-react";

// Asumiendo backend en puerto 5000; ajusta si es diferente
const API_BASE_URL = "http://localhost:5000";

export default function CierresCaja() {
  const [cajas, setCajas] = useState([]);
  const [, setUsuarios] = useState([]); // Para filtro de cajero
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, ] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // DESC por fecha_cierre por default
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Filtros
  const [fechaInicial, setFechaInicial] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");
  const [filtroCajero, ] = useState(""); // ID usuario o ""

  // Función helper para fetch
  const fetchWithErrorHandling = async (endpoint, setter) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Error en ${url}: Status ${response.status}`,
          errorText.substring(0, 200)
        );
        throw new Error(`Error ${response.status}: Verifica el backend.`);
      }
      const data = await response.json();
      setter(data);
    } catch (err) {
      console.error(`Error al cargar desde ${url}:`, err);
      setError(err.message);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWithErrorHandling("/api/cajas", setCajas);
    fetchWithErrorHandling("/api/perfil", setUsuarios); // Lista de usuarios para filtro
    setLoading(false);
  }, []);

  // Filtrar solo cajas cerradas
  const cajasCerradas = cajas.filter((c) => c.estado === "cerrada");

  // Aplicar filtros y ordenamiento
  const filteredCajas = cajasCerradas.filter((c) => {
    const fechaCierre = new Date(c.fecha_cierre).toISOString().split("T")[0];
    const inicial = fechaInicial
      ? new Date(fechaInicial).toISOString().split("T")[0]
      : "1900-01-01";
    const final = fechaFinal
      ? new Date(fechaFinal).toISOString().split("T")[0]
      : "2100-01-01";
    const matchesDate = fechaCierre >= inicial && fechaCierre <= final;
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
  });

  const sortedCajas = [...filteredCajas].sort((a, b) => {
    const dateA = new Date(a.fecha_cierre).getTime();
    const dateB = new Date(b.fecha_cierre).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

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
  const totalDescuadre = filteredCajas.reduce(
    (sum, c) => sum + Math.abs(parseFloat(c.diferencia || 0)),
    0
  );
  // Total ingresos (suma de total_ventas)
  // const totalIngresos = filteredCajas.reduce(
   // (sum, c) => sum + parseFloat(c.total_ventas || 0),
    //0
  // );

  if (loading) {
    return (
      <div className="p-4 sm:p-1 w-full flex items-center justify-center min-h-[400px]">
        <p className="text-slate-600">Cargando cierres de caja...</p>
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col items-center justify-center min-h-screen bg-white"
      style={{ overflowX: "hidden" }}
    >
      <div className="w-full max-w-5xl flex flex-col items-center justify-center">
        {/* Error global */}
        {error && (
          <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4 w-full max-w-3xl text-center">
            <p className="text-sm">Error al cargar datos: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-rose-600 hover:underline text-sm mt-1"
            >
              Recargar
            </button>
          </div>
        )}

        {/* ===== Título ===== */}
        <div className="flex items-center gap-3 mb-6 mt-2 justify-center w-full">
          <div className="bg-gradient-to-r from-orange-500 to-fuchsia-500 p-2.5 rounded-lg shadow-md text-white flex items-center justify-center">
            <Calculator size={20} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight text-center">
            Consultas de Cierres de Caja
          </h1>
        </div>

        {/* ===== Parámetros de consulta ===== */}
        <div className="bg-white/95 rounded-xl shadow-md border border-orange-100 p-4 sm:p-6 mb-6 w-full max-w-3xl flex flex-col items-center transition hover:shadow-lg">
          <div className="flex items-center gap-2 mb-4 justify-center w-full">
            <CalendarRange size={18} className="text-orange-500" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-700">
              Parámetros de consulta
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            {/* Fecha Inicial */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Fecha Inicial
              </label>
              <input
                type="date"
                value={fechaInicial}
                onChange={(e) => {
                  setFechaInicial(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none transition"
              />
            </div>

            {/* Fecha Final */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Fecha Final
              </label>
              <input
                type="date"
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none transition"
              />
            </div>

            {/* Botón consultar */}
            <div className="flex items-end">
              <button
                onClick={() => setCurrentPage(0)} // Aplicar filtros
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm shadow-md transition"
              >
                <Search size={16} /> Consultar
              </button>
            </div>
          </div>

          {/* Total descuadre */}
          <div className="mt-6 text-slate-700 font-medium text-sm sm:text-base flex items-center gap-2 justify-center">
            <Calculator size={16} className="text-red-500" />
            <p>
              Total Descuadre:{" "}
              <span className="font-bold text-blue-600">
                ${totalDescuadre.toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        {/* ===== Lista de cierres ===== */}
        <div className="bg-white/95 rounded-xl shadow-md border border-orange-100 p-4 sm:p-6 transition hover:shadow-lg w-full max-w-5xl flex flex-col items-center">
          <div className="flex flex-col sm:flex-row w-full justify-between items-center mb-4 gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2 justify-center">
              Lista de Cierres{" "}
              <span className="text-slate-500 text-sm">
                ({sortedCajas.length})
              </span>
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <label className="text-slate-600">Ordenar por fecha cierre:</label>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(0);
                }}
                className="border border-slate-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-orange-200"
              >
                <option value="desc">Más reciente</option>
                <option value="asc">Más antiguo</option>
              </select>
            </div>
          </div>

          <div className="w-full overflow-x-auto -mx-6 px-6">
            <table className="min-w-full text-xs border border-slate-200 rounded-lg">
              <thead className="bg-gradient-to-r from-orange-400/80 to-fuchsia-400/80 text-white">
                <tr className="text-left">
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap w-[85px]">F. Apertura</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap w-[85px]">F. Cierre</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide text-center whitespace-nowrap w-[60px]">N°</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap w-[100px]">Cajero</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide text-right whitespace-nowrap w-[90px]">Ventas</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide text-right whitespace-nowrap w-[85px]">Base</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide text-right whitespace-nowrap w-[90px]">Teórico</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide text-right whitespace-nowrap w-[85px]">Descuadre</th>
                  <th className="px-2 py-2 border text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap w-[80px]">Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCajas.length > 0 ? (
                  paginatedCajas.map((c) => {
                    const fechaApertura = new Date(c.fecha_apertura);
                    const fechaCierre = new Date(c.fecha_cierre);
                    return (
                      <tr
                        key={c.id_caja}
                        className="border-b border-orange-100 hover:bg-orange-50 transition"
                      >
                        <td className="px-2 py-2 border text-[11px]">
                          {fechaApertura.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit' })}<br/>
                          <span className="text-slate-500">{fechaApertura.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                        </td>
                        <td className="px-2 py-2 border text-[11px]">
                          {fechaCierre.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit' })}<br/>
                          <span className="text-slate-500">{fechaCierre.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                        </td>
                        <td className="px-2 py-2 border font-mono text-center text-[11px]">
                          {c.id_caja.toString().padStart(3, "0")}
                        </td>
                        <td className="px-2 py-2 border text-[11px] truncate" title={c.nombre_usuario}>
                          {c.nombre_usuario || "N/A"}
                        </td>
                        <td className="px-2 py-2 border text-right text-[11px]">
                          ${parseFloat(c.total_ventas || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-2 py-2 border text-right text-[11px]">
                          ${parseFloat(c.monto_inicial || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-2 py-2 border text-right text-[11px]">
                          ${parseFloat(c.monto_final || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        </td>
                        <td
                          className={`px-2 py-2 border text-right font-semibold text-[11px] ${
                            parseFloat(c.diferencia || 0) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          ${parseFloat(c.diferencia || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-2 py-2 border text-[11px] truncate" title={c.nombre_sucursal}>
                          {c.nombre_sucursal || "N/A"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-400 text-sm">
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
            <div className="flex items-center justify-center mt-6 gap-4">
              <div className="text-sm text-slate-600">
                Mostrando {currentPage * itemsPerPage + 1} a{" "}
                {Math.min((currentPage + 1) * itemsPerPage, sortedCajas.length)}{" "}
                de {sortedCajas.length} cierres
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
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
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}