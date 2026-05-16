import { apiFetch, apiJson } from "../api";

export const listarMovimientosInventario = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ).toString();

  return apiJson(`/movimientos-inventario${query ? `?${query}` : ""}`);
};

export const ajustarInventarioProducto = (ajuste) =>
  apiFetch("/movimientos-inventario/ajuste", {
    method: "POST",
    body: JSON.stringify(ajuste),
  });
