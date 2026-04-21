import React, { useState, useEffect } from "react";
import { CalendarRange, FileText, DollarSign, Search, ChevronLeft, ChevronRight, ArchiveX } from "lucide-react";

// Asumiendo backend en puerto 5000; ajusta si es diferente
const API_BASE_URL = 'http://localhost:5000';

export default function ConsultarVentas() {
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // DESC por fecha por default
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Filtros
  const [fechaInicial, setFechaInicial] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState(""); // ID usuario o ""

  // Función helper para fetch
  const fetchWithErrorHandling = async (endpoint, setter) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en ${url}: Status ${response.status}`, errorText.substring(0, 200));
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
    fetchWithErrorHandling('/api/ventas', setVentas);
    fetchWithErrorHandling('/api/perfil', setUsuarios); // Lista de usuarios para filtro
    setLoading(false);
  }, []);

  // Aplicar filtros y ordenamiento
  const filteredVentas = ventas.filter((v) => {
    const fechaV = new Date(v.fecha).toISOString().split('T')[0];
    const inicial = fechaInicial ? new Date(fechaInicial).toISOString().split('T')[0] : '1900-01-01';
    const final = fechaFinal ? new Date(fechaFinal).toISOString().split('T')[0] : '2100-01-01';
    const matchesDate = fechaV >= inicial && fechaV <= final;
    const matchesUser = !filtroUsuario || v.id_usuario == filtroUsuario;
    const matchesSearch = (v.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.nombre_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.id_venta.toString().includes(searchTerm));
    return matchesDate && matchesUser && matchesSearch;
  });

  const sortedVentas = [...filteredVentas].sort((a, b) => {
    const dateA = new Date(a.fecha).getTime();
    const dateB = new Date(b.fecha).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const totalPages = Math.ceil(sortedVentas.length / itemsPerPage);
  const paginatedVentas = sortedVentas.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Total general de ventas filtradas
  const totalGeneral = filteredVentas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-6 sm:px-12 py-10 rounded-xl flex items-center justify-center">
        <p className="text-slate-600">Cargando ventas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 px-6 sm:px-12 py-10 rounded-xl">
      {/* Error global */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">Error al cargar datos: {error}</p>
          <button onClick={() => window.location.reload()} className="text-rose-600 hover:underline text-sm mt-1">
            Recargar
          </button>
        </div>
      )}

      {/* ===== Encabezado ===== */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gradient-to-r from-orange-500 to-fuchsia-500 p-2.5 rounded-lg shadow-md text-white">
          <FileText size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Consultar Ventas
        </h1>
      </div>

      {/* ===== Filtros ===== */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <CalendarRange size={18} className="text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-700">
            Filtros de búsqueda
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
            />
          </div>

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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Usuario
            </label>
            <select 
              value={filtroUsuario}
              onChange={(e) => {
                setFiltroUsuario(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map((u) => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Búsqueda
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Cliente o ID..."
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Total General ===== */}
      <div className="bg-gradient-to-r from-orange-500 to-fuchsia-500 text-white p-4 rounded-xl mb-8 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Total General de Ventas</h3>
          <div className="text-2xl font-bold h-2">{totalGeneral.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div>
        </div>
        <p className="text-orange-100 text-sm mt-1">Actualizado con filtros aplicados ({filteredVentas.length} ventas)</p>
      </div>

      {/* ===== Listado de facturas ===== */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow-md p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-slate-700">
            Listado de Facturas ({sortedVentas.length})
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="text-slate-600">Ordenar por fecha:</label>
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

        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-gradient-to-r from-orange-400/80 to-fuchsia-400/80 text-white">
              <tr>
                {["Factura", "Cliente", "Usuario", "Caja", "Fecha", "Total", "Método Pago"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedVentas.length > 0 ? (
                paginatedVentas.map((v) => (
                  <tr key={v.id_venta} className="border-b border-orange-100 hover:bg-orange-50 transition">
                    <td className="px-4 py-2 font-mono">{v.id_venta.toString().padStart(3, '0')}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{v.nombre_cliente || 'Cliente Genérico'}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{v.nombre_usuario || 'N/A'}</td>
                    <td className="px-4 py-2 text-center">{v.numero_caja || 'N/A'}</td>
                    <td className="px-4 py-2">{new Date(v.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="px-4 py-2 font-semibold text-right">${parseFloat(v.total || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-center capitalize">{v.metodo_pago || 'efectivo'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <ArchiveX size={32} className="text-slate-300" />
                      <p>No hay ventas que coincidan con los filtros...</p>
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
              Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, sortedVentas.length)} de {sortedVentas.length} ventas
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
  );
}