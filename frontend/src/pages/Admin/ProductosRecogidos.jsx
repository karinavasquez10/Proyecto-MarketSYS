import React, { useState, useEffect } from "react";
import { PackageSearch, CalendarRange, AlertTriangle, RefreshCw, Trash2, Plus, X, Search } from "lucide-react";

const API = (() => {
  try {
    const RAW_API_URL = import.meta.env.VITE_API_URL || "";
    let u = RAW_API_URL || "http://localhost:5000";
    u = u.replace(/\/+$/, "");
    if (!u.endsWith("/api")) u = u + "/api";
    return u;
  } catch {
    return "http://localhost:5000/api";
  }
})();

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

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("authUser") || "null");
    } catch {
      return null;
    }
  })();

  const id_usuario = storedUser?.id;

  // Cargar productos al abrir el modal
  const cargarProductos = async () => {
    try {
      const response = await fetch(`${API}/products/productos`);
      if (response.ok) {
        const data = await response.json();
        // Filtrar solo productos activos con stock
        const productosDisponibles = data.filter(p => p.estado === 1 && parseFloat(p.stock_actual || 0) > 0);
        setProductos(productosDisponibles);
      }
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

    if (cantidad > parseFloat(productoSeleccionado.stock_actual)) {
      setMensaje({ tipo: 'error', texto: `Stock insuficiente. Disponible: ${productoSeleccionado.stock_actual}` });
      return;
    }

    if (cambiaApariencia && !nombreDestino.trim()) {
      setMensaje({ tipo: 'error', texto: 'Debe especificar el nombre del producto destino para cambio de apariencia.' });
      return;
    }

    setInsertando(true);
    setMensaje(null);

    try {
      // CASO 1: Cambio de estado (vencimiento) - Registrar merma
      if (cambiaEstado) {
        const responseMerma = await fetch(`${API}/mermas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_producto: productoSeleccionado.id_producto,
            cantidad: cantidad,
            motivo: 'Cambio de estado manual (vencimiento/deterioro)',
            id_usuario: id_usuario
          })
        });

        if (!responseMerma.ok) {
          throw new Error('Error al registrar merma');
        }
      }

      // CASO 2: Cambio de apariencia (transformación)
      if (cambiaApariencia) {
        const responseTransformacion = await fetch(`${API}/mermas/transformar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_producto_origen: productoSeleccionado.id_producto,
            nombre_producto_destino: nombreDestino.trim(),
            cantidad: cantidad,
            crear_nuevo: true,
            id_usuario: id_usuario
          })
        });

        if (!responseTransformacion.ok) {
          throw new Error('Error al realizar transformación');
        }
      }

      setMensaje({
        tipo: 'success',
        texto: `Merma registrada exitosamente. ${cambiaEstado ? 'Stock reducido.' : ''} ${cambiaApariencia ? `Producto transformado a "${nombreDestino}".` : ''}`
      });

      handleCerrarModal();
      handleConsultar(); // Recargar mermas

    } catch (error) {
      console.error('Error al insertar merma:', error);
      setMensaje({ tipo: 'error', texto: 'Error al registrar la merma.' });
    } finally {
      setInsertando(false);
    }
  };

  const handleConsultar = async () => {
    setLoading(true);
    setMensaje(null);
    setPaginaActual(1); // Resetear a página 1 al consultar
    
    try {
      let url = `${API}/mermas`;
      
      // Si hay fechas, usar endpoint con rango, si no, obtener todas
      if (fechaInicial && fechaFinal) {
        url = `${API}/mermas/rango?fechaInicial=${fechaInicial}&fechaFinal=${fechaFinal}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al obtener mermas');
      }
      
      const data = await response.json();
      setResultados(data);
      
      if (data.length === 0) {
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

  const handleEliminarMerma = async (id_merma) => {
    if (!window.confirm('¿Está seguro de eliminar esta merma? Se restaurará el stock del producto.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API}/mermas/${id_merma}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_usuario }),
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar merma');
      }
      
      setMensaje({
        tipo: 'success',
        texto: 'Merma eliminada y stock restaurado correctamente.'
      });
      
      // Recargar resultados
      handleConsultar();
      
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
    <div className="p-4 sm:p-14 w-full max-w-[calc(150%-16rem)] mt-0">
      {/* ===== Encabezado ===== */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-2.5 rounded-lg text-white shadow-md">
            <PackageSearch size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Gestión de Mermas
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Productos vencidos y cambios de estado
            </p>
          </div>
        </div>
        
        <button
          onClick={handleAbrirModal}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium px-4 py-2.5 rounded-lg text-sm shadow-md transition flex items-center gap-2"
        >
          <Plus size={16} />
          Insertar Merma
        </button>
      </div>

      {/* ===== Mensaje de alerta ===== */}
      {mensaje && (
        <div className={`mb-6 p-4 rounded-lg border ${
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

      {/* ===== Filtros ===== */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
          <CalendarRange size={18} className="text-orange-500" />
          Parámetros de consulta
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha inicial
            </label>
            <input
              type="date"
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Fecha final
            </label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
            />
          </div>

          <div className="flex sm:justify-end">
            <button
              onClick={handleConsultar}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-md text-sm shadow-sm transition"
            >
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Resultados ===== */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-slate-700">
            Lista de mermas ({resultados.length})
          </h2>
          <span className="text-xs text-slate-500">
            {fechaInicial} - {fechaFinal}
          </span>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-2 py-2 text-left whitespace-nowrap w-[90px]">Fecha</th>
                <th className="px-2 py-2 text-left whitespace-nowrap w-[100px]">Usuario</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">Producto</th>
                <th className="px-2 py-2 text-center whitespace-nowrap w-[80px]">Código</th>
                <th className="px-2 py-2 text-right whitespace-nowrap w-[80px]">Cantidad</th>
                <th className="px-2 py-2 text-right whitespace-nowrap w-[90px]">P. Venta</th>
                <th className="px-2 py-2 text-right whitespace-nowrap w-[100px]">Pérdida</th>
                <th className="px-2 py-2 text-left whitespace-nowrap max-w-[150px]">Motivo</th>
                <th className="px-2 py-2 text-center whitespace-nowrap w-[70px]">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center text-slate-400 py-6 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Cargando mermas...
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
                      className="hover:bg-slate-50 transition duration-150"
                    >
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {new Date(item.fecha).toLocaleDateString('es-CO', { month: '2-digit', day: '2-digit' })}
                      </td>
                      <td className="px-2 py-2 text-xs truncate max-w-[100px]" title={item.nombre_usuario || 'Sistema'}>
                        {(item.nombre_usuario || 'Sistema').split(' ')[0]}
                      </td>
                      <td className="px-2 py-2 font-medium text-slate-700 text-xs truncate max-w-[150px]" title={item.nombre_producto}>
                        {item.nombre_producto}
                      </td>
                      <td className="px-2 py-2 text-slate-500 text-xs text-center">
                        {item.codigo || 'N/A'}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-xs">
                        {cantidad.toFixed(1)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        ${precioVenta.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-red-600 text-xs">
                        ${perdidaTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-2 text-slate-600 text-xs truncate max-w-[150px]" title={item.motivo}>
                        {item.motivo || 'Sin especificar'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleEliminarMerma(item.id_merma)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition"
                          title="Eliminar merma y restaurar stock"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center text-slate-400 py-6 text-sm"
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
            <div className="text-sm text-slate-600">
              Mostrando {((paginaActual - 1) * itemsPorPagina) + 1} - {Math.min(paginaActual * itemsPorPagina, resultados.length)} de {resultados.length} mermas
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                ← Anterior
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(resultados.length / itemsPorPagina) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setPaginaActual(page)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      paginaActual === page 
                        ? 'bg-orange-500 text-white font-semibold' 
                        : 'border hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setPaginaActual(prev => Math.min(prev + 1, Math.ceil(resultados.length / itemsPorPagina)))}
                disabled={paginaActual === Math.ceil(resultados.length / itemsPorPagina)}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
        
        {resultados.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                <span className="text-sm font-semibold text-red-800">
                  Resumen de pérdidas
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-red-600">Total de mermas</div>
                <div className="text-xl font-bold text-red-700">
                  ${resultados.reduce((sum, item) => {
                    return sum + (parseFloat(item.cantidad || 0) * parseFloat(item.precio_venta || 0));
                  }, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal Insertar Merma ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={24} />
                <div>
                  <h2 className="text-xl font-bold">Insertar Merma Manual</h2>
                  <p className="text-sm text-emerald-50">Registrar cambio de estado o apariencia de productos</p>
                </div>
              </div>
              <button
                onClick={handleCerrarModal}
                className="hover:bg-white/20 p-2 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-6">
              {/* Sección 1: Selección de Producto */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
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
                        className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                      />
                      <Search size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    </div>

                    {busquedaProducto && (
                      <div className="max-h-60 overflow-y-auto border rounded-lg">
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
                                Stock: <span className="font-semibold">{parseFloat(producto.stock_actual).toFixed(2)}</span> {producto.unidad_abrev || ''}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white border-2 border-emerald-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{productoSeleccionado.nombre}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Stock actual: <span className="font-bold text-emerald-600">{parseFloat(productoSeleccionado.stock_actual).toFixed(2)}</span> {productoSeleccionado.unidad_abrev || ''}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        ID: {productoSeleccionado.id_producto} | Categoría: {productoSeleccionado.nombre_categoria || 'N/A'}
                      </div>
                    </div>
                    <button
                      onClick={() => setProductoSeleccionado(null)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Sección 2: Tipo de Cambio */}
              {productoSeleccionado && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                      2. Tipo de Cambio
                    </h3>

                    <div className="space-y-3">
                      {/* Radio: Cambio de Estado */}
                      <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition"
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
                            🔴 Cambio de Estado (Vencimiento/Deterioro)
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            El producto se vence o deteriora. Se registrará una merma y se reducirá el stock.
                          </div>
                        </div>
                      </label>

                      {/* Radio: Cambio de Apariencia */}
                      <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition"
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
                            🔄 Cambio de Apariencia (Transformación)
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            El producto se transforma en otro. Se reducirá el stock del origen y se agregará al destino.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Sección 3: Cantidad y Destino */}
                  {(cambiaEstado || cambiaApariencia) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
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
                            max={parseFloat(productoSeleccionado.stock_actual)}
                            value={cantidadCambio}
                            onChange={(e) => setCantidadCambio(e.target.value)}
                            placeholder="Ej: 5.5"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Máximo disponible: {parseFloat(productoSeleccionado.stock_actual).toFixed(2)} {productoSeleccionado.unidad_abrev || ''}
                          </p>
                        </div>

                        {/* Nombre destino (solo si cambia apariencia) */}
                        {cambiaApariencia && (
                          <div className="relative">
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                              Nombre del producto destino <span className="text-red-500">*</span>
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
                                placeholder="Ej: Plátano maduro, Tomate maduro, etc."
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                              />
                              {productoDestinoSeleccionado && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                    ✓ Existe
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Sugerencias de productos existentes */}
                            {mostrarSugerenciasDestino && nombreDestino.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-sky-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
                                                Stock actual: <span className="font-semibold">{parseFloat(producto.stock_actual).toFixed(2)}</span> {producto.unidad_abrev || ''}
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
                                      ⚠️ Producto nuevo
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
                                ? `✓ Se agregará ${cantidadCambio || '0'} unidades al stock de "${productoDestinoSeleccionado.nombre}"`
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
                className="px-5 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleInsertarMerma}
                disabled={insertando || !productoSeleccionado || (!cambiaEstado && !cambiaApariencia) || !cantidadCambio}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
              >
                {insertando ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Registrar Merma
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}