// src/pages/Admin/Auditoria.jsx
import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Search, 
  Calendar, 
  UserCircle, 
  RefreshCcw, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  Filter,
  Download,
  AlertCircle
} from "lucide-react";
import api from "../../api";

export default function Auditoria() {
  const [filtro, setFiltro] = useState({
    usuario: "",
    accion: "",
    tabla: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_records: 0,
    records_per_page: 10
  });
  
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('DESC');
  
  // Estados para los selectores dinámicos
  const [tablas, setTablas] = useState([]);
  const [acciones, setAcciones] = useState([]);
  // const [usuarios, setUsuarios] = useState([]); // Reservado para futura implementación
  
  // Estado para modal de detalles
  const [showDetalles, setShowDetalles] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    fetchTablas();
    fetchAcciones();
    fetchUsuarios();
  }, []);

  // Recargar cuando cambien los filtros de paginación - primera carga
  useEffect(() => {
    fetchAuditoria();
    // eslint-disable-next-line
  }, [pagination.current_page, recordsPerPage, sortBy, sortOrder]);

  const fetchAuditoria = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.current_page,
        limit: recordsPerPage,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...filtro
      });

      const response = await api.get(`/auditoria?${params}`);
      setRegistros(response.data.registros);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error al cargar auditoría:", error);
      alert("Error al cargar registros de auditoría");
    } finally {
      setLoading(false);
    }
  };

  const fetchTablas = async () => {
    try {
      const response = await api.get('/auditoria/tablas');
      setTablas(response.data);
    } catch (error) {
      console.error("Error al cargar tablas:", error);
    }
  };

  const fetchAcciones = async () => {
    try {
      const response = await api.get('/auditoria/acciones');
      setAcciones(response.data);
    } catch (error) {
      console.error("Error al cargar acciones:", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const response = await api.get('/auditoria/usuarios');
      // setUsuarios(response.data); // Reservado para futura implementación
      console.log('Usuarios disponibles:', response.data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    }
  };

  const handleFiltrar = () => {
    setPagination(prev => ({ ...prev, current_page: 1 }));
    fetchAuditoria();
  };

  const handleLimpiar = () => {
    setFiltro({
      usuario: "",
      accion: "",
      tabla: "",
      fecha_inicio: "",
      fecha_fin: "",
    });
    setPagination(prev => ({ ...prev, current_page: 1 }));
    setTimeout(() => fetchAuditoria(), 100);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, current_page: newPage }));
  };

  const handleRecordsPerPageChange = (value) => {
    setRecordsPerPage(parseInt(value));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('DESC');
    }
  };

  const handleVerDetalles = (registro) => {
    setSelectedRegistro(registro);
    setShowDetalles(true);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return d.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleExportar = () => {
    // Simulación de exportación CSV
    const csvContent = [
      ['Fecha', 'Usuario', 'Rol', 'Acción', 'Tabla', 'Registro ID', 'IP Origen', 'Dispositivo'],
      ...registros.map(r => [
        formatFecha(r.fecha),
        r.nombre_usuario || 'Sistema',
        r.rol_usuario || 'N/A',
        r.accion,
        r.tabla_nombre || 'N/A',
        r.registro_id || 'N/A',
        r.origen_ip || 'N/A',
        r.dispositivo || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 px-6 sm:px-8 py-10">
      {/* ===== Contenedor centrado con ancho máximo ===== */}
      <div className="max-w-7xl mx-auto">
        {/* ===== Encabezado ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-2.5 rounded-lg shadow-md text-white">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                Auditoría del Sistema
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Registro completo de actividades del sistema
              </p>
            </div>
          </div>
          
          <button
            onClick={handleExportar}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-md transition disabled:opacity-50"
            disabled={registros.length === 0}
          >
            <Download size={18} />
            Exportar CSV
          </button>
        </div>

      {/* ===== Filtros ===== */}
      <div className="bg-white/90 border border-amber-100 rounded-2xl shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter size={18} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-700">
            Filtros de búsqueda
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {/* Filtro Usuario */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={filtro.usuario}
              onChange={(e) => setFiltro({ ...filtro, usuario: e.target.value })}
              placeholder="Buscar por nombre..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </div>

          {/* Filtro Acción */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Acción
            </label>
            <select
              value={filtro.accion}
              onChange={(e) => setFiltro({ ...filtro, accion: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
            >
              <option value="">Todas las acciones</option>
              {acciones.map((accion, idx) => (
                <option key={idx} value={accion}>{accion}</option>
              ))}
            </select>
          </div>

          {/* Filtro Tabla */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Tabla
            </label>
            <select
              value={filtro.tabla}
              onChange={(e) => setFiltro({ ...filtro, tabla: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
            >
              <option value="">Todas las tablas</option>
              {tablas.map((tabla, idx) => (
                <option key={idx} value={tabla}>{tabla}</option>
              ))}
            </select>
          </div>

          {/* Fecha Inicio */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filtro.fecha_inicio}
              onChange={(e) => setFiltro({ ...filtro, fecha_inicio: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filtro.fecha_fin}
              onChange={(e) => setFiltro({ ...filtro, fecha_fin: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </div>

          {/* Registros por página */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Registros por página
            </label>
            <select
              value={recordsPerPage}
              onChange={(e) => handleRecordsPerPageChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleFiltrar}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            <Search size={16} /> Buscar
          </button>
          <button 
            onClick={handleLimpiar}
            disabled={loading}
            className="bg-slate-400 hover:bg-slate-500 text-white px-5 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCcw size={16} /> Limpiar
          </button>
        </div>
      </div>

      {/* ===== Tabla de registros ===== */}
      <div className="bg-white/90 border border-amber-100 rounded-2xl shadow-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <Calendar size={18} className="text-amber-500" />
            Registros de auditoría ({pagination.total_records})
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            <p className="ml-4 text-slate-600">Cargando registros...</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No se encontraron registros</p>
            <p className="text-sm text-slate-400 mt-1">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-lg">
                  <thead className="bg-gradient-to-r from-amber-400/80 to-orange-400/80 text-white">
                    <tr>
                      <th 
                        onClick={() => handleSort('fecha')}
                        className="px-3 py-3 text-left text-xs uppercase tracking-wide cursor-pointer hover:bg-amber-500 transition whitespace-nowrap"
                      >
                        Fecha {sortBy === 'fecha' && (sortOrder === 'ASC' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('nombre_usuario')}
                        className="px-3 py-3 text-left text-xs uppercase tracking-wide cursor-pointer hover:bg-amber-500 transition whitespace-nowrap"
                      >
                        Usuario {sortBy === 'nombre_usuario' && (sortOrder === 'ASC' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('accion')}
                        className="px-3 py-3 text-left text-xs uppercase tracking-wide cursor-pointer hover:bg-amber-500 transition whitespace-nowrap"
                      >
                        Acción {sortBy === 'accion' && (sortOrder === 'ASC' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('tabla_nombre')}
                        className="px-3 py-3 text-left text-xs uppercase tracking-wide cursor-pointer hover:bg-amber-500 transition whitespace-nowrap"
                      >
                        Tabla {sortBy === 'tabla_nombre' && (sortOrder === 'ASC' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-3 text-center text-xs uppercase tracking-wide whitespace-nowrap">
                        Ver
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registros.map((r) => (
                      <tr
                        key={r.id_auditoria}
                        className="hover:bg-amber-50 transition"
                      >
                        <td className="px-3 py-3 whitespace-nowrap text-xs">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">
                              {new Date(r.fecha).toLocaleDateString('es-CO')}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(r.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserCircle size={16} className="text-amber-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-800 text-xs truncate" title={r.nombre_usuario || 'Sistema'}>
                                {r.nombre_usuario || 'Sistema'}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate" title={r.correo_usuario}>
                                {r.correo_usuario || 'N/A'}
                              </div>
                              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                r.rol_usuario === 'admin' ? 'bg-purple-100 text-purple-700' :
                                r.rol_usuario === 'cajero' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {r.rol_usuario || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs text-slate-700 max-w-[200px] truncate" title={r.accion}>
                            {r.accion}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">
                            {r.tabla_nombre || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleVerDetalles(r)}
                            className="text-amber-600 hover:text-amber-800 p-1.5 rounded hover:bg-amber-50 transition inline-flex items-center justify-center"
                            title="Ver detalles completos"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Mostrando {((pagination.current_page - 1) * recordsPerPage) + 1} - {Math.min(pagination.current_page * recordsPerPage, pagination.total_records)} de {pagination.total_records} registros
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={18} />
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.total_pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.current_page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.current_page >= pagination.total_pages - 2) {
                      pageNum = pagination.total_pages - 4 + i;
                    } else {
                      pageNum = pagination.current_page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                          pagination.current_page === pageNum
                            ? 'bg-amber-500 text-white'
                            : 'border border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== Modal de Detalles ===== */}
      {showDetalles && selectedRegistro && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} />
                Detalles del Registro
              </h2>
              <button
                onClick={() => setShowDetalles(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                ×
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">ID Auditoría</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.id_auditoria}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Fecha y Hora</label>
                  <p className="text-sm text-slate-800 mt-1">{formatFecha(selectedRegistro.fecha)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Usuario</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.nombre_usuario || 'Sistema'}</p>
                  <p className="text-xs text-slate-500">{selectedRegistro.correo_usuario}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Rol</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.rol_usuario || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Acción</label>
                  <p className="text-sm text-slate-800 mt-1 font-medium">{selectedRegistro.accion}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Tabla Afectada</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.tabla_nombre || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">ID Registro</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.registro_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">IP Origen</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.origen_ip || 'N/A'}</p>
                </div>
              </div>

              {selectedRegistro.dispositivo && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Dispositivo</label>
                  <p className="text-sm text-slate-800 mt-1">{selectedRegistro.dispositivo}</p>
                </div>
              )}

              {selectedRegistro.detalles && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Detalles Adicionales</label>
                  <div className="mt-2 bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(JSON.parse(selectedRegistro.detalles), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDetalles(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-lg text-sm font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      </div> {/* Cierre del contenedor max-w-7xl */}
    </div>
  );
}
