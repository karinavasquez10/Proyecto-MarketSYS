import { apiFetch, apiJson } from "../api";

const formatLabel = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toMovimientoView = (movimiento) => {
  const tipo = movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso";
  const categoria = movimiento.categoria || "otro";
  const tercero = movimiento.nombre_cliente || movimiento.nombre_proveedor || "";
  const descripcionBase = movimiento.observacion || formatLabel(categoria);

  return {
    ...movimiento,
    id: movimiento.id_movimiento_financiero,
    fecha: movimiento.fecha,
    tipo,
    categoria,
    categoriaLabel: formatLabel(categoria),
    descripcion: tercero ? `${descripcionBase} - ${tercero}` : descripcionBase,
    monto: Number(movimiento.monto || 0),
    metodo: formatLabel(movimiento.metodo_pago || "otro"),
    usuario: movimiento.nombre_usuario || "Sin usuario",
  };
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const listarMovimientosFinancieros = async (params = {}) => {
  const data = await apiJson(`/movimientos-financieros${buildQuery(params)}`);
  return Array.isArray(data) ? data.map(toMovimientoView) : [];
};

export const crearMovimientoFinanciero = (movimiento) =>
  apiFetch("/movimientos-financieros", {
    method: "POST",
    body: JSON.stringify(movimiento),
  });
