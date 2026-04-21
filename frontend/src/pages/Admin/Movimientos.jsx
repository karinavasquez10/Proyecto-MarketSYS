import React, { useState, useEffect } from "react";
import { ArrowUpCircle, ArrowDownCircle, Wallet, FileSpreadsheet, Filter, ChevronLeft, ChevronRight, Download } from "lucide-react";
import * as XLSX from 'xlsx';

// Asumiendo backend en puerto 5000; ajusta si es diferente
const API_BASE_URL = 'http://localhost:5000';

// Spinner de carga mejorado
function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col justify-center items-center py-12">
      <svg className="animate-spin h-12 w-12 text-indigo-500 mb-4" viewBox="0 0 45 45">
        <circle className="opacity-20" cx="22.5" cy="22.5" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
        <path d="M42.5,22.5a20,20 0 1,1-40,0" stroke="currentColor" strokeWidth="5" fill="none" className="opacity-70" />
      </svg>
      <span className="text-indigo-600 text-base font-medium tracking-wide">{label}</span>
    </div>
  );
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 15;

  // Función helper para fetch
  const fetchWithErrorHandling = async (endpoint) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: Verifica el backend.`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`Error al cargar desde ${url}:`, err);
      setError(err.message);
      return [];
    }
  };

  // Cargar datos iniciales (ventas + compras)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const ventas = await fetchWithErrorHandling('/api/ventas');
      const compras = await fetchWithErrorHandling('/api/compras');
      
      // Unificar movimientos
      const movimientosUnificados = [
        // Ingresos (ventas)
        ...ventas.map(v => ({
          id: v.id_venta,
          fecha: v.fecha,
          tipo: "Ingreso",
          descripcion: `Venta #${v.id_venta}${v.nombre_cliente ? ` - ${v.nombre_cliente}` : ''}`,
          monto: parseFloat(v.total),
          metodo: v.metodo_pago || "Efectivo",
          usuario: v.nombre_usuario || "N/A",
          esVenta: true
        })),
        // Egresos (compras) - Nota: Ajusta joins si compras.js no incluye proveedor/usuario; asume que sí
        ...compras.map(c => ({
          id: c.id_compra,
          fecha: c.fecha,
          tipo: "Egreso",
          descripcion: `Compra #${c.id_compra}${c.proveedor ? ` - ${c.proveedor}` : ''}`,
          monto: parseFloat(c.total),
          metodo: "Transferencia", // Asumir; ajusta si hay campo en compras
          usuario: c.usuario || "N/A",
          esVenta: false
        }))
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Ordenar por fecha DESC

      setMovimientos(movimientosUnificados);
      setLoading(false);
    };
    loadData();
  }, []);

  // Aplicar filtros
  const filteredMovimientos = movimientos.filter((m) => {
    const matchesTipo = tipoFiltro === "todos" || m.tipo.toLowerCase() === tipoFiltro;
    const matchesFechaInicio = !fechaInicio || new Date(m.fecha) >= new Date(fechaInicio);
    const matchesFechaFin = !fechaFin || new Date(m.fecha) <= new Date(fechaFin);
    const matchesBusqueda = !busqueda || 
                            m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                            m.usuario.toLowerCase().includes(busqueda.toLowerCase());
    return matchesTipo && matchesFechaInicio && matchesFechaFin && matchesBusqueda;
  });

  // Indicadores
  const ingresos = filteredMovimientos
    .filter((m) => m.tipo === "Ingreso")
    .reduce((sum, m) => sum + m.monto, 0);
  const egresos = filteredMovimientos
    .filter((m) => m.tipo === "Egreso")
    .reduce((sum, m) => sum + m.monto, 0);
  const saldo = ingresos - egresos;

  // Paginación
  const totalPages = Math.ceil(filteredMovimientos.length / itemsPerPage);
  const paginatedMovimientos = filteredMovimientos.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleAplicarFiltros = () => {
    setCurrentPage(0); // Reset paginación
  };

  const handleLimpiarFiltros = () => {
    setTipoFiltro("todos");
    setFechaInicio("");
    setFechaFin("");
    setBusqueda("");
    setCurrentPage(0);
  };

  const handleExportarExcel = () => {
    // Preparar datos para exportar
    const datosExportar = filteredMovimientos.map((m, index) => ({
      'N°': index + 1,
      'Fecha': new Date(m.fecha).toLocaleDateString('es-ES'),
      'Hora': new Date(m.fecha).toLocaleTimeString('es-ES'),
      'Tipo': m.tipo,
      'Descripción': m.descripcion,
      'Monto': m.monto.toLocaleString('es-ES', { style: 'currency', currency: 'COP' })
    }));

    // Agregar resumen al final
    datosExportar.push({});
    datosExportar.push({
      'N°': '',
      'Fecha': '',
      'Hora': '',
      'Tipo': 'RESUMEN',
      'Descripción': 'Total Ingresos',
      'Monto': ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'COP' })
    });
    datosExportar.push({
      'N°': '',
      'Fecha': '',
      'Hora': '',
      'Tipo': '',
      'Descripción': 'Total Egresos',
      'Monto': egresos.toLocaleString('es-ES', { style: 'currency', currency: 'COP' })
    });
    datosExportar.push({
      'N°': '',
      'Fecha': '',
      'Hora': '',
      'Tipo': '',
      'Descripción': 'Saldo Neto',
      'Monto': saldo.toLocaleString('es-ES', { style: 'currency', currency: 'COP' })
    });

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(datosExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 5 },  // N°
      { wch: 12 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 10 }, // Tipo
      { wch: 40 }, // Descripción
      { wch: 15 }  // Monto
    ];

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Movimientos_${fecha}.xlsx`);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-14 w-full max-w-[calc(150%-16rem)] mt-1">
        <Spinner label="Cargando movimientos..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-14 w-full max-w-[calc(150%-16rem)] mt-1">
      {/* ===== TÍTULO ===== */}
      <div className="flex items-center gap-3 mb-2 -mt-2">
        <div className="bg-gradient-to-r from-sky-500 to-indigo-500 p-2.5 rounded-lg text-white shadow-md">
          <Wallet size={20} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          Movimientos Financieros y de Inventario
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-5 font-medium">
        MERKA FRUVER FLORENCIA
      </p>

      {/* Error */}
      {error && (
        <div className="bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">Error: {error}</p>
        </div>
      )}

      {/* ===== INDICADORES ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700 font-semibold">Total Ingresos</p>
            <p className="text-lg font-bold text-green-600">
              ${ingresos.toLocaleString('es-CO')}
            </p>
          </div>
          <ArrowUpCircle size={26} className="text-green-500" />
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-rose-700 font-semibold">Total Egresos</p>
            <p className="text-lg font-bold text-rose-600">
              ${egresos.toLocaleString('es-CO')}
            </p>
          </div>
          <ArrowDownCircle size={26} className="text-rose-500" />
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 font-semibold">General</p>
            <p
              className={`text-lg font-bold ${
                saldo >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              ${saldo.toLocaleString('es-CO')}
            </p>
          </div>
          <Wallet size={24} className="text-blue-500" />
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-700 font-semibold">Movimientos</p>
            <p className="text-lg font-bold text-amber-600">
              {filteredMovimientos.length}
            </p>
          </div>
          <FileSpreadsheet size={24} className="text-amber-500" />
        </div>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 text-slate-700 flex items-center gap-2">
          <Filter size={18} className="text-sky-500" />
          Filtros de búsqueda
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="border rounded px-3 py-2 text-sm shadow-sm"
          >
            <option value="todos">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>

          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="border rounded px-3 py-2 text-sm shadow-sm"
          />
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="border rounded px-3 py-2 text-sm shadow-sm"
          />
          <input
            type="text"
            placeholder="Buscar por descripción o usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border rounded px-3 py-2 text-sm shadow-sm"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={handleAplicarFiltros} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded text-sm shadow">
            Aplicar filtros
          </button>
          <button onClick={handleLimpiarFiltros} className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded text-sm shadow">
            Limpiar
          </button>
        </div>
      </div>

      {/* ===== TABLA DE MOVIMIENTOS ===== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center mb-3 px-4 py-2 border-b border-slate-200">
          <p className="text-sm text-slate-600">
            Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, filteredMovimientos.length)} de {filteredMovimientos.length} movimientos
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm border-collapse w-max">
            <thead className="bg-gradient-to-r from-orange-400/90 to-fuchsia-400/90 text-white sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left w-24">Fecha</th>
                <th className="px-2 py-2 text-left w-16">Tipo</th>
                <th className="px-2 py-2 text-left w-80">Descripción</th>
                <th className="px-2 py-2 text-right w-32">Monto</th>
                <th className="px-2 py-2 text-left w-24">Método</th>
                <th className="px-2 py-2 text-left w-32">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMovimientos.length > 0 ? (
                paginatedMovimientos.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-orange-50 transition border-b border-slate-100"
                  >
                    <td className="px-2 py-2 text-[11px]">
                      {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td
                      className={`px-2 py-2 font-semibold text-[11px] ${
                        m.tipo === "Ingreso" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {m.tipo === "Ingreso"} {m.tipo}
                    </td>
                    <td className="px-2 py-2 truncate text-[11px]" title={m.descripcion}>{m.descripcion}</td>
                    <td
                      className={`px-2 py-2 text-right font-semibold text-[11px] ${
                        m.tipo === "Ingreso" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      ${m.monto.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-2 text-[11px] truncate" title={m.metodo}>{m.metodo}</td>
                    <td className="px-2 py-2 truncate text-[11px]" title={m.usuario}>{m.usuario}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center text-slate-400 py-8 italic">
                    No se encontraron movimientos con los filtros aplicados...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-4 gap-2 px-4 py-3 border-t border-slate-200">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600">
              Página {currentPage + 1} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ===== ACCIONES ===== */}
      <div className="flex justify-end gap-3 mt-6">
        <button 
          onClick={handleExportarExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm shadow-md transition flex items-center gap-2"
        >
          <Download size={16} />
          Exportar a Excel
        </button>
      </div>
    </div>
  );
}