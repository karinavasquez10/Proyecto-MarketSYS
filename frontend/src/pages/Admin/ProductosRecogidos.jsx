import React, { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarRange,
  ClipboardList,
  DollarSign,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { listarProductos } from "../../services/productosService";
import {
  crearMerma,
  eliminarMerma,
  listarMermas,
  listarMermasPorRango,
  transformarMerma,
} from "../../services/mermasService";
import { ensureOk } from "../../services/responseUtils";
import { formatStock, isUnlimitedStock } from "../../utils/stock";

export default function ProductosRecogidos() {
  const [fechaInicial, setFechaInicial] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // Estados para el modal de insertar merma
  const [showModal, setShowModal] = useState(false);
  const [productos, setProductos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cambiaEstado, setCambiaEstado] = useState(false);
  const [cambiaApariencia, setCambiaApariencia] = useState(false);
  const [cantidadCambio, setCantidadCambio] = useState("");
  const [nombreDestino, setNombreDestino] = useState("");
  const [insertando, setInsertando] = useState(false);
  const [productoDestinoSeleccionado, setProductoDestinoSeleccionado] = useState(null);
  const [mostrarSugerenciasDestino, setMostrarSugerenciasDestino] = useState(false);
  const [mermaEliminar, setMermaEliminar] = useState(null);

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  })();

  const id_usuario = storedUser?.id;

  const resumen = useMemo(() => {
    const totalCantidad = resultados.reduce((sum, item) => sum + parseFloat(item.cantidad || 0), 0);
    const totalPerdida = resultados.reduce((sum, item) => {
      return sum + (parseFloat(item.cantidad || 0) * parseFloat(item.precio_venta || 0));
    }, 0);
    const transformaciones = resultados.filter((item) =>
      String(item.motivo || "").toLowerCase().includes("transform")
    ).length;

    return [
      { label: "Registros", value: resultados.length, icon: ClipboardList },
      { label: "Cantidad afectada", value: totalCantidad.toFixed(2), icon: PackageSearch },
      { label: "Transformaciones", value: transformaciones, icon: ArrowRightLeft },
      { label: "Pérdida estimada", value: `$${totalPerdida.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`, icon: DollarSign },
    ];
  }, [resultados]);

  // Cargar productos al abrir el modal
  const cargarProductos = async () => {
    try {
      const data = await listarProductos();
      // Mostrar productos activos aunque el stock esté en cero para poder ubicar frutas/verduras
      // y decidir si se ajustan como ilimitados desde inventario/productos.
      const productosDisponibles = data.filter(p => Number(p.estado) === 1);
      setProductos(productosDisponibles);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const handleAbrirModal = () => {
    setShowModal(true);
    cargarProductos();
    // Reset form
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setCambiaEstado(false);
    setCambiaApariencia(false);
    setCantidadCambio("");
    setNombreDestino("");
  };

  const handleCerrarModal = () => {
    setShowModal(false);
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setCambiaEstado(false);
    setCambiaApariencia(false);
    setCantidadCambio("");
    setNombreDestino("");
    setProductoDestinoSeleccionado(null);
    setMostrarSugerenciasDestino(false);
  };

  const handleSeleccionarProductoDestino = (producto) => {
    setProductoDestinoSeleccionado(producto);
    setNombreDestino(producto.nombre);
    setMostrarSugerenciasDestino(false);
  };

  const handleSeleccionarProducto = (producto) => {
    setProductoSeleccionado(producto);
    setBusquedaProducto("");
  };

  const handleInsertarMerma = async () => {
    // Validaciones
    if (!productoSeleccionado) {
      setMensaje({ tipo: 'error', texto: 'Seleccione un producto.' });
      return;
    }

    if (!cambiaEstado && !cambiaApariencia) {
      setMensaje({ tipo: 'error', texto: 'Debe seleccionar al menos un tipo de cambio (Estado o Apariencia).' });
      return;
    }

    const cantidad = parseFloat(cantidadCambio);
    if (!cantidad || cantidad <= 0) {
      setMensaje({ tipo: 'error', texto: 'La cantidad debe ser mayor a 0.' });
      return;
    }

    if (!isUnlimitedStock(productoSeleccionado.stock_actual) && cantidad > parseFloat(productoSeleccionado.stock_actual)) {
      setMensaje({ tipo: 'error', texto: `Stock insuficiente. Disponible: ${productoSeleccionado.stock_actual}` });
      return;
    }

    if (cambiaApariencia && !nombreDestino.trim()) {
      setMensaje({ tipo: 'error', texto: 'Debe especificar el producto destino para la transformación.' });
      return;
    }

    setInsertando(true);
    setMensaje(null);

    try {
      // CASO 1: Cambio de estado (vencimiento) - Registrar merma
      if (cambiaEstado) {
        const responseMerma = await crearMerma({
          id_producto: productoSeleccionado.id_producto,
          cantidad: cantidad,
          motivo: 'Cambio de estado manual (vencimiento/deterioro)',
          id_usuario: id_usuario
        });
        await ensureOk(responseMerma, 'Error al registrar merma');
      }

      // CASO 2: Cambio de apariencia (transformación)
      if (cambiaApariencia) {
        const responseTransformacion = await transformarMerma({
          id_producto_origen: productoSeleccionado.id_producto,
          nombre_producto_destino: nombreDestino.trim(),
          cantidad: cantidad,
          crear_nuevo: true,
          id_usuario: id_usuario
        });
        await ensureOk(responseTransformacion, 'Error al realizar transformación');
      }

      setMensaje({
        tipo: 'success',
        texto: `Merma registrada exitosamente. ${cambiaEstado ? 'Stock reducido.' : ''} ${cambiaApariencia ? `Producto transformado a "${nombreDestino}".` : ''}`
      });

      handleCerrarModal();
      await handleConsultar({ preserveMessage: true }); // Recargar mermas

    } catch (error) {
      console.error('Error al insertar merma:', error);
      setMensaje({ tipo: 'error', texto: 'Error al registrar la merma.' });
    } finally {
      setInsertando(false);
    }
  };

  const handleConsultar = async ({ preserveMessage = false } = {}) => {
    setLoading(true);
    if (!preserveMessage) setMensaje(null);
    setPaginaActual(1); // Resetear a página 1 al consultar

    try {
      const data = fechaInicial && fechaFinal
        ? await listarMermasPorRango({ fechaInicial, fechaFinal })
        : await listarMermas();
      setResultados(data);

      if (!preserveMessage && data.length === 0) {
        setMensaje({
          tipo: 'info',
          texto: fechaInicial && fechaFinal
            ? 'No se encontraron mermas para el rango de fechas seleccionado.'
            : 'No hay mermas registradas en el sistema.'
        });
      }
    } catch (error) {
      console.error('Error al consultar mermas:', error);
      setMensaje({
        tipo: 'error',
        texto: 'Error al cargar las mermas. Intente nuevamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarMerma = async () => {
    if (!mermaEliminar?.id_merma) return;
    try {
      const response = await eliminarMerma(mermaEliminar.id_merma, { id_usuario });
      await ensureOk(response, 'Error al eliminar merma');

      setMermaEliminar(null);
      setMensaje({
        tipo: 'success',
        texto: 'Merma eliminada y stock restaurado correctamente.'
      });

      // Recargar resultados
      await handleConsultar({ preserveMessage: true });

    } catch (error) {
      console.error('Error al eliminar merma:', error);
      setMensaje({
        tipo: 'error',
        texto: 'Error al eliminar la merma.'
      });
    }
  };

  // Cargar mermas al montar el componente
  useEffect(() => {
    handleConsultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-module-page">
      {/* ===== Encabezado ===== */}
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <PackageSearch size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">
              Gestión de Mermas
            </h1>
            <p className="admin-module-subtitle">
              Controla pérdidas, productos dañados y transformaciones que afectan el inventario.
            </p>
          </div>
        </div>

        <button
          onClick={handleAbrirModal}
          className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-110"
        >
          <Plus size={16} />
          Registrar merma
        </button>
      </div>

      {/* ===== Mensaje de alerta ===== */}
      {mensaje && (
        <div className={`mb-4 p-4 rounded-sm border ${
          mensaje.tipo === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          mensaje.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{mensaje.texto}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {resumen.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-sm border border-[#c8d7ff] bg-white/95 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#152b73]">{label}</p>
              <Icon size={17} className="text-[#3157d5]" />
            </div>
            <p className="mt-1 truncate text-2xl font-black text-[#111827]">{value}</p>
          </div>
        ))}
      </div>

      {/* ===== Filtros ===== */}
      <div className="mt-5 rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#d9e3ff] bg-[#eef4ff] px-4 py-3">
          <CalendarRange size={18} className="text-[#3157d5]" />
          <h2 className="text-base font-black text-[#111827]">
          Parámetros de consulta
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Fecha inicial
            </label>
            <input
              type="date"
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value)}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Fecha final
            </label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              className="h-11 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
            />
          </div>

          <div className="flex sm:justify-end">
            <button
              onClick={handleConsultar}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-5 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Resultados ===== */}
      <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-white px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
            <ClipboardList size={18} className="text-[#3157d5]" />
            Historial de mermas
          </h2>
          <span className="rounded-sm bg-[#e9f2e9] px-3 py-1 text-xs font-black text-[#152b73]">
            {resultados.length} registro(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-[#eef4ff] text-[#152b73]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Responsable</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Cantidad / Pérdida</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Motivo</th>
                <th className="px-4 py-3 text-center text-xs font-black uppercase">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e2e8f0]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-sm font-bold text-[#152b73]">
                    <div className="flex items-center justify-center gap-2">
                      <span className="inline-flex items-center justify-center">
                        <RefreshCw size={16} className="animate-spin" />
                      </span>
                      <span>Cargando mermas...</span>
                    </div>
                  </td>
                </tr>
              ) : resultados.length > 0 ? (
                resultados
                  .slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina)
                  .map((item, i) => {
                  const cantidad = parseFloat(item.cantidad || 0);
                  const precioVenta = parseFloat(item.precio_venta || 0);
                  const perdidaTotal = cantidad * precioVenta;

                  return (
                    <tr
                      key={item.id_merma || i}
                      className="transition hover:bg-[#f7fbf3]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-black text-[#111827]">
                          {new Date(item.fecha).toLocaleDateString('es-CO')}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#47524e]">
                          {new Date(item.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-black text-[#111827]" title={item.nombre_producto}>
                          {item.nombre_producto}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#47524e]">
                          Código: {item.codigo || 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-bold text-[#111827]" title={item.nombre_usuario || 'Sistema'}>
                          {item.nombre_usuario || 'Sistema'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-black text-[#111827]">
                          {cantidad.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#47524e]">
                          Venta: ${precioVenta.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </p>
                        <p className="mt-1 font-black text-rose-700">
                          ${perdidaTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 font-bold text-[#111827]" title={item.motivo}>
                          {item.motivo || 'Sin especificar'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setMermaEliminar(item)}
                          className="rounded-sm border border-rose-300 bg-white p-2 text-[#7f1d1d] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                          title="Eliminar merma y restaurar stock"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-10 text-center text-sm font-bold text-[#47524e]"
                  >
                    No se encontraron mermas para las fechas seleccionadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {resultados.length > itemsPorPagina && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm font-bold text-[#47524e]">
              Mostrando {((paginaActual - 1) * itemsPorPagina) + 1} - {Math.min(paginaActual * itemsPorPagina, resultados.length)} de {resultados.length} mermas
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-black text-[#152b73] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(resultados.length / itemsPorPagina) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setPaginaActual(page)}
                    className={`rounded-sm px-3 py-2 text-sm font-black ${
                      paginaActual === page
                        ? 'bg-[#3157d5] text-white'
                        : 'border border-[#b9caff] bg-white text-[#152b73] hover:bg-[#eef4ff]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPaginaActual(prev => Math.min(prev + 1, Math.ceil(resultados.length / itemsPorPagina)))}
                disabled={paginaActual === Math.ceil(resultados.length / itemsPorPagina)}
                className="rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-black text-[#152b73] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="m-4 rounded-sm border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-700" />
                <span className="text-sm font-black text-rose-900">
                  Resumen de pérdidas estimadas
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs font-black uppercase text-rose-700">Total de mermas</div>
                <div className="text-xl font-black text-rose-900">
                  ${resultados.reduce((sum, item) => {
                    return sum + (parseFloat(item.cantidad || 0) * parseFloat(item.precio_venta || 0));
                  }, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal registrar movimiento ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={24} />
                <div>
                  <h2 className="text-xl font-bold">Registrar merma o transformación</h2>
                  <p className="text-sm text-emerald-50">Procesa pérdida de producto o traslado hacia otra presentación</p>
                </div>
              </div>
              <button
                onClick={handleCerrarModal}
                className="hover:bg-white/20 p-2 rounded-sm transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-6">
              {/* Sección 1: Selección de Producto */}
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Search size={16} className="text-emerald-500" />
                  1. Seleccionar Producto
                </h3>

                {!productoSeleccionado ? (
                  <>
                    <div className="relative mb-3">
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre..."
                        value={busquedaProducto}
                        onChange={(e) => setBusquedaProducto(e.target.value)}
                        className="w-full border rounded-sm px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                      />
                      <Search size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    </div>

                    {busquedaProducto && (
                      <div className="max-h-60 overflow-y-auto border rounded-sm">
                        {productos
                          .filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()))
                          .map(producto => (
                            <button
                              key={producto.id_producto}
                              onClick={() => handleSeleccionarProducto(producto)}
                              className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b last:border-b-0 transition"
                            >
                              <div className="font-medium text-slate-800">{producto.nombre}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Stock: <span className="font-semibold">{formatStock(producto.stock_actual, producto.unidad_abrev || "")}</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white border-2 border-emerald-200 rounded-sm p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{productoSeleccionado.nombre}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Stock actual: <span className="font-bold text-emerald-600">{formatStock(productoSeleccionado.stock_actual, productoSeleccionado.unidad_abrev || "")}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        ID: {productoSeleccionado.id_producto} | Categoría: {productoSeleccionado.nombre_categoria || 'N/A'}
                      </div>
                    </div>
                    <button
                      onClick={() => setProductoSeleccionado(null)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-sm transition"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Sección 2: Tipo de Cambio */}
              {productoSeleccionado && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-sm p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                      2. Tipo de movimiento
                    </h3>

                    <div className="space-y-3">
                      {/* Radio: pérdida */}
                      <label className="flex items-start gap-3 p-3 border-2 rounded-sm cursor-pointer hover:bg-white transition"
                        style={{ borderColor: cambiaEstado ? '#10b981' : '#e2e8f0' }}>
                        <input
                          type="radio"
                          name="tipoCambio"
                          checked={cambiaEstado}
                          onChange={() => {
                            setCambiaEstado(true);
                            setCambiaApariencia(false);
                          }}
                          className="mt-1 w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            Registrar pérdida / producto dañado
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Úsalo cuando el producto se dañó, venció, se perdió o no se puede vender. Reduce el stock.
                          </div>
                        </div>
                      </label>

                      {/* Radio: transformación */}
                      <label className="flex items-start gap-3 p-3 border-2 rounded-sm cursor-pointer hover:bg-white transition"
                        style={{ borderColor: cambiaApariencia ? '#0ea5e9' : '#e2e8f0' }}>
                        <input
                          type="radio"
                          name="tipoCambio"
                          checked={cambiaApariencia}
                          onChange={() => {
                            setCambiaEstado(false);
                            setCambiaApariencia(true);
                          }}
                          className="mt-1 w-5 h-5 text-sky-600 focus:ring-sky-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            Transformar producto
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Úsalo cuando el producto pasa a otra presentación. Baja el origen y suma al producto destino.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Sección 3: Cantidad y Destino */}
                  {(cambiaEstado || cambiaApariencia) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-sm p-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">
                        3. Detalles del Cambio
                      </h3>

                      <div className="space-y-4">
                        {/* Cantidad */}
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">
                            Cantidad a procesar <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={isUnlimitedStock(productoSeleccionado.stock_actual) ? undefined : parseFloat(productoSeleccionado.stock_actual)}
                            value={cantidadCambio}
                            onChange={(e) => setCantidadCambio(e.target.value)}
                            placeholder="Ej: 5.5"
                            className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Máximo disponible: {formatStock(productoSeleccionado.stock_actual, productoSeleccionado.unidad_abrev || "")}
                          </p>
                        </div>

                        {/* Producto destino */}
                        {cambiaApariencia && (
                          <div className="relative">
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                              Producto destino <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={nombreDestino}
                                onChange={(e) => {
                                  setNombreDestino(e.target.value);
                                  setMostrarSugerenciasDestino(e.target.value.length > 0);
                                  setProductoDestinoSeleccionado(null);
                                }}
                                onFocus={() => setMostrarSugerenciasDestino(nombreDestino.length > 0)}
                                placeholder="Ej: Plátano maduro, Tomate maduro, mora procesada"
                                className="w-full border rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                              />
                              {productoDestinoSeleccionado && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                    Existe
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Sugerencias de productos existentes */}
                            {mostrarSugerenciasDestino && nombreDestino.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-sky-200 rounded-sm shadow-sm max-h-48 overflow-y-auto">
                                {productos.filter(p =>
                                  p.nombre.toLowerCase().includes(nombreDestino.toLowerCase()) &&
                                  p.id_producto !== productoSeleccionado?.id_producto
                                ).length > 0 ? (
                                  <>
                                    <div className="px-3 py-2 bg-sky-50 border-b border-sky-100 text-xs font-semibold text-sky-700">
                                      Productos existentes (se agregará al stock)
                                    </div>
                                    {productos
                                      .filter(p =>
                                        p.nombre.toLowerCase().includes(nombreDestino.toLowerCase()) &&
                                        p.id_producto !== productoSeleccionado?.id_producto
                                      )
                                      .map(producto => (
                                        <button
                                          key={producto.id_producto}
                                          onClick={() => handleSeleccionarProductoDestino(producto)}
                                          className="w-full text-left px-3 py-2 hover:bg-sky-50 border-b last:border-b-0 transition"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <div className="font-medium text-slate-800 text-sm">{producto.nombre}</div>
                                              <div className="text-xs text-slate-500">
                                                Stock actual: <span className="font-semibold">{formatStock(producto.stock_actual, producto.unidad_abrev || "")}</span>
                                              </div>
                                            </div>
                                            <span className="text-xs text-sky-600 font-medium">Seleccionar</span>
                                          </div>
                                        </button>
                                      ))}
                                  </>
                                ) : (
                                  <div className="px-3 py-3 text-center">
                                    <div className="text-amber-600 text-sm font-medium mb-1">
                                      Producto nuevo
                                    </div>
                                    <div className="text-xs text-slate-600">
                                      "{nombreDestino}" no existe. Se creará automáticamente.
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <p className="text-xs text-slate-500 mt-1">
                              {productoDestinoSeleccionado
                                ? `Se agregará ${cantidadCambio || '0'} unidades al stock de "${productoDestinoSeleccionado.nombre}"`
                                : 'Si el producto no existe, se creará automáticamente con los datos del origen.'
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer del modal */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
              <button
                onClick={handleCerrarModal}
                className="px-5 py-2 border border-slate-300 rounded-sm text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleInsertarMerma}
                disabled={insertando || !productoSeleccionado || (!cambiaEstado && !cambiaApariencia) || !cantidadCambio}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm transition flex items-center gap-2"
              >
                {insertando ? (
                  <>
                    <span className="inline-flex items-center justify-center">
                      <RefreshCw size={16} className="animate-spin" />
                    </span>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Registrar movimiento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {mermaEliminar && (
        <MermaConfirmDialog
          merma={mermaEliminar}
          onCancel={() => setMermaEliminar(null)}
          onConfirm={handleEliminarMerma}
        />
      )}
    </div>
  );
}

function MermaConfirmDialog({ merma, onCancel, onConfirm }) {
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
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-100 text-rose-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">Eliminar merma</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">
              Se eliminará el registro de merma y se restaurará el stock del producto.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Producto</span>
            <span className="max-w-[230px] truncate text-right font-black text-[#111827]">
              {merma.nombre_producto || "Producto"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-black uppercase tracking-wide text-[#47524e]">Cantidad</span>
            <span className="font-black text-[#111827]">{Number(merma.cantidad || 0).toFixed(2)}</span>
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
            className="rounded-sm bg-[#b91c1c] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
          >
            Eliminar y restaurar
          </button>
        </div>
      </div>
    </div>
  );
}
