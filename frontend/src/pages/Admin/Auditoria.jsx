import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import {
  listarAccionesAuditoria,
  listarAuditoria,
  listarTablasAuditoria,
  listarUsuariosAuditoria,
  obtenerResumenAuditoria,
} from "../../services/auditoriaService";

const filtrosBase = {
  usuario: "",
  accion: "",
  tabla: "",
  fecha_inicio: "",
  fecha_fin: "",
};

const filtrosRapidos = [
  { label: "Hoy", key: "hoy" },
  { label: "Últimos 7 días", key: "7dias" },
  { label: "Eliminaciones", key: "eliminaciones" },
  { label: "Permisos", key: "permisos" },
  { label: "Caja", key: "caja" },
  { label: "Inventario", key: "inventario" },
];

const accionesCriticas = [
  "elimin",
  "delete",
  "permiso",
  "contraseña",
  "password",
  "anul",
  "restaur",
  "cierre",
  "apertura",
  "precio",
];

const toDateInput = (date) => date.toISOString().split("T")[0];

const safeParseDetails = (detalles) => {
  if (!detalles) return null;
  if (typeof detalles === "object") return detalles;
  try {
    return JSON.parse(detalles);
  } catch {
    return { detalle: detalles };
  }
};

const isCriticalAction = (accion = "") => {
  const normalized = accion.toLowerCase();
  return accionesCriticas.some((keyword) => normalized.includes(keyword));
};

export default function Auditoria() {
  const [filtro, setFiltro] = useState(filtrosBase);
  const [registros, setRegistros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tablas, setTablas] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRegistro, setSelectedRegistro] = useState(null);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("fecha");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_records: 0,
    records_per_page: 10,
  });

  useEffect(() => {
    fetchCatalogos();
    fetchResumen();
  }, []);

  useEffect(() => {
    fetchAuditoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current_page, recordsPerPage, sortBy, sortOrder]);

  const fetchCatalogos = async () => {
    try {
      const [tablasData, accionesData, usuariosData] = await Promise.all([
        listarTablasAuditoria(),
        listarAccionesAuditoria(),
        listarUsuariosAuditoria(),
      ]);
      setTablas(Array.isArray(tablasData) ? tablasData : []);
      setAcciones(Array.isArray(accionesData) ? accionesData : []);
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
    } catch (err) {
      console.error("Error al cargar catálogos de auditoría:", err);
    }
  };

  const fetchResumen = async () => {
    try {
      const data = await obtenerResumenAuditoria();
      setResumen(data);
    } catch (err) {
      console.error("Error al cargar resumen de auditoría:", err);
    }
  };

  const fetchAuditoria = async (overrideFiltro = filtro, overridePage = pagination.current_page) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: overridePage,
        limit: recordsPerPage,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...overrideFiltro,
      });

      const data = await listarAuditoria(params);
      setRegistros(Array.isArray(data.registros) ? data.registros : []);
      setPagination(data.pagination || pagination);
    } catch (err) {
      console.error("Error al cargar auditoría:", err);
      setError(err.message || "Error al cargar registros de auditoría");
    } finally {
      setLoading(false);
    }
  };

  const estadisticasLocales = useMemo(() => {
    const criticos = registros.filter((registro) => isCriticalAction(registro.accion)).length;
    const usuariosPagina = new Set(registros.map((registro) => registro.id_usuario).filter(Boolean)).size;

    return [
      {
        label: "Total auditado",
        value: resumen?.total_registros ?? pagination.total_records,
        icon: Database,
      },
      {
        label: "Resultado actual",
        value: pagination.total_records,
        icon: FileText,
      },
      {
        label: "Acciones críticas",
        value: criticos,
        icon: ShieldAlert,
      },
      {
        label: "Usuarios en página",
        value: usuariosPagina,
        icon: Users,
      },
    ];
  }, [pagination.total_records, registros, resumen]);

  const handleFiltrar = () => {
    setPagination((prev) => ({ ...prev, current_page: 1 }));
    fetchAuditoria(filtro, 1);
  };

  const handleLimpiar = () => {
    setFiltro(filtrosBase);
    setPagination((prev) => ({ ...prev, current_page: 1 }));
    setTimeout(() => fetchAuditoria(filtrosBase, 1), 0);
  };

  const handleFiltroRapido = (key) => {
    const today = new Date();
    const nextFiltro = { ...filtrosBase };

    if (key === "hoy") {
      nextFiltro.fecha_inicio = toDateInput(today);
      nextFiltro.fecha_fin = toDateInput(today);
    }

    if (key === "7dias") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      nextFiltro.fecha_inicio = toDateInput(start);
      nextFiltro.fecha_fin = toDateInput(today);
    }

    if (key === "eliminaciones") nextFiltro.accion = "Elimin";
    if (key === "permisos") nextFiltro.tabla = "permisos_usuarios";
    if (key === "caja") nextFiltro.tabla = "cajas";
    if (key === "inventario") nextFiltro.tabla = "movimientos_inventario";

    setFiltro(nextFiltro);
    setPagination((prev) => ({ ...prev, current_page: 1 }));
    setTimeout(() => fetchAuditoria(nextFiltro, 1), 0);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      return;
    }
    setSortBy(column);
    setSortOrder("DESC");
  };

  const handleExportar = async () => {
    try {
      const params = new URLSearchParams({
        page: 1,
        limit: Math.max(pagination.total_records || 1000, 1000),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...filtro,
      });
      const data = await listarAuditoria(params);
      const rows = Array.isArray(data.registros) ? data.registros : registros;
      const csvContent = [
        ["Fecha", "Usuario", "Rol", "Acción", "Tabla", "Registro ID", "IP Origen", "Dispositivo"],
        ...rows.map((r) => [
          formatFecha(r.fecha),
          r.nombre_usuario || "Sistema",
          r.rol_usuario || "N/A",
          r.accion,
          r.tabla_nombre || "N/A",
          r.registro_id || "N/A",
          r.origen_ip || "N/A",
          r.dispositivo || "N/A",
        ]),
      ]
        .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `auditoria_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (err) {
      console.error("Error al exportar auditoría:", err);
      setError(err.message || "No se pudo exportar la auditoría");
    }
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "N/A";
    return new Date(fecha).toLocaleString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const sortMark = (column) => (sortBy === column ? (sortOrder === "ASC" ? " ↑" : " ↓") : "");
  const detalles = safeParseDetails(selectedRegistro?.detalles);

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Auditoría del Sistema</h1>
            <p className="admin-module-subtitle">
              Consulta acciones realizadas, usuarios, tablas afectadas y eventos críticos.
            </p>
          </div>
        </div>
        <button
          onClick={handleExportar}
          disabled={pagination.total_records === 0}
          className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {estadisticasLocales.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-sm border border-[#c8d7ff] bg-white/95 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#152b73]">{label}</p>
              <Icon size={17} className="text-[#3157d5]" />
            </div>
            <p className="mt-1 text-2xl font-black text-[#111827]">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-5 rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#d9e3ff] bg-[#eef4ff] px-4 py-3">
          <Filter size={18} className="text-[#3157d5]" />
          <h2 className="text-base font-black text-[#111827]">Filtros de búsqueda</h2>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#d9e3ff] bg-[#f8fbf7] px-4 py-3">
          {filtrosRapidos.map((quick) => (
            <button
              key={quick.key}
              type="button"
              onClick={() => handleFiltroRapido(quick.key)}
              className="rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-xs font-black text-[#152b73] transition hover:bg-[#eef4ff]"
            >
              {quick.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Filtro por usuario</span>
            <select
              value={filtro.usuario}
              onChange={(e) => setFiltro({ ...filtro, usuario: e.target.value })}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id_usuario} value={usuario.nombre}>
                  {usuario.nombre} - {usuario.rol}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Filtro por acción</span>
            <select
              value={filtro.accion}
              onChange={(e) => setFiltro({ ...filtro, accion: e.target.value })}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              <option value="">Todas las acciones</option>
              {acciones.map((accion) => (
                <option key={accion} value={accion}>{accion}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Filtro por tabla</span>
            <select
              value={filtro.tabla}
              onChange={(e) => setFiltro({ ...filtro, tabla: e.target.value })}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              <option value="">Todas las tablas</option>
              {tablas.map((tabla) => (
                <option key={tabla} value={tabla}>{tabla}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Fecha inicio</span>
            <input
              type="date"
              value={filtro.fecha_inicio}
              onChange={(e) => setFiltro({ ...filtro, fecha_inicio: e.target.value })}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Fecha fin</span>
            <input
              type="date"
              value={filtro.fecha_fin}
              onChange={(e) => setFiltro({ ...filtro, fecha_fin: e.target.value })}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Registros por página</span>
            <select
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setPagination((prev) => ({ ...prev, current_page: 1 }));
              }}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            >
              <option value="10">10 registros</option>
              <option value="25">25 registros</option>
              <option value="50">50 registros</option>
              <option value="100">100 registros</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[#d9e3ff] bg-[#f8fbf7] px-4 py-4">
          <button
            onClick={handleLimpiar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-[#111827] transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} />
            Limpiar
          </button>
          <button
            onClick={handleFiltrar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            <Search size={16} />
            Buscar
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-white px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
            <Calendar size={18} className="text-[#3157d5]" />
            Registros de auditoría
          </h2>
          <span className="rounded-sm bg-[#e9f2e9] px-3 py-1 text-xs font-black text-[#152b73]">
            {pagination.total_records} registro(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-bold text-[#152b73]">Cargando registros...</div>
        ) : registros.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle size={40} className="mx-auto mb-3 text-[#3157d5]" />
            <p className="font-black text-[#111827]">No se encontraron registros</p>
            <p className="text-sm font-bold text-[#47524e]">Ajusta los filtros e intenta nuevamente.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead className="bg-[#eef4ff] text-[#152b73]">
                  <tr>
                    <th onClick={() => handleSort("fecha")} className="cursor-pointer px-4 py-3 text-left text-xs font-black uppercase">
                      Fecha{sortMark("fecha")}
                    </th>
                    <th onClick={() => handleSort("nombre_usuario")} className="cursor-pointer px-4 py-3 text-left text-xs font-black uppercase">
                      Usuario{sortMark("nombre_usuario")}
                    </th>
                    <th onClick={() => handleSort("accion")} className="cursor-pointer px-4 py-3 text-left text-xs font-black uppercase">
                      Acción{sortMark("accion")}
                    </th>
                    <th onClick={() => handleSort("tabla_nombre")} className="cursor-pointer px-4 py-3 text-left text-xs font-black uppercase">
                      Tabla{sortMark("tabla_nombre")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {registros.map((registro) => (
                    <tr key={registro.id_auditoria} className="transition hover:bg-[#f7fbf3]">
                      <td className="px-4 py-3">
                        <p className="font-black text-[#111827]">{new Date(registro.fecha).toLocaleDateString("es-CO")}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#47524e]">
                          <Clock3 size={13} className="text-[#3157d5]" />
                          {new Date(registro.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex min-w-0 items-center gap-1 truncate font-black text-[#111827]" title={registro.nombre_usuario || "Sistema"}>
                          <UserCircle size={15} className="shrink-0 text-[#3157d5]" />
                          {registro.nombre_usuario || "Sistema"}
                        </p>
                        <p className="mt-1 truncate text-xs font-bold text-[#47524e]" title={registro.correo_usuario}>
                          {registro.correo_usuario || "Sin correo"}
                        </p>
                        <span className="mt-1 inline-block rounded-sm bg-[#f5f8ff] px-2 py-0.5 text-[10px] font-black uppercase text-[#152b73]">
                          {registro.rol_usuario || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-bold text-[#111827]" title={registro.accion}>
                          {registro.accion}
                        </p>
                        {isCriticalAction(registro.accion) && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
                            <ShieldAlert size={12} />
                            Crítica
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-sm border border-[#b9caff] bg-[#f5f8ff] px-2 py-1 text-xs font-black text-[#152b73]">
                          {registro.tabla_nombre || "N/A"}
                        </span>
                        <p className="mt-1 text-xs font-bold text-[#47524e]">ID: {registro.registro_id || "N/A"}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedRegistro(registro)}
                          className="rounded-sm border border-[#b9caff] bg-white p-2 text-[#152b73] shadow-sm transition hover:bg-[#eef4ff] [&_svg]:stroke-[2.8]"
                          title="Ver detalles"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#d9e3ff] bg-[#f8fbf7] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-bold text-[#47524e]">
                Mostrando {((pagination.current_page - 1) * recordsPerPage) + 1} - {Math.min(pagination.current_page * recordsPerPage, pagination.total_records)} de {pagination.total_records}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, current_page: prev.current_page - 1 }))}
                  disabled={pagination.current_page === 1}
                  className="rounded-sm border border-[#b9caff] bg-white p-2 text-[#152b73] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="rounded-sm bg-white px-3 py-2 text-sm font-black text-[#111827] shadow-sm">
                  Página {pagination.current_page} de {pagination.total_pages || 1}
                </span>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, current_page: prev.current_page + 1 }))}
                  disabled={pagination.current_page >= pagination.total_pages}
                  className="rounded-sm border border-[#b9caff] bg-white p-2 text-[#152b73] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedRegistro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-sm bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-[#eef4ff] px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-[#111827]">
                  <FileText size={18} className="text-[#3157d5]" />
                  Detalle de auditoría
                </h2>
                <p className="text-xs font-bold text-[#47524e]">Registro #{selectedRegistro.id_auditoria}</p>
              </div>
              <button
                onClick={() => setSelectedRegistro(null)}
                className="rounded-sm border border-[#b9caff] bg-white p-2 text-[#152b73] transition hover:bg-[#f5f8ff]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
              {[
                ["Fecha y hora", formatFecha(selectedRegistro.fecha)],
                ["Usuario", selectedRegistro.nombre_usuario || "Sistema"],
                ["Correo", selectedRegistro.correo_usuario || "N/A"],
                ["Rol", selectedRegistro.rol_usuario || "N/A"],
                ["Acción", selectedRegistro.accion],
                ["Tabla afectada", selectedRegistro.tabla_nombre || "N/A"],
                ["ID registro", selectedRegistro.registro_id || "N/A"],
                ["IP origen", selectedRegistro.origen_ip || "N/A"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-sm border border-[#d9e3ff] bg-[#fbfcff] p-3">
                  <p className="text-xs font-black uppercase text-[#152b73]">{label}</p>
                  <p className="mt-1 break-words text-sm font-bold text-[#111827]">{value}</p>
                </div>
              ))}

              {selectedRegistro.dispositivo && (
                <div className="rounded-sm border border-[#d9e3ff] bg-[#fbfcff] p-3 md:col-span-2">
                  <p className="text-xs font-black uppercase text-[#152b73]">Dispositivo</p>
                  <p className="mt-1 break-words text-sm font-bold text-[#111827]">{selectedRegistro.dispositivo}</p>
                </div>
              )}

              <div className="rounded-sm border border-[#d9e3ff] bg-[#fbfcff] p-3 md:col-span-2">
                <p className="text-xs font-black uppercase text-[#152b73]">Detalles adicionales</p>
                {detalles ? (
                  <pre className="mt-2 max-h-72 overflow-auto rounded-sm bg-[#111827] p-4 text-xs font-bold text-white">
                    {JSON.stringify(detalles, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-1 text-sm font-bold text-[#47524e]">Sin detalles adicionales.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-[#d9e3ff] bg-[#f8fbf7] px-5 py-4">
              <button
                onClick={() => setSelectedRegistro(null)}
                className="rounded-sm border border-slate-200 bg-white px-5 py-2 text-sm font-black text-[#111827] transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
